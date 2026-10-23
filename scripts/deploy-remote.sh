#!/bin/bash
# Corre EN el server de producción (aunaro), vía:
#   ssh usuario@host bash -s -- <sha> < scripts/deploy-remote.sh
# Lo usan el job "deploy" de .github/workflows/deploy.yml y deploy.sh.
#
# Actualiza el checkout del server al commit pedido, guarda la imagen actual
# como "previous" y reconstruye solo el servicio frontend (--no-deps: no toca
# backend ni db). Si el contenedor nuevo no responde, vuelve a la imagen
# anterior y sale con error.

set -euo pipefail

SHA="${1:?Uso: deploy-remote.sh <sha>}"
SRC=/opt/mardev/src/Gestflow-Frontend
COMPOSE="docker compose -p aunaro -f /opt/mardev/compose/aunaro.compose.yaml --env-file /opt/mardev/aunaro/config/compose.env --env-file /opt/mardev/aunaro/config/runtime.env"

cd "$SRC"
git fetch --quiet origin main
SHA=$(git rev-parse --verify "$SHA^{commit}")
echo "Commit actual: $(git rev-parse --short HEAD) -> nuevo: ${SHA:0:7}"
git reset --hard "$SHA"

docker image tag aunaro-frontend:latest aunaro-frontend:previous
# --pull: sin esto la base nginx queda en caché y no recibe parches.
$COMPOSE build --pull frontend
$COMPOSE up -d --no-deps --no-build frontend

for i in $(seq 1 12); do
  if curl -sf -o /dev/null http://127.0.0.1:8080/; then
    echo "frontend ok en :8080 (intento $i)"
    exit 0
  fi
  sleep 5
done

echo "::error::el frontend nuevo no responde en :8080, volviendo a la imagen anterior"
$COMPOSE logs --tail 50 frontend || true
docker image tag aunaro-frontend:previous aunaro-frontend:latest
$COMPOSE up -d --no-deps --no-build frontend
exit 1
