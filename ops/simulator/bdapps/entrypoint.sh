#!/bin/bash
set -euo pipefail

cd /opt/tap-sdk

TAP_REST_PORT="${TAP_REST_PORT:-7000}"
TAP_UI_PORT="${TAP_UI_PORT:-10001}"

# Web UI port (Jetty hosting mchoice-tap-sdk.war)
if [[ -f conf/tap-sdk.properties ]]; then
  sed -i "s/^tap.sdk.startup.port=.*/tap.sdk.startup.port=${TAP_UI_PORT}/" conf/tap-sdk.properties
fi

# REST / NCS simulator port (CXF/Jetty inside WAR — tap-sim.properties)
WAR="/opt/tap-sdk/lib/mchoice-tap-sdk.war"
if [[ -f "$WAR" ]]; then
  TMP="$(mktemp -d)"
  trap 'rm -rf "$TMP"' EXIT
  unzip -q "$WAR" WEB-INF/classes/tap-sim.properties -d "$TMP"
  sed -i "s|^rest.server.url=.*|rest.server.url=http://0.0.0.0:${TAP_REST_PORT}|" \
    "$TMP/WEB-INF/classes/tap-sim.properties"
  (cd "$TMP" && zip -q -u "$WAR" WEB-INF/classes/tap-sim.properties)
fi

if [[ $# -eq 0 ]]; then
  set -- console
fi
exec ./bin/tap-simulator "$@"
