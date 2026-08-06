FROM node:22-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++ \
  && corepack enable \
  && corepack prepare pnpm@9.12.0 --activate
COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile
COPY prisma ./prisma
COPY prisma.config.ts ./
ARG DATABASE_URL=postgresql://postgres:postgres@db:5432/offline_tool?schema=public
ENV DATABASE_URL=$DATABASE_URL
RUN pnpm exec prisma generate

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable \
  && corepack prepare pnpm@9.12.0 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /app/.npmrc ./.npmrc
COPY src ./src
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
RUN addgroup -g 1001 -S appgroup \
  && adduser -S appuser -u 1001 -G appgroup
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD wget -qO- http://localhost:3000/api/v1/health || exit 1
CMD ["node", "src/server.js"]
