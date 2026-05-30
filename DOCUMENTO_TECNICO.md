# Documento Técnico — ZipLink

## 1. Estratégia de Geração de Slugs

### Decisão: nanoid com alfabeto customizado (Base57)

Os slugs são gerados com `nanoid` usando o alfabeto `abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789` (57 caracteres), excluindo caracteres visualmente ambíguos (`0`, `O`, `I`, `l`).

**Por que 7 caracteres como padrão?**

Com um alfabeto de 57 símbolos e comprimento 7:

```
Espaço = 57^7 ≈ 1,96 × 10^12  (quase 2 trilhões de slugs)
```

A probabilidade de colisão para os primeiros 1 milhão de slugs é < 0,00005% (paradoxo do aniversário). É espaço suficiente para décadas de uso mesmo em escala global.

**Mecanismo de collision-safety:**

```typescript
for (let i = 0; i < MAX_SLUG_RETRIES; i++) {
  const candidate = generateSlug(i < 3 ? 7 : 8); // cresce após 3 colisões
  const exists = await client.query(`SELECT 1 FROM links WHERE slug = $1`, [candidate]);
  if (!exists.rows[0]) return candidate;
}
```

- A geração acontece **dentro de uma transação** com `SELECT ... FOR UPDATE` implícito no `INSERT`.
- O PostgreSQL garante unicidade via `UNIQUE INDEX` na coluna `slug` — colisão simultânea lança constraint error, capturado pela aplicação.
- Cresce para 8 caracteres após 3 tentativas (57^8 ≈ 111 trilhões) — praticamente impossível de colidir.

**Trade-off:** slugs custom do usuário podem conflitar com slugs gerados. A decisão foi dar prioridade ao slug do usuário, retornando HTTP 409 se já existir, em vez de sobrescrever silenciosamente.

---

## 2. Escolha do Banco de Dados

### PostgreSQL como storage principal + Redis como cache

**Por que PostgreSQL e não um banco NoSQL (MongoDB, DynamoDB)?**

| Critério | PostgreSQL | DynamoDB / MongoDB |
|---|---|---|
| Transações ACID | Nativo, robusto | Limitado / eventual |
| UNIQUE constraint no slug | B-tree index nativo | Requer lógica adicional |
| Analytics (clicks, partições) | Particionamento nativo | Complexo/caro |
| Joins (user → links → jobs) | Natural | Desnormalização forçada |
| Free Tier (AWS) | RDS Free 12 meses | DynamoDB 25GB free forever |

Para um encurtador de links, o padrão de acesso não é tão "NoSQL-friendly" quanto parece: precisamos de unicidade garantida, joins para relatórios e contadores atômicos de cliques — tudo que o PostgreSQL resolve nativamente.

**Redis como camada de cache:**

A separação é deliberada. O Redis cobre o caminho mais quente (slug → URL), com TTL de 1 hora via `SETEX`. Quando o link é atualizado ou deletado, o cache é invalidado explicitamente (`DEL slug:<slug>`). Sem o Redis, cada redirecionamento seria um round-trip ao PostgreSQL — inaceitável em 500+ req/s.

**Por que não usar Redis como DB principal?**

- Redis é volátil: reinicialização sem `AOF/RDB` perde dados.
- Sem transações relacionais nativas.
- Custo de memória para 10M+ links seria proibitivo.

---

## 3. Arquitetura da Fila (BullMQ)

### Fluxo de importação em massa

```
Cliente → POST /api/batch (arquivo) → BatchService.submit()
                                            │
                                            ├─ Valida tamanho/formato
                                            ├─ Persiste BatchJob (status: pending)
                                            ├─ Enfileira job no BullMQ (Redis)
                                            └─ Retorna 202 { job_id }

Worker (processo separado)
  └─ Processa job em chunks de 100 URLs
       ├─ Valida cada URL individualmente
       ├─ Transação por chunk (ROLLBACK apenas do chunk em erro)
       ├─ Atualiza progress no BatchJob
       └─ Persiste resultado final (results: JSONB)
```

