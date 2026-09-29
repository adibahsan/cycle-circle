# Container metrics exporter

Docker Engine stats → Prometheus (CPU cores, memory, network). Used when cAdvisor cannot read container metadata (Docker **containerd snapshotter** on the VPS — no `overlayfs/layerdb/mount-id`).

Requires **privileged** access to `docker.sock` (same constraint as `docker ps` from a container on hardened hosts).

Scrape job: `container_metrics` → `container-metrics:9487`.
