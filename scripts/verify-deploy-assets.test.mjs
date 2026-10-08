import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missingSelfSignedSans } from './verify-deploy-assets.mjs';

const cert = (san) => `openssl req -addext "subjectAltName=${san}"\n`;
const nginx = (names) => `server {\n  server_name ${names};\n}\n`;

test('reports a host missing from the SAN', () => {
  assert.deepEqual(
    missingSelfSignedSans(nginx('a.example.com b.example.com'), cert('DNS:a.example.com')),
    ['b.example.com'],
  );
});

test('handles multi-line server_name', () => {
  const conf = 'server {\n  server_name a.example.com\n    b.example.com\n    c.example.com;\n}\n';
  assert.deepEqual(missingSelfSignedSans(conf, cert('DNS:a.example.com')), [
    'b.example.com',
    'c.example.com',
  ]);
});

test('ignores # comments inside and after server_name', () => {
  const conf =
    'server {\n  server_name a.example.com # b.example.com;\n    ;\n}\n' +
    'server {\n  server_name c.example.com\n    # d.example.com\n    ; # e.example.com\n}\n' +
    '# server_name f.example.com;\n';
  assert.deepEqual(missingSelfSignedSans(conf, cert('DNS:a.example.com,DNS:c.example.com')), []);
});

test('skips regex (~), $host, _, localhost and non-FQDN names', () => {
  const conf = nginx('~^(www\\.)?x\\.example\\.com$ $host _ localhost intranet a.example.com');
  assert.deepEqual(missingSelfSignedSans(conf, cert('DNS:a.example.com')), []);
});

test('wildcard SAN covers one label only', () => {
  assert.deepEqual(
    missingSelfSignedSans(nginx('monitoring.cycle-circle.com'), cert('DNS:*.cycle-circle.com')),
    [],
  );
  assert.deepEqual(
    missingSelfSignedSans(nginx('a.b.cycle-circle.com'), cert('DNS:*.cycle-circle.com')),
    ['a.b.cycle-circle.com'],
  );
});

test('ignores commented-out older subjectAltName lines', () => {
  const script =
    '# -addext "subjectAltName=DNS:a.example.com,DNS:b.example.com"\n' +
    'openssl req -addext "subjectAltName=DNS:a.example.com"\n';
  assert.deepEqual(missingSelfSignedSans(nginx('a.example.com b.example.com'), script), [
    'b.example.com',
  ]);
});
