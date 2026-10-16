#!/bin/bash

# Deploy manual de emergencia del frontend a producción (aunaro).
# El deploy normal es automático vía .github/workflows/deploy.yml (push a
# main). Usar este script solo si el CI está caído — corre desde tu máquina,
# que debe estar en la tailnet y tener acceso SSH al server.
#
# Uso: ./deploy.sh [ref]   (por defecto origin/main)
# Variables opcionales: DEPLOY_HOST, DEPLOY_USER, SITE_URL.

set -euo pipefail

DEPLOY_HOST="${DEPLOY_HOST:-100.109.30.79}"
DEPLOY_USER="${DEPLOY_USER:-matias}"
SITE_URL="${SITE_URL:-https://aunaro.mardev.cl}"
REF="${1:-origin/main}"

cd "$(dirname "$0")"
git fetch --quiet origin main
SHA=$(git rev-parse --verify "$REF^{commit}")

echo "🚀 Deploy de ${SHA:0:7} a $DEPLOY_USER@$DEPLOY_HOST..."
ssh "$DEPLOY_USER@$DEPLOY_HOST" bash -s -- "$SHA" < scripts/deploy-remote.sh

echo "✅ Deploy completo!"
curl -sf -o /dev/null -w "site:%{http_code}\n" "$SITE_URL"
