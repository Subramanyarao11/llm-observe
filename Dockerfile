# Root Dockerfile base for API and worker
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/api/package.json ./apps/api/
COPY apps/worker/package.json ./apps/worker/
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY apps/api ./apps/api
COPY apps/worker ./apps/worker
RUN pnpm --filter @llm-observe/types build
RUN pnpm --filter @llm-observe/db generate
RUN pnpm --filter @llm-observe/db build
RUN pnpm --filter @llm-observe/pii build
RUN pnpm --filter @llm-observe/sdk build
RUN pnpm --filter @llm-observe/api build
RUN pnpm --filter @llm-observe/worker build

FROM base AS api
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]

FROM base AS worker
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/apps/worker/package.json ./apps/worker/
WORKDIR /app/apps/worker
CMD ["node", "dist/main.js"]
