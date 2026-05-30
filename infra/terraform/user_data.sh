#!/bin/bash
set -euo pipefail

# ── Docker + Docker Compose ───────────────────────────────────────────────────
dnf update -y
dnf install -y docker git
systemctl enable docker
systemctl start docker
usermod -aG docker ec2-user

mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

curl -SL "https://github.com/docker/buildx/releases/download/v0.21.1/buildx-v0.21.1.linux-amd64" \
  -o /usr/local/lib/docker/cli-plugins/docker-buildx
chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx

# ── Clone do projeto ──────────────────────────────────────────────────────────
git clone https://github.com/Thomaz-Castro/ziplink.git /opt/ziplink
cd /opt/ziplink

# ── Variáveis de produção ─────────────────────────────────────────────────────
cat > .env <<EOF
NODE_ENV=production
JWT_SECRET=${jwt_secret}
POSTGRES_PASSWORD=${postgres_password}
BASE_URL=${base_url}
RATE_LIMIT_MAX=500
RATE_LIMIT_WINDOW_SECONDS=60
EOF

# ── Build e start ─────────────────────────────────────────────────────────────
docker compose -f docker-compose.prod.yml up -d --build

echo "ZipLink deployed successfully!"
