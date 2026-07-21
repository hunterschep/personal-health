#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env from .env.example. Replace AUTH_SECRET before any shared deployment."
fi

docker compose up -d --wait db
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:migrate
pnpm db:seed
exec pnpm dev
