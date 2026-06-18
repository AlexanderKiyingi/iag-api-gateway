FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Copy only manifests first so the dependency-install layer is cached
# independently of source changes. Editing src/ or packages/ no longer busts
# `pnpm install`, which otherwise re-resolves the whole OTel/Fastify tree on
# every deploy. Keep this list in sync with packages/* (pnpm needs each
# workspace package.json present at install time).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY packages/auth-client/package.json ./packages/auth-client/
COPY packages/config/package.json ./packages/config/
COPY packages/observability/package.json ./packages/observability/
COPY packages/service-core/package.json ./packages/service-core/

RUN pnpm install --frozen-lockfile

# Now bring in sources and build. A source-only change reuses the cached
# install layer above.
COPY packages ./packages
COPY src ./src
COPY config ./config
RUN pnpm run build

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache wget
ENV NODE_ENV=production

COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages

EXPOSE 8080
ENV PORT=8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD sh -c 'wget -q -O /dev/null "http://127.0.0.1:${PORT}/ready" || exit 1'
CMD ["node", "dist/main.js"]
