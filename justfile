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

# Start only infrastructure (postgres, redis, redisinsight, mailpit, bdapps-simulator) — run Next.js locally
infra:
    {{compose}} up -d postgres redis redisinsight mailpit bdapps-simulator --remove-orphans --wait

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
    docker exec -i $({{compose}} ps -q postgres) psql -U vesta_user -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'vesta_dev' AND pid <> pg_backend_pid();" || true
    docker exec -i $({{compose}} ps -q postgres) psql -U vesta_user -d postgres -c "DROP DATABASE IF EXISTS vesta_dev;" || true
    docker exec -i $({{compose}} ps -q postgres) psql -U vesta_user -d postgres -c "CREATE DATABASE vesta_dev;" || true
    docker exec -i $({{compose}} ps -q postgres) psql -U vesta_user -d vesta_dev -f /docker-entrypoint-initdb.d/init.sql
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

# Full local dev setup: copy env, start infra, reset db, seed
setup:
    @test -f apps/web/.env.local || cp apps/web/.env.example apps/web/.env.local && echo "Created apps/web/.env.local"
    @test -f apps/admin/.env.local || cp apps/admin/.env.example apps/admin/.env.local && echo "Created apps/admin/.env.local"
    just infra
    just db-reset-force
    @echo ""
    @echo "Ready! Run 'just w' (web :3000), 'just a' (admin :3001), or 'just wa' (both)."
    @echo "Mailpit: http://localhost:8025 · BDApps simulator: http://localhost:10001/mchoice-tap-sdk"
    @echo "Admin login: admin@vesta.health / admin123 · OTP bypass (DEV_MODE): 420420 / 840840"

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

# ─── LOCAL EDGE (fake prod: nginx + simulator keys) ─────
# Browser: http://cycle-circle.localhost:8088 · http://admin.cycle-circle.localhost:8088/login
# Simulator callback base: http://cycle-circle.localhost (resolves to nginx inside Docker)

edge_ip := "172.31.250.10"
edge_env := "APP_URL=http://cycle-circle.localhost:8088 BDAPPS_WEBHOOK_IPS=" + edge_ip + " BDAPPS_APP_ID=APP_SIMULATOR BDAPPS_PASSWORD=simulator_password"

# Start nginx edge (+ recreate simulator on the edge network)
edge-up:
    {{compose}} up -d --wait nginx bdapps-simulator

# Stop nginx edge
edge-down:
    {{compose}} stop nginx

# Web + admin dev servers with prod-like webhook allowlist and fake BDApps keys
edge-wa:
    {{edge_env}} {{web}} dev & {{edge_env}} {{admin}} dev & wait

