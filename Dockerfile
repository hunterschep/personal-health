# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV COREPACK_HOME=/corepack
ENV PATH=$PNPM_HOME:$PATH
RUN apt-get update \
    && apt-get install --yes --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/* \
    && mkdir -p "$COREPACK_HOME" \
    && corepack enable \
    && corepack prepare pnpm@11.9.0 --activate \
    && chmod -R a+rX "$COREPACK_HOME"
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM dependencies AS builder
COPY . .
ARG BUILD_VERSION=development
ENV BUILD_VERSION=$BUILD_VERSION
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV AUTH_SECRET=build-only-secret-with-at-least-thirty-two-characters
ENV SOURCE_SYNC_ENABLED=false
ENV DEMO_SEED_ENABLED=false
RUN pnpm db:generate && pnpm build

# Used only by the one-shot Compose initialization service. It contains the
# Prisma CLI and seed sources; these development tools are not in the web image.
FROM dependencies AS tools
COPY . .
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
RUN pnpm db:generate
RUN groupadd --system --gid 1001 carecadence \
    && useradd --system --uid 1001 --gid carecadence --home-dir /app carecadence \
    && mkdir -p /app/uploads \
    && chown carecadence:carecadence /app/uploads
USER carecadence
CMD ["pnpm", "db:migrate:deploy"]

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV UPLOAD_DIR=/app/uploads
ARG BUILD_VERSION=development
ENV BUILD_VERSION=$BUILD_VERSION

RUN groupadd --system --gid 1001 carecadence \
    && useradd --system --uid 1001 --gid carecadence --home-dir /app carecadence \
    && mkdir -p /app/uploads \
    && chown carecadence:carecadence /app/uploads

COPY --from=builder --chown=carecadence:carecadence /app/public ./public
COPY --from=builder --chown=carecadence:carecadence /app/.next/standalone ./
COPY --from=builder --chown=carecadence:carecadence /app/.next/static ./.next/static

USER carecadence
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health?mode=readiness').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]
