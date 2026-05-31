FROM node:22-alpine AS base

WORKDIR /workspace
RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/bdapps-simulator/package.json apps/bdapps-simulator/package.json

RUN pnpm install --filter @vesta/bdapps-simulator... --frozen-lockfile=false

COPY apps/bdapps-simulator apps/bdapps-simulator

RUN pnpm --filter @vesta/bdapps-simulator build

EXPOSE 7010

CMD ["pnpm", "--filter", "@vesta/bdapps-simulator", "start"]
