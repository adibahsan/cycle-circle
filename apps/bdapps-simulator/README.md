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

The service keeps all state in memory. Restarting it resets subscribers,
OTP challenges, balances, and CAAS transactions.

Seeded subscribers:

| Subscriber | State |
| --- | --- |
| `tel:8801812345678` | `REGISTERED`, BDT 300 |
| `tel:8801800000001` | `REGISTERED`, BDT 1 |

Fixed OTPs `420420` and `840840` are accepted for every reference.
