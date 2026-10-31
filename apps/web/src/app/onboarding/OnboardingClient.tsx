'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { useHasMounted } from '@/components/motion/useHasMounted';
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
import { goalAccentVar } from '@vesta/shared/utils/goal';
import { Button } from '@/components/ui/Button';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { FlowIcon } from '@/components/ui/PhaseIcon';
import { LanguageToggle } from '@/components/ui/LanguageToggle';
import { CenteredShell } from '@/components/onboarding/CenteredShell';
import { AccountControl } from '@/components/onboarding/AccountControl';
import { useAppStore } from '@/lib/store';
import { createProfile, setActiveProfileCookie } from '@/app/actions/profile-actions';
import type { ProfileRelation } from '@vesta/shared/types';
import { lastPeriodDateBounds } from '@/lib/day-ranges';

// ─── Types ────────────────────────────────────────────────────────────────────

type Goal = 'tracking' | 'conceive' | 'perimenopause' | null;
type FlowIntensity = 'light' | 'medium' | 'heavy';

interface OnboardingState {
  goal: Goal;
  cycleLength: number;
  periodLength: number;
  lastPeriodDate: string;
  flowIntensity: FlowIntensity;
  profileName: string;
  userName: string;
  profileRelation: ProfileRelation;
}

const FLOW_LABEL_KEYS: Record<FlowIntensity, string> = {
  light: 'dashboard.flowLight',
  medium: 'dashboard.flowMedium',
  heavy: 'dashboard.flowHeavy',
};

const FLOW_COLORS: Record<FlowIntensity, string> = {
  light: 'var(--color-follicular)',
  medium: 'var(--color-primary)',
  heavy: 'var(--color-menstrual)',
};

const FLOW_TEXT: Record<FlowIntensity, string> = {
  light: 'var(--color-on-follicular)',
  medium: 'var(--color-on-accent)',
  heavy: 'var(--color-on-menstrual)',
};

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

// Map frontend relation values to the DB enum values expected by the server action
const RELATION_TO_DB: Record<ProfileRelation, 'SELF' | 'WIFE' | 'SISTER' | 'MOTHER' | 'DAUGHTER' | 'GIRLFRIEND'> = {
  self: 'SELF',
  wife: 'WIFE',
  sister: 'SISTER',
  mother: 'MOTHER',
  daughter: 'DAUGHTER',
  girlfriend: 'GIRLFRIEND',
};

