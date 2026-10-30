'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '@/components/ui/Toast';
import { useTranslation, Trans } from 'react-i18next';
import { Check, Trash2, Plus, Minus, UserPlus, X, ChevronRight, Pencil, User, Heart, Baby, UserRound, Users, Lock, LockKeyhole, type LucideIcon } from 'lucide-react';
import { FlowIcon } from '@/components/ui/PhaseIcon';
import { GOAL_ICON_COMPONENTS, GOAL_I18N_KEYS } from '@/lib/goal-display';
import { GOAL_VALUES, normalizeGoal, goalAccentVar, type GoalValue } from '@vesta/shared/utils/goal';
import { useAppStore } from '@/lib/store';
import type { Profile, ProfileRelation } from '@vesta/shared/types';
import { createProfile, deleteProfile, updateProfile, setActiveProfileCookie } from '@/app/actions/profile-actions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { useHeld } from '@/lib/use-held';
import { cn } from '@/lib/cn';
import { lastPeriodDateBounds } from '@/lib/day-ranges';
import '@vesta/shared/utils/i18n';
import { PageContainer } from '@/components/ui/PageContainer'
import { PageHeader } from '@/components/ui/PageHeader'

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_PROFILES = 6;

const FLOW_COLORS: Record<'light' | 'medium' | 'heavy', string> = {
  light: 'var(--color-follicular)',
  medium: 'var(--color-primary)',
  heavy: 'var(--color-menstrual)',
};

const FLOW_TEXT: Record<'light' | 'medium' | 'heavy', string> = {
  light: 'var(--color-on-follicular)',
  medium: 'var(--color-on-accent)',
  heavy: 'var(--color-on-menstrual)',
};

const RELATIONS: ProfileRelation[] = ['self', 'wife', 'sister', 'mother', 'daughter', 'girlfriend'];

const RELATION_ICONS: Record<ProfileRelation, LucideIcon> = {
  self: User,
  wife: Heart,
  sister: Users,
  mother: UserRound,
  daughter: Baby,
  girlfriend: Heart,
};

const RELATION_COLORS: Record<ProfileRelation, { bg: string; text: string; border: string }> = {
  self: { bg: 'color-mix(in srgb, var(--color-primary) 10%, transparent)', text: 'var(--color-text-primary)', border: 'color-mix(in srgb, var(--color-primary) 30%, transparent)' },
  wife: { bg: 'color-mix(in srgb, var(--color-secondary) 10%, transparent)', text: 'var(--color-text-primary)', border: 'color-mix(in srgb, var(--color-secondary) 30%, transparent)' },
  sister: { bg: 'color-mix(in srgb, var(--color-coral) 10%, transparent)', text: 'var(--color-text-primary)', border: 'color-mix(in srgb, var(--color-coral) 30%, transparent)' },
  mother: { bg: 'color-mix(in srgb, var(--color-follicular) 16%, transparent)', text: 'var(--color-text-primary)', border: 'color-mix(in srgb, var(--color-follicular) 40%, transparent)' },
  daughter: { bg: 'color-mix(in srgb, var(--color-accent) 10%, transparent)', text: 'var(--color-text-primary)', border: 'color-mix(in srgb, var(--color-accent) 30%, transparent)' },
  girlfriend: { bg: 'color-mix(in srgb, var(--color-primary) 8%, transparent)', text: 'var(--color-text-primary)', border: 'color-mix(in srgb, var(--color-primary) 25%, transparent)' },
};

// Map Prisma uppercase enum to lowercase ProfileRelation
function normalizeRelation(relation: Profile['relation']): ProfileRelation {
  return relation.toLowerCase() as ProfileRelation;
}

// Map lowercase ProfileRelation to Prisma uppercase enum
function toDbRelation(relation: ProfileRelation): 'SELF' | 'WIFE' | 'SISTER' | 'MOTHER' | 'DAUGHTER' | 'GIRLFRIEND' {
  return relation.toUpperCase() as 'SELF' | 'WIFE' | 'SISTER' | 'MOTHER' | 'DAUGHTER' | 'GIRLFRIEND';
}

