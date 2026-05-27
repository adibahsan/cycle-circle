set dotenv-filename := "app/.env.local"
set dotenv-load

compose := "docker compose -f ops/docker/compose.yml"
app := "pnpm --dir app"

default:
    just --list

# ─── DOCKER ─────────────────────────────────────────────

# Start all services (postgres, redis, mailpit, bdapps-simulator, worker, app)
up:
    {{compose}} up -d --build --remove-orphans

# Start only infrastructure (postgres, redis, mailpit) — run Next.js locally
infra:
    {{compose}} up -d postgres redis mailpit --remove-orphans

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
    {{app}} db:generate

# Create and apply new migration
db-migrate:
    {{app}} db:migrate

# Apply migrations (deploy, no prompt)
db-deploy:
    {{app}} db:migrate:deploy

# Seed database with demo data
db-seed:
    {{app}} db:seed

# Open Prisma Studio
db-studio:
    {{app}} db:studio

# Shortcut: Open Prisma Studio
studio:
    just db-studio

# Completely reset database: drop → migrate → seed
db-reset:
    {{app}} db:reset

# Reset database without interactive prompt: drop via Docker, push schema, generate, seed
db-reset-force:
    docker exec -i $({{compose}} ps -q postgres) psql -U vesta -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'vesta_dev' AND pid <> pg_backend_pid();" || true
    docker exec -i $({{compose}} ps -q postgres) psql -U vesta -d postgres -c "DROP DATABASE IF EXISTS vesta_dev;" || true
    docker exec -i $({{compose}} ps -q postgres) psql -U vesta -d postgres -c "CREATE DATABASE vesta_dev;" || true
    docker exec -i $({{compose}} ps -q postgres) psql -U vesta -d vesta_dev -f /docker-entrypoint-initdb.d/init.sql
    {{app}} exec prisma db push --accept-data-loss
    {{app}} db:generate
    {{app}} db:seed

# Wipe database volumes and start fresh (nuclear option)
db-nuke:
    {{compose}} down -v postgres
    {{compose}} up -d postgres
    @echo "Waiting for postgres to be healthy..."
    @sleep 5
    {{app}} db:migrate:deploy
    {{app}} db:seed
    @echo "Database nuked and re-seeded."

# ─── DEV ────────────────────────────────────────────────

# Full local dev setup: copy env, start infra, migrate, seed, run dev server
setup:
    @test -f app/.env.local || cp app/.env.example app/.env.local && echo "Created app/.env.local"
    just infra
    @echo "Waiting for services to be healthy..."
    @sleep 5
    {{app}} db:generate
    {{app}} db:migrate:deploy
    {{app}} db:seed
    @echo "Ready! Run 'just dev' to start."

# Start Next.js dev server (assumes infra is running)
dev:
    {{app}} dev

# Start everything inside Docker (no local Node needed)
dev-docker:
    just up

# Type check
typecheck:
    {{app}} typecheck

# Run tests
test:
    {{app}} backend:test

# Run tests in watch mode
test-watch:
    {{app}} backend:test:watch

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
    {{app}} db:migrate:deploy
    {{app}} db:seed
    @echo "Fresh start complete."
