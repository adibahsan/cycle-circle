# BDApps TAP SDK Simulator (Docker)

Reproducible Linux image for the vendor bundle under `Developer_Bundle/sdk-standalone-1.2.68/`: Jetty UI on **10001**, REST simulator on **7000** (SMS/USSD/CaaS per the BDApps guides).

The `Developer_Bundle/sdk-standalone-1.2.68/` runtime is intentionally kept in the repo because this Docker image copies the vendor SDK directly. Generated sample-app build outputs under `Developer_Bundle/sample-applications/**/target/` should not be committed.

## Prerequisites

- Docker with BuildKit and Compose v2
- On **Apple Silicon** or **arm64 Linux**, the compose file sets `platform: linux/amd64` because the Tanuki wrapper in the bundle is **x86_64-only**.

The image disables `bin/wrapper-linux-x86-32` (non-executable) so the startup script uses **wrapper-linux-x86-64** only. Otherwise the 32-bit wrapper is preferred and fails on slim amd64 images (`ld-linux.so.2` missing).

## Host port 7000 (macOS)

AirPlay Receiver / Control Center often binds **TCP 7000** on macOS. If `docker compose up` fails with “port already in use”, map a free host port to container **7000**, for example:

```yaml
ports:
  - "10001:10001"
  - "7002:7000"
```

REST URLs on the host become `http://localhost:7002/...` while the container still uses `7000` internally.

## Build and run

From this directory:

```bash
docker compose up --build
```

Or build from the **repository root**:

```bash
docker build -f docker/bdapps-simulator/Dockerfile -t bdapps-tap-simulator:local .
docker run --rm -p 10001:10001 -p 7000:7000 --platform linux/amd64 bdapps-tap-simulator:local
```

## URLs

| Purpose | URL |
|--------|-----|
| Simulator Web UI | http://localhost:10001/mchoice-tap-sdk |
| REST (SMS MT, USSD MT, CaaS, …) | http://localhost:7000/… (e.g. `/sms/send`, `/ussd/send`, `/caas/balance/query`) |

Sample scripts under `Developer_Bundle/sample-applications/` use `http://localhost:7000/...`; with the default compose mapping, that matches the container.

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TAP_REST_PORT` | `7000` | Binds the CXF REST server inside the WAR (`tap-sim.properties` → `rest.server.url`). |
| `TAP_UI_PORT` | `10001` | Jetty port for the Web UI (`conf/tap-sdk.properties` → `tap.sdk.startup.port`). |

If you change these, update the Compose **`ports:`** mapping so the **container** side matches (e.g. `"10002:10002"` when `TAP_UI_PORT=10002`) and adjust the **healthcheck** URL if you change `TAP_UI_PORT`.

## Smoke tests

1. **Web UI**

   ```bash
   curl -fsS -o /dev/null -w "%{http_code}\n" http://localhost:10001/mchoice-tap-sdk
   ```

   Expect `200`.

2. **REST SMS send** (minimal body; align fields with [BDApps Pro API Guide.pdf](../../Developer_Bundle/BDApps%20Pro%20API%20Guide.pdf))

   ```bash
   curl -sS -X POST "http://localhost:7000/sms/send" \
     -H "Content-Type: application/json" \
     -d '{"password":"password","message":"Docker smoke test","destinationAddresses":["tel:8801812345678"],"applicationId":"APP_000006","deliveryStatusRequest":"0","version":"1.0"}'
   ```

3. **MO toward an app on your host** (Docker Desktop)

   In the simulator UI, set the application URL to something reachable from the container, for example:

   - `http://host.docker.internal:5555/mo-receiver` (SMS MO)
   - `http://host.docker.internal:5555/mo-ussd` (USSD MO)

   Run your listener on the host on that port. On Linux without Docker Desktop, use your host gateway IP or add the app as another Compose service and use its service name.

## Clean WAR / reproducible builds

The entrypoint **rewrites** `WEB-INF/classes/tap-sim.properties` inside `lib/mchoice-tap-sdk.war` on every container start so `TAP_REST_PORT` is applied. Do not rely on a host-only patch (e.g. macOS moving REST to 7001) being baked into the image: keep `Developer_Bundle/sdk-standalone-1.2.68` as close to vendor defaults as possible. If the WAR on disk was modified manually, restore from backup or re-extract the original distribution before committing.

## Stop

```bash
docker compose down
```

Press **Ctrl+C** if running in the foreground.
