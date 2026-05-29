# ZipLink — High-Performance URL Shortener

> Stack: **Fastify + TypeScript · PostgreSQL · Redis · BullMQ · Vue 3 · Docker**

---

## Quick Start (< 5 minutes)

### Prerequisites
- Docker ≥ 24 and Docker Compose v2  
- `git clone` this repo

### 1. Configurar variáveis de ambiente

```bash
cp .env.example .env
# Edite .env se quiser trocar senhas/secrets (opcional para dev local)
```

### 2. Subir tudo

```bash
docker compose up --build
```

All services start in parallel. Wait for:

```
ziplink_api    | ZipLink API running on port 3000
ziplink_worker | Batch worker ready and listening for jobs
```

### 2. Open the App

Tudo em **uma única porta — http://localhost:80** via nginx reverso:

| Path             | O que faz                                    |
|------------------|----------------------------------------------|
| `http://localhost/`         | Frontend Vue (SPA)                |
| `http://localhost/api/`     | API REST (auth, links, batch)     |
| `http://localhost/queues`   | Bull Board — painel de filas      |
| `http://localhost/<slug>`   | Redirecionamento (`302`)          |
| `http://localhost/health`   | Health check da API               |

> Internamente cada serviço ainda tem sua porta (`api:3000`, `frontend:5173`),
> mas **nenhuma** é exposta ao host — só o nginx ouve na 80.

### 3. Register & Use

1. Open http://localhost:5173/register
2. Create an account
3. Start shortening links

---

## API Reference

All API routes are prefixed with `/api`.

### Authentication

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret123"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"secret123"}'
```

### Links CRUD

```bash
TOKEN="<jwt from login>"

# Create
curl -X POST http://localhost:3000/api/links \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"original_url":"https://example.com/very-long-path","slug":"myslug","title":"My Link"}'

# List
curl http://localhost:3000/api/links \
  -H "Authorization: Bearer $TOKEN"

# Update
curl -X PATCH http://localhost:3000/api/links/<id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"active":false}'

# Delete
curl -X DELETE http://localhost:3000/api/links/<id> \
  -H "Authorization: Bearer $TOKEN"
```

### Redirect

```
GET http://localhost:3000/<slug>
→ 302 to original URL
```

Cache-hit path: Redis only (sub-millisecond).  
Cache-miss path: PostgreSQL → populate Redis → redirect.

### Batch Import

```bash
# CSV format: url,slug,title
cat > links.csv <<'EOF'
url,slug,title
https://example.com/a,,First link
https://example.com/b,custom-b,Second link
EOF

curl -X POST http://localhost:3000/api/batch \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@links.csv"
# → 202 Accepted {"job_id":"..."}

# Poll job status
curl http://localhost:3000/api/batch/<job_id> \
  -H "Authorization: Bearer $TOKEN"
```

---

## Load Testing with Locust

### Setup

```bash
cd tests/locust
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Run (headless — 500+ req/s target)

```bash
locust -f locustfile.py \
  --headless \
  --users 600 \
  --spawn-rate 60 \
  --run-time 90s \
  --host http://localhost:3000 \
  --html report.html
```

Key flags:
- `-u 600` — 600 concurrent users
- `-r 60` — ramp up 60 users/second
- `-t 90s` — run for 90 seconds (60s steady state after 10s ramp)

### Run with dashboard (interactive)

```bash
locust -f locustfile.py --host http://localhost:3000
```
Open http://localhost:8089 → set Users=600, Spawn rate=60 → Start.

### Expected results (local Docker, 8-core machine)

| Metric           | Target       |
|------------------|--------------|
| Requests/sec     | ≥ 500        |
| p50 latency      | < 10 ms      |
| p95 latency      | < 50 ms      |
| Error rate       | < 0.1%       |

> If throughput is below target: scale Redis `maxmemory` up, check
> `docker stats`, or increase `WORKER_CONCURRENCY`.

---

## Project Structure

```
ziplink/
├── backend/
│   └── src/
│       ├── config/         # DB, Redis, env, SQL migrations
│       ├── controllers/    # Route handlers (auth, links, batch)
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
├── infra/
│   └── terraform/          # AWS Free Tier EC2 deployment
├── tests/
│   └── locust/             # Load test scripts
└── docker-compose.yml
```

---

## Environment Variables

| Variable              | Default                   | Description                  |
|-----------------------|---------------------------|------------------------------|
| `DATABASE_URL`        | (postgres container)      | PostgreSQL connection string |
| `REDIS_URL`           | (redis container)         | Redis connection string      |
| `JWT_SECRET`          | (set in compose)          | JWT signing key (min 16 chars)|
| `BASE_URL`            | `http://localhost:3000`   | Public base URL for short links|
| `BCRYPT_ROUNDS`       | `10`                      | bcrypt cost factor           |
| `WORKER_CONCURRENCY`  | `5`                       | Parallel batch jobs per worker|

---

## Deploy to AWS (Free Tier)

```bash
cd infra/terraform

# Initialise
terraform init

# Preview
terraform plan \
  -var="jwt_secret=change_me_in_production_32chars" \
  -var="postgres_password=str0ng_password"

# Apply
terraform apply \
  -var="jwt_secret=change_me_in_production_32chars" \
  -var="postgres_password=str0ng_password"
```

Terraform creates: VPC, Subnet, Security Group, EC2 t3.micro, Elastic IP.  
The instance runs `docker compose up` on first boot via `user_data.sh`.

> **Free Tier note:** t3.micro gives 750 hours/month free for 12 months.
> Elastic IP is free while attached to a running instance.
