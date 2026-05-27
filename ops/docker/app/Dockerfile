FROM node:22-alpine
WORKDIR /workspace/app
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate
COPY app/package.json app/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY app/ .
RUN pnpm db:generate
EXPOSE 3000
CMD ["pnpm", "dev"]
