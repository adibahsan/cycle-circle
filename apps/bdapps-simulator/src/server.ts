import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomInt, randomUUID } from 'node:crypto';
import { createOpenApiSpec } from './openapi.js';

type SubscriptionStatus = 'REGISTERED' | 'UNREGISTERED';

interface SubscriberState {
  subscriberId: string;
  subscriptionStatus: SubscriptionStatus;
  balance: number;
  accountType: 'Pre Paid' | 'Post Paid';
  accountStatus: 'Active' | 'Disabled';
}

interface OtpChallenge {
  referenceNo: string;
  subscriberId: string;
  otp: string;
  verified: boolean;
}

interface CaasTransaction {
  externalTrxId: string;
  internalTrxId: string;
  referenceId: string;
  amount: number;
  subscriberId: string;
  createdAt: string;
}

const PORT = Number(process.env.PORT ?? 7010);
const PUBLIC_BASE_URL = trimTrailingSlash(
  process.env.BDAPPS_SIMULATOR_PUBLIC_BASE_URL ?? `http://localhost:${PORT}`,
);
const CALLBACK_BASE_URL = process.env.BDAPPS_SIMULATOR_CALLBACK_BASE_URL
  ? trimTrailingSlash(process.env.BDAPPS_SIMULATOR_CALLBACK_BASE_URL)
  : undefined;
const FIXED_OTPS = new Set(['420420', '840840']);
const subscribers = new Map<string, SubscriberState>();
const otpChallenges = new Map<string, OtpChallenge>();
const caasTransactions = new Map<string, CaasTransaction>();

seedState();

const server = createServer(async (request, response) => {
  try {
    await route(request, response);
  } catch (error) {
    console.error(error);
    sendJson(response, 500, {
      statusCode: 'E1600',
      statusDetail: 'Internal simulator error',
    });
  }
});

server.listen(PORT, () => {
  console.log(`Vesta BDApps REST simulator listening on http://localhost:${PORT}`);
});

