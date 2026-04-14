#!/bin/sh
set -e
if [ ! -f /app/node_modules/.bin/vite ]; then
  echo "delivery-frontend-dev: instalando dependencias (primer arranque o volumen vacio)..."
  (cd /app && npm ci)
fi
# Con bind mount, caché vieja en node_modules/.vite provoca "Failed to resolve import" en imports nuevos.
rm -rf /app/node_modules/.vite 2>/dev/null || true
exec "$@"
