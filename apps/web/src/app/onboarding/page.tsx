'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import {
  Shield,
  CalendarDays,
  Heart,
  Moon,
  ChevronLeft,
  ChevronRight,
  Check,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { useAppStore } from '@/lib/store';
import type { ProfileRelation } from '@vesta/shared/types';

// ─── Types ────────────────────────────────────────────────────────────────────

type Goal = 'tracking' | 'conceive' | 'perimenopause' | null;

interface OnboardingState {
  goal: Goal;
  cycleLength: number;
  periodLength: number;
  lastPeriodDate: string;
  profileName: string;
  profileRelation: ProfileRelation;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5;

const RELATIONS: { value: ProfileRelation; labelKey: string }[] = [
  { value: 'self', labelKey: 'profiles.self' },
  { value: 'wife', labelKey: 'profiles.wife' },
  { value: 'sister', labelKey: 'profiles.sister' },
  { value: 'mother', labelKey: 'profiles.mother' },
  { value: 'daughter', labelKey: 'profiles.daughter' },
  { value: 'girlfriend', labelKey: 'profiles.girlfriend' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="flex items-center gap-1.5 justify-center" aria-label={`Step ${step} of ${TOTAL_STEPS}`}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const isActive = i + 1 === step;
        return (
          <motion.div
            key={i}
            initial={false}
            animate={{
              width: isActive ? 24 : 8,
              backgroundColor: i + 1 <= step ? 'var(--color-primary)' : 'var(--color-border)',
              scale: isActive ? [1, 1.2, 1] : 1,
            }}
            transition={
              isActive
                ? {
                    width: { duration: 0.3 },
                    backgroundColor: { duration: 0.3 },
                    scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
                  }
                : { duration: 0.3 }
            }
            className="h-2 rounded-full"
          />
        );
      })}
    </div>
  );
}

function NumberStepper({
  value,
  min,
  max,
  onChange,
  unit,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  unit?: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-10 h-10 rounded-full border-2 border-[var(--color-primary)] text-[var(--color-primary)] flex items-center justify-center font-bold text-lg transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--color-primary)] hover:text-white"
        aria-label="Decrease"
      >
        −
      </button>
      <span className="text-3xl font-bold text-[var(--color-text-primary)] min-w-[3.5rem] text-center tabular-nums">
        {value}
        {unit && (
          <span className="text-sm font-normal text-[var(--color-text-muted)] ml-1">{unit}</span>
        )}
      </span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-10 h-10 rounded-full border-2 border-[var(--color-primary)] text-[var(--color-primary)] flex items-center justify-center font-bold text-lg transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--color-primary)] hover:text-white"
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}

// ─── Step 1: Welcome ──────────────────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center text-center gap-8 px-2">
      {/* Decorative illustration */}
      <div className="relative w-56 h-56 flex items-center justify-center mt-4">
        {/* Outermost ring */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[var(--color-primary)]/10 to-[var(--color-secondary)]/10" />
        {/* Middle ring */}
        <div className="absolute inset-6 rounded-full bg-gradient-to-br from-[var(--color-primary)]/15 to-[var(--color-accent)]/15" />
        {/* Inner circle */}
        <div className="absolute inset-12 rounded-full bg-gradient-to-br from-[var(--color-primary)]/25 to-[var(--color-secondary)]/25" />
        {/* Floating accent dots */}
        <div className="absolute top-3 right-8 w-5 h-5 rounded-full bg-[var(--color-accent)]/60" />
        <div className="absolute bottom-6 left-5 w-4 h-4 rounded-full bg-[var(--color-secondary)]/60" />
        <div className="absolute top-10 left-4 w-3 h-3 rounded-full bg-[var(--color-primary)]/50" />
        <div className="absolute bottom-10 right-3 w-3 h-3 rounded-full bg-[var(--color-primary)]/40" />
        {/* Center logo mark */}
        <div className="relative z-10 w-20 h-20 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] flex items-center justify-center shadow-[0_8px_32px_rgba(232,71,108,0.35)]">
          <span className="text-white text-3xl font-bold">V</span>
        </div>
      </div>

      <div className="space-y-3">
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
          {t('onboarding.welcome')}
        </h1>
        <p className="text-[var(--color-text-secondary)] text-base leading-relaxed max-w-xs mx-auto">
          Your personal cycle intelligence — private, bilingual, and built for you.
        </p>
      </div>

      {/* Privacy badge */}
      <div className="flex items-start gap-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl px-4 py-3.5 max-w-xs w-full">
        <div className="mt-0.5 shrink-0 w-8 h-8 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
          <Shield size={16} className="text-[var(--color-primary)]" />
        </div>
        <div className="text-left">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t('onboarding.privacy')}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            We never share your health information with anyone.
          </p>
        </div>
      </div>

      <Button size="lg" fullWidth onClick={onNext} className="mt-2">
        {t('onboarding.done')}
      </Button>
    </div>
  );
}