// ─── Stepper Component ────────────────────────────────────────────────────────

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  unit?: string;
}

function Stepper({ label, value, min, max, onChange, unit }: StepperProps) {
  const { t } = useTranslation();
  const unitText = unit ?? t('common.days');
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-sm font-medium text-[var(--color-text-secondary)]">{label}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="group min-w-11 min-h-11 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
          aria-label={t('profiles.decreaseField', { label })}
        >
          <span className="w-8 h-8 rounded-full flex items-center justify-center border transition-colors duration-150 bg-[var(--color-bg-secondary)] border-[var(--color-border)]"><Minus aria-hidden="true" size={13} className="text-[var(--color-text-primary)]" /></span>
        </button>
        <div className="min-w-[52px] text-center">
          <span className="text-base font-bold text-[var(--color-text-primary)]">{value}</span>
          <span className="text-xs text-[var(--color-text-muted)] ml-1">{unitText}</span>
        </div>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="group min-w-11 min-h-11 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
          aria-label={t('profiles.increaseField', { label })}
        >
          <span className="w-8 h-8 rounded-full flex items-center justify-center border transition-colors duration-150 bg-[var(--color-bg-secondary)] border-[var(--color-border)]"><Plus aria-hidden="true" size={13} className="text-[var(--color-text-primary)]" /></span>
        </button>
      </div>
    </div>
  );
}

// ─── Profile Card Component ────────────────────────────────────────────────────

