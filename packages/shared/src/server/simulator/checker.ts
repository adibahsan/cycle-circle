import { NextResponse } from 'next/server';

export type SimulatorEventType =
  | 'sms.receive'
  | 'sms.report'
  | 'ussd.receive'
  | 'subscription.notify';

export interface SimulatorEvent {
  id: string;
  type: SimulatorEventType;
  receivedAt: string;
  payload: unknown;
  headers: Record<string, string>;
}

export interface SimulatorForwardResult {
  ok: boolean;
  status: number;
  statusText: string;
  url: string;
  interpretedStatus: string;
  request: unknown;
  response: unknown;
  error?: string;
}

const MAX_EVENTS = 60;
const DEFAULT_TIMEOUT_MS = 10000;

declare global {
  // eslint-disable-next-line no-var
  var __vestaBdappsSimulatorEvents: SimulatorEvent[] | undefined;
}

export function isSimulatorCheckerEnabled() {
  return process.env.NODE_ENV !== 'production' || process.env.ENABLE_BDAPPS_SIMULATOR_CHECKER === 'true';
}

export function disabledResponse() {
  return NextResponse.json(
    { error: 'BDApps simulator checker is disabled in this environment.' },
    { status: 404 }
  );
}

export function simulatorConfig(request?: Request) {
  const restBaseUrl = process.env.BDAPPS_SIMULATOR_BASE_URL || 'http://127.0.0.1:7002';
  const uiUrl = process.env.BDAPPS_SIMULATOR_UI_URL || 'http://localhost:10001/mchoice-tap-sdk';
  const callbackBaseUrl =
    process.env.BDAPPS_SIMULATOR_CALLBACK_BASE_URL || inferCallbackBaseUrl(request) || 'http://host.docker.internal:3000';

  return {
    restBaseUrl: trimTrailingSlash(restBaseUrl),
    uiUrl,
    callbackBaseUrl: trimTrailingSlash(callbackBaseUrl),
  };
}

export function callbackUrls(request?: Request) {
  const { callbackBaseUrl } = simulatorConfig(request);

  return {
    smsReceive: `${callbackBaseUrl}/api/simulator-check/webhooks/sms/receive`,
    smsReport: `${callbackBaseUrl}/api/simulator-check/webhooks/sms/report`,
    ussdReceive: `${callbackBaseUrl}/api/simulator-check/webhooks/ussd/receive`,
    subscriptionNotify: `${callbackBaseUrl}/api/simulator-check/webhooks/subscription/notify`,
  };
}

export function defaultPayloads() {
  return {
    smsSend: {
      applicationId: 'APP_000006',
      password: 'password',
      message: 'Vesta simulator flow check',
      destinationAddresses: ['tel:8801812345678'],
      deliveryStatusRequest: '0',
      version: '1.0',
    },
    ussdSend: {
      applicationId: 'APP_003117',
      password: 'password',
      version: '1.0',
      sessionId: 'local-session-001',
      ussdOperation: 'mt-cont',
      destinationAddress: 'tel:8801812345678',
      message: 'Welcome to Vesta',
    },
    caasBalance: {
      applicationId: 'APP_000010',
      password: 'password',
      subscriberId: 'tel:8801812345678',
      paymentInstrumentName: 'Mobile Account',
      currency: 'BDT',
    },
    caasDirectDebit: {
      externalTrxId: 'vesta-local-001',
      amount: '5',
      applicationId: 'APP_000010',
      password: 'password',
      subscriberId: 'tel:8801812345678',
      paymentInstrumentName: 'Mobile Account',
      currency: 'BDT',
      accountId: '8801812345678',
    },
  };
}

export async function forwardToSimulator(path: string, payload: unknown): Promise<SimulatorForwardResult> {
  const { restBaseUrl } = simulatorConfig();
  const url = `${restBaseUrl}${path}`;

  try {
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await parseResponseBody(response);

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      url,
      interpretedStatus: interpretSimulatorStatus(body),
      request: payload,
      response: body,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      statusText: 'Request failed',
      url,
      interpretedStatus: 'unreachable',
      request: payload,
      response: null,
      error: error instanceof Error ? error.message : 'Unknown simulator request failure',
    };
  }
}

export async function checkUrl(url: string) {
  const startedAt = Date.now();

  try {
    const response = await fetchWithTimeout(url, { method: 'GET' }, 3500);
    return {
      ok: response.status > 0 && response.status < 500,
      status: response.status,
      statusText: response.statusText,
      latencyMs: Date.now() - startedAt,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      statusText: 'Unavailable',
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : 'Unknown reachability failure',
    };
  }
}

export async function readJsonBody(request: Request) {
  const text = await request.text();
  if (!text.trim()) return {};

  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Request body must be valid JSON.');
  }
}

export function recordSimulatorEvent(type: SimulatorEventType, payload: unknown, request: Request) {
  const events = getEventStore();
  const headers = Object.fromEntries(request.headers.entries());
  const event: SimulatorEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    receivedAt: new Date().toISOString(),
    payload,
    headers,
  };

  events.unshift(event);
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS;
  return event;
}

export function listSimulatorEvents() {
  return [...getEventStore()];
}

export function clearSimulatorEvents() {
  globalThis.__vestaBdappsSimulatorEvents = [];
}

export function successWebhookResponse(event: SimulatorEvent) {
  return NextResponse.json({
    statusCode: 'S1000',
    statusDetail: 'Received by Vesta simulator checker',
    event,
  });
}

function getEventStore() {
  if (!globalThis.__vestaBdappsSimulatorEvents) {
    globalThis.__vestaBdappsSimulatorEvents = [];
  }
  return globalThis.__vestaBdappsSimulatorEvents;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function parseResponseBody(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function interpretSimulatorStatus(body: unknown) {
  const statusCode = findStatusCode(body);

  if (!statusCode) return 'unknown';
  if (statusCode === 'S1000') return 'success';
  if (statusCode === 'E1326' || statusCode === 'E1308') return 'insufficient-balance';
  if (statusCode === 'E1313') return 'auth-error';
  if (statusCode === 'E1312') return 'malformed-request';
  if (statusCode.startsWith('E16')) return 'temporary-error';
  if (statusCode.startsWith('E')) return 'simulator-error';
  return 'unknown';
}

function findStatusCode(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;

  if (typeof record.statusCode === 'string') return record.statusCode;
  if (Array.isArray(record.destinationResponses)) {
    for (const item of record.destinationResponses) {
      const nested = findStatusCode(item);
      if (nested) return nested;
    }
  }

  return null;
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function inferCallbackBaseUrl(request?: Request) {
  const host = request?.headers.get('host');
  if (!host) return null;

  const port = host.split(':')[1];
  return port ? `http://host.docker.internal:${port}` : 'http://host.docker.internal';
}
