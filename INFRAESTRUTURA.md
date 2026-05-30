# 🛠️ Documentação da Infraestrutura & Deploy — ZipLink

Este documento descreve toda a infraestrutura na nuvem da AWS projetada para o **ZipLink**, bem como o guia passo a passo para gerenciar, atualizar e destruir os recursos usando o **Terraform**.

---

## 🏗️ Arquitetura da Infraestrutura

A infraestrutura foi desenhada para se enquadrar 100% no **Nível Gratuito da AWS (Free Tier)**, garantindo custo zero e excelente segurança:

```mermaid
graph TD
    subgraph VPC ["AWS Cloud - VPC (Virtual Private Cloud)"]
        subgraph Subnet ["Subnet Pública (Zona us-east-1a)"]
            EIP["Elastic IP (IP Fixo Público)"] <--> EC2["Servidor EC2 (t3.micro - 30GB gp3)"]
            SG["Security Group (Firewall)"] -.-> EC2
        end
        IGW["Internet Gateway"] <--> Subnet
    end
    Internet((Internet)) <--> IGW
```

### Componentes Criados:
1. **VPC (Virtual Private Cloud)**: Rede lógica isolada (`10.0.0.0/16`).
2. **Subnet Pública**: Sub-rede (`10.0.1.0/24`) com mapeamento de IP público ativado.
3. **Internet Gateway (IGW)**: Permite a entrada e saída de tráfego de internet da VPC.
4. **Security Group (SG)**: Firewall restrito liberando apenas as portas:
   * `80` (HTTP) — Acesso público ao encurtador.
   * `443` (HTTPS) — Tráfego seguro futuro.
   * `22` (SSH) — Acesso administrativo seguro via chaves.
5. **Elastic IP (EIP)**: Endereço IP público fixo e estático associado à máquina.
6. **Instância EC2 (`t3.micro`)**: Servidor virtual com disco de **30 GB gp3** (limite máximo do Free Tier de EBS) rodando Amazon Linux 2023.
7. **SSM Managed Role**: Perfil IAM associado à máquina para permitir administração remota segura pela AWS caso necessário.

---

## ⚙️ Variáveis de Deploy

O Terraform aceita as seguintes variáveis de configuração (`infra/terraform/variables.tf`):

| Variável | Descrição | Padrão | Obrigatória? |
|----------|-----------|--------|--------------|
| `aws_region` | Região da AWS para o deploy | `"us-east-1"` | Não |
| `project_name` | Prefixo de nomenclatura dos recursos | `"ziplink"` | Não |
| `jwt_secret` | Chave de segurança para assinatura de tokens JWT | *Sem padrão* | **Sim (min. 32 chars)** |
| `postgres_password` | Senha interna para o banco PostgreSQL | `"change_me_in_prod"` | Não |
| `domain_name` | Domínio personalizado (ex: `meulink.com`) | `""` (usa IP fixo) | Não |

---

## 🚀 Guia de Operação (Passo a Passo)

Sempre execute os comandos a partir da pasta de infraestrutura:
```bash
cd infra/terraform
```

### 1. Inicializar o ambiente
Baixa os provedores necessários da AWS, TLS e Local File:
```bash
terraform init
```

### 2. Planejar (Preview)
Mostra na tela tudo o que será criado ou alterado na nuvem antes de aplicar:
```bash
# Define o JWT_SECRET temporário na sua sessão
JWT_SECRET=$(openssl rand -hex 16)

# Visualiza o plano
terraform plan -var="jwt_secret=$JWT_SECRET"
```

### 3. Fazer o Deploy (ou Atualizar)
Aplica de fato a infraestrutura e cria a máquina na nuvem.

* **Deploy padrão (Usando IP Fixo):**
  ```bash
  terraform apply -var="jwt_secret=$JWT_SECRET"
  ```

* **Deploy com Domínio Personalizado:**
  ```bash
  terraform apply -var="jwt_secret=$JWT_SECRET" -var="domain_name=seudominio.com"
  ```

> 🔐 **Importante**: O Terraform gerará um arquivo de chave privada **`ziplink-key.pem`** automaticamente nesta pasta. Este arquivo está configurado no `.gitignore` para nunca ser commitado.

### 4. Destruir tudo (Limpeza completa)
Remove todos os recursos criados na AWS para evitar quaisquer custos:
```bash
terraform destroy -var="jwt_secret=$JWT_SECRET"
```

---

## 💻 Conexão SSH & Monitoramento (Termius)

Para gerenciar o seu servidor de produção pelo **Termius**:

1. Crie um novo Host com o IP público retornado no final do `terraform apply` (ex: `100.49.77.122`).
2. Defina o usuário como **`ec2-user`**.
3. Importe a chave privada **`infra/terraform/ziplink-key.pem`** gerada automaticamente.

### Comandos úteis dentro do servidor (via SSH):

```bash
# Ver os logs de inicialização e build em tempo real (muito útil na primeira inicialização)
sudo tail -f /var/log/cloud-init-output.log

# Verificar status dos containers
cd /opt/ziplink
sudo docker compose -f docker-compose.prod.yml ps

# Ver logs da aplicação em tempo real
sudo docker compose -f docker-compose.prod.yml logs -f --tail=50

# Reiniciar a API e Workers após alterações de código
sudo docker compose -f docker-compose.prod.yml restart api worker
```