// ─── Animation constants ───────────────────────────────────────────────────────

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const FADE_UP = {
  hidden: { opacity: 0, y: 20 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.42, ease: EASE },
  }),
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ step, prefersReducedMotion }: { step: number; prefersReducedMotion: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-1.5 justify-center" aria-label={t('onboarding.stepOf', { step, total: TOTAL_STEPS })}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const isActive = i + 1 === step;
        return (
          <motion.div
            key={i}
            initial={false}
            animate={
              prefersReducedMotion
                ? {
                    width: isActive ? 24 : 8,
                    backgroundColor: i + 1 <= step ? 'var(--color-primary)' : 'var(--color-border)',
                    scale: 1,
                  }
                : {
                    width: isActive ? 24 : 8,
                    backgroundColor: i + 1 <= step ? 'var(--color-primary)' : 'var(--color-border)',
                    scale: 1,
                  }
            }
            transition={
              prefersReducedMotion
                ? { duration: 0.3 }
                : isActive
                ? {
                    width: { duration: 0.3 },
                    backgroundColor: { duration: 0.3 },
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
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-4">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-10 h-10 rounded-full border-2 border-[var(--color-primary)] text-[var(--color-primary)] flex items-center justify-center font-bold text-lg transition-colors active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--color-primary)] hover:text-[var(--color-on-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
        aria-label={t('common.decrease')}
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
        className="w-10 h-10 rounded-full border-2 border-[var(--color-primary)] text-[var(--color-primary)] flex items-center justify-center font-bold text-lg transition-colors active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--color-primary)] hover:text-[var(--color-on-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
        aria-label={t('common.increase')}
      >
        +
      </button>
    </div>
  );
}

// ─── Step 1: Welcome ──────────────────────────────────────────────────────────

function StepWelcome({ onNext, prefersReducedMotion }: { onNext: () => void; prefersReducedMotion: boolean }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center text-center gap-6 px-2 mx-auto w-full max-w-md lg:max-w-lg">
      {/* Decorative illustration — staggered fade-up entrance */}
      <motion.div
        custom={0}
        variants={FADE_UP}
        initial={prefersReducedMotion ? false : 'hidden'}
        animate="show"
        className="relative w-56 h-56 flex items-center justify-center mt-2"
      >
        {/* Outermost ring */}
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[var(--color-primary)]/10 to-[var(--color-secondary)]/10" />
        {/* Middle ring */}
        <div className="absolute inset-6 rounded-full bg-gradient-to-br from-[var(--color-primary)]/15 to-[var(--color-accent)]/15" />
        {/* Inner circle */}
        <div className="absolute inset-12 rounded-full bg-gradient-to-br from-[var(--color-primary)]/25 to-[var(--color-secondary)]/25" />
        {/* Static accent dots */}
        <div className="absolute top-3 right-8 w-5 h-5 rounded-full bg-[var(--color-accent)]/60" aria-hidden="true" />
        <div className="absolute bottom-6 left-5 w-4 h-4 rounded-full bg-[var(--color-secondary)]/60" aria-hidden="true" />
        <div className="absolute top-10 left-4 w-3 h-3 rounded-full bg-[var(--color-primary)]/50" aria-hidden="true" />
        <div className="absolute bottom-10 right-3 w-3 h-3 rounded-full bg-[var(--color-primary)]/40" aria-hidden="true" />
        {/* Center logo mark */}
        <div className="relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-glow">
          <BrandLogo size={80} className="h-20 w-20" />
        </div>
      </motion.div>

      <motion.div
        custom={1}
        variants={FADE_UP}
        initial={prefersReducedMotion ? false : 'hidden'}
        animate="show"
        className="space-y-3"
      >
        <h1 className="text-fluid-xl font-bold text-[var(--color-text-primary)]">
          {t('onboarding.welcome')}
        </h1>
        <p className="text-[var(--color-text-secondary)] text-base leading-relaxed max-w-xs lg:max-w-md mx-auto">
          {t('onboarding.personalIntelligence')}
        </p>
      </motion.div>

      {/* Privacy badge */}
      <motion.div
        custom={2}
        variants={FADE_UP}
        initial={prefersReducedMotion ? false : 'hidden'}
        animate="show"
        className="flex items-start gap-3 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl px-4 py-3.5 max-w-xs lg:max-w-md w-full"
      >
        <div className="mt-0.5 shrink-0 w-8 h-8 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center">
          <Shield size={16} className="text-[var(--color-primary)]" aria-hidden="true" />
        </div>
        <div className="text-left">
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t('onboarding.privacy')}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            {t('onboarding.privacyNote')}
          </p>
        </div>
      </motion.div>

      <motion.div
        custom={3}
        variants={FADE_UP}
        initial={prefersReducedMotion ? false : 'hidden'}
        animate="show"
        className="w-full mt-2"
      >
        <Button size="lg" fullWidth onClick={onNext}>
          {t('onboarding.done')}
        </Button>
      </motion.div>
    </div>
  );
}

// ─── Step 2: Goal Selection ────────────────────────────────────────────────────

