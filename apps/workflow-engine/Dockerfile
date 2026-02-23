FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml turbo.json ./
COPY packages/shared-types/package.json packages/shared-types/
COPY packages/db/package.json packages/db/
COPY apps/workflow-engine/package.json apps/workflow-engine/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @producer/shared-types build || true
RUN pnpm --filter @producer/workflow-engine build

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/apps/workflow-engine/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/db/prisma ./prisma
ENV NODE_ENV=production
EXPOSE 3002
CMD ["node", "dist/main"]
