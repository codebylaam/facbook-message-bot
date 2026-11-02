# Build the static bundle, then let Caddy serve it and proxy the API, so the app
# and the API share one origin. That removes CORS from production and gives TLS.
FROM docker.io/oven/bun:1.4-alpine AS build

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/meta/package.json packages/meta/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN bun install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages packages
COPY apps/web apps/web

# An empty API URL keeps every request relative, so the bundle works behind Caddy.
ENV VITE_API_URL=""
WORKDIR /app/apps/web

RUN bun run build

FROM docker.io/library/caddy:2-alpine AS runtime

COPY --from=build /app/apps/web/dist /srv/web
COPY apps/web/Caddyfile /etc/caddy/Caddyfile

EXPOSE 80 443
