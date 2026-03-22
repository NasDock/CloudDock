FROM node:22-alpine AS base

WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/nas-client/package.json ./packages/nas-client/
COPY packages/web/package.json ./packages/web/
COPY packages/shared/package.json ./packages/shared/
RUN corepack enable && pnpm install --frozen-lockfile

FROM deps AS shared-builder
WORKDIR /app/packages/shared
COPY packages/shared/src ./src
COPY packages/shared/tsconfig.json ./tsconfig.json
COPY tsconfig.base.json /app/tsconfig.base.json
RUN pnpm build

FROM deps AS app-builder
WORKDIR /app/packages/nas-client
COPY packages/nas-client/src ./src
COPY packages/nas-client/bin ./bin
COPY packages/nas-client/vite.ui.config.ts ./vite.ui.config.ts
COPY packages/nas-client/tsconfig.json ./tsconfig.json
COPY tsconfig.base.json /app/tsconfig.base.json
COPY --from=shared-builder /app/packages/shared/dist ./node_modules/@cloud-dock/shared/dist
RUN pnpm build

WORKDIR /app/packages/web
COPY packages/web/src ./src
COPY packages/web/index.html ./index.html
COPY packages/web/public ./public
COPY packages/web/tsconfig.json ./tsconfig.json
COPY packages/web/tsconfig.node.json ./tsconfig.node.json
COPY packages/web/vite.config.ts ./vite.config.ts
COPY packages/web/postcss.config.js ./postcss.config.js
COPY packages/web/tailwind.config.js ./tailwind.config.js
COPY tsconfig.base.json /app/tsconfig.base.json
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN pnpm build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache nginx

COPY --from=app-builder /app/node_modules ./node_modules
COPY --from=app-builder /app/packages/nas-client/dist ./dist
COPY --from=app-builder /app/packages/nas-client/bin ./bin
COPY --from=app-builder /app/packages/web/dist /usr/share/nginx/html
COPY docker/nginx/nas-web.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000 5700

CMD ["sh", "-c", "node /app/bin/nas-client.js start & nginx -g 'daemon off;'"]
