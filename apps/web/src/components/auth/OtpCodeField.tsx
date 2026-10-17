'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';

interface OtpCodeFieldProps {
  digits: string[];
  onChange: (digits: string[]) => void;
  /** Shakes the boxes and turns them red. */
  error?: boolean;
  autoFocus?: boolean;
}

/** One box per OTP digit, shared by the verify page and the add-phone / upgrade dialog. */
export function OtpCodeField({ digits, onChange, error, autoFocus }: OtpCodeFieldProps) {
  const { t } = useTranslation();
  const length = digits.length;
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const filled = digits.filter(Boolean).length;

  useEffect(() => {
    if (autoFocus) requestAnimationFrame(() => inputRefs.current[0]?.focus());
  }, [autoFocus]);

  // A code that gets cleared (resend) puts the cursor back in the first box.
  const prevFilled = useRef(filled);
  useEffect(() => {
    if (prevFilled.current > 0 && filled === 0) inputRefs.current[0]?.focus();
    prevFilled.current = filled;
  }, [filled]);

  function update(index: number, value: string) {
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned) return;
    const next = [...digits];
    // Paste or SMS autofill of several digits fills forward from this box.
    const chars = cleaned.slice(0, length - index).split('');
    chars.forEach((ch, i) => { next[index + i] = ch; });
    onChange(next);
    inputRefs.current[Math.min(index + chars.length, length - 1)]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...digits];
      if (next[index]) {
        next[index] = '';
      } else if (index > 0) {
        next[index - 1] = '';
        inputRefs.current[index - 1]?.focus();
      }
      onChange(next);
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  return (
    <div>
      <div className="flex gap-2.5 justify-between">
        {digits.map((digit, index) => (
          <motion.div
            key={index}
            animate={
              error
                ? { x: [0, -5, 5, -5, 5, 0], scale: 1, transition: { duration: 0.35 } }
                : { scale: focusedIndex === index ? 1.05 : 1 }
            }
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="flex-1"
          >
            <input
              ref={(el) => { inputRefs.current[index] = el; }}
              type="text"
              inputMode="numeric"
              name="otp"
              autoComplete="one-time-code"
              maxLength={length}
              value={digit}
              onChange={(e) => update(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onFocus={(e) => { e.target.select(); setFocusedIndex(index); }}
              onBlur={() => setFocusedIndex(null)}
              className={`w-full aspect-square text-center text-xl font-bold rounded-xl border-2 bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] focus-visible:outline-none transition-colors duration-200 ${
                digit ? 'border-[var(--color-primary)] bg-[var(--color-bg-card)]' : 'border-[var(--color-border)]'
              } ${error ? 'border-[var(--color-error)]' : ''} focus-visible:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/25`}
              aria-label={t('auth.otpDigit', { n: index + 1 })}
            />
          </motion.div>
        ))}
      </div>
      <div className="mt-3 h-1 rounded-full bg-[var(--color-border)] overflow-hidden" aria-hidden="true">
        <motion.div
          className="h-full rounded-full bg-[var(--color-primary)]"
          animate={{ width: `${(filled / length) * 100}%` }}
          transition={{ duration: 0.2 }}
        />
      </div>
    </div>
  );
}
