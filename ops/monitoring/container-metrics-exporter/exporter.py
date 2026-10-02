#!/usr/bin/env python3
"""Per-container CPU, memory, and network via Docker Engine API (containerd snapshotter safe)."""

from __future__ import annotations

import os
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, HTTPServer

import docker
from prometheus_client import CONTENT_TYPE_LATEST, Gauge, generate_latest

REFRESH_SECONDS = float(os.environ.get("REFRESH_SECONDS", "15"))

CPU_CORES = Gauge(
    "vesta_container_cpu_cores",
    "Approximate CPU cores in use (from docker stats)",
    ["container_name", "compose_service"],
)
MEM_BYTES = Gauge(
    "vesta_container_memory_bytes",
    "Memory usage bytes (docker memory_stats.usage)",
    ["container_name", "compose_service"],
)
NET_RX = Gauge(
    "vesta_container_network_rx_bytes",
    "Cumulative network bytes received (all interfaces)",
    ["container_name", "compose_service"],
)
NET_TX = Gauge(
    "vesta_container_network_tx_bytes",
    "Cumulative network bytes transmitted (all interfaces)",
    ["container_name", "compose_service"],
)

_client: docker.DockerClient | None = None
_lock = threading.Lock()


def _docker() -> docker.DockerClient:
    global _client
    if _client is None:
        _client = docker.from_env()
    return _client


def _cpu_cores(stats: dict) -> float:
    cpu = stats.get("cpu_stats") or {}
    precpu = stats.get("precpu_stats") or {}
    cpu_usage = cpu.get("cpu_usage") or {}
    precpu_usage = precpu.get("cpu_usage") or {}
    cpu_delta = cpu_usage.get("total_usage", 0) - precpu_usage.get("total_usage", 0)
    sys_delta = cpu.get("system_cpu_usage", 0) - precpu.get("system_cpu_usage", 0)
    if sys_delta <= 0 or cpu_delta < 0:
        return 0.0
    online = cpu.get("online_cpus")
    if not online:
        percpu = cpu_usage.get("percpu_usage") or []
        online = len(percpu) if percpu else 1
    return (cpu_delta / sys_delta) * online


def _sample(container) -> tuple | None:
    name = container.name
    labels = container.labels or {}
    service = labels.get("com.docker.compose.service") or name
    try:
        stats = container.stats(stream=False)
    except docker.errors.APIError:
        return None

    mem = (stats.get("memory_stats") or {}).get("usage")
    rx = 0
    tx = 0
    for iface in (stats.get("networks") or {}).values():
        rx += iface.get("rx_bytes", 0)
        tx += iface.get("tx_bytes", 0)
    return name, service, _cpu_cores(stats), mem, rx, tx


def collect() -> None:
    # Each stats(stream=False) call blocks ~2s waiting for a second CPU sample,
    # so fetch in parallel and hold the lock only for the gauge swap; otherwise
    # scrapes block past Prometheus' scrape_timeout.
    containers = _docker().containers.list()
    with ThreadPoolExecutor(max_workers=max(1, min(16, len(containers)))) as pool:
        samples = [s for s in pool.map(_sample, containers) if s is not None]

    with _lock:
        CPU_CORES.clear()
        MEM_BYTES.clear()
        NET_RX.clear()
        NET_TX.clear()
        for name, service, cpu, mem, rx, tx in samples:
            CPU_CORES.labels(name, service).set(cpu)
            if mem is not None:
                MEM_BYTES.labels(name, service).set(mem)
            NET_RX.labels(name, service).set(rx)
            NET_TX.labels(name, service).set(tx)


def _refresh_loop() -> None:
    while True:
        try:
            collect()
        except Exception:
            pass
        time.sleep(REFRESH_SECONDS)


class _MetricsHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path != "/metrics":
            self.send_response(404)
            self.end_headers()
            return
        with _lock:
            payload = generate_latest()
        self.send_response(200)
        self.send_header("Content-Type", CONTENT_TYPE_LATEST)
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, _format: str, *_args: object) -> None:
        return


def main() -> None:
    port = int(os.environ.get("METRICS_PORT", "9487"))
    threading.Thread(target=_refresh_loop, daemon=True).start()
    time.sleep(1)
    HTTPServer(("0.0.0.0", port), _MetricsHandler).serve_forever()


if __name__ == "__main__":
    main()