async function route(request: IncomingMessage, response: ServerResponse) {
  const method = request.method ?? 'GET';
  const path = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`).pathname;

  if (method === 'OPTIONS') {
    sendJson(response, 204, null);
    return;
  }

  if (method === 'GET' && path === '/health') {
    sendJson(response, 200, {
      status: 'ok',
      simulator: 'vesta-bdapps-rest-simulator',
      subscribers: subscribers.size,
      transactions: caasTransactions.size,
      publicBaseUrl: PUBLIC_BASE_URL,
      callbackBaseUrl: CALLBACK_BASE_URL ?? null,
    });
    return;
  }

  if (method === 'GET' && path === '/openapi.json') {
    sendJson(response, 200, openApiSpec());
    return;
  }

  if (method === 'GET' && (path === '/' || path === '/docs')) {
    sendHtml(response, docsHtml());
    return;
  }

  if (method !== 'POST') {
    sendJson(response, 404, errorResponse('E1404', 'Endpoint not found'));
    return;
  }

  const body = await readJsonBody(request);

  switch (path) {
    case '/otp/request':
      handleOtpRequest(response, body);
      return;
    case '/otp/verify':
      handleOtpVerify(response, body);
      return;
    case '/subscription/getStatus':
      handleSubscriptionGetStatus(response, body);
      return;
    case '/subscription/send':
      handleSubscriptionSend(response, body);
      return;
    case '/subscription/query-base':
      handleSubscriptionQueryBase(response, body);
      return;
    case '/caas/get/balance':
      handleCaasBalance(response, body);
      return;
    case '/caas/direct/debit':
      handleCaasDebit(response, body);
      return;
    default:
      sendJson(response, 404, errorResponse('E1404', 'Endpoint not found'));
  }
}

function handleOtpRequest(response: ServerResponse, body: Record<string, unknown>) {
  const authError = validateAuth(body);
  if (authError) {
    sendJson(response, 200, authError);
    return;
  }

  const subscriberId = normalizeSubscriberId(body.subscriberId);
  if (!subscriberId) {
    sendJson(response, 200, errorResponse('E1312', 'subscriberId is required'));
    return;
  }

  ensureSubscriber(subscriberId);
  const referenceNo = `REF-${Date.now()}-${randomInt(1000, 9999)}`;
  const otp = '420420';
  otpChallenges.set(referenceNo, { referenceNo, subscriberId, otp, verified: false });

  sendJson(response, 200, {
    version: '1.0',
    statusCode: 'S1000',
    referenceNo,
    debugOtp: otp,
    statusDetail: 'Success',
  });
}

function handleOtpVerify(response: ServerResponse, body: Record<string, unknown>) {
  const authError = validateAuth(body);
  if (authError) {
    sendJson(response, 200, authError);
    return;
  }

  const referenceNo = asString(body.referenceNo);
  const otp = asString(body.otp);
  if (!referenceNo || !otp) {
    sendJson(response, 200, errorResponse('E1312', 'referenceNo and otp are required'));
    return;
  }

  const challenge = otpChallenges.get(referenceNo);
  if (!challenge) {
    sendJson(response, 200, errorResponse('E1855', 'Invalid Reference Number.'));
    return;
  }

  if (challenge.otp !== otp && !FIXED_OTPS.has(otp)) {
    sendJson(response, 200, errorResponse('E1850', 'Invalid OTP.'));
    return;
  }

  challenge.verified = true;
  const subscriber = ensureSubscriber(challenge.subscriberId);
  subscriber.subscriptionStatus = 'REGISTERED';

  sendJson(response, 200, {
    version: '1.0',
    statusCode: 'S1000',
    subscriptionStatus: subscriber.subscriptionStatus,
    statusDetail: 'Success',
    subscriberId: subscriber.subscriberId,
  });
}

function handleSubscriptionGetStatus(response: ServerResponse, body: Record<string, unknown>) {
  const authError = validateAuth(body);
  if (authError) {
    sendJson(response, 200, authError);
    return;
  }

  const subscriberId = normalizeSubscriberId(body.subscriberId);
  if (!subscriberId) {
    sendJson(response, 200, errorResponse('E1317', 'Subscriber is invalid or not allowed.'));
    return;
  }

  const subscriptionStatus = subscribers.get(subscriberId)?.subscriptionStatus ?? 'UNREGISTERED';
  sendJson(response, 200, subscriptionStatusResponse(subscriptionStatus, subscriberId));
}

function handleSubscriptionSend(response: ServerResponse, body: Record<string, unknown>) {
  const authError = validateAuth(body);
  if (authError) {
    sendJson(response, 200, authError);
    return;
  }

  const subscriberId = normalizeSubscriberId(body.subscriberId);
  const action = asString(body.action);
  if (!subscriberId || !['0', '1'].includes(action ?? '')) {
    sendJson(response, 200, errorResponse('E1312', 'subscriberId and action 0 or 1 are required'));
    return;
  }

  const subscriber = ensureSubscriber(subscriberId);
  subscriber.subscriptionStatus = action === '1' ? 'REGISTERED' : 'UNREGISTERED';
  sendJson(response, 200, subscriptionStatusResponse(subscriber.subscriptionStatus, subscriberId));
}

function handleSubscriptionQueryBase(response: ServerResponse, body: Record<string, unknown>) {
  const authError = validateAuth(body);
  if (authError) {
    sendJson(response, 200, authError);
    return;
  }

  const baseSize = [...subscribers.values()].filter(
    (subscriber) => subscriber.subscriptionStatus === 'REGISTERED',
  ).length;

  sendJson(response, 200, {
    baseSize: String(baseSize),
    version: '1.0.',
    statusCode: 'S1000',
    statusDetail: 'Success.',
  });
}

function handleCaasBalance(response: ServerResponse, body: Record<string, unknown>) {
  const authError = validateAuth(body);
  if (authError) {
    sendJson(response, 200, authError);
    return;
  }

  const subscriber = findChargeableSubscriber(body);
  if ('statusCode' in subscriber) {
    sendJson(response, 200, subscriber);
    return;
  }

  sendJson(response, 200, {
    accountType: subscriber.accountType,
    accountStatus: subscriber.accountStatus,
    statusCode: 'S1000',
    statusDetail: 'Success.',
    chargeableBalance: subscriber.balance.toFixed(1),
  });
}

function handleCaasDebit(response: ServerResponse, body: Record<string, unknown>) {
  const authError = validateAuth(body);
  if (authError) {
    sendJson(response, 200, authError);
    return;
  }

  const subscriber = findChargeableSubscriber(body);
  if ('statusCode' in subscriber) {
    sendJson(response, 200, subscriber);
    return;
  }

  const externalTrxId = asString(body.externalTrxId);
  const amount = Number(body.amount);
  if (!externalTrxId || !Number.isFinite(amount) || amount <= 0) {
    sendJson(response, 200, errorResponse('E1312', 'externalTrxId and positive amount are required'));
    return;
  }

  if (caasTransactions.has(externalTrxId)) {
    sendJson(response, 200, errorResponse('E1335', 'Duplicate external transaction id'));
    return;
  }

  if (subscriber.balance < amount) {
    sendJson(response, 200, errorResponse('E1326', 'Insufficient balance'));
    return;
  }

  subscriber.balance -= amount;
  const transaction: CaasTransaction = {
    externalTrxId,
    internalTrxId: `INT-${randomUUID()}`,
    referenceId: `REF-${randomInt(10000000, 99999999)}`,
    amount,
    subscriberId: subscriber.subscriberId,
    createdAt: new Date().toISOString(),
  };
  caasTransactions.set(externalTrxId, transaction);

  sendJson(response, 200, {
    externalTrxId: transaction.externalTrxId,
    internalTrxId: transaction.internalTrxId,
    referenceId: transaction.referenceId,
    timeStamp: transaction.createdAt,
    statusCode: 'S1000',
    statusDetail: 'Success.',
  });
}

function findChargeableSubscriber(body: Record<string, unknown>) {
  const subscriberId = normalizeSubscriberId(body.subscriberId);
  if (!subscriberId) return errorResponse('E1317', 'Subscriber is invalid or not allowed.');

  const subscriber = subscribers.get(subscriberId);
  if (!subscriber) return errorResponse('E1317', 'Subscriber is invalid or not allowed.');
  if (subscriber.subscriptionStatus !== 'REGISTERED') {
    return errorResponse('E1317', 'Subscriber is invalid or not allowed.');
  }
  if (subscriber.accountStatus !== 'Active') {
    return errorResponse('E1317', 'Subscriber is invalid or not allowed.');
  }

  return subscriber;
}

function validateAuth(body: Record<string, unknown>) {
  if (!asString(body.applicationId) || !asString(body.password)) {
    return errorResponse('E1313', 'applicationId and password are required');
  }
  return null;
}

function subscriptionStatusResponse(subscriptionStatus: SubscriptionStatus, subscriberId: string) {
  return {
    version: '1.0.',
    statusCode: 'S1000',
    statusDetail: 'Request was successfully processed',
    subscriptionStatus,
    subscriberId,
  };
}

function errorResponse(statusCode: string, statusDetail: string) {
  return {
    version: '1.0.',
    statusCode,
    statusDetail,
  };
}

function ensureSubscriber(subscriberId: string) {
  let subscriber = subscribers.get(subscriberId);
  if (!subscriber) {
    subscriber = {
      subscriberId,
      subscriptionStatus: 'UNREGISTERED',
      balance: 300,
      accountType: 'Pre Paid',
      accountStatus: 'Active',
    };
    subscribers.set(subscriberId, subscriber);
  }
  return subscriber;
}

function seedState() {
  subscribers.clear();
  otpChallenges.clear();
  caasTransactions.clear();
  subscribers.set('tel:8801812345678', {
    subscriberId: 'tel:8801812345678',
    subscriptionStatus: 'REGISTERED',
    balance: 300,
    accountType: 'Pre Paid',
    accountStatus: 'Active',
  });
  subscribers.set('tel:8801800000001', {
    subscriberId: 'tel:8801800000001',
    subscriptionStatus: 'REGISTERED',
    balance: 1,
    accountType: 'Pre Paid',
    accountStatus: 'Active',
  });
}

async function readJsonBody(request: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};

  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  });
  if (statusCode === 204) {
    response.end();
    return;
  }
  response.end(JSON.stringify(body));
}

function sendHtml(response: ServerResponse, html: string) {
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
  response.end(html);
}

function normalizeSubscriberId(value: unknown) {
  const raw = asString(value);
  if (!raw) return null;
  if (raw.startsWith('tel:')) return raw;
  if (raw.startsWith('+88')) return `tel:88${raw.slice(3)}`;
  if (raw.startsWith('88')) return `tel:${raw}`;
  return `tel:${raw}`;
}

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function docsHtml() {
  const callbackText = CALLBACK_BASE_URL
    ? `Callback base: ${escapeHtml(CALLBACK_BASE_URL)}`
    : 'Callback base: not configured';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Vesta BDApps REST Simulator</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; background: #f7faf9; }
      .fallback { padding: 16px 24px; font-family: system-ui, sans-serif; }
      .config {
        padding: 10px 24px;
        font: 13px/1.4 system-ui, sans-serif;
        background: #eef6f4;
        color: #16423c;
        border-bottom: 1px solid #c9e4de;
      }
      .config code { background: #fff; padding: 2px 5px; border-radius: 4px; }
    </style>
  </head>
  <body>
    <div class="config">
      <strong>OpenAPI server:</strong> <code>${escapeHtml(PUBLIC_BASE_URL)}</code>
      <span>&nbsp;|&nbsp;</span>
      <strong>${callbackText}</strong>
    </div>
    <div id="swagger-ui">
      <div class="fallback">
        <h1>Vesta BDApps REST Simulator</h1>
        <p>OpenAPI JSON is available at <a href="/openapi.json">/openapi.json</a>.</p>
      </div>
    </div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.onload = () => {
        if (window.SwaggerUIBundle) {
          window.SwaggerUIBundle({ url: '/openapi.json', dom_id: '#swagger-ui' });
        }
      };
    </script>
  </body>
</html>`;
}

function openApiSpec() {
  return createOpenApiSpec({
    publicBaseUrl: PUBLIC_BASE_URL,
    callbackBaseUrl: CALLBACK_BASE_URL,
  });
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