// ─── Step 2: Goal Selection ────────────────────────────────────────────────────

function StepGoal({
  selected,
  onSelect,
}: {
  selected: Goal;
  onSelect: (g: Goal) => void;
}) {
  const { t } = useTranslation();

  const goals: {
    value: Goal;
    icon: React.ReactNode;
    label: string;
    description: string;
    accent: string;
    bg: string;
  }[] = [
    {
      value: 'tracking',
      icon: <CalendarDays size={28} />,
      label: t('onboarding.goalTracking'),
      description: 'Track your cycle, log symptoms and get accurate predictions.',
      accent: 'var(--color-primary)',
      bg: 'rgba(232,71,108,0.08)',
    },
    {
      value: 'conceive',
      icon: <Heart size={28} />,
      label: t('onboarding.goalConceive'),
      description: 'Identify fertile windows and maximise conception chances.',
      accent: 'var(--color-secondary)',
      bg: 'rgba(155,127,212,0.08)',
    },
    {
      value: 'perimenopause',
      icon: <Moon size={28} />,
      label: t('onboarding.goalPerimenopause'),
      description: 'Monitor irregular cycles and track perimenopause symptoms.',
      accent: 'var(--color-accent)',
      bg: 'rgba(255,140,107,0.08)',
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
          {t('onboarding.goal')}
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Choose one to personalise your experience</p>
      </div>

      <div className="flex flex-col gap-3">
        {goals.map((g) => {
          const isActive = selected === g.value;
          return (
            <button
              key={g.value}
              onClick={() => onSelect(g.value)}
              className={`w-full rounded-2xl p-4 border-2 text-left transition-all duration-200 active:scale-[0.98] ${
                isActive
                  ? 'border-[var(--color-primary)] shadow-[0_0_0_4px_rgba(232,71,108,0.12)]'
                  : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/40'
              }`}
              style={{ background: isActive ? g.bg : 'var(--color-bg-card)' }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all"
                  style={{
                    background: isActive ? g.bg : 'var(--color-bg-secondary)',
                    color: g.accent,
                    border: `1.5px solid ${isActive ? g.accent : 'transparent'}`,
                  }}
                >
                  {g.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[var(--color-text-primary)]">{g.label}</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5 leading-relaxed">{g.description}</p>
                </div>
                {isActive && (
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: g.accent }}
                  >
                    <Check size={14} className="text-white" strokeWidth={3} />
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

    </div>
  );
}

// ─── Step 3: Cycle History ─────────────────────────────────────────────────────

function StepCycleHistory({
  cycleLength,
  periodLength,
  lastPeriodDate,
  lastPeriodError,
  onCycleLength,
  onPeriodLength,
  onLastPeriodDate,
}: {
  cycleLength: number;
  periodLength: number;
  lastPeriodDate: string;
  lastPeriodError?: string;
  onCycleLength: (v: number) => void;
  onPeriodLength: (v: number) => void;
  onLastPeriodDate: (v: string) => void;
}) {
  const { t } = useTranslation();

  // Max date is today; min date is 90 days ago
  const today = new Date().toISOString().split('T')[0];
  const minDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Tell us about your cycle
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          We'll use this to make accurate predictions
        </p>
      </div>

      {/* Cycle length stepper */}
      <Card padding="md" className="space-y-3">
        <div>
          <p className="font-semibold text-[var(--color-text-primary)]">{t('onboarding.cycleLength')}</p>
          <p className="text-xs text-[var(--color-text-muted)]">Usually 21–35 days</p>
        </div>
        <div className="flex justify-center">
          <NumberStepper
            value={cycleLength}
            min={21}
            max={45}
            onChange={onCycleLength}
            unit="days"
          />
        </div>
        {/* Visual track */}
        <div className="h-1.5 rounded-full bg-[var(--color-bg-secondary)] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] transition-all duration-200"
            style={{ width: `${((cycleLength - 21) / (45 - 21)) * 100}%` }}
          />
        </div>
      </Card>

      {/* Period length stepper */}
      <Card padding="md" className="space-y-3">
        <div>
          <p className="font-semibold text-[var(--color-text-primary)]">{t('onboarding.periodLength')}</p>
          <p className="text-xs text-[var(--color-text-muted)]">Usually 3–7 days</p>
        </div>
        <div className="flex justify-center">
          <NumberStepper
            value={periodLength}
            min={1}
            max={10}
            onChange={onPeriodLength}
            unit="days"
          />
        </div>
        <div className="h-1.5 rounded-full bg-[var(--color-bg-secondary)] overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] transition-all duration-200"
            style={{ width: `${((periodLength - 1) / (10 - 1)) * 100}%` }}
          />
        </div>
      </Card>

      {/* Last period date */}
      <Card padding="md">
        <Input
          label={`${t('onboarding.lastPeriod')} *`}
          type="date"
          value={lastPeriodDate}
          min={minDate}
          max={today}
          error={lastPeriodError}
          onChange={(e) => onLastPeriodDate(e.target.value)}
        />
      </Card>

    </div>
  );
}

// ─── Step 4: Profile Setup ─────────────────────────────────────────────────────

function StepProfile({
  name,
  nameError,
  relation,
  onName,
  onRelation,
}: {
  name: string;
  nameError?: string;
  relation: ProfileRelation;
  onName: (v: string) => void;
  onRelation: (v: ProfileRelation) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[var(--color-text-primary)]">
          Who is this profile for?
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          You can manage up to 6 profiles
        </p>
      </div>

      {/* Relation chips */}
      <div>
        <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Relationship</p>
        <div className="flex flex-wrap gap-2">
          {RELATIONS.map(({ value, labelKey }) => {
            const isActive = relation === value;
            return (
              <button
                key={value}
                onClick={() => onRelation(value)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border-2 transition-all duration-150 active:scale-95 ${
                  isActive
                    ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-[0_0_0_3px_rgba(232,71,108,0.18)]'
                    : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                }`}
              >
                {t(labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Name input */}
      <div>
        <Input
          label="Name *"
          placeholder={relation === 'self' ? 'Your name' : `${t(`profiles.${relation}`)}\'s name`}
          value={name}
          error={nameError}
          onChange={(e) => onName(e.target.value)}
          maxLength={40}
        />
      </div>

      {/* Profile preview */}
      {(name || relation) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-3.5 rounded-2xl bg-gradient-to-r from-[var(--color-primary)]/8 to-[var(--color-secondary)]/8 border border-[var(--color-primary)]/20"
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] flex items-center justify-center text-white font-bold text-sm">
            {name ? name[0].toUpperCase() : <User size={16} />}
          </div>
          <div>
            <p className="font-semibold text-[var(--color-text-primary)] text-sm">
              {name || t(`profiles.${relation}`)}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">{t(`profiles.${relation}`)}</p>
          </div>
        </motion.div>
      )}

    </div>
  );
}

// ─── Step 5: Done ─────────────────────────────────────────────────────────────

function StepDone({
  state,
  onFinish,
  submitting = false,
}: {
  state: OnboardingState;
  onFinish: () => void;
  submitting?: boolean;
}) {
  const { t } = useTranslation();

  const goalLabel =
    state.goal === 'tracking'
      ? t('onboarding.goalTracking')
      : state.goal === 'conceive'
      ? t('onboarding.goalConceive')
      : state.goal === 'perimenopause'
      ? t('onboarding.goalPerimenopause')
      : 'Not set';

  const summaryItems = [
    {
      label: 'Goal',
      value: goalLabel,
    },
    {
      label: 'Profile',
      value: state.profileName
        ? `${state.profileName} (${t(`profiles.${state.profileRelation}`)})`
        : t(`profiles.${state.profileRelation}`),
    },
    {
      label: 'Cycle length',
      value: `${state.cycleLength} days`,
    },
    {
      label: 'Period length',
      value: `${state.periodLength} days`,
    },
    ...(state.lastPeriodDate
      ? [{ label: 'Last period', value: new Date(state.lastPeriodDate + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) }]
      : []),
  ];

  // CSS-only confetti dots
  const confettiDots = [
    { top: '8%', left: '10%', color: 'var(--color-primary)', size: 10, delay: '0s' },
    { top: '5%', left: '80%', color: 'var(--color-secondary)', size: 8, delay: '0.1s' },
    { top: '15%', left: '55%', color: 'var(--color-accent)', size: 6, delay: '0.2s' },
    { top: '3%', left: '35%', color: 'var(--color-primary)', size: 7, delay: '0.15s' },
    { top: '12%', left: '92%', color: 'var(--color-accent)', size: 9, delay: '0.05s' },
    { top: '20%', left: '5%', color: 'var(--color-secondary)', size: 5, delay: '0.25s' },
    { top: '18%', left: '70%', color: 'var(--color-primary)', size: 6, delay: '0.3s' },
    { top: '6%', left: '20%', color: 'var(--color-accent)', size: 8, delay: '0.08s' },
  ];

  return (
    <div className="flex flex-col items-center text-center gap-6">
      {/* Celebration area */}
      <div className="relative w-full h-32 flex items-center justify-center">
        {/* Confetti dots */}
        {confettiDots.map((dot, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: -20, scale: 0 }}
            animate={{ opacity: [0, 1, 0.6, 1], y: [-20, 0, -18, 0], scale: [0, 1, 1, 1] }}
            transition={{
              delay: parseFloat(dot.delay),
              duration: 3 + i * 0.4,
              repeat: Infinity,
              ease: 'easeInOut',
              times: [0, 0.15, 0.57, 1],
            }}
            className="absolute rounded-full"
            style={{
              top: dot.top,
              left: dot.left,
              width: dot.size,
              height: dot.size,
              backgroundColor: dot.color,
            }}
          />
        ))}
        {/* Central celebration icon */}
        <motion.div
          initial={{ scale: 0, rotate: -15 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="w-24 h-24 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] flex items-center justify-center shadow-[0_8px_40px_rgba(232,71,108,0.35)] z-10"
        >
          <Check size={40} className="text-white" strokeWidth={3} />
        </motion.div>
      </div>

      <div className="space-y-2">
        <h2 className="text-3xl font-bold text-[var(--color-text-primary)]">You're all set!</h2>
        <p className="text-[var(--color-text-secondary)] text-sm">
          Vesta is personalised and ready for you.
        </p>
      </div>

      {/* Summary card */}
      <Card padding="md" className="w-full text-left">
        <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
          Your Setup
        </p>
        <div className="divide-y divide-[var(--color-border)]">
          {summaryItems.map((item) => (
            <div key={item.label} className="flex justify-between items-center py-2.5">
              <span className="text-sm text-[var(--color-text-muted)]">{item.label}</span>
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">{item.value}</span>
            </div>
          ))}
        </div>
      </Card>

      <Button size="lg" fullWidth onClick={onFinish} disabled={submitting} className="mt-2">
        {submitting ? 'Saving…' : 'Go to Dashboard'}
      </Button>

      <p className="text-xs text-[var(--color-text-muted)] max-w-xs">
        You can update any of these settings later in the Profiles & Settings screens.
      </p>
    </div>
  );
}

// ─── Main Onboarding Page ─────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { profiles, setOnboardingComplete, addProfile } = useAppStore();

  useEffect(() => {
    if (profiles.length > 0) {
      setOnboardingComplete(true);
      router.replace('/dashboard');
    }
  }, [profiles.length, router, setOnboardingComplete]);

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<1 | -1>(1);

  const [state, setState] = useState<OnboardingState>({
    goal: null,
    cycleLength: 28,
    periodLength: 5,
    lastPeriodDate: '',
    profileName: '',
    profileRelation: 'self',
  });

  const [stepErrors, setStepErrors] = useState<{
    profileName?: string;
    lastPeriodDate?: string;
    submit?: string;
  }>({});

  const [submitting, setSubmitting] = useState(false);

  function goalLabel(goal: Goal): string {
    switch (goal) {
      case 'tracking':
        return 'Cycle tracking';
      case 'conceive':
        return 'Trying to conceive';
      case 'perimenopause':
        return 'Perimenopause support';
      default:
        return '';
    }
  }

  function validateStep(currentStep: number): boolean {
    const errors: typeof stepErrors = {};

    if (currentStep === 3) {
      const trimmed = state.profileName.trim();
      if (trimmed.length < 2) {
        errors.profileName = 'Enter a name (at least 2 characters)';
      }
    }

    if (currentStep === 4) {
      if (!state.lastPeriodDate) {
        errors.lastPeriodDate = 'Last period start date is required';
      }
    }

    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // ── Navigation helpers ──

  function goNext() {
    if (!validateStep(step)) return;
    setDirection(1);
    setStep((s) => Math.min(TOTAL_STEPS, s + 1));
  }

  function goBack() {
    setStepErrors({});
    setDirection(-1);
    setStep((s) => Math.max(1, s - 1));
  }

  // ── Final submission ──

  async function handleFinish() {
    if (!validateStep(3) || !validateStep(4)) {
      setStep(3);
      return;
    }

    setSubmitting(true);
    setStepErrors({});

    try {
      await addProfile({
        name: state.profileName.trim(),
        relation: state.profileRelation,
        cycleLength: state.cycleLength,
        periodLength: state.periodLength,
        lastPeriodStart: state.lastPeriodDate,
        cycleHistory: [state.cycleLength],
        predictionTier: 'average',
        goal: state.goal ? goalLabel(state.goal) : undefined,
      });
      setOnboardingComplete(true);
      router.replace('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create profile. Please try again.';
      setStepErrors({ submit: message });
      console.error('Failed to create profile:', err);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Animation variants ──

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? '60%' : '-60%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? '-60%' : '60%',
      opacity: 0,
    }),
  };

  // ── Render step content ──

  function renderStep() {
    switch (step) {
      case 1:
        return <StepWelcome onNext={goNext} />;
      case 2:
        return (
          <StepGoal
            selected={state.goal}
            onSelect={(g) => setState((s) => ({ ...s, goal: g }))}
          />
        );
      case 3:
        return (
          <StepProfile
            name={state.profileName}
            nameError={stepErrors.profileName}
            relation={state.profileRelation}
            onName={(v) => {
              setState((s) => ({ ...s, profileName: v }));
              if (stepErrors.profileName) setStepErrors((e) => ({ ...e, profileName: undefined }));
            }}
            onRelation={(v) => setState((s) => ({ ...s, profileRelation: v }))}
          />
        );
      case 4:
        return (
          <StepCycleHistory
            cycleLength={state.cycleLength}
            periodLength={state.periodLength}
            lastPeriodDate={state.lastPeriodDate}
            lastPeriodError={stepErrors.lastPeriodDate}
            onCycleLength={(v) => setState((s) => ({ ...s, cycleLength: v }))}
            onPeriodLength={(v) => setState((s) => ({ ...s, periodLength: v }))}
            onLastPeriodDate={(v) => {
              setState((s) => ({ ...s, lastPeriodDate: v }));
              if (stepErrors.lastPeriodDate) setStepErrors((e) => ({ ...e, lastPeriodDate: undefined }));
            }}
          />
        );
      case 5:
        return (
          <>
            {stepErrors.submit && (
              <p className="mb-4 text-sm text-red-500 text-center">{stepErrors.submit}</p>
            )}
            <StepDone state={state} onFinish={handleFinish} submitting={submitting} />
          </>
        );
      default:
        return null;
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex flex-col max-w-md mx-auto relative overflow-hidden">
        {/* Floating background orbs */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute top-[-80px] right-[-60px] w-72 h-72 rounded-full opacity-[0.08]"
          style={{ background: 'radial-gradient(circle, #e8476c 0%, transparent 70%)' }}
          animate={{ x: [0, 20, 0], y: [0, -15, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-[-60px] left-[-80px] w-80 h-80 rounded-full opacity-[0.08]"
          style={{ background: 'radial-gradient(circle, #9b7fd4 0%, transparent 70%)' }}
          animate={{ x: [0, -12, 0], y: [0, 18, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-[var(--color-bg-primary)]/90 backdrop-blur-sm px-5 pt-safe-top">
          <div className="flex items-center justify-between py-4">
            {/* Vesta wordmark */}
            <span className="text-lg font-bold text-[var(--color-primary)]">Vesta</span>
            {/* Step counter */}
            <span className="text-xs font-medium text-[var(--color-text-muted)]">
              {step} / {TOTAL_STEPS}
            </span>
          </div>
          {/* Progress bar */}
          <ProgressBar step={step} />
          <div className="pb-2" />
        </div>

        {/* Step content with animated transitions */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: 'spring', stiffness: 280, damping: 30 },
                opacity: { duration: 0.18 },
              }}
              className="absolute inset-0 overflow-y-auto px-5 py-4"
            >
              {renderStep()}
              {/* Bottom padding so content isn't hidden behind fixed nav */}
              <div className="h-6" />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Fixed bottom navigation bar — shown for steps 2–4 */}
        {step >= 2 && step <= 4 && (
          <div className="sticky bottom-0 z-20 bg-[var(--color-bg-primary)]/95 backdrop-blur-sm border-t border-[var(--color-border)] px-5 py-4">
            <div className="flex gap-3 max-w-md mx-auto">
              <Button variant="outline" size="lg" onClick={goBack} className="w-14 shrink-0 px-0">
                <ChevronLeft size={20} />
              </Button>
              <Button
                size="lg"
                fullWidth
                onClick={goNext}
                disabled={
                  (step === 2 && !state.goal) ||
                  (step === 3 && state.profileName.trim().length < 2) ||
                  (step === 4 && !state.lastPeriodDate)
                }
              >
                {t('onboarding.next')} <ChevronRight size={18} className="ml-1" />
              </Button>
            </div>
          </div>
        )}
    </div>
  );
}
