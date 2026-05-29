#!/bin/bash
set -euo pipefail

# Install Docker + Docker Compose
dnf update -y
dnf install -y docker git
systemctl enable docker
systemctl start docker
usermod -aG docker ec2-user

# Docker Compose v2 plugin
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Clone the project (replace with your repo URL)
git clone https://github.com/YOUR_ORG/ziplink.git /opt/ziplink
cd /opt/ziplink

# Create production env file
cat > .env.prod <<'EOF'
NODE_ENV=production
JWT_SECRET=${jwt_secret}
POSTGRES_PASSWORD=${postgres_password}
EOF

# Pull images and start
docker compose -f docker-compose.prod.yml up -d --build

echo "ZipLink deployed successfully!"
