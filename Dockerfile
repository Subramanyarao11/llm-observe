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
RUN pnpm --filter @llm-observe/api deploy --prod --ignore-scripts /prod/api
RUN pnpm --filter @llm-observe/worker deploy --prod --ignore-scripts /prod/worker

FROM node:20-alpine AS api
WORKDIR /app
COPY --from=builder /prod/api .
EXPOSE 3001
CMD ["node", "dist/main.js"]

FROM node:20-alpine AS worker
WORKDIR /app
COPY --from=builder /prod/worker .
CMD ["node", "dist/main.js"]
