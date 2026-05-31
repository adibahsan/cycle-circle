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
