# syntax=docker/dockerfile:1

ARG NODE_IMAGE=node:24-alpine

FROM ${NODE_IMAGE} AS base
RUN corepack enable
WORKDIR /app

FROM base AS production-dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts

# Prisma TypedSQL asks a live database to infer query types, so this stage runs a throwaway Postgres while it generates.
FROM base AS build
RUN apk add --no-cache postgresql17
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts
COPY . .
ENV DATABASE_URL=postgresql://postgres@127.0.0.1:5432/postgres
RUN install -d -o postgres -g postgres /tmp/pgdata \
    && su postgres -c "initdb -D /tmp/pgdata -A trust -U postgres && pg_ctl -D /tmp/pgdata -w -o '-c listen_addresses=127.0.0.1 -c unix_socket_directories=/tmp' start" \
    && pnpm exec prisma migrate deploy \
    && pnpm build \
    && su postgres -c "pg_ctl -D /tmp/pgdata -m fast stop"

FROM build AS migrate
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
USER node
EXPOSE 3000
CMD ["node", "--import", "./dist/src/tracing.js", "dist/src/main.js"]
