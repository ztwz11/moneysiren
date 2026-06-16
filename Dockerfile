# syntax=docker/dockerfile:1

FROM node:24-slim AS workspace

ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    NEXT_TELEMETRY_DISABLED="1"

WORKDIR /app

RUN corepack enable
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates sqlite3 \
    && rm -rf /var/lib/apt/lists/*

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/cli/package.json apps/cli/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/report/package.json packages/report/package.json
COPY packages/security/package.json packages/security/package.json
COPY packages/connectors/aws/package.json packages/connectors/aws/package.json
COPY packages/connectors/cloudflare/package.json packages/connectors/cloudflare/package.json
COPY packages/connectors/mock/package.json packages/connectors/mock/package.json
COPY packages/connectors/openai/package.json packages/connectors/openai/package.json
COPY packages/connectors/supabase/package.json packages/connectors/supabase/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm build

FROM workspace AS verify

RUN pnpm typecheck

FROM workspace AS runner

ENV NODE_ENV="production" \
    MONEYSIREN_DB_PATH="/data/moneysiren.sqlite" \
    NEXT_TELEMETRY_DISABLED="1"

RUN mkdir -p /data

VOLUME ["/data"]
EXPOSE 3000

CMD ["pnpm", "--filter", "@moneysiren/web", "start", "--hostname", "0.0.0.0"]