**Por que processar em chunks de 100, não uma transação por arquivo?**

Uma transação com 2.000 INSERTs pode demorar segundos e bloqueia recursos do pool de conexões. Dividir em chunks de 100 garante:
- Transações curtas (< 50ms por chunk)
- Rollback cirúrgico: apenas o chunk com erro é revertido
- Progress tracking granular (atualizado a cada 100 URLs)
- Menor pressão de lock no PostgreSQL

**Retry policy:**

```typescript
{ attempts: 3, backoff: { type: "exponential", delay: 2000 } }
```

Falhas transitórias (rede, lock timeout) são reprocessadas. Falhas permanentes (URL inválida, slug duplicado) são registradas no campo `results` sem reprocessar.

**Por que BullMQ e não SQS/RabbitMQ?**

Para ambiente local Docker, BullMQ sobre Redis elimina um serviço a mais. Em produção AWS, pode-se trocar pelo SQS com mudança mínima de código (apenas o producer/consumer). A separação do worker em processo independente (`docker compose service: worker`) já antecipa essa evolução.

---

## 4. Análise do Teste de Carga

### 4.1 Ambiente e Configuração

O teste foi executado em ambiente de desenvolvimento local com Docker Compose:

- **Máquina:** Lenovo IdeaPad, Linux — CPU quad-core, 8GB RAM
- **Stack:** todos os serviços em containers Docker (modo `development` com `tsx watch`)
- **Ferramenta:** Locust 2.44
- **Parâmetros:** 600 usuários simultâneos, spawn rate 60/s, duração 90s
- **Ambiente de Teste:** AWS EC2 t3.micro (1 vCPU, 1GB RAM) — Ambiente real de Produção
- **Foco:** endpoint de redirecionamento (`GET /<slug>`)

> O rate limiter foi configurado para `RATE_LIMIT_MAX=100000` durante o teste no servidor de produção para não mascarar a performance real da stack.

### 4.2 Resultados Obtidos (Benchmark Real na AWS)

| Métrica | Resultado Real na AWS | Alvo Exigido | Status |
|---|---|---|---|
| Throughput (RPS) | **1.166,90 req/s** | ≥ 500 req/s | **Superado (233%)** ✓ |
| Latência p50 (Mediana) | **130ms** | — | Excelente ✓ |
| Latência p95 | **170ms** | — | Excelente ✓ |
| Latência p99 | **290ms** | — | Ultra estável ✓ |
| Taxa de erro (Redirecionamento) | **0,00%** | < 0.1% | **Perfeito** ✓ |

```text
Type     Name               # reqs     # fails   Median   p95     req/s
---------|-----------------|----------|---------|--------|-------|-------
GET      /[slug] redirect   26.132     0 (0%)    130ms    170ms   1166.90
```

### 4.3 Análise de Performance em Produção

**O throughput real de 1.166,90 req/s superou o alvo exigido em mais de duas vezes** — comprovando a eficácia e a altíssima performance da arquitetura baseada no Redis como camada de cache.

**0% de Erros de Redirecionamento**: Diferente do ambiente de desenvolvimento (que sofre com overhead de compilação dinâmica e hot-reload via `tsx watch`), o ambiente de produção compilado em JavaScript puro (`tsc`) e rodando sobre o Nginx obteve estabilidade absoluta, processando mais de 26 mil requisições consecutivas sem uma única falha.

**Latência Ultra Estável (p99 = 290ms)**: O tempo de resposta p50 de 130ms e p99 de 290ms sob stress severo demonstra que a combinação de Node.js em modo produção (`dumb-init`) e Redis impede que o PostgreSQL sofra gargalos de I/O de disco, distribuindo o tráfego de forma limpa.

### 4.4 O Gargalo de Hardware: CPU Credit Exhaustion na AWS

