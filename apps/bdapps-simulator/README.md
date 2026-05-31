# Vesta BDApps REST Simulator

Local BDApps-compatible REST simulator for Vesta development. This is separate
from the official/vendor TAP SDK simulator under `ops/simulator/bdapps`.

## URLs

| Purpose | URL |
| --- | --- |
| Health | `http://localhost:7010/health` |
| Swagger docs | `http://localhost:7010/docs` |
| OpenAPI JSON | `http://localhost:7010/openapi.json` |

## Dev

```bash
pnpm --filter @vesta/bdapps-simulator dev
```

Useful environment options:

| Variable | Purpose |
| --- | --- |
| `PORT` | REST simulator port. Defaults to `7010`. |
| `BDAPPS_SIMULATOR_PUBLIC_BASE_URL` | OpenAPI `servers[0].url`, useful when Docker publishes the simulator at `http://127.0.0.1:7010`. |
| `BDAPPS_SIMULATOR_CALLBACK_BASE_URL` | Optional callback base shown in Swagger as the resolved `apps/web` callback targets. |

The service keeps all state in memory. Restarting it resets subscribers,
OTP challenges, balances, and CAAS transactions.

When you run the simulator locally, it also writes compact request and
response logs to the console. Sensitive values are redacted before they
reach stdout or stderr so you can inspect traffic without leaking secrets.

Seeded subscribers:

| Subscriber | State |
| --- | --- |
| `tel:8801812345678` | `REGISTERED`, BDT 300 |
| `tel:8801800000001` | `REGISTERED`, BDT 1 |

Fixed OTPs `420420` and `840840` are accepted for every reference.

## Render deployment (free tier)

Host the simulator as a public Docker web service on [Render](https://render.com). The repo includes [`render.yaml`](../../render.yaml) at the monorepo root.

### One-time setup

1. Push this repo to GitHub (if not already).
2. In Render: **New → Blueprint** → connect the repository.
3. Render reads `render.yaml` and creates **vesta-bdapps-simulator** (Docker, free plan).
4. After the first successful deploy, open the service → **Environment** and set:
   - `BDAPPS_SIMULATOR_PUBLIC_BASE_URL` = `https://<your-service>.onrender.com`
5. Redeploy once so Swagger/OpenAPI shows the correct public URL.

### Manual setup (without Blueprint)

1. **New → Web Service → Build and deploy from Git**
2. **Root directory:** repository root
3. **Runtime:** Docker
4. **Dockerfile path:** `apps/bdapps-simulator/Dockerfile`
5. **Health check path:** `/health`
6. **Instance type:** Free
7. Set `BDAPPS_SIMULATOR_PUBLIC_BASE_URL` as above after first deploy.

Optional: `BDAPPS_SIMULATOR_CALLBACK_BASE_URL` — only needed if you want Swagger to display webhook callback targets for a remote web app.

### Free tier behavior

- Service **spins down after 15 minutes** with no inbound traffic.
- First request after sleep may take **30–60 seconds** (cold start).
- In-memory state (subscribers, OTP, CAAS transactions) is **lost** on stop, restart, or redeploy.
- Seeded defaults reload on wake (see table above).
- **750 instance hours/month** on the free plan; spun-down services do not consume hours.

No keep-alive pinger or paid plan is configured in this deploy.

### Post-deploy smoke tests

Replace `<service>` with your Render hostname:

```bash
# Health
curl https://<service>.onrender.com/health

# Swagger HTML
curl -I https://<service>.onrender.com/docs

# Subscription status
curl -X POST https://<service>.onrender.com/subscription/getStatus \
  -H "Content-Type: application/json" \
  -d '{"applicationId":"APP_SIMULATOR","password":"simulator_password","subscriberId":"tel:8801712345678"}'

# Subscribe action
curl -X POST https://<service>.onrender.com/subscription/send \
  -H "Content-Type: application/json" \
  -d '{"applicationId":"APP_SIMULATOR","password":"simulator_password","subscriberId":"tel:8801712345678","action":"1"}'
```

Expected: `statusCode: S1000`; `send` with `action: "1"` sets `subscriptionStatus` to `REGISTERED`.

### Local Docker preflight (same image Render builds)

```bash
docker build -f apps/bdapps-simulator/Dockerfile -t vesta-bdapps-simulator .
docker run --rm -p 7010:7010 \
  -e PORT=7010 \
  -e BDAPPS_SIMULATOR_PUBLIC_BASE_URL=http://127.0.0.1:7010 \
  vesta-bdapps-simulator
```

Then run the smoke-test curls against `http://127.0.0.1:7010`.

### Security

Uses fixed simulator credentials (`APP_SIMULATOR` / `simulator_password`). Suitable for a public mock/staging tool only — not production BDApps.
