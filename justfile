set dotenv-filename := "apps/web/.env.local"
set dotenv-load

compose := "docker compose -f ops/docker/compose.yml"
web := "pnpm --filter @vesta/web"
admin := "pnpm --filter @vesta/admin"
shared := "pnpm --filter @vesta/shared"

default:
    just --list

# ─── WORKSPACE ──────────────────────────────────────────

# Install all workspace dependencies
install:
    pnpm install

# Type-check all packages and apps
typecheck-all:
    pnpm --filter '*' typecheck

# ─── DOCKER ─────────────────────────────────────────────

# Start all services (postgres, redis, mailpit, bdapps-simulator, worker, app)
up:
    {{compose}} up -d --build --remove-orphans

# Start only infrastructure (postgres, redis, mailpit) — run Next.js locally
infra:
    {{compose}} up -d postgres redis mailpit --remove-orphans --wait

# Stop all docker services
down:
    {{compose}} down

# Stop and remove all volumes (full wipe)
nuke:
    {{compose}} down -v --remove-orphans

# Show docker service logs (follow)
logs *args='':
    {{compose}} logs -f {{args}}

# Show status of all services
ps:
    {{compose}} ps

# ─── DATABASE ───────────────────────────────────────────

# Generate Prisma client
db-generate:
    {{shared}} db:generate

# Create and apply new migration
db-migrate:
    {{shared}} db:migrate

# Apply migrations (deploy, no prompt)
db-deploy:
    {{shared}} db:migrate:deploy

# Seed database with demo data
db-seed:
    {{shared}} db:seed

# Open Prisma Studio
db-studio:
    {{shared}} db:studio

# Shortcut: Open Prisma Studio
studio:
    just db-studio

# Completely reset database: drop → migrate → seed
db-reset:
    {{shared}} db:reset

# Reset database without interactive prompt: drop via Docker, push schema, generate, seed
db-reset-force:
    docker exec -i $({{compose}} ps -q postgres) psql -U vesta -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'vesta_dev' AND pid <> pg_backend_pid();" || true
    docker exec -i $({{compose}} ps -q postgres) psql -U vesta -d postgres -c "DROP DATABASE IF EXISTS vesta_dev;" || true
    docker exec -i $({{compose}} ps -q postgres) psql -U vesta -d postgres -c "CREATE DATABASE vesta_dev;" || true
    docker exec -i $({{compose}} ps -q postgres) psql -U vesta -d vesta_dev -f /docker-entrypoint-initdb.d/init.sql
    {{shared}} exec prisma db push --accept-data-loss
    {{shared}} db:generate
    {{shared}} db:seed

# Wipe database volumes and start fresh (nuclear option)
db-nuke:
    {{compose}} down -v postgres
    {{compose}} up -d postgres
    @echo "Waiting for postgres to be healthy..."
    @sleep 5
    {{shared}} db:migrate:deploy
    {{shared}} db:seed
    @echo "Database nuked and re-seeded."

# Backup database to ops/backups/ (uses DIRECT_URL from .env.local)
db-backup:
    @mkdir -p ops/backups
    pg_dump "${DIRECT_URL}" \
        --format=plain \
        --no-acl \
        --no-owner \
        --file=ops/backups/vesta-backup-$(date +%Y%m%d-%H%M%S).sql
    @echo "Backup saved to ops/backups/"

# Backup any database by passing connection string: just db-backup-url <url>
db-backup-url url:
    @mkdir -p ops/backups
    pg_dump "{{url}}" \
        --format=plain \
        --no-acl \
        --no-owner \
        --file=ops/backups/vesta-backup-$(date +%Y%m%d-%H%M%S).sql
    @echo "Backup saved to ops/backups/"

# ─── DEV ────────────────────────────────────────────────

# Full local dev setup: copy env, start infra, reset db, run dev server
setup:
    @test -f apps/web/.env.local || cp apps/web/.env.example apps/web/.env.local && echo "Created apps/web/.env.local"
    just infra
    just db-reset-force
    @echo "Ready! Run 'just w' to start web, 'just a' for admin."

# Start Next.js web dev server (assumes infra is running)
dev:
    {{web}} dev

# Short alias: start web dev server
w:
    just dev

# Start admin app dev server (port 3001)
dev-admin:
    {{admin}} dev

# Short alias: start admin dev server
a:
    just dev-admin

# Start both web + admin dev servers
wa:
    {{web}} dev & {{admin}} dev & wait

# Start everything inside Docker (no local Node needed)
dev-docker:
    just up

# Type check web app
typecheck:
    {{web}} typecheck

# Run tests
test:
    {{web}} backend:test

# Run tests in watch mode
test-watch:
    {{web}} backend:test:watch

# ─── BUILD ──────────────────────────────────────────────

# Build web app for production
build:
    {{web}} build

# Build admin app for production
build-admin:
    {{admin}} build

# ─── HEALTH ─────────────────────────────────────────────

# Check all service health endpoints
health:
    @echo "DB:      $(curl -s http://localhost:3000/api/health/db | head -c 80)"
    @echo "Redis:   $(curl -s http://localhost:3000/api/health/redis | head -c 80)"
    @echo "BDApps:  $(curl -s http://localhost:3000/api/health/bdapps | head -c 80)"
    @echo "Mailpit: $(curl -s http://localhost:3000/api/health/mailpit | head -c 80)"
    @echo "Worker:  $(curl -s http://localhost:3000/api/health/worker | head -c 80)"

# ─── CRON (manual trigger) ──────────────────────────────

# Trigger daily reminders cron manually
cron-reminders:
    curl -s -X POST http://localhost:3000/api/cron/daily-reminders -H "Authorization: Bearer ${CRON_SECRET}" | python3 -m json.tool

# Trigger CAAS balance check cron manually
cron-caas:
    curl -s -X POST http://localhost:3000/api/cron/caas-check -H "Authorization: Bearer ${CRON_SECRET}" | python3 -m json.tool

# ─── REDIS ──────────────────────────────────────────────

# Open Redis CLI
redis-cli:
    docker exec -it $({{compose}} ps -q redis) redis-cli

# Flush all Redis data
redis-flush:
    docker exec -it $({{compose}} ps -q redis) redis-cli FLUSHALL
    @echo "Redis flushed."

# ─── QUICK COMBOS ──────────────────────────────────────

# Reset everything: database + redis + re-seed
reset:
    just redis-flush
    just db-reset-force
    @echo "Full reset complete."

# Fresh start: nuke volumes, rebuild, migrate, seed
fresh:
    just nuke
    just up
    @echo "Waiting for services..."
    @sleep 8
    {{shared}} db:migrate:deploy
    {{shared}} db:seed
    @echo "Fresh start complete."