interface ProfileCardProps {
  profile: Profile;
  isActive: boolean;
  isSwitching?: boolean;
  onSwitch: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

function ProfileCard({ profile, isActive, isSwitching, onSwitch, onDelete, onEdit }: ProfileCardProps) {
  const { t } = useTranslation();
  const relation = normalizeRelation(profile.relation);
  const colors = RELATION_COLORS[relation];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
    >
      <div
        className={cn(
          'w-full rounded-panel bg-[var(--color-bg-card)] border border-transparent shadow-panel transition-[box-shadow] duration-200 relative overflow-hidden',
          // The active profile wears the goal-colour ring (spec #66: goal accent = profile ring).
          isActive && 'ring-2 ring-[var(--goal-accent)]',
        )}
      >

        <div className="flex items-center gap-1">
          {/* Switch control: avatar + info */}
          <button
            type="button"
            onClick={onSwitch}
            disabled={isSwitching}
            aria-label={`${t('profiles.switchTo')} ${profile.name}`}
            aria-current={isActive ? 'true' : undefined}
            className="flex flex-1 min-w-0 items-center gap-3 text-left p-4 pr-2 min-h-11 rounded-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--goal-accent)]"
          >
          {/* Avatar */}
          <div
            className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: colors.bg, border: `1.5px solid ${colors.border}` }}
          >
            {React.createElement(RELATION_ICONS[relation], { size: 20, 'aria-hidden': true, style: { color: colors.text } })}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[var(--color-text-primary)] text-base truncate">
                {profile.name}
              </span>
              {isActive && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full uppercase bg-tint-pink text-accent-pink">
                  {t('profiles.active')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {/* Relation badge */}
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
              >
                {t(`profiles.${relation}`)}
              </span>
              {/* Cycle info */}
              <span className="text-[11px] text-[var(--color-text-muted)]">
                {t('profiles.cycleSummary', { cycle: profile.cycleLength, period: profile.periodLength })}
              </span>
            </div>
          </div>

          {/* Active checkmark or chevron */}
          <div className="flex items-center flex-shrink-0">
            {isActive ? (
              <div className="w-7 h-7 rounded-full flex items-center justify-center bg-tint-pink text-accent-pink">
                <Check size={14} strokeWidth={2.5} aria-hidden="true" />
              </div>
            ) : (
              <ChevronRight size={16} className="text-[var(--color-text-muted)]" aria-hidden="true" />
            )}
          </div>
          </button>

          {/* Edit / delete controls: siblings of the switch button */}
          <div className="flex items-center gap-1 flex-shrink-0 pr-3">

            {/* Edit button — always visible */}
            <button
              type="button"
              onClick={onEdit}
              className="min-w-11 min-h-11 rounded-full flex items-center justify-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
              style={{
                background: 'color-mix(in srgb, var(--color-secondary) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-secondary) 25%, transparent)',
              }}
              aria-label={`${t('profiles.editProfile')} ${profile.name}`}
            >
              <Pencil size={13} color="var(--color-secondary)" aria-hidden="true" />
            </button>

            {/* Delete — only for non-active profiles */}
            {!isActive && (
              <button
                type="button"
                onClick={onDelete}
                className="min-w-11 min-h-11 rounded-full flex items-center justify-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
                style={{
                  background: 'color-mix(in srgb, var(--color-error) 8%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--color-error) 25%, transparent)',
                }}
                aria-label={`${t('common.delete')} ${profile.name}`}
              >
                <Trash2 size={13} color="var(--color-error)" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Add Profile Form ─────────────────────────────────────────────────────────

interface AddProfileFormProps {
  /** The Bangladesh day, from the Server Component. */
  today: string;
  onClose: () => void;
  serverError?: string;
  disabled?: boolean;
  onSubmit: (data: {
    name: string;
    relation: ProfileRelation;
    cycleLength: number;
    periodLength: number;
    lastPeriodStart: string;
    flowIntensity: 'LIGHT' | 'MEDIUM' | 'HEAVY';
    goal: GoalValue;
  }) => void;
}

function AddProfileForm({ today, onClose, onSubmit, serverError, disabled }: AddProfileFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [relation, setRelation] = useState<ProfileRelation>('sister');
  const [cycleLength, setCycleLength] = useState(28);
  const [periodLength, setPeriodLength] = useState(5);
  const [nameError, setNameError] = useState('');
  const [lastPeriodDate, setLastPeriodDate] = useState('');
  const [lastPeriodError, setLastPeriodError] = useState('');
  const [flowIntensity, setFlowIntensity] = useState<'light' | 'medium' | 'heavy'>('medium');
  const [goal, setGoal] = useState<GoalValue>('tracking');

  function handleSubmit() {
    const trimmed = name.trim();
    let hasError = false;

    if (!trimmed) {
      setNameError(t('profiles.nameRequired'));
      hasError = true;
    } else if (trimmed.length < 2) {
      setNameError(t('profiles.nameMinLength'));
      hasError = true;
    }

    if (!lastPeriodDate) {
      setLastPeriodError(t('profiles.lastPeriodRequired'));
      hasError = true;
    }

    if (hasError) return;

    onSubmit({
      name: trimmed,
      relation,
      cycleLength,
      periodLength,
      lastPeriodStart: lastPeriodDate,
      flowIntensity: flowIntensity.toUpperCase() as 'LIGHT' | 'MEDIUM' | 'HEAVY',
      goal,
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ type: 'spring', stiffness: 400, damping: 35 }}
      className="rounded-panel bg-[var(--color-bg-card)] border border-transparent shadow-panel overflow-hidden"
    >
      {/* Form header */}
      <div
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-2">
          <div aria-hidden="true" className="w-8 h-8 rounded-full flex items-center justify-center bg-tint-pink text-accent-pink">
            <UserPlus size={15} />
          </div>
          <h2 className="font-bold text-[var(--color-text-primary)] text-base">
            {t('profiles.add')}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="group -mr-2 min-w-11 min-h-11 rounded-full flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent)]"
          aria-label={t('common.cancel')}
        >
          <span aria-hidden="true" className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--color-bg-secondary)] group-hover:bg-[var(--color-border)] transition-colors">
            <X size={14} className="text-[var(--color-text-muted)]" />
          </span>
        </button>
      </div>

      <div className="px-5 py-4 flex flex-col gap-4">
        {/* Name */}
        <Input
          id="add-profile-name"
          label={t('onboarding.nameLabel')}
          placeholder={t('profiles.namePlaceholder')}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError('');
          }}
          error={nameError}
          maxLength={30}
          autoFocus
        />

        {/* Relation picker */}
        <div>
          <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            {t('profiles.relation')}
          </p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {RELATIONS.map((rel) => {
              const isSelected = relation === rel;
              const colors = RELATION_COLORS[rel];
              return (
                <button
                  key={rel}
                  onClick={() => setRelation(rel)}
                  className="flex flex-col items-center gap-1 min-h-11 py-2.5 px-2 rounded-xl border text-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
                  style={{
                    background: isSelected ? colors.bg : 'var(--color-bg-secondary)',
                    borderColor: isSelected ? colors.border : 'var(--color-border)',
                    boxShadow: isSelected ? `0 0 0 1.5px ${colors.border}` : 'none',
                  }}
                  aria-pressed={isSelected}
                >
                  {React.createElement(RELATION_ICONS[rel], { size: 18, 'aria-hidden': true })}
                  <span
                    className="text-[11px] font-semibold"
                    style={{ color: isSelected ? colors.text : 'var(--color-text-muted)' }}
                  >
                    {t(`profiles.${rel}`)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Goal selector */}
        <div role="group" aria-label={t('profiles.goalLabel')}>
          <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
            {t('profiles.goalLabel')}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {GOAL_VALUES.map((g) => {
              const isSelected = goal === g;
              const accentVar = goalAccentVar(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGoal(g)}
                  aria-pressed={isSelected}
                  className="flex flex-col items-center gap-1 min-h-11 py-2.5 px-1.5 rounded-xl border text-center transition-[color,background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
                  style={
                    {
                      '--goal-accent': accentVar,
                      background: isSelected ? 'color-mix(in srgb, var(--goal-accent) 12%, transparent)' : 'var(--color-bg-secondary)',
                      borderColor: isSelected ? 'color-mix(in srgb, var(--goal-accent) 45%, transparent)' : 'var(--color-border)',
                      boxShadow: isSelected ? '0 0 0 1.5px color-mix(in srgb, var(--goal-accent) 45%, transparent)' : 'none',
                    } as React.CSSProperties
                  }
                >
                  <span
                    style={{ color: isSelected ? accentVar : 'var(--color-text-muted)' }}
                    className="flex items-center justify-center"
                  >
                    {GOAL_ICON_COMPONENTS[g]}
                  </span>
                  <span
                    className="text-[11px] font-semibold leading-tight"
                    style={{ color: isSelected ? accentVar : 'var(--color-text-muted)' }}
                  >
                    {t(GOAL_I18N_KEYS[g])}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Steppers */}
        <div
          className="rounded-xl p-3 flex flex-col gap-3"
          style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
        >
          <Stepper
            label={t('profiles.cycleLength')}
            value={cycleLength}
            min={21}
            max={45}
            onChange={setCycleLength}
          />
          <div style={{ height: '1px', background: 'var(--color-border)' }} />
          <Stepper
            label={t('profiles.periodLength')}
            value={periodLength}
            min={1}
            max={10}
            onChange={setPeriodLength}
          />
        </div>

        {/* Last period date */}
        <div>
          <label
            htmlFor="last-period-date"
            className="block text-sm font-medium text-[var(--color-text-secondary)] mb-1.5"
          >
            {t('profiles.lastPeriodStart')} *
          </label>
          <input
            id="last-period-date"
            type="date"
            value={lastPeriodDate}
            onChange={(e) => {
              setLastPeriodDate(e.target.value);
              if (lastPeriodError) setLastPeriodError('');
            }}
            max={lastPeriodDateBounds(today).max}
            min={lastPeriodDateBounds(today).min}
            required
            aria-invalid={!!lastPeriodError}
            aria-describedby={lastPeriodError ? 'last-period-date-error' : undefined}
            className={`w-full rounded-xl border px-3 py-2.5 text-sm font-medium text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)] transition-colors duration-150 ${
              lastPeriodError ? 'border-[var(--color-error)] focus-visible:ring-[var(--color-error)]/30' : ''
            }`}
            style={{ borderColor: lastPeriodError ? undefined : 'var(--color-border)' }}
          />
          <p
            id="last-period-date-error"
            role="alert"
            aria-hidden={!lastPeriodError}
            className={`mt-1 text-sm text-[var(--color-error)] min-h-[20px] transition-opacity duration-150 ${
              lastPeriodError ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {lastPeriodError || '\u00A0'}
          </p>
        </div>

        {/* Flow intensity */}
        <div>
          <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">{t('dashboard.flowIntensity')}</p>
          <div className="flex gap-2" role="group" aria-label={t('dashboard.flowIntensity')}>
            {(['light', 'medium', 'heavy'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFlowIntensity(f)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)] ${
                  flowIntensity === f
                    ? 'shadow-soft'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)]'
                }`}
                style={
                  flowIntensity === f
                    ? { backgroundColor: FLOW_COLORS[f], borderColor: FLOW_COLORS[f], color: FLOW_TEXT[f] }
                    : {}
                }
                aria-pressed={flowIntensity === f}
              >
                <FlowIcon flow={f} className="mr-1.5 align-middle" />
                {f === 'light' ? t('profiles.flowLight') : f === 'medium' ? t('profiles.flowMedium') : t('profiles.flowHeavy')}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <p
          role="alert"
          aria-live="polite"
          aria-hidden={!serverError}
          className={`text-sm text-[var(--color-error)] text-center min-h-[20px] transition-opacity duration-150 ${
            serverError ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {serverError || '\u00A0'}
        </p>
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose} className="flex-1 min-h-11">
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={disabled} className="flex-1 min-h-11">
            {t('profiles.createProfile')}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Edit Profile Form ────────────────────────────────────────────────────────

// Goal options derived from shared canonical module (includes 'pregnancy')
const GOAL_OPTIONS: GoalValue[] = [...GOAL_VALUES];

interface EditProfileFormProps {
  open: boolean;
  profile: Profile;
  onClose: () => void;
  serverError?: string;
  disabled?: boolean;
  onSubmit: (data: {
    name: string;
    relation: ProfileRelation;
    cycleLength: number;
    periodLength: number;
    goal: GoalValue;
  }) => void;
}

function EditProfileForm({ open, profile, onClose, onSubmit, serverError, disabled }: EditProfileFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(profile.name);
  const [relation, setRelation] = useState<ProfileRelation>(normalizeRelation(profile.relation));
  const [cycleLength, setCycleLength] = useState(profile.cycleLength);
  const [periodLength, setPeriodLength] = useState(profile.periodLength);
  // normalizeGoal can return null for unknown values; fall back to 'tracking'
  const [goal, setGoal] = useState<GoalValue>(normalizeGoal(profile.goal) ?? 'tracking');
  const [nameError, setNameError] = useState('');

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(t('profiles.nameRequired'));
      return;
    }
    if (trimmed.length < 2) {
      setNameError(t('profiles.nameMinLength'));
      return;
    }
    onSubmit({ name: trimmed, relation, cycleLength, periodLength, goal });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      titleId="edit-profile-dialog-title"
      panelClassName="sm:max-w-md"
      header={
        <div
          className="flex items-center gap-2 px-5 py-4 pr-14 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div aria-hidden="true" className="w-8 h-8 rounded-full flex items-center justify-center bg-tint-pink text-accent-pink">
            <Pencil size={15} />
          </div>
          <h2 id="edit-profile-dialog-title" className="font-bold text-[var(--color-text-primary)] text-base">
            {t('profiles.editProfile')}
          </h2>
        </div>
      }
      footer={
        <div className="px-5 py-3 border-t flex flex-col gap-2" style={{ borderColor: 'var(--color-border)' }}>
          {/* Actions */}
          <p
            role="alert"
            aria-live="polite"
            aria-hidden={!serverError}
            className={`text-sm text-[var(--color-error)] text-center min-h-[20px] transition-opacity duration-150 ${
              serverError ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {serverError || '\u00A0'}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} className="flex-1 min-h-11">
              {t('common.cancel')}
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={disabled} className="flex-1 min-h-11">
        {t('profiles.saveChanges')}
      </Button>
    </div>
        </div>
      }
    >
        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Name */}
          <Input
            id="edit-profile-name"
            label={t('onboarding.nameLabel')}
            placeholder={t('profiles.namePlaceholder')}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (nameError) setNameError('');
            }}
            error={nameError}
            maxLength={30}
          />

          {/* Relation picker */}
          <div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              {t('profiles.relation')}
            </p>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {RELATIONS.map((rel) => {
                const isSelected = relation === rel;
                const colors = RELATION_COLORS[rel];
                return (
                  <button
                    key={rel}
                    onClick={() => setRelation(rel)}
                    className="flex flex-col items-center gap-1 min-h-11 py-2.5 px-2 rounded-xl border text-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
                    style={{
                      background: isSelected ? colors.bg : 'var(--color-bg-secondary)',
                      borderColor: isSelected ? colors.border : 'var(--color-border)',
                      boxShadow: isSelected ? `0 0 0 1.5px ${colors.border}` : 'none',
                    }}
                    aria-pressed={isSelected}
                  >
                    {React.createElement(RELATION_ICONS[rel], { size: 18, 'aria-hidden': true })}
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: isSelected ? colors.text : 'var(--color-text-muted)' }}
                    >
                      {t(`profiles.${rel}`)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Steppers */}
          <div
            className="rounded-xl p-3 flex flex-col gap-3"
            style={{ background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)' }}
          >
            <Stepper
              label={t('profiles.cycleLength')}
              value={cycleLength}
              min={21}
              max={45}
              onChange={setCycleLength}
            />
            <div style={{ height: '1px', background: 'var(--color-border)' }} />
            <Stepper
              label={t('profiles.periodLength')}
              value={periodLength}
              min={1}
              max={10}
              onChange={setPeriodLength}
            />
          </div>

          {/* Goal selector */}
          <div role="group" aria-label={t('profiles.goalLabel')}>
            <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">
              {t('profiles.goalLabel')}
            </p>
            <div className="grid grid-cols-4 gap-2">
              {GOAL_OPTIONS.map((g) => {
                const isSelected = goal === g;
                const accentVar = goalAccentVar(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGoal(g)}
                    aria-pressed={isSelected}
                    className="flex flex-col items-center gap-1 min-h-11 py-2.5 px-1.5 rounded-xl border text-center transition-[color,background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
                    style={
                      {
                        '--goal-accent': accentVar,
                        background: isSelected ? 'color-mix(in srgb, var(--goal-accent) 12%, transparent)' : 'var(--color-bg-secondary)',
                        borderColor: isSelected ? 'color-mix(in srgb, var(--goal-accent) 45%, transparent)' : 'var(--color-border)',
                        boxShadow: isSelected ? '0 0 0 1.5px color-mix(in srgb, var(--goal-accent) 45%, transparent)' : 'none',
                      } as React.CSSProperties
                    }
                  >
                    <span
                      style={{ color: isSelected ? accentVar : 'var(--color-text-muted)' }}
                      className="flex items-center justify-center"
                    >
                      {GOAL_ICON_COMPONENTS[g]}
                    </span>
                    <span
                      className="text-[11px] font-semibold leading-tight"
                      style={{ color: isSelected ? accentVar : 'var(--color-text-muted)' }}
                    >
                      {t(GOAL_I18N_KEYS[g])}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
    </Modal>
  );
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

interface DeleteDialogProps {
  open: boolean;
  profileName: string;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
}

function DeleteDialog({ open, profileName, error, onConfirm, onCancel, disabled }: DeleteDialogProps) {
  const { t } = useTranslation();
  return (
    <Modal open={open} onClose={onCancel} titleId="delete-dialog-title" panelClassName="sm:max-w-sm">
      <div className="p-5 pt-6">
        <div className="flex items-center gap-3 mb-3 pr-8">
          <div className="w-10 h-10 shrink-0 rounded-2xl flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--color-error) 10%, transparent)' }}>
            <Trash2 size={18} color="var(--color-error)" aria-hidden="true" />
          </div>
          <div>
            <h2 id="delete-dialog-title" className="font-bold text-[var(--color-text-primary)]">{t('profiles.removeTitle')}</h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              <Trans i18nKey="profiles.removePrompt" values={{ name: profileName }} components={{ strong: <strong /> }} />
            </p>
          </div>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          {t('profiles.removeWarning')}
        </p>
        <p
          role="alert"
          aria-live="polite"
          aria-hidden={!error}
          className={`text-sm text-[var(--color-error)] text-center mb-4 min-h-[20px] transition-opacity duration-150 ${
            error ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {error || '\u00A0'}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} className="flex-1 min-h-11" data-autofocus>
            {t('common.cancel')}
          </Button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={disabled}
            className="flex-1 min-h-11 py-2 rounded-full text-sm font-bold text-[var(--color-on-action)] transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
            style={{ background: 'var(--color-error)' }}
          >
            {t('common.delete')}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Client Component ────────────────────────────────────────────────────

interface ProfilesClientProps {
  profiles: Profile[];
  /** The Bangladesh day, from the Server Component. */
  today: string;
}

export function ProfilesClient({ profiles, today }: ProfilesClientProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const setActiveProfile = useAppStore((s) => s.setActiveProfile);

  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [editTarget, setEditTarget] = useState<Profile | null>(null);
  const [editKey, setEditKey] = useState(0);
  const heldEdit = useHeld(editTarget);
  const heldDelete = useHeld(deleteTarget);
  const toast = useToast();
  const [isPending, setIsPending] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [addError, setAddError] = useState('');
  const [editError, setEditError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  function closeAddForm() {
    setShowForm(false);
    setAddError('');
  }

  function closeEditForm() {
    setEditTarget(null);
    setEditError('');
  }

  function closeDeleteDialog() {
    setDeleteTarget(null);
    setDeleteError('');
  }

  const atMax = profiles.length >= MAX_PROFILES;

  async function handleSwitchProfile(id: string, name: string) {
    if (id === activeProfileId || isSwitching) return;
    setIsSwitching(true);
    setActiveProfile(id, name);
    toast.show(t('profiles.switchedTo', { name }));
    await setActiveProfileCookie(id);
    window.dispatchEvent(new Event('vesta:profile-updated'));
    router.push('/dashboard');
  }

  async function handleAddProfile(data: {
    name: string;
    relation: ProfileRelation;
    cycleLength: number;
    periodLength: number;
    lastPeriodStart: string;
    flowIntensity: 'LIGHT' | 'MEDIUM' | 'HEAVY';
    goal: GoalValue;
  }) {
    setIsPending(true);
    setAddError('');
    try {
      await createProfile({
        name: data.name,
        relation: toDbRelation(data.relation),
        cycleLength: data.cycleLength,
        periodLength: data.periodLength,
        lastPeriodStart: data.lastPeriodStart,
        flowIntensity: data.flowIntensity,
        goal: data.goal,
      });
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vesta:profile-updated'));
      }
      closeAddForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('profiles.serverError');
      setAddError(message);
      console.error('Failed to add profile:', err);
    } finally {
      setIsPending(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setIsPending(true);
    setDeleteError('');
    try {
      await deleteProfile(deleteTarget.id);
      // If the deleted profile was active, clear the Zustand store selection.
      if (deleteTarget.id === activeProfileId) {
        setActiveProfile('', '');
      }
      router.refresh();
      window.dispatchEvent(new CustomEvent('vesta:profile-updated'));
      closeDeleteDialog();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('profiles.serverError');
      setDeleteError(message);
      console.error('Failed to delete profile:', err);
    } finally {
      setIsPending(false);
    }
  }

  async function handleEditSubmit(data: {
    name: string;
    relation: ProfileRelation;
    cycleLength: number;
    periodLength: number;
    goal: GoalValue;
  }) {
    if (!editTarget) return;
    setIsPending(true);
    setEditError('');
    try {
      await updateProfile({
        profileId: editTarget.id,
        name: data.name,
        relation: toDbRelation(data.relation),
        cycleLength: data.cycleLength,
        periodLength: data.periodLength,
        goal: data.goal,
      });
      // If the renamed profile is currently active, update the Zustand store so
      // the sidebar label reflects the new name immediately.
      if (editTarget.id === activeProfileId) {
        setActiveProfile(editTarget.id, data.name);
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vesta:profile-updated'));
      }
      closeEditForm();
    } catch (err) {
      const message = err instanceof Error ? err.message : t('profiles.serverError');
      setEditError(message);
      console.error('Failed to update profile:', err);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <>
      <PageContainer width="canvas" className="min-h-[calc(100dvh-8rem)]">
        <PageHeader
          title={t('profiles.title')}
          subtitle={`${profiles.length} / ${MAX_PROFILES} ${t('nav.profiles').toLowerCase()}`}
        />

        {/* Profile list */}
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:gap-5 2xl:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {profiles.map((profile) => (
              <ProfileCard
                key={profile.id}
                profile={profile}
                isActive={profile.id === activeProfileId}
                isSwitching={isSwitching}
                onSwitch={() => handleSwitchProfile(profile.id, profile.name)}
                onDelete={() => {
                  setDeleteError('');
                  setDeleteTarget({ id: profile.id, name: profile.name });
                }}
                onEdit={() => {
                  setEditError('');
                  setEditKey((k) => k + 1);
                  setEditTarget(profile);
                }}
              />
            ))}
          </AnimatePresence>
          {/* Add Profile Section */}
          <div className={showForm ? 'lg:col-span-2' : undefined}>
            <AnimatePresence mode="wait">
              {showForm ? (
                <AddProfileForm
                  key="form"
                  today={today}
                  onClose={closeAddForm}
                  serverError={addError}
                  onSubmit={handleAddProfile}
                  disabled={isPending}
                />
              ) : (
                <motion.div
                  key="add-btn"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.2 }}
                >
                  {atMax ? (
                    <div
                      className="rounded-panel border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5 flex flex-col items-center gap-1.5 text-center"
                    >
                      <Lock size={24} className="text-[var(--color-text-muted)]" aria-hidden="true" />
                      <p className="text-sm font-semibold text-[var(--color-text-secondary)]">
                        {t('profiles.maxReached')}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {t('profiles.deleteToAdd')}
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setAddError('');
                        setShowForm(true);
                      }}
                      className="w-full rounded-panel border border-dashed border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-5 flex items-center justify-center gap-3 transition-colors duration-200 group hover:border-[var(--color-border-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
                    >
                      <div
                        aria-hidden="true"
                        className="w-10 h-10 rounded-full flex items-center justify-center bg-tint-pink text-accent-pink transition-transform duration-200 group-hover:scale-105"
                      >
                        <Plus size={18} strokeWidth={2.5} />
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-sm text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">
                          {t('profiles.add')}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {t('profiles.slotsRemaining', { count: MAX_PROFILES - profiles.length })}
                        </p>
                      </div>
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Data isolation note */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.4 }}
            className="lg:col-span-2 2xl:col-span-3 rounded-panel bg-tint-sage p-5 flex items-start gap-3"
          >
            <LockKeyhole size={20} className="flex-shrink-0 mt-0.5 text-accent-sage" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-accent-sage">
                {t('profiles.isolationTitle')}
              </p>
              <p className="text-xs mt-0.5 text-[var(--color-text-secondary)]">
                {t('profiles.isolationBody')}
              </p>
            </div>
          </motion.div>
        </div>
      </PageContainer>

      {/* Delete confirmation dialog: stays mounted so the exit animation plays */}
      {heldDelete && (
        <DeleteDialog
          open={deleteTarget !== null}
          profileName={heldDelete.name}
          error={deleteError}
          onConfirm={handleDeleteConfirm}
          onCancel={closeDeleteDialog}
          disabled={isPending}
        />
      )}

      {/* Edit profile dialog */}
      {heldEdit && (
        <EditProfileForm
          key={`${heldEdit.id}-${editKey}`}
          open={editTarget !== null}
          profile={heldEdit}
          onClose={closeEditForm}
          serverError={editError}
          onSubmit={handleEditSubmit}
          disabled={isPending}
        />
      )}
    </>
  );
}
