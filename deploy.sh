#!/usr/bin/env bash
set -e

cd /opt/skythermal
git fetch origin
git reset --hard origin/main

# Build frontend
cd frontend
npm install --silent
npm run build
cd ..

# Restart API stack
docker compose -f docker-compose.prod.yml build api
docker compose -f docker-compose.prod.yml up -d

# Reload nginx
nginx -t && systemctl reload nginx

echo "Deploy complete"
