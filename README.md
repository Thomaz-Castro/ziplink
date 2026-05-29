# ZipLink — Encurtador de URL de Alta Performance

> Stack: **Fastify + TypeScript · PostgreSQL · Redis · BullMQ · Vue 3 · Docker**

---

## Início Rápido (< 5 minutos)

### Pré-requisitos
- Docker ≥ 24 e Docker Compose v2  
- `git clone` neste repositório

### 1. Configurar variáveis de ambiente

```bash
cp .env.example .env
# Edite .env se quiser trocar senhas/secrets (opcional para dev local)
```

### 2. Subir tudo

```bash
docker compose up --build
```

Aguarde as mensagens:

```
ziplink_api    | ZipLink API running on port 3000
ziplink_worker | Batch worker ready and listening for jobs
```

### 3. Abrir o app

Tudo em **uma única porta — http://localhost** via nginx reverso:

| Path                        | O que faz                             |
|-----------------------------|---------------------------------------|
| `http://localhost/`         | Frontend Vue (SPA)                    |
| `http://localhost/api/`     | API REST (auth, links, batch)         |
| `http://localhost/queues`   | Bull Board — painel de filas          |
| `http://localhost/<slug>`   | Redirecionamento (`302`)              |
| `http://localhost/health`   | Health check da API                   |

> Internamente cada serviço ainda tem sua porta (`api:3000`, `frontend:5173`),
> mas **nenhuma** é exposta ao host — só o nginx ouve na 80.

### 4. Criar conta e usar

1. Abra http://localhost/register
2. Crie uma conta
3. Comece a encurtar links

---

## Referência da API

Todas as rotas da API têm o prefixo `/api`.

### Autenticação

```bash
# Register
curl -X POST http://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret123"}'

# Login
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret123"}'
```

### CRUD de Links

```bash
TOKEN="<jwt from login>"

# Create
curl -X POST http://localhost/api/links \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"original_url":"https://example.com/very-long-path","slug":"myslug","title":"My Link"}'

# List
curl http://localhost/api/links \
  -H "Authorization: Bearer $TOKEN"

# Update
curl -X PATCH http://localhost/api/links/<id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"active":false}'

# Delete
curl -X DELETE http://localhost/api/links/<id> \
  -H "Authorization: Bearer $TOKEN"
```

### Redirecionamento

```
GET http://localhost/<slug>
→ 302 para a URL original
```

Caminho com Cache-hit: Apenas Redis (sub-milissegundo).  
Caminho com Cache-miss: PostgreSQL → preenche Redis → redireciona.

### Importação em Lote (Batch)

```bash
# CSV format: url,slug,title
cat > links.csv <<'EOF'
url,slug,title
https://example.com/a,,First link
https://example.com/b,custom-b,Second link
EOF

curl -X POST http://localhost/api/batch \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@links.csv"
# → 202 Accepted {"job_id":"..."}

# Consultar status do job
curl http://localhost/api/batch/<job_id> \
  -H "Authorization: Bearer $TOKEN"
```

---

## Teste de Carga com Locust

### Configuração

```bash
cd tests/locust
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Executar (headless — alvo de 500+ req/s)

```bash
locust -f locustfile.py \
  --headless \
  --users 600 \
  --spawn-rate 60 \
  --run-time 90s \
  --host http://localhost \
  --html report.html
```

Principais flags:
- `-u 600` — 600 usuários simultâneos
- `-r 60` — adiciona 60 usuários/segundo (ramp up)
- `-t 90s` — executa por 90 segundos (60s de estado estável após 10s de ramp up)

### Executar com dashboard (interativo)

```bash
locust -f locustfile.py --host http://localhost
```
Abra http://localhost:8089 → defina Users=600, Spawn rate=60 → Start.

### Resultados esperados (Docker local, máquina de 8 núcleos)

| Métrica          | Alvo         |
|------------------|--------------|
| Requições/seg    | ≥ 500        |
| Latência p50     | < 10 ms      |
| Latência p95     | < 50 ms      |
| Taxa de erro     | < 0.1%       |

> Se a taxa de transferência (throughput) estiver abaixo do alvo: aumente o `maxmemory` do Redis, verifique
> os recursos usando `docker stats` ou aumente `WORKER_CONCURRENCY`.

---

## Estrutura do Projeto

```
ziplink/
├── backend/
│   └── src/
│       ├── config/         # DB, Redis, env, SQL migrations
│       ├── controllers/    # Route handlers (auth, links, batch, redirect)
│       ├── middleware/     # JWT authentication
│       ├── queues/         # BullMQ queue definitions
│       ├── services/       # Business logic
│       ├── utils/          # Slug generator, URL validator
│       ├── workers/        # Batch import worker
│       └── server.ts       # Fastify app entry
├── frontend/
│   └── src/
│       ├── api/            # Axios client + typed API calls
│       ├── stores/         # Pinia state (auth)
│       ├── router/         # Vue Router guards
│       └── views/          # LoginView, LinksView, BatchView, StatsView
├── nginx/
│   └── dev.conf            # Reverse proxy — single port 80
├── infra/
│   └── terraform/          # AWS Free Tier EC2 deployment
├── tests/
│   └── locust/             # Load test scripts
└── docker-compose.yml
```

---

## Variáveis de Ambiente

| Variável              | Padrão                  | Descrição                     |
|-----------------------|-------------------------|-------------------------------|
| `DATABASE_URL`        | (container postgres)    | String de conexão do PostgreSQL |
| `REDIS_URL`           | (container redis)       | String de conexão do Redis    |
| `JWT_SECRET`          | (definido no .env)      | Chave JWT (mínimo 32 caracteres)|
| `BASE_URL`            | `http://localhost`      | URL base pública para links curtos|
| `BCRYPT_ROUNDS`       | `10`                    | Fator de custo do bcrypt      |
| `WORKER_CONCURRENCY`  | `5`                     | Jobs paralelos por worker     |

Copie `.env.example` para `.env` — todas as variáveis já têm valores padrão para dev local.

---

## Deploy na AWS (Nível Gratuito / Free Tier)

```bash
cd infra/terraform

# Inicializar
terraform init

# Visualizar plano (Preview)
terraform plan \
  -var="jwt_secret=change_me_in_production_32chars" \
  -var="postgres_password=str0ng_password"

# Aplicar
terraform apply \
  -var="jwt_secret=mude_isso_em_producao_32_chars" \
  -var="postgres_password=senha_fort3"
```

O Terraform cria: VPC, Subnet, Security Group, EC2 t3.micro, Elastic IP.  
A instância executa `docker compose up` na primeira inicialização através do `user_data.sh`.

> **Nota sobre o Nível Gratuito:** t3.micro dá 750 horas/mês gratuitas por 12 meses.
> O Elastic IP é gratuito enquanto estiver anexado a uma instância em execução.