# Webhook smoke through nginx: from the allowlisted simulator (expect S1000) and from the host (expect 401)
edge-smoke:
    @echo "── from simulator container (allowlisted {{edge_ip}}) ──"
    {{compose}} exec -T -e BASE_URL=http://cycle-circle.localhost bdapps-simulator bash -s < scripts/smoke-bdapps-webhooks.sh
    @echo "── from host (not allowlisted, expect 401) ──"
    @code=$(curl -s -o /dev/null -w '%{http_code}' -X POST http://cycle-circle.localhost:8088/api/webhooks/subscription/notify -H 'Content-Type: application/json' -H 'X-Real-IP: {{edge_ip}}' -d '{"subscriberId":"tel:8801812345678","status":"ACTIVE","timeStamp":"0"}'); \
      if [ "$code" = "401" ]; then echo "OK:   spoofed X-Real-IP from host → 401"; else echo "FAIL: host got HTTP $code (expected 401)"; exit 1; fi

# Start the local cron worker (BullMQ → triggers /api/cron/* on schedule). For hybrid `just infra` + `just w`.
worker:
    {{web}} worker

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

# ─── APP LOGS (dated files per channel, ADR 0004) ───────

# Tail a prod log channel over ssh (merchant|customer|webhook|translog|cron|error); date = YYYY-MM-DD, default today (Asia/Dhaka)
logs-prod channel="error" date="":
    ssh vesta "tail -n 200 -f /var/log/vesta/app/{{channel}}/{{ if date == "" { `TZ=Asia/Dhaka date +%F` } else { date } }}.log"

# Tail a local log channel from apps/web/logs (today, Asia/Dhaka)
logs-local channel="error":
    tail -n 200 -f apps/web/logs/{{channel}}/$(TZ=Asia/Dhaka date +%F).log

# ─── BUILD ──────────────────────────────────────────────

# Build web app for production
build:
    {{web}} build

# Build admin app for production
build-admin:
    {{admin}} build

# ─── HEALTH ─────────────────────────────────────────────

# Pre-flight checks for local development (tools, ports, env files)
doctor:
    #!/usr/bin/env bash
    set -euo pipefail
    failed=0
    warn() { echo "WARN: $*"; }
    ok() { echo "OK:   $*"; }
    need() { echo "FAIL: $*"; failed=1; }
    echo "=== Vesta local doctor ==="
    command -v docker >/dev/null 2>&1 && ok "docker installed" || need "docker not found — install Docker Desktop"
    docker compose version >/dev/null 2>&1 && ok "docker compose available" || need "docker compose not available"
    command -v node >/dev/null 2>&1 && ok "node $(node -v)" || need "node not found — use Node 22"
    command -v pnpm >/dev/null 2>&1 && ok "pnpm $(pnpm -v)" || need "pnpm not found — run: corepack enable"
    command -v just >/dev/null 2>&1 && ok "just installed" || need "just not found — https://github.com/casey/just"
    for port in 5431 6379 8025 3000 3001 7002 10001; do
      if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
        warn "port $port already in use (may be fine if services are running)"
      else
        ok "port $port free"
      fi
    done
    test -f apps/web/.env.local && ok "apps/web/.env.local exists" || warn "apps/web/.env.local missing — run: just setup"
    test -f apps/admin/.env.local && ok "apps/admin/.env.local exists" || warn "apps/admin/.env.local missing — run: just setup"
    if docker compose -f ops/docker/compose.yml ps --status running 2>/dev/null | grep -q postgres; then
      ok "postgres container running"
    else
      warn "postgres not running — run: just infra"
    fi
    echo ""
    if [[ "$failed" -eq 0 ]]; then
      echo "Doctor passed. Next: just setup (first time) or just wa (start apps)."
    else
      echo "Doctor found blocking issues. Fix FAIL items above."
      exit 1
    fi

# Post-setup smoke test for Docker services (run after just setup)
setup-check:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "=== Vesta setup check ==="
    {{compose}} ps
    echo ""
    echo -n "Mailpit UI (:8025): "
    curl -sf -o /dev/null http://localhost:8025 && echo "OK" || echo "FAIL"
    echo -n "BDApps simulator UI (:10001): "
    curl -sf -o /dev/null http://localhost:10001/mchoice-tap-sdk && echo "OK" || echo "FAIL (may need ~90s after first start)"
    echo ""
    echo "Seeded admin: admin@vesta.health / admin123"
    echo "Web OTP bypass (DEV_MODE): 420420 / 840840"
    echo "Start apps: just wa"

# Check all service health endpoints
health:
    @echo "DB:      $(curl -s http://localhost:3000/api/health/db | head -c 80)"
    @echo "Redis:   $(curl -s http://localhost:3000/api/health/redis | head -c 80)"
    @echo "BDApps:  $(curl -s http://localhost:3000/api/health/bdapps | head -c 80)"
    @echo "Mailpit: $(curl -s http://localhost:3000/api/health/mailpit | head -c 80)"
    @echo "Worker:  $(curl -s http://localhost:3000/api/health/worker | head -c 80)"

# Smoke-test the four production BDApps webhook listeners (web must be on :3000)
webhook-smoke:
    bash scripts/smoke-bdapps-webhooks.sh

# ─── CRON (manual trigger) ──────────────────────────────

# Trigger daily reminders cron manually
cron-reminders:
    curl -s -X POST http://localhost:3000/api/cron/daily-reminders -H "Authorization: Bearer ${CRON_SECRET}" | python3 -m json.tool

# Trigger the daily subscription check (route slug caas-check) manually
cron-caas:
    curl -s -X POST http://localhost:3000/api/cron/caas-check -H "Authorization: Bearer ${CRON_SECRET}" | python3 -m json.tool

# ─── REDIS ──────────────────────────────────────────────

# Open the RedisInsight UI (browse Redis / BullMQ cron keys). First connect: host=redis, port=6379.
redis-ui:
    @echo "RedisInsight: http://localhost:5540  (add database -> host: redis, port: 6379)"
    @open http://localhost:5540 2>/dev/null || true

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
