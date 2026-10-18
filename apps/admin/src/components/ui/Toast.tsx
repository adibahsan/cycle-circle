'use client';

/**
 * Admin toasts. Mounted once in <Providers> (root layout); call from any client component:
 *
 *   const toast = useToast();
 *   toast.success('Pro granted');   // auto-dismisses after 5s
 *   toast.error('Something broke'); // auto-dismisses after 8s
 *
 * Messages render inside one `aria-live="polite"` region, so screen readers announce them.
 * For confirmations use `ConfirmModal` from './ConfirmModal' (role=dialog, ESC, focus trap).
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

type ToastVariant = 'success' | 'error';
interface ToastItem {
  id: number;
  variant: ToastVariant;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DURATION_MS: Record<ToastVariant, number> = { success: 5000, error: 8000 };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string) => {
      const id = nextId.current++;
      setItems((list) => [...list.slice(-3), { id, variant, message }]);
      window.setTimeout(() => dismiss(id), DURATION_MS[variant]);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({ success: (m) => push('success', m), error: (m) => push('error', m) }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-end"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.variant === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border bg-[var(--color-bg-card)] p-3 text-sm shadow-lg ${
              t.variant === 'error'
                ? 'border-[var(--color-danger)]'
                : 'border-[var(--color-success)]'
            }`}
          >
            {t.variant === 'error' ? (
              <AlertCircle size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--color-danger)]" />
            ) : (
              <CheckCircle2 size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--color-success)]" />
            )}
            <p className="min-w-0 flex-1 break-words text-[var(--color-text-primary)]">{t.message}</p>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="rounded-lg p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