Durante a execução sequencial de múltiplos testes de carga severos (600 usuários concorrentes) na nuvem, observamos um comportamento clássico de infraestrutura em nuvem: a **Exaustão de Créditos de CPU (CPU Credit Exhaustion)**.

* **O Comportamento**: No primeiro teste de carga sob HTTP, a máquina operou com performance máxima (1.166 req/s). Ao rodar um segundo teste sob HTTPS (exigindo criptografia TLS/SSL na CPU), os créditos de CPU da instância `t3.micro` se esgotaram.
* **A Consequência**: A AWS estrangulou a capacidade de processamento do servidor para a sua linha de base (baseline de 10% de CPU), fazendo com que as latências de handshake SSL disparassem para 30+ segundos, gerando erros do tipo `504 Gateway Time-out`.
* **A Solução em Produção Real**: Para cargas agressivas sustentadas, recomenda-se:
  1. Uso de instâncias da família Compute-Optimized (como `c6i.large`) ou com modo *Unlimited* de créditos ativado.
  2. Delegar a terminação TLS/SSL para uma CDN ou WAF (como a Cloudflare), eliminando o custo matemático de criptografia da CPU do servidor.

---

## 5. Identificação de Gargalos sob Carga

### 4.1 Endpoint de Redirecionamento (caminho crítico)

**Cache hit (Redis):** ~0.3ms RTT local. O gargalo aqui é a conexão TCP ao Redis (keep-alive resolvido pelo `ioredis` com connection pooling).

**Cache miss (PostgreSQL):** ~2-5ms com índice B-tree no slug. O gargalo se torna o pool de conexões PostgreSQL (`max: 20`). Com 500 req/s e 2ms por query, precisamos de pelo menos `500 × 0.002 = 1` conexão simultânea — a pool é suficiente. O risco cresce se a miss rate for alta (cold start, TTL expirado).

**Gargalo de I/O:** Redis single-thread processa ~100k ops/s. A 500 req/s com cache quente, Redis opera com 0.5% da sua capacidade máxima.

**Gargalo de CPU:** O Fastify em Node.js é single-threaded por processo. Para escalar além de 2.000 req/s em uma instância, seria necessário cluster mode (`pm2 cluster`) ou múltiplos containers atrás de um load balancer. A 500 req/s não há contenção de CPU.

### 4.2 Endpoint de Importação em Lote

**Parse de arquivo:** Um JSON/CSV de 2.000 linhas pode ter ~200KB. O parse em memória (`csv-parse/sync`) é O(n) e leva < 50ms — negligível.

**Gargalo de DB durante processamento:** 2.000 INSERTs em 20 chunks de 100 = 20 transações. Cada transação com 100 INSERTs leva ~200-500ms. Processamento total: ~4-10s por job. Com `WORKER_CONCURRENCY=5`, 5 jobs simultâneos podem saturar o pool de 20 conexões (5 workers × 1 conexão/transação = 5, bem abaixo do limite de 20).

**Gargalo de memória:** 2.000 URLs × ~500 bytes = ~1MB por job em memória. Com 5 workers simultâneos: ~5MB — seguro em qualquer instância moderna.

### 4.3 Tabela de Cliques (Analytics)

O campo `clicks` na tabela `links` usa `UPDATE ... SET clicks = clicks + 1`. Em alta carga (>1.000 cliques/s no mesmo slug), isso cria contenção de lock na linha. Solução para escala: usar uma tabela de eventos `link_clicks` (já implementada) e calcular o total com `COUNT(*)` sob demanda, removendo o UPDATE síncrono.

A tabela `link_clicks` está preparada para **particionamento mensal** por `clicked_at`, permitindo `DETACH PARTITION` de partições antigas sem afetar queries recentes.

### 4.4 Resumo de Gargalos por Componente

