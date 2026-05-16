'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { X, User, Phone, Calendar, CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAppStore } from '@/lib/store';

interface FormState {
  fullName: string;
  phone: string;
  dob: string;
}

interface FormErrors {
  fullName?: string;
  phone?: string;
  dob?: string;
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.fullName.trim()) errors.fullName = 'Full name is required';
  else if (form.fullName.trim().length < 2) errors.fullName = 'Name must be at least 2 characters';

  const digits = form.phone.replace(/\D/g, '');
  if (!digits) errors.phone = 'Phone number is required';
  else if (digits.length !== 11) errors.phone = '11-digit Bangladesh number required';
  else if (!digits.startsWith('01')) errors.phone = 'Must start with 01';

  if (!form.dob) errors.dob = 'Date of birth is required';
  else {
    const birthYear = new Date(form.dob).getFullYear();
    const currentYear = new Date().getFullYear();
    if (currentYear - birthYear < 10) errors.dob = 'You must be at least 10 years old';
    if (currentYear - birthYear > 100) errors.dob = 'Enter a valid date of birth';
  }

  return errors;
}

export function ProfileCompletionModal() {
  const { t } = useTranslation();
  const { showProfileCompletion, setShowProfileCompletion, completeProfile, user } = useAppStore();

  const [form, setForm] = useState<FormState>({
    fullName: user?.fullName ?? '',
    phone: user?.phone ?? '',
    dob: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (showProfileCompletion) {
      setForm({ fullName: user?.fullName ?? '', phone: user?.phone ?? '', dob: '' });
      setErrors({});
      setDone(false);
    }
  }, [showProfileCompletion, user]);

  function handleChange(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      const value =
        field === 'phone'
          ? e.target.value.replace(/[^\d]/g, '').slice(0, 11)
          : e.target.value;
      setForm((prev) => ({ ...prev, [field]: value }));
      if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  async function handleSubmit() {
    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    await new Promise((res) => setTimeout(res, 1100));
    completeProfile(form.fullName.trim(), form.phone);
    setLoading(false);
    setDone(true);

    // Close after brief celebration
    await new Promise((res) => setTimeout(res, 1400));
    setShowProfileCompletion(false);
  }

  function handleDismiss() {
    setShowProfileCompletion(false);
  }

  return (
    <AnimatePresence>
      {showProfileCompletion && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={handleDismiss}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            aria-hidden="true"
          />

          {/* Modal sheet */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: '100%', scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: '100%', scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-modal-title"
          >
            {/* Glass card */}
            <div
              className="rounded-t-3xl overflow-hidden"
              style={{
                background: 'rgba(255, 248, 249, 0.97)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                boxShadow: '0 -8px 40px -4px rgba(232,71,108,0.18), 0 -2px 8px rgba(0,0,0,0.08)',
                border: '1px solid rgba(255,255,255,0.6)',
                borderBottom: 'none',
              }}
            >
              {/* Gradient top bar */}
              <div
                className="h-1.5"
                style={{
                  background: 'linear-gradient(90deg, var(--color-primary) 0%, var(--color-secondary) 50%, var(--color-accent) 100%)',
                }}
              />

              <div className="px-5 pt-5 pb-8">
                <AnimatePresence mode="wait" initial={false}>
                  {!done ? (
                    <motion.div
                      key="form"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.25 }}
                    >
                      {/* Header row */}
                      <div className="flex items-start justify-between mb-5">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                            style={{
                              background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
                            }}
                          >
                            <User size={20} color="white" />
                          </div>
                          <div>
                            <h2
                              id="profile-modal-title"
                              className="text-lg font-bold text-[var(--color-text-primary)]"
                            >
                              {t('auth.profileCompletion')}
                            </h2>
                            <p className="text-xs text-[var(--color-text-muted)]">
                              Takes less than a minute
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={handleDismiss}
                          className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--color-bg-secondary)] hover:bg-[var(--color-border)] transition-colors text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                          aria-label="Dismiss"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      {/* Re-appears notice */}
                      <div className="mb-5 px-3 py-2.5 rounded-xl text-xs text-[var(--color-text-muted)] flex items-center gap-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                        <span className="text-base">💡</span>
                        This prompt will reappear on next login if skipped.
                      </div>

                      {/* Form fields */}
                      <div className="space-y-4 mb-5">
                        {/* Full name */}
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5 flex items-center gap-1.5">
                            <User size={13} className="text-[var(--color-primary)]" />
                            {t('auth.fullName')}
                          </label>
                          <Input
                            type="text"
                            placeholder="Your full name"
                            value={form.fullName}
                            onChange={handleChange('fullName')}
                            error={errors.fullName}
                            autoComplete="name"
                          />
                        </div>

                        {/* Phone */}
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5 flex items-center gap-1.5">
                            <Phone size={13} className="text-[var(--color-primary)]" />
                            {t('auth.phoneVerified')}
                          </label>
                          <div className="relative">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--color-text-secondary)] select-none">
                              🇧🇩 +88
                            </span>
                            <input
                              type="tel"
                              inputMode="numeric"
                              placeholder="01XXXXXXXXX"
                              value={form.phone}
                              onChange={handleChange('phone')}
                              maxLength={11}
                              className={`w-full pl-20 pr-4 py-3 rounded-xl border bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)] transition-all duration-200 text-base tracking-widest font-medium ${
                                errors.phone ? 'border-red-400' : 'border-[var(--color-border)]'
                              }`}
                            />
                          </div>
                          {errors.phone && (
                            <p className="mt-1 text-sm text-red-500">{errors.phone}</p>
                          )}
                        </div>

                        {/* Date of birth */}
                        <div>
                          <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5 flex items-center gap-1.5">
                            <Calendar size={13} className="text-[var(--color-primary)]" />
                            Date of Birth
                          </label>
                          <Input
                            type="date"
                            value={form.dob}
                            onChange={handleChange('dob')}
                            error={errors.dob}
                            max={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                      </div>

                      {/* Submit */}
                      <Button
                        fullWidth
                        size="lg"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="rounded-2xl font-bold text-base"
                      >
                        {loading ? (
                          <span className="flex items-center gap-2">
                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            Saving…
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <Sparkles size={18} />
                            {t('auth.continue')}
                          </span>
                        )}
                      </Button>

                      <button
                        onClick={handleDismiss}
                        className="mt-3 w-full text-center text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                      >
                        {t('common.cancel')} — remind me later
                      </button>
                    </motion.div>
                  ) : (
                    /* ── Success celebration ── */
                    <motion.div
                      key="success"
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      className="flex flex-col items-center text-center py-4"
                    >
                      <motion.div
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                        className="relative mb-4"
                      >
                        <div
                          className="w-20 h-20 rounded-full flex items-center justify-center shadow-glow"
                          style={{
                            background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
                          }}
                        >
                          <CheckCircle2 size={40} color="white" strokeWidth={2} />
                        </div>
                        {['✨', '🌸', '💜'].map((emoji, i) => (
                          <motion.span
                            key={i}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.2 + i * 0.1, type: 'spring', stiffness: 260 }}
                            className="absolute text-lg"
                            style={{
                              top: i === 0 ? '-8px' : i === 1 ? '50%' : 'auto',
                              bottom: i === 2 ? '-6px' : 'auto',
                              left: i === 1 ? '-14px' : 'auto',
                              right: i === 0 ? '-6px' : i === 2 ? '0' : 'auto',
                              transform: i === 1 ? 'translateY(-50%)' : undefined,
                            }}
                          >
                            {emoji}
                          </motion.span>
                        ))}
                      </motion.div>

                      <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-1">
                        Profile Complete!
                      </h3>
                      <p className="text-sm text-[var(--color-text-muted)]">
                        Welcome to Vesta, {form.fullName.trim().split(' ')[0]} 🎉
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
