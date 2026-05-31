'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BellRing,
  CheckCircle2,
  Clipboard,
  CreditCard,
  Eraser,
  Loader2,
  RadioTower,
  RefreshCw,
  Send,
  Smartphone,
  TerminalSquare,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface ReachabilityCheck {
  ok: boolean;
  status: number;
  statusText: string;
  latencyMs: number;
  error: string | null;
}

interface PreflightData {
  config: {
    restBaseUrl: string;
    uiUrl: string;
    callbackBaseUrl: string;
  };
  callbacks: Record<string, string>;
  defaults: Record<string, unknown>;
  checks: {
    ui: ReachabilityCheck;
    rest: ReachabilityCheck;
  };
}

interface FlowResult {
  ok?: boolean;
  status?: number;
  statusText?: string;
  url?: string;
  interpretedStatus?: string;
  request?: unknown;
  response?: unknown;
  error?: string;
}

interface CallbackEvent {
  id: string;
  type: string;
  receivedAt: string;
  payload: unknown;
  headers: Record<string, string>;
}

interface FlowDefinition {
  id: string;
  title: string;
  description: string;
  endpoint: string;
  defaultKey: string;
  icon: React.ReactNode;
}

const FLOWS: FlowDefinition[] = [
  {
    id: 'sms',
    title: 'SMS MT',
    description: 'Send a mobile terminated SMS into the simulator phone screen.',
    endpoint: '/api/simulator-check/sms/send',
    defaultKey: 'smsSend',
    icon: <Smartphone size={18} />,
  },
  {
    id: 'ussd',
    title: 'USSD MT',
    description: 'Push a USSD response into an active simulator session.',
    endpoint: '/api/simulator-check/ussd/send',
    defaultKey: 'ussdSend',
    icon: <RadioTower size={18} />,
  },
  {
    id: 'caas-balance',
    title: 'CAAS Balance',
    description: 'Query simulator account balance and account state.',
    endpoint: '/api/simulator-check/caas/balance',
    defaultKey: 'caasBalance',
    icon: <Activity size={18} />,
  },
  {
    id: 'caas-debit',
    title: 'CAAS Direct Debit',
    description: 'Charge the simulator account with an external transaction id.',
    endpoint: '/api/simulator-check/caas/direct-debit',
    defaultKey: 'caasDirectDebit',
    icon: <CreditCard size={18} />,
  },
];

