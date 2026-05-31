import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const applicationId = 'APP_SIMULATOR';
const password = 'simulator_password';

test('BDApps simulator supports OTP, subscription, CAAS, and deterministic failures', async (t) => {
  const port = String(18000 + Math.floor(Math.random() * 1000));
  const server = spawnServer(port);
  t.after(() => stopServer(server));

  await waitForHealth(port);

  const otpRequest = await post(port, '/otp/request', {
    applicationId,
    password,
    subscriberId: 'tel:8801812345678',
  });
  assert.equal(otpRequest.statusCode, 'S1000');
  assert.equal(typeof otpRequest.referenceNo, 'string');

  const invalidOtp = await post(port, '/otp/verify', {
    applicationId,
    password,
    referenceNo: otpRequest.referenceNo,
    otp: '000000',
  });
  assert.equal(invalidOtp.statusCode, 'E1850');

  const validOtp = await post(port, '/otp/verify', {
    applicationId,
    password,
    referenceNo: otpRequest.referenceNo,
    otp: '420420',
  });
  assert.equal(validOtp.statusCode, 'S1000');
  assert.equal(validOtp.subscriptionStatus, 'REGISTERED');

  const unregistered = await post(port, '/subscription/getStatus', {
    applicationId,
    password,
    subscriberId: 'tel:8801811111111',
  });
  assert.equal(unregistered.statusCode, 'S1000');
  assert.equal(unregistered.subscriptionStatus, 'UNREGISTERED');

  const registered = await post(port, '/subscription/send', {
    applicationId,
    password,
    subscriberId: 'tel:8801811111111',
    action: '1',
  });
  assert.equal(registered.subscriptionStatus, 'REGISTERED');

  const debit = await post(port, '/caas/direct/debit', {
    applicationId,
    password,
    subscriberId: 'tel:8801811111111',
    externalTrxId: 'trx-smoke-001',
    paymentInstrumentName: 'PaymentInstrument',
    amount: 5,
  });
  assert.equal(debit.statusCode, 'S1000');

  const duplicate = await post(port, '/caas/direct/debit', {
    applicationId,
    password,
    subscriberId: 'tel:8801811111111',
    externalTrxId: 'trx-smoke-001',
    paymentInstrumentName: 'PaymentInstrument',
    amount: 5,
  });
  assert.equal(duplicate.statusCode, 'E1335');

  const lowBalance = await post(port, '/caas/direct/debit', {
    applicationId,
    password,
    subscriberId: 'tel:8801800000001',
    externalTrxId: 'trx-smoke-low-balance',
    paymentInstrumentName: 'PaymentInstrument',
    amount: 5,
  });
  assert.equal(lowBalance.statusCode, 'E1326');
});

function spawnServer(port: string) {
  const serverPath = fileURLToPath(new URL('./server.js', import.meta.url));
  return spawn(process.execPath, [serverPath], {
    env: { ...process.env, PORT: port },
    stdio: 'ignore',
  });
}

async function waitForHealth(port: string) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error('Simulator did not become healthy in time');
}

async function post(port: string, path: string, body: Record<string, unknown>) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.json() as Promise<Record<string, unknown>>;
}

function stopServer(server: ChildProcess) {
  if (!server.killed) server.kill();
}
