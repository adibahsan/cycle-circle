import logging
import os
import sys
import types
import unittest
from unittest import mock

# Stub third-party modules so the exporter imports without them installed.
_docker = types.ModuleType("docker")
_docker.DockerClient = object
_docker.errors = types.SimpleNamespace(APIError=Exception)
_prom = types.ModuleType("prometheus_client")
_prom.CONTENT_TYPE_LATEST = "text/plain"
_prom.Gauge = lambda *a, **k: mock.MagicMock()
_prom.generate_latest = lambda: b""
sys.modules.setdefault("docker", _docker)
sys.modules.setdefault("prometheus_client", _prom)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import exporter  # noqa: E402


class RefreshOnceTest(unittest.TestCase):
    def test_collect_failure_is_logged_and_not_raised(self):
        with mock.patch.object(exporter, "collect", side_effect=RuntimeError("boom")):
            with self.assertLogs("container-metrics", "ERROR") as cm:
                exporter._refresh_once()
        record = cm.records[0]
        self.assertIn("boom", cm.output[0])
        self.assertIsNotNone(record.exc_info)

    def test_success_logs_nothing_and_calls_collect(self):
        with mock.patch.object(exporter, "collect") as collect:
            exporter._refresh_once()
        collect.assert_called_once()

    def test_success_emits_no_logs(self):
        logger = logging.getLogger("container-metrics")
        records = []
        handler = logging.Handler()
        handler.emit = records.append
        logger.addHandler(handler)
        try:
            with mock.patch.object(exporter, "collect"):
                exporter._refresh_once()
        finally:
            logger.removeHandler(handler)
        self.assertEqual(records, [])


class LogLevelTest(unittest.TestCase):
    def test_lowercase_env_is_uppercased(self):
        with mock.patch.dict(os.environ, {"LOG_LEVEL": "info"}):
            self.assertEqual(exporter._log_level(), "INFO")

    def test_default_is_info(self):
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertEqual(exporter._log_level(), "INFO")


if __name__ == "__main__":
    unittest.main()