function pretty(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function parseJson(value: string) {
  return JSON.parse(value) as unknown;
}

function statusTone(ok?: boolean) {
  if (ok) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (ok === false) return 'border-red-200 bg-red-50 text-red-700';
  return 'border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]';
}

export function SimulatorCheckClient() {
  const [preflight, setPreflight] = useState<PreflightData | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [payloads, setPayloads] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, FlowResult>>({});
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<CallbackEvent[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const callbackEntries = useMemo(() => {
    if (!preflight) return [];
    return Object.entries(preflight.callbacks).map(([key, url]) => ({
      key,
      label: key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase()),
      url,
    }));
  }, [preflight]);

  const loadCallbacks = useCallback(async () => {
    const response = await fetch('/api/simulator-check/callbacks', { cache: 'no-store' });
    if (!response.ok) return;
    const data = (await response.json()) as { events: CallbackEvent[] };
    setEvents(data.events);
  }, []);

  const loadPreflight = useCallback(async () => {
    setPreflightLoading(true);
    try {
      const response = await fetch('/api/simulator-check/preflight', { cache: 'no-store' });
      const data = (await response.json()) as PreflightData;
      setPreflight(data);
      setPayloads((current) => {
        const next = { ...current };
        for (const flow of FLOWS) {
          if (!next[flow.id]) {
            next[flow.id] = pretty(data.defaults[flow.defaultKey]);
          }
        }
        return next;
      });
    } finally {
      setPreflightLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPreflight();
    void loadCallbacks();
  }, [loadCallbacks, loadPreflight]);

  async function runFlow(flow: FlowDefinition) {
    setRunning((current) => ({ ...current, [flow.id]: true }));
    setErrors((current) => ({ ...current, [flow.id]: '' }));

    try {
      const request = parseJson(payloads[flow.id] || '{}');
      const response = await fetch(flow.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      const data = (await response.json()) as FlowResult;
      setResults((current) => ({ ...current, [flow.id]: data }));
    } catch (error) {
      setErrors((current) => ({
        ...current,
        [flow.id]: error instanceof Error ? error.message : 'Unable to run this flow.',
      }));
    } finally {
      setRunning((current) => ({ ...current, [flow.id]: false }));
    }
  }

  async function copyUrl(key: string, url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1400);
  }

  async function clearCallbacks() {
    const response = await fetch('/api/simulator-check/callbacks', { method: 'DELETE' });
    if (!response.ok) return;
    setEvents([]);
  }

  return (
    <main className="min-h-screen bg-[#f8faf7] text-[#1e2a24]">
      <section className="border-b border-[#dfe7df] bg-[#eef5ed]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#b8d6c0] bg-white px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#3b7452]">
                <TerminalSquare size={14} />
                Local BDApps Tooling
              </div>
              <h1 className="text-3xl font-black tracking-tight text-[#102018] sm:text-5xl">
                Simulator Flow Checker
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#5c6c62] sm:text-base">
                Probe SMS, USSD, CAAS, and callback flows against the Dockerized BDApps simulator without touching
                production auth, billing, or database code.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void loadCallbacks()} className="rounded-lg">
                <RefreshCw size={16} />
                Refresh callbacks
              </Button>
              <Button variant="outline" onClick={() => void clearCallbacks()} className="rounded-lg">
                <Eraser size={16} />
                Clear log
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-6 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <div className="rounded-lg border border-[#dfe7df] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">Preflight</h2>
              <p className="text-sm text-[#65746a]">Checks what this Next.js process can reach right now.</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void loadPreflight()}
              disabled={preflightLoading}
              className="rounded-lg"
            >
              {preflightLoading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
              Run
            </Button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <HealthTile
              title="Simulator UI"
              url={preflight?.config.uiUrl || 'http://localhost:10001/mchoice-tap-sdk'}
              check={preflight?.checks.ui}
            />
            <HealthTile
              title="REST Base"
              url={preflight?.config.restBaseUrl || 'http://localhost:7002'}
              check={preflight?.checks.rest}
            />
          </div>
        </div>

        <div className="rounded-lg border border-[#dfe7df] bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-black">Callback URLs</h2>
            <p className="text-sm text-[#65746a]">Paste these into the simulator MO and report screens.</p>
          </div>
          <div className="space-y-2">
            {callbackEntries.map((entry) => (
              <button
                key={entry.key}
                onClick={() => void copyUrl(entry.key, entry.url)}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-[#dfe7df] bg-[#fbfdfb] p-3 text-left transition hover:border-[#9bc9aa] hover:bg-[#f3faf5]"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-[#24352b]">{entry.label}</span>
                  <span className="block truncate font-mono text-xs text-[#65746a]">{entry.url}</span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-[#e8f4eb] px-2 py-1 text-xs font-bold text-[#386848]">
                  <Clipboard size={13} />
                  {copied === entry.key ? 'Copied' : 'Copy'}
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 pb-8 sm:px-6 lg:grid-cols-2 lg:px-8">
        {FLOWS.map((flow) => (
          <FlowPanel
            key={flow.id}
            flow={flow}
            payload={payloads[flow.id] || ''}
            setPayload={(value) => setPayloads((current) => ({ ...current, [flow.id]: value }))}
            result={results[flow.id]}
            error={errors[flow.id]}
            running={Boolean(running[flow.id])}
            onRun={() => void runFlow(flow)}
          />
        ))}
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-[#dfe7df] bg-[#111b16] p-4 text-white shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-black">
                <BellRing size={18} />
                Callback Log
              </h2>
              <p className="text-sm text-[#b9c8be]">Auto-refreshes every 3 seconds while this page is open.</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-bold">
              {events.length} event{events.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {events.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-6 text-center text-sm text-[#b9c8be]">
                No callbacks received yet.
              </div>
            ) : (
              events.map((event) => (
                <div key={event.id} className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded-md bg-[#d7ff80] px-2 py-1 text-xs font-black text-[#162013]">
                      {event.type}
                    </span>
                    <span className="font-mono text-xs text-[#b9c8be]">{new Date(event.receivedAt).toLocaleString()}</span>
                  </div>
                  <pre className="max-h-72 overflow-auto rounded-md bg-black/30 p-3 text-xs leading-5 text-[#dfeee3]">
                    {pretty(event.payload)}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function HealthTile({
  title,
  url,
  check,
}: {
  title: string;
  url: string;
  check?: ReachabilityCheck;
}) {
  const ok = check?.ok;

  return (
    <div className={`rounded-lg border p-3 ${statusTone(ok)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-black">{title}</p>
          <p className="truncate font-mono text-xs opacity-80">{url}</p>
        </div>
        {ok ? <CheckCircle2 size={18} /> : ok === false ? <XCircle size={18} /> : <Loader2 size={18} />}
      </div>
      {check && (
        <p className="mt-2 text-xs font-semibold">
          {check.status || 'No status'} {check.statusText} in {check.latencyMs}ms
          {check.error ? ` - ${check.error}` : ''}
        </p>
      )}
    </div>
  );
}

function FlowPanel({
  flow,
  payload,
  setPayload,
  result,
  error,
  running,
  onRun,
}: {
  flow: FlowDefinition;
  payload: string;
  setPayload: (value: string) => void;
  result?: FlowResult;
  error?: string;
  running: boolean;
  onRun: () => void;
}) {
  return (
    <div className="rounded-lg border border-[#dfe7df] bg-white shadow-sm">
      <div className="border-b border-[#edf2ed] p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black text-[#18251d]">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#e7f4e8] text-[#3f7a51]">
                {flow.icon}
              </span>
              {flow.title}
            </h2>
            <p className="mt-1 text-sm text-[#65746a]">{flow.description}</p>
          </div>
          <Button size="sm" onClick={onRun} disabled={running} className="rounded-lg">
            {running ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
            Send
          </Button>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-2">
        <div className="border-b border-[#edf2ed] p-4 xl:border-b-0 xl:border-r">
          <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-[#718077]">
            Request JSON
          </label>
          <textarea
            value={payload}
            onChange={(event) => setPayload(event.target.value)}
            spellCheck={false}
            className="min-h-72 w-full resize-y rounded-lg border border-[#dce7dd] bg-[#fbfdfb] p-3 font-mono text-xs leading-5 text-[#24352b] outline-none transition focus:border-[#74ad83] focus:ring-4 focus:ring-[#d6eadb]"
          />
          {error && <p className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>}
        </div>

        <div className="p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-xs font-black uppercase tracking-[0.16em] text-[#718077]">Response</span>
            {result?.interpretedStatus && (
              <span className="rounded-md bg-[#e8f4eb] px-2 py-1 text-xs font-black text-[#386848]">
                {result.interpretedStatus}
              </span>
            )}
          </div>
          <pre className="min-h-72 max-h-[32rem] overflow-auto rounded-lg border border-[#1f3027] bg-[#101a15] p-3 text-xs leading-5 text-[#dfeee3]">
            {result ? pretty(result) : 'Run this flow to see raw simulator request and response JSON.'}
          </pre>
        </div>
      </div>
    </div>
  );
}
