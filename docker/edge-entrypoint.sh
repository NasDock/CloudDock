#!/usr/bin/env sh
set -e

API_URL=${WEB_API_URL:-${VITE_API_URL:-http://localhost:3001/api}}
WS_URL=${WEB_WS_URL:-${VITE_WS_URL:-ws://localhost:3001/ws/device}}
PUBLIC_BASE_URL=${WEB_PUBLIC_BASE_URL:-${VITE_PUBLIC_BASE_URL:-}}

cat >/usr/share/nginx/html/config.js <<EOF2
window.__APP_CONFIG__ = {
  apiUrl: "${API_URL}",
  wsUrl: "${WS_URL}",
  publicBaseUrl: "${PUBLIC_BASE_URL}"
};
EOF2

node /app/bin/nas-client.js start &
exec nginx -g 'daemon off;'