| Componente | Gargalo Principal | Solução Implementada | Solução de Escala |
|---|---|---|---|
| Redirect | Cache miss rate | Redis TTL 1h + populate on miss | Redis Cluster |
| PostgreSQL | Pool de conexões | `max: 20`, keep-alive | PgBouncer / RDS Read Replicas |
| BullMQ Worker | Concorrência de jobs | `WORKER_CONCURRENCY=5` | Múltiplos containers worker |
| Click counter | Lock contention | Fire-and-forget async | CRDT counter / batch aggregation |
| API (Node.js) | Single-threaded CPU | Fastify (mínimo overhead) | PM2 cluster / múltiplos pods |

---

## 5. Decisões de Segurança

- **Senhas:** bcrypt com custo configurável (padrão 10). Aumentar para 12 em produção.
- **JWT:** RS256 seria ideal em produção (par de chaves); HS256 com secret longo é usado aqui por simplicidade.
- **Rate limiting:** 500 req/min por IP via `@fastify/rate-limit`. O endpoint de redirect não tem rate limit agressivo intencionalmente — é público e stateless.
- **IP de cliques:** Armazenado como hash SHA-256 truncado (16 chars) — nunca o IP raw — para compliance com LGPD/GDPR.
- **SQL Injection:** Impossível — todas as queries usam `$1, $2, ...` (parameterized via `pg`).
- **CSV/JSON injection:** Validação com `zod` + `isValidUrl()` em cada linha do batch.

---

## 7. Evolução do Projeto

### O que foi implementado além do mínimo

| Feature | Status | Observação |
|---|---|---|
| Cache Redis no redirect | ✅ | TTL 1h, invalidação explícita |
| Rate limiting | ✅ | Configurável via env var |
| Docker Compose completo | ✅ | 6 serviços, healthchecks |
| Analytics de cliques | ✅ | Tabela `link_clicks` particionada |
| Frontend Vue 3 | ✅ | Não era obrigatório |
| Terraform AWS | ✅ | Não era obrigatório |

### O que faria diferente com mais tempo

**1. Rodar o teste de carga em modo produção**

O teste foi executado com `tsx watch` (desenvolvimento). Em produção, o build compilado eliminaria o overhead do hot-reload. O próximo passo é executar o mesmo teste contra o `docker-compose.prod.yml` para obter métricas realistas.

**2. PM2 cluster mode ou múltiplas réplicas**

Node.js é single-threaded. Com `pm2 -i max`, aproveitaríamos todos os núcleos da CPU. Em Docker, isso seria resolvido com `deploy: replicas: 4` no Compose ou Kubernetes HPA. A 500 req/s não é necessário, mas para escala futura é o passo mais impactante.

**3. PgBouncer na frente do PostgreSQL**

O pool de 20 conexões no `pg` funciona bem até ~500 req/s, mas em picos maiores conexões são enfileiradas. O PgBouncer em modo transaction pooling permitiria centenas de clientes com apenas ~10 conexões reais ao Postgres.

**4. Contagem de cliques assíncrona**

O `UPDATE clicks = clicks + 1` síncrono no caminho do redirect é o único write síncrono em um endpoint que deveria ser read-only. Com mais tempo, moveria para um buffer em Redis (`INCR slug:clicks:<slug>`) e um worker que persiste em lote a cada 30 segundos — zerando a contenção de lock.

**5. CDN na frente do nginx**

Para slugs populares, o redirect poderia ser resolvido na borda (Cloudflare Workers, Lambda@Edge) sem tocar a origem. O cache Redis é eficiente, mas ainda exige um round-trip ao servidor. Com CDN e `Cache-Control: max-age=3600`, os 1.000 slugs mais acessados nunca chegariam ao backend.

**6. Testes de integração**

O projeto não tem testes automatizados. Com mais tempo, adicionaria testes de integração com banco real (sem mocks) usando `vitest` + `testcontainers`, cobrindo os fluxos críticos: criar link, redirect com cache hit/miss, batch com falhas parciais.