function StepGoal({
  selected,
  goalError,
  onSelect,
}: {
  selected: Goal;
  goalError?: string;
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
      icon: <CalendarDays aria-hidden="true" size={28} />,
      label: t('onboarding.goalTracking'),
      description: t('onboarding.goalDescTracking'),
      accent: 'var(--color-goal-tracking)',
      bg: 'color-mix(in srgb, var(--color-goal-tracking) 8%, transparent)',
    },
    {
      value: 'conceive',
      icon: <Heart aria-hidden="true" size={28} />,
      label: t('onboarding.goalConceive'),
      description: t('onboarding.goalDescConceive'),
      accent: 'var(--color-goal-conceive)',
      bg: 'color-mix(in srgb, var(--color-goal-conceive) 8%, transparent)',
    },
    {
      value: 'perimenopause',
      icon: <Moon aria-hidden="true" size={28} />,
      label: t('onboarding.goalPerimenopause'),
      description: t('onboarding.goalDescPerimenopause'),
      accent: 'var(--color-goal-perimenopause)',
      bg: 'color-mix(in srgb, var(--color-goal-perimenopause) 8%, transparent)',
    },
  ];

  return (
    <div className="flex flex-col gap-6 mx-auto w-full max-w-md lg:max-w-lg">
      <div className="text-center">
        <h2 className="text-fluid-lg font-bold text-[var(--color-text-primary)]">
          {t('onboarding.goal')}
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">{t('onboarding.choosePersonalise')}</p>
        <p
          role="alert"
          aria-hidden={!goalError}
          className={`mt-2 text-sm text-[var(--color-error)] min-h-[20px] transition-opacity duration-150 ${
            goalError ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {goalError || ' '}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {goals.map((g) => {
          const isActive = selected === g.value;
          return (
            <button
              key={g.value}
              onClick={() => onSelect(g.value)}
              className={`w-full rounded-2xl p-4 border-2 text-left transition-colors duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)] ${
                isActive
                  ? 'border-[var(--goal-accent)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--goal-accent)_12%,transparent)]'
                  : 'border-[var(--color-border)] hover:border-[var(--goal-accent)]/40'
              }`}
              style={{
                ['--goal-accent' as string]: goalAccentVar(g.value),
                background: isActive ? g.bg : 'var(--color-bg-card)',
              } as React.CSSProperties}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                  style={{
                    background: isActive ? g.bg : 'var(--color-bg-secondary)',
                    color: 'var(--goal-accent)',
                    border: `1.5px solid ${isActive ? 'var(--goal-accent)' : 'transparent'}`,
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
                    style={{ background: 'var(--goal-accent)' }}
                  >
                    <Check aria-hidden="true" size={14} className="text-[var(--color-on-accent)]" strokeWidth={3} />
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
  flowIntensity,
  onCycleLength,
  onPeriodLength,
  onLastPeriodDate,
  onFlowIntensity,
  today,
}: {
  today: string;
  cycleLength: number;
  periodLength: number;
  lastPeriodDate: string;
  lastPeriodError?: string;
  flowIntensity: FlowIntensity;
  onCycleLength: (v: number) => void;
  onPeriodLength: (v: number) => void;
  onLastPeriodDate: (v: string) => void;
  onFlowIntensity: (v: FlowIntensity) => void;
}) {
  const { t } = useTranslation();

  // Max date is the Bangladesh today; min date is 90 days before it
  const { min: minDate, max: maxDate } = lastPeriodDateBounds(today);

  return (
    <div className="flex flex-col gap-6 mx-auto w-full max-w-2xl">
      <div className="text-center">
        <h2 className="text-fluid-lg font-bold text-[var(--color-text-primary)]">
          {t('onboarding.tellAboutCycle')}
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          {t('onboarding.accuratePredictions')}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Cycle length stepper */}
        <Card padding="md" className="glass space-y-3">
          <div>
            <p className="font-semibold text-[var(--color-text-primary)]">{t('onboarding.cycleLength')}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{t('onboarding.cycleLengthHint')}</p>
          </div>
          <div className="flex justify-center">
            <NumberStepper
              value={cycleLength}
              min={21}
              max={45}
              onChange={onCycleLength}
              unit={t('common.days')}
            />
          </div>
          {/* Visual track */}
          <div className="h-1.5 rounded-full bg-[var(--color-bg-secondary)] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-secondary)] transition-[width] duration-200"
              style={{ width: `${((cycleLength - 21) / (45 - 21)) * 100}%` }}
            />
          </div>
        </Card>

        {/* Period length stepper */}
        <Card padding="md" className="glass space-y-3">
          <div>
            <p className="font-semibold text-[var(--color-text-primary)]">{t('onboarding.periodLength')}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{t('onboarding.periodLengthHint')}</p>
          </div>
          <div className="flex justify-center">
            <NumberStepper
              value={periodLength}
              min={1}
              max={10}
              onChange={onPeriodLength}
              unit={t('common.days')}
            />
          </div>
          <div className="h-1.5 rounded-full bg-[var(--color-bg-secondary)] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] transition-[width] duration-200"
              style={{ width: `${((periodLength - 1) / (10 - 1)) * 100}%` }}
            />
          </div>
        </Card>

        {/* Last period date */}
        <Card padding="md" className="glass">
          <Input
            id="onboarding-last-period-date"
            label={`${t('onboarding.lastPeriod')} *`}
            type="date"
            value={lastPeriodDate}
            min={minDate}
            max={maxDate}
            error={lastPeriodError}
            onChange={(e) => onLastPeriodDate(e.target.value)}
          />
        </Card>

        {/* Flow intensity */}
        <Card padding="md" className="glass space-y-3">
          <div>
            <p className="font-semibold text-[var(--color-text-primary)]">{t('dashboard.flowIntensity')}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{t('onboarding.flowHint')}</p>
          </div>
          <div className="flex gap-2" role="group" aria-label={t('dashboard.flowIntensity')}>
            {(['light', 'medium', 'heavy'] as FlowIntensity[]).map((f) => (
              <button
                key={f}
                onClick={() => onFlowIntensity(f)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${
                  flowIntensity === f
                    ? 'shadow-soft'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)]'
                }`}
                style={
                  flowIntensity === f
                    ? { backgroundColor: FLOW_COLORS[f], borderColor: FLOW_COLORS[f], color: FLOW_TEXT[f] }
                    : {}
                }
              >
                <span className="inline-flex items-center justify-center gap-1.5">
                  <FlowIcon flow={f} />
                  {t(FLOW_LABEL_KEYS[f])}
                </span>
              </button>
            ))}
          </div>
        </Card>
      </div>

    </div>
  );
}

