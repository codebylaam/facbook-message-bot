# Multi-stage image for the API and the worker. Bun runs the TypeScript
# directly, so there is no build step: copy the workspace and start the entry.
FROM docker.io/oven/bun:1.4-alpine AS deps

WORKDIR /app

COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/ai/package.json packages/ai/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/meta/package.json packages/meta/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN bun install --frozen-lockfile --production

FROM deps AS runtime

COPY tsconfig.base.json ./
COPY packages packages
COPY apps/api apps/api

ENV NODE_ENV=production
WORKDIR /app/apps/api

EXPOSE 3000

USER bun

CMD ["bun", "run", "src/index.ts"]
