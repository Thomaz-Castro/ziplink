#!/bin/bash
set -euo pipefail

# Garante que está rodando como root/sudo
if [ "$EUID" -ne 0 ]; then
  echo "❌ Por favor, execute este script como root (com sudo):"
  echo "sudo ./setup-ssl.sh"
  exit 1
fi

echo "=========================================="
echo "🔒 Configurador Automático de SSL - ZipLink"
echo "=========================================="

# Pergunta o domínio de forma interativa
read -p "👉 Digite o seu domínio comprado (ex: ziplink.site): " DOMAIN

if [ -z "$DOMAIN" ]; then
  echo "❌ O domínio não pode ser vazio!"
  exit 1
fi

echo "------------------------------------------"
echo "1. Instalando o Certbot..."
dnf install -y certbot

echo "------------------------------------------"
echo "2. Parando os containers temporariamente..."
docker compose -f /opt/ziplink/docker-compose.prod.yml down || true

echo "------------------------------------------"
echo "3. Gerando o certificado Let's Encrypt para $DOMAIN..."
certbot certonly --standalone \
  -d "$DOMAIN" \
  -d "www.$DOMAIN" \
  --register-unsafely-without-email \
  --agree-tos

echo "------------------------------------------"
echo "4. Escrevendo a nova configuração do Nginx com SSL..."
cat > /opt/ziplink/nginx/prod.conf <<EOF
upstream api      { server api:3000; }
upstream frontend { server frontend:80; }

# Redireciona HTTP para HTTPS automaticamente
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    return 301 https://\$host\$request_uri;
}

# Bloco seguro HTTPS
server {
    listen 443 ssl;
    server_name ${DOMAIN} www.${DOMAIN};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;

    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    # API
    location /api/ {
        proxy_pass http://api;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Bull Board
    location /queues {
        proxy_pass http://api;
        proxy_set_header Host \$host;
    }

    # Health check
    location = /health {
        proxy_pass http://api;
    }

    # SPA & Slug Redirects
    location / {
        proxy_pass             http://api;
        proxy_intercept_errors on;
        error_page 404         = @spa;
        proxy_set_header       Host \$host;
        proxy_set_header       X-Real-IP \$remote_addr;
        proxy_set_header       X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header       X-Forwarded-Proto \$scheme;
    }

    location @spa {
        proxy_pass       http://frontend;
        proxy_set_header Host \$host;
    }
}
EOF

echo "------------------------------------------"
echo "5. Reiniciando a aplicação no Docker Compose..."
docker compose -f /opt/ziplink/docker-compose.prod.yml up -d --build

echo "=========================================="
echo "✅ SSL Ativado com Sucesso para https://$DOMAIN !"
echo "=========================================="
