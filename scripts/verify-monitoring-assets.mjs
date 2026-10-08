#!/usr/bin/env node
/**
 * Monitoring stack verification: file inventory + merged Compose config render.
 * Does not require /opt/vesta production secrets or a running Docker stack.
 */

import { access, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Canonical inventory (keep aligned with ops/monitoring/README.md). */
const REQUIRED_MONITORING_PATHS = [
  'ops/monitoring/README.md',
  'ops/monitoring/compose.yml',
  'ops/monitoring/compose.local.override.yml',
  'ops/monitoring/compose.prod.override.yml',
  'ops/monitoring/compose.verify.stub-env.yml',
  'ops/monitoring/prometheus/prometheus.yml',
  'ops/monitoring/container-metrics-exporter/Dockerfile',
  'ops/monitoring/container-metrics-exporter/exporter.py',
  'ops/monitoring/grafana/provisioning/datasources/prometheus.yml',
  'ops/monitoring/grafana/provisioning/dashboards/dashboards.yml',
  'ops/monitoring/grafana/provisioning/dashboards/json/vesta-infra.json',
  'ops/monitoring/grafana/provisioning/dashboards/json/vesta-host-system.json',
  'ops/monitoring/grafana/provisioning/dashboards/json/vesta-containers.json',
  'ops/monitoring/grafana/provisioning/dashboards/json/vesta-services.json',
  'ops/monitoring/env/monitoring.local.example',
  'ops/monitoring/env/monitoring.production.example',
  'ops/monitoring/stub/.env.web.production',
  'ops/monitoring/stub/.env.admin.production',
  'ops/monitoring/stub/.env.postgres.production',
];

/** Scrape jobs required in v1 (spec: host, containers, nginx, postgres, redis). */
const REQUIRED_PROMETHEUS_JOBS = [
  'prometheus',
  'node_exporter',
  'cadvisor',
  'container_metrics',
  'nginx',
  'postgres',
  'redis',
];

const LOCAL_COMPOSE_FILES = [
  'ops/docker/compose.yml',
  'ops/monitoring/compose.yml',
  'ops/monitoring/compose.local.override.yml',
];

const PROD_COMPOSE_FILES = ['ops/deploy/compose.prod.yml'];

/** Env file paths for `docker compose config` (relative to ops/deploy/). */
const PROD_VERIFY_ENV = {
  VESTA_WEB_ENV_FILE: '../monitoring/stub/.env.web.production',
  VESTA_ADMIN_ENV_FILE: '../monitoring/stub/.env.admin.production',
  VESTA_POSTGRES_ENV_FILE: '../monitoring/stub/.env.postgres.production',
  VESTA_MONITORING_ENV_FILE: '../monitoring/stub/.env.monitoring.production',
  PROMETHEUS_RETENTION: '30d',
};

async function pathExists(relativePath) {
  try {
    await access(path.join(repoRoot, relativePath));
    return true;
  } catch {
    return false;
  }
}

/** @param {string} composeText */
function bindMountPathsFromCompose(composeText) {
  const found = new Set();
  const bindRe = /-\s+\.\/([^:${}\s]+):/g;
  let m;
  while ((m = bindRe.exec(composeText)) !== null) {
    found.add(`ops/monitoring/${m[1]}`);
  }
  const monBindRe = /-\s+\.\.\/monitoring\/([^:${}\s]+):/g;
  while ((m = monBindRe.exec(composeText)) !== null) {
    found.add(`ops/monitoring/${m[1]}`);
  }
  return [...found];
}

function assertPrometheusJobs(prometheusYaml) {
  const missing = [];
  for (const job of REQUIRED_PROMETHEUS_JOBS) {
    const jobRe = new RegExp(`job_name:\\s*['"]?${job}['"]?`, 'm');
    if (!jobRe.test(prometheusYaml)) {
      missing.push(job);
    }
  }
  return missing;
}

/**
 * @param {string[]} composeFiles relative to repo root
 * @param {string} label
 */
function dockerComposeConfig(composeFiles, label, extraEnv = {}) {
  const absFiles = composeFiles.map((f) => path.join(repoRoot, f));
  for (const f of absFiles) {
    if (!pathExists(path.relative(repoRoot, f))) {
      return { ok: false, error: `missing compose file: ${path.relative(repoRoot, f)}` };
    }
  }

  const result = spawnSync(
    'docker',
    ['compose', ...absFiles.flatMap((f) => ['-f', f]), 'config'],
    { encoding: 'utf8', cwd: repoRoot, env: { ...process.env, ...extraEnv } },
  );

  if (result.error) {
    return {
      ok: false,
      error: `${label}: docker compose failed (${result.error.message}). Is Docker installed?`,
    };
  }
  if (result.status !== 0) {
    return {
      ok: false,
      error: `${label}: docker compose config exited ${result.status}\n${result.stderr}`,
    };
  }

  const rendered = result.stdout;
  const mustInclude = ['prometheus:', 'grafana:', 'postgres-exporter:', 'redis-exporter:'];
  for (const needle of mustInclude) {
    if (!rendered.includes(needle)) {
      return { ok: false, error: `${label}: merged config missing service ${needle}` };
    }
  }

  const grafanaPublishes3030 = /grafana:[\s\S]*?published:\s*"?3030"?/m.test(rendered);

  if (label.includes('prod')) {
    if (grafanaPublishes3030) {
      return { ok: false, error: `${label}: Grafana must not publish host ports in production merge` };
    }
    if (!rendered.includes('--storage.tsdb.retention.time=30d')) {
      return { ok: false, error: `${label}: Prometheus retention must be 30d in production` };
    }
  }

  if (label.includes('local')) {
    if (!grafanaPublishes3030) {
      return { ok: false, error: `${label}: Grafana must publish localhost:3030 in local merge` };
    }
    if (!rendered.includes('--storage.tsdb.retention.time=7d')) {
      return { ok: false, error: `${label}: Prometheus retention must be 7d locally` };
    }
  }

  return { ok: true };
}

async function main() {
  const missing = [];
  for (const rel of REQUIRED_MONITORING_PATHS) {
    if (!(await pathExists(rel))) {
      missing.push(rel);
    }
  }

  let monitoringComposeText = '';
  try {
    monitoringComposeText = await readFile(path.join(repoRoot, 'ops/monitoring/compose.yml'), 'utf8');
  } catch {
    if (!missing.includes('ops/monitoring/compose.yml')) {
      missing.push('ops/monitoring/compose.yml (unreadable)');
    }
  }

  for (const rel of bindMountPathsFromCompose(monitoringComposeText)) {
    if (!(await pathExists(rel))) {
      missing.push(rel);
    }
  }

  let promMissing = [];
  try {
    const promYaml = await readFile(
      path.join(repoRoot, 'ops/monitoring/prometheus/prometheus.yml'),
      'utf8',
    );
    promMissing = assertPrometheusJobs(promYaml);
  } catch {
    promMissing = REQUIRED_PROMETHEUS_JOBS;
  }

  if (missing.length > 0 || promMissing.length > 0) {
    console.error('Monitoring asset verification failed.');
    if (missing.length > 0) {
      console.error('Missing paths:');
      for (const p of [...new Set(missing)].sort()) {
        console.error(`  - ${p}`);
      }
    }
    if (promMissing.length > 0) {
      console.error('Missing Prometheus scrape jobs:', promMissing.join(', '));
    }
    process.exit(1);
  }

  const nginxConf = await readFile(
    path.join(repoRoot, 'ops/deploy/nginx/cycle-circle.conf'),
    'utf8',
  );
  if (!nginxConf.includes('monitoring.cycle-circle.com')) {
    console.error('Production nginx LE config must include monitoring.cycle-circle.com');
    process.exit(1);
  }

  const localCfg = dockerComposeConfig(LOCAL_COMPOSE_FILES, 'local+monitoring', {
    PROMETHEUS_RETENTION: '7d',
  });
  if (!localCfg.ok) {
    console.error(localCfg.error);
    process.exit(1);
  }

  const prodCfg = dockerComposeConfig(PROD_COMPOSE_FILES, 'prod+monitoring', PROD_VERIFY_ENV);
  if (!prodCfg.ok) {
    console.error(prodCfg.error);
    process.exit(1);
  }

  console.log(
    `Monitoring assets OK (${REQUIRED_MONITORING_PATHS.length} paths, ${REQUIRED_PROMETHEUS_JOBS.length} scrape jobs, compose merges).`,
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
