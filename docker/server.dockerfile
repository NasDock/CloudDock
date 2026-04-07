FROM node:22-alpine AS base

WORKDIR /app
RUN apk add --no-cache openssl

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
COPY tsconfig.base.json /app/tsconfig.base.json
RUN pnpm build

# Build server
FROM deps AS server-builder
WORKDIR /app/packages/server
COPY packages/server/src ./src
COPY packages/server/tsup.config.ts ./tsup.config.ts
COPY packages/server/tsconfig.json ./tsconfig.json
COPY packages/server/src/prisma ./prisma
COPY tsconfig.base.json /app/tsconfig.base.json
COPY --from=shared-builder /app/packages/shared/dist ./node_modules/@cloud-dock/shared/dist
RUN pnpm dlx prisma@5.22.0 generate --schema=./prisma/schema.prisma
RUN pnpm build

# Production image
FROM base AS runner
WORKDIR /app/packages/server

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 server
RUN mkdir -p /app/packages/server/data

COPY --from=server-builder /app/node_modules /app/node_modules
COPY --from=server-builder /app/packages/server/node_modules ./node_modules
COPY --from=server-builder /app/packages/server/package.json ./package.json
COPY --from=server-builder /app/packages/server/dist ./dist
COPY --from=server-builder /app/packages/server/src/prisma ./src/prisma
COPY --from=server-builder /app/packages/shared/package.json /app/packages/shared/package.json
COPY --from=shared-builder /app/packages/shared/dist /app/packages/shared/dist

RUN chown -R server:nodejs /app

USER server

EXPOSE 3000 3001

CMD ["node", "dist/index.js"]