// ─── Step 4: Profile Setup ─────────────────────────────────────────────────────

function StepProfile({
  name,
  nameError,
  userName,
  userNameError,
  relation,
  onName,
  onUserName,
  onRelation,
}: {
  name: string;
  nameError?: string;
  userName: string;
  userNameError?: string;
  relation: ProfileRelation;
  onName: (v: string) => void;
  onUserName: (v: string) => void;
  onRelation: (v: ProfileRelation) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6 mx-auto w-full max-w-md lg:max-w-lg">
      <div className="text-center">
        <h2 className="text-fluid-lg font-bold text-[var(--color-text-primary)]">
          {t('onboarding.whoIsProfile')}
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          {t('onboarding.manageProfiles')}
        </p>
      </div>

      {/* Relation chips */}
      <div>
        <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">{t('onboarding.relationship')}</p>
        <div className="flex flex-wrap gap-2">
          {RELATIONS.map(({ value, labelKey }) => {
            const isActive = relation === value;
            return (
              <button
                key={value}
                onClick={() => onRelation(value)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border-2 transition-colors duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)] ${
                  isActive
                    ? 'bg-[var(--color-primary)] text-[var(--color-on-accent)] border-[var(--color-primary)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary)_18%,transparent)]'
                    : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                }`}
              >
                {t(labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Your name input — only shown for non-self profiles */}
      {relation !== 'self' && (
        <div>
          <Input
            id="onboarding-user-name"
            label={`${t('onboarding.yourNameLabel')} *`}
            placeholder={t('onboarding.yourNamePlaceholder')}
            value={userName}
            error={userNameError}
            onChange={(e) => onUserName(e.target.value)}
            maxLength={40}
          />
        </div>
      )}

      {/* Name input */}
      <div>
        <Input
          id="onboarding-profile-name"
          label={`${t('onboarding.nameLabel')} *`}
          placeholder={relation === 'self' ? t('onboarding.namePlaceholder') : t('onboarding.relativeNamePlaceholder', { relation: t(`profiles.${relation}`) })}
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
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] flex items-center justify-center text-[var(--color-on-accent)] font-bold text-sm">
            {name ? name[0].toUpperCase() : <User aria-hidden="true" size={16} />}
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
  prefersReducedMotion,
}: {
  state: OnboardingState;
  prefersReducedMotion: boolean;
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

  const summaryItems: { label: string; value: React.ReactNode }[] = [
    {
      label: t('onboarding.goalLabel'),
      value: goalLabel,
    },
    {
      label: t('onboarding.profileLabel'),
      value: state.profileName
        ? `${state.profileName} (${t(`profiles.${state.profileRelation}`)})`
        : t(`profiles.${state.profileRelation}`),
    },
    {
      label: t('onboarding.cycleLengthLabel'),
      value: `${state.cycleLength} ${t('onboarding.days')}`,
    },
    {
      label: t('onboarding.periodLengthLabel'),
      value: `${state.periodLength} ${t('onboarding.days')}`,
    },
    ...(state.lastPeriodDate
      // eslint-disable-next-line no-restricted-syntax -- parsed as local midnight and formatted in the same local zone, so the day cannot shift
      ? [{ label: t('onboarding.lastPeriodLabel'), value: new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(state.lastPeriodDate + 'T00:00:00')) }]
      : []),
    {
      label: t('dashboard.flowIntensity'),
      value: (
        <span className="inline-flex items-center gap-1.5">
          <FlowIcon flow={state.flowIntensity} />
          {t(FLOW_LABEL_KEYS[state.flowIntensity])}
        </span>
      ),
    },
  ];

  // Confetti dots — one-shot entrance, static under prefersReducedMotion
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
    <div className="flex flex-col items-center text-center gap-5 mx-auto w-full max-w-md lg:max-w-lg">
      {/* Celebration area */}
      <div className="relative w-full h-20 lg:h-24 flex items-center justify-center" aria-hidden="true">
        {/* Confetti dots */}
        {confettiDots.map((dot, i) =>
          prefersReducedMotion ? (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                top: dot.top,
                left: dot.left,
                width: dot.size,
                height: dot.size,
                backgroundColor: dot.color,
                opacity: 0.6,
              }}
            />
          ) : (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: -20, scale: 0 }}
              animate={{ opacity: 0.8, y: 0, scale: 1 }}
              transition={{
                delay: parseFloat(dot.delay),
                type: 'spring',
                stiffness: 220,
                damping: 14,
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
          )
        )}
        {/* Central celebration icon */}
        <motion.div
          initial={prefersReducedMotion ? false : { scale: 0, rotate: -15 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={prefersReducedMotion ? undefined : { type: 'spring', stiffness: 260, damping: 18 }}
          className="w-24 h-24 rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-secondary)] flex items-center justify-center shadow-glow z-10"
        >
          <Check aria-hidden="true" size={40} className="text-[var(--color-on-accent)]" strokeWidth={3} />
        </motion.div>
      </div>

      <div className="space-y-2">
        <h2 className="text-fluid-xl font-bold text-[var(--color-text-primary)]">{t('onboarding.allSet')}</h2>
        <p className="text-[var(--color-text-secondary)] text-sm">
          {t('onboarding.personalised')}
        </p>
      </div>

      {/* Summary card */}
      <Card padding="md" className="glass w-full text-left">
        <p className="text-sm font-semibold text-[var(--color-text-secondary)] mb-3">
          {t('onboarding.yourSetup')}
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

      <p className="text-xs text-[var(--color-text-muted)] max-w-xs lg:max-w-md">
        {t('onboarding.settingsHint')}
      </p>
    </div>
  );
}

// ─── Main Onboarding Client ───────────────────────────────────────────────────

interface OnboardingClientProps {
  user: { phone: string | null; email: string | null; fullName: string | null };
  /** The Bangladesh day, from the Server Component. */
  today: string;
}

export default function OnboardingClient({ user, today }: OnboardingClientProps) {
  const router = useRouter();
  const { t } = useTranslation();
  const { setOnboardingComplete, setActiveProfile } = useAppStore();
  // Gate on mount so SSR and the first client render agree (both animated), then
  // apply the reduced-motion fallbacks after mount — avoids a hydration mismatch
  // for reduced-motion users. Flows to every step via the prop below.
  const reduceRaw = useReducedMotion() ?? false;
  const mounted = useHasMounted();
  const prefersReducedMotion = mounted && reduceRaw;

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState<1 | -1>(1);

  const [state, setState] = useState<OnboardingState>({
    goal: null,
    cycleLength: 28,
    periodLength: 5,
    lastPeriodDate: '',
    flowIntensity: 'medium' as FlowIntensity,
    profileName: '',
    userName: '',
    profileRelation: 'self',
  });

  const [stepErrors, setStepErrors] = useState<{
    goal?: string;
    profileName?: string;
    userName?: string;
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

    if (currentStep === 2) {
      if (!state.goal) {
        errors.goal = t('onboarding.goalRequired');
      }
    }

    if (currentStep === 3) {
      const trimmed = state.profileName.trim();
      if (!trimmed) {
        errors.profileName = t('profiles.nameRequired');
      } else if (trimmed.length < 2) {
        errors.profileName = t('onboarding.enterNameError');
      }
      if (state.profileRelation !== 'self') {
        const trimmedUserName = state.userName.trim();
        if (!trimmedUserName) {
          errors.userName = t('profiles.nameRequired');
        } else if (trimmedUserName.length < 2) {
          errors.userName = t('onboarding.enterNameError');
        }
      }
    }

    if (currentStep === 4) {
      if (!state.lastPeriodDate) {
        errors.lastPeriodDate = t('onboarding.lastPeriodRequired');
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
    if (submitting) return;
    if (!validateStep(2)) {
      setStep(2);
      return;
    }
    if (!validateStep(3)) {
      setStep(3);
      return;
    }
    if (!validateStep(4)) {
      setStep(4);
      return;
    }

    setSubmitting(true);
    setStepErrors({});

    try {
      const profile = await createProfile({
        name: state.profileName.trim(),
        relation: RELATION_TO_DB[state.profileRelation],
        cycleLength: state.cycleLength,
        periodLength: state.periodLength,
        lastPeriodStart: state.lastPeriodDate,
        flowIntensity: state.flowIntensity.toUpperCase() as 'LIGHT' | 'MEDIUM' | 'HEAVY',
        goal: state.goal ?? undefined,
        userName: state.profileRelation === 'self' ? state.profileName.trim() : state.userName.trim() || undefined,
      });
      await setActiveProfileCookie(profile.id);
      setActiveProfile(profile.id);
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

  // ── Animation variants — x offsets collapse to 0 when reduced motion is preferred ──

  const variants = {
    enter: (dir: number) => ({
      x: prefersReducedMotion ? 0 : dir > 0 ? '60%' : '-60%',
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: prefersReducedMotion ? 0 : dir > 0 ? '-60%' : '60%',
      opacity: 0,
    }),
  };

  // ── Render step content ──

  function renderStep() {
    switch (step) {
      case 1:
        return <StepWelcome onNext={goNext} prefersReducedMotion={prefersReducedMotion} />;
      case 2:
        return (
          <StepGoal
            selected={state.goal}
            goalError={stepErrors.goal}
            onSelect={(g) => {
              setState((s) => ({ ...s, goal: g }));
              if (stepErrors.goal) setStepErrors((e) => ({ ...e, goal: undefined }));
            }}
          />
        );
      case 3:
        return (
          <StepProfile
            name={state.profileName}
            nameError={stepErrors.profileName}
            userName={state.userName}
            userNameError={stepErrors.userName}
            relation={state.profileRelation}
            onName={(v) => {
              setState((s) => ({ ...s, profileName: v }));
              if (stepErrors.profileName) setStepErrors((e) => ({ ...e, profileName: undefined }));
            }}
            onUserName={(v) => {
              setState((s) => ({ ...s, userName: v }));
              if (stepErrors.userName) setStepErrors((e) => ({ ...e, userName: undefined }));
            }}
            onRelation={(v) => {
              setState((s) => ({ ...s, profileRelation: v }));
              if (v === 'self' && stepErrors.userName) {
                setStepErrors((e) => ({ ...e, userName: undefined }));
              }
            }}
          />
        );
      case 4:
        return (
          <StepCycleHistory
            today={today}
            cycleLength={state.cycleLength}
            periodLength={state.periodLength}
            lastPeriodDate={state.lastPeriodDate}
            lastPeriodError={stepErrors.lastPeriodDate}
            flowIntensity={state.flowIntensity}
            onCycleLength={(v) => setState((s) => ({ ...s, cycleLength: v }))}
            onPeriodLength={(v) => setState((s) => ({ ...s, periodLength: v }))}
            onLastPeriodDate={(v) => {
              setState((s) => ({ ...s, lastPeriodDate: v }));
              if (stepErrors.lastPeriodDate) setStepErrors((e) => ({ ...e, lastPeriodDate: undefined }));
            }}
            onFlowIntensity={(v) => setState((s) => ({ ...s, flowIntensity: v }))}
          />
        );
      case 5:
        return (
          <>
            <div aria-live="polite" aria-atomic="true">
              <p
                role="alert"
                aria-hidden={!stepErrors.submit}
                className={`mb-4 text-sm text-[var(--color-error)] text-center min-h-[20px] transition-opacity duration-150 ${
                  stepErrors.submit ? 'opacity-100' : 'opacity-0'
                }`}
              >
                {stepErrors.submit || ' '}
              </p>
            </div>
            <StepDone state={state} prefersReducedMotion={prefersReducedMotion} />
          </>
        );
      default:
        return null;
    }
  }

  return (
    <CenteredShell prefersReducedMotion={prefersReducedMotion} animateIn={false}>
      {/* ── Header (shrink-0) ── */}
      <div className="shrink-0 px-5 pt-5 pb-3 md:px-7">
        <div className="flex items-center justify-between">
          {/* Cycle Circle wordmark — always visible now that the brand panel is gone */}
          <span className="shrink-0 text-lg font-extrabold text-[var(--color-text-primary)]">Cycle Circle</span>
          {/* Right cluster: identity chip + language toggle + step counter */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <AccountControl user={user} />
            <LanguageToggle />
            <span className="text-xs font-medium tabular-nums text-[var(--color-text-muted)] shrink-0">
              {step}&nbsp;/&nbsp;{TOTAL_STEPS}
            </span>
          </div>
        </div>
        {/* Progress indicators */}
        <div className="mt-3">
          <ProgressBar step={step} prefersReducedMotion={prefersReducedMotion} />
        </div>
      </div>

      {/* ── Scrollable content (flex-1) ── */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {/* initial={false}: the first step replaces the loading skeleton in place; only step changes animate. */}
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.div
            key={step}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={
              prefersReducedMotion
                ? { opacity: { duration: 0.15 } }
                : {
                    x: { type: 'spring', stiffness: 280, damping: 30 },
                    opacity: { duration: 0.18 },
                  }
            }
            className="px-5 py-6 md:px-8 md:py-8"
          >
            {renderStep()}
            {/* Bottom padding so content isn't hidden behind the nav */}
            <div className="h-2" />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Bottom nav (shrink-0) — shown for steps 2–5 ── */}
      {step >= 2 && step <= 5 && (
        <div className="shrink-0 border-t border-[var(--color-border)] px-5 py-4 md:px-7">
          <div className="flex gap-3">
            <Button variant="outline" size="lg" onClick={goBack} aria-label={t('common.back')} className="w-14 shrink-0 px-0">
              <ChevronLeft size={20} aria-hidden="true" />
            </Button>
            {step === 5 ? (
              <Button
                size="lg"
                fullWidth
                onClick={handleFinish}
                disabled={submitting}
              >
                {submitting ? t('common.loading') : t('onboarding.goToDashboard')}
              </Button>
            ) : (
              <Button
                size="lg"
                fullWidth
                onClick={goNext}
              >
                {t('onboarding.next')} <ChevronRight size={18} className="ml-1" aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      )}
    </CenteredShell>
  );
}
