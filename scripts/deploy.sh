#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if docker compose version >/dev/null 2>&1; then
  COMPOSE=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE=(docker-compose)
else
  echo "docker compose is not installed"
  exit 1
fi

if [ ! -f .env.production ]; then
  echo "Missing $ROOT/.env.production. Copy .env.production.example on the server and fill production values before deploying."
  exit 1
fi

"${COMPOSE[@]}" --env-file .env.production build

if ! "${COMPOSE[@]}" --env-file .env.production up -d --remove-orphans; then
  echo "docker compose up failed — recent web logs:"
  "${COMPOSE[@]}" --env-file .env.production ps -a || true
  "${COMPOSE[@]}" --env-file .env.production logs --tail=120 web || true
  exit 1
fi

docker image prune -f >/dev/null

if [ -f deploy/nginx/rock.vendingao.com.conf ] && [ -d /etc/nginx/sites-available ]; then
  cp deploy/nginx/rock.vendingao.com.conf /etc/nginx/sites-available/rock.vendingao.com
  ln -sfn /etc/nginx/sites-available/rock.vendingao.com /etc/nginx/sites-enabled/rock.vendingao.com
  if nginx -t; then
    systemctl reload nginx
  else
    echo "nginx config test failed; not reloading"
    exit 1
  fi
fi

HEALTH_URL="http://127.0.0.1:3001/"
for _ in $(seq 1 45); do
  if curl -fsS -o /dev/null "$HEALTH_URL"; then
    echo "Frontend healthy at $HEALTH_URL"
    "${COMPOSE[@]}" --env-file .env.production ps
    exit 0
  fi
  sleep 2
done

echo "Health check failed for $HEALTH_URL"
"${COMPOSE[@]}" --env-file .env.production ps -a
"${COMPOSE[@]}" --env-file .env.production logs --tail=120 web
exit 1
