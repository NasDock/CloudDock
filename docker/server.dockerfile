FROM node:22-alpine AS base

WORKDIR /app

# Install dependencies only when needed
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/server/package.json ./packages/server/
COPY packages/shared/package.json ./packages/shared/
RUN corepack enable && pnpm install --frozen-lockfile

# Build shared package first
FROM deps AS shared-builder
WORKDIR /app/packages/shared
COPY packages/shared/src ./src
COPY packages/shared/tsconfig.json ./tsconfig.json
RUN pnpm build

# Build server
FROM deps AS server-builder
WORKDIR /app/packages/server
COPY packages/server/src ./src
COPY packages/server/src/prisma ./prisma
COPY --from=shared-builder /app/packages/shared/dist ./node_modules/@cloud-dock/shared/dist
RUN pnpm build

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 server

COPY --from=server-builder /app/node_modules ./node_modules
COPY --from=server-builder /app/packages/server/dist ./dist
COPY --from=server-builder /app/packages/server/prisma ./prisma

RUN chown -R server:nodejs /app

USER server

EXPOSE 3000 3001

CMD ["node", "dist/index.js"]
