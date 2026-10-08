'use client';

import React, { useState, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Check, Trash2, Plus, Minus, UserPlus, X, ChevronRight, Pencil } from 'lucide-react';
import { GOAL_ICON_COMPONENTS, GOAL_I18N_KEYS } from '@/lib/goal-display';
import { GOAL_VALUES, normalizeGoal, goalAccentVar, type GoalValue } from '@vesta/shared/utils/goal';
import { useAppStore } from '@/lib/store';
import type { Profile, ProfileRelation } from '@vesta/shared/types';
import { createProfile, deleteProfile, updateProfile, setActiveProfileCookie } from '@/app/actions/profile-actions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import '@vesta/shared/utils/i18n';

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

const RELATION_ICONS: Record<ProfileRelation, string> = {
  self: '👤',
  wife: '💑',
  sister: '👧',
  mother: '👩',
  daughter: '🧒',
  girlfriend: '💕',
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

function Stepper({ label, value, min, max, onChange, unit = 'days' }: StepperProps) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-sm font-medium text-[var(--color-text-secondary)]">{label}</span>
      <div className="flex items-center gap-3">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="w-8 h-8 rounded-full flex items-center justify-center border transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
          style={{
            background: 'var(--color-bg-secondary)',
            borderColor: 'var(--color-border)',
          }}
          aria-label={`Decrease ${label}`}
        >
          <Minus size={13} className="text-[var(--color-text-primary)]" />
        </button>
        <div className="min-w-[52px] text-center">
          <span className="text-base font-bold text-[var(--color-text-primary)]">{value}</span>
          <span className="text-xs text-[var(--color-text-muted)] ml-1">{unit}</span>
        </div>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="w-8 h-8 rounded-full flex items-center justify-center border transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
          style={{
            background: 'var(--color-bg-secondary)',
            borderColor: 'var(--color-border)',
          }}
          aria-label={`Increase ${label}`}
        >
          <Plus size={13} className="text-[var(--color-text-primary)]" />
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
      <button
        onClick={onSwitch}
        disabled={isSwitching}
        className="w-full text-left rounded-2xl border transition-[color,background-color,border-color,box-shadow] duration-200 p-4 relative overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
        style={{
          background: isActive
            ? 'linear-gradient(135deg, color-mix(in srgb, var(--goal-accent) 7%, transparent) 0%, color-mix(in srgb, var(--color-secondary) 7%, transparent) 100%)'
            : 'var(--color-bg-card)',
          borderColor: isActive ? 'var(--goal-accent)' : 'var(--color-border)',
          boxShadow: isActive
            ? '0 0 0 2px color-mix(in srgb, var(--goal-accent) 20%, transparent), 0 4px 16px color-mix(in srgb, var(--goal-accent) 8%, transparent)'
            : '0 2px 8px color-mix(in srgb, var(--color-brand-navy) 4%, transparent)',
        }}
        aria-label={`${t('profiles.switchTo')} ${profile.name}`}
      >
        {/* Active glow line */}
        {isActive && (
          <motion.div
            layoutId="active-line"
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
            style={{ background: 'linear-gradient(180deg, var(--goal-accent) 0%, var(--color-secondary) 100%)' }}
          />
        )}

        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: colors.bg, border: `1.5px solid ${colors.border}` }}
          >
            {RELATION_ICONS[relation]}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-[var(--color-text-primary)] text-base truncate">
                {profile.name}
              </span>
              {isActive && (
                <span
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    background: 'var(--goal-accent)',
                    color: 'var(--color-on-accent)',
                  }}
                >
                  ACTIVE
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
                {profile.cycleLength}d cycle · {profile.periodLength}d period
              </span>
            </div>
          </div>

          {/* Right: active checkmark or chevron */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {isActive ? (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: 'var(--goal-accent)' }}
              >
                <Check size={14} color="var(--color-on-accent)" strokeWidth={2.5} />
              </div>
            ) : (
              <ChevronRight size={16} className="text-[var(--color-text-muted)]" />
            )}

            {/* Edit button — always visible */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="w-7 h-7 rounded-full flex items-center justify-center transition-colors duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
              style={{
                background: 'color-mix(in srgb, var(--color-secondary) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--color-secondary) 25%, transparent)',
              }}
              aria-label={`Edit ${profile.name}`}
            >
              <Pencil size={13} color="var(--color-secondary)" aria-hidden="true" />
            </button>

            {/* Delete — only for non-active profiles */}
            {!isActive && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-colors duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
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
      </button>
    </motion.div>
  );
}

// ─── Add Profile Form ─────────────────────────────────────────────────────────

interface AddProfileFormProps {
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

function AddProfileForm({ onClose, onSubmit, serverError, disabled }: AddProfileFormProps) {
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
      className="rounded-2xl border overflow-hidden"
      style={{
        background: 'var(--color-bg-card)',
        borderColor: 'var(--goal-accent)',
        boxShadow: '0 0 0 2px color-mix(in srgb, var(--goal-accent) 15%, transparent), 0 8px 32px color-mix(in srgb, var(--goal-accent) 10%, transparent)',
      }}
    >
      {/* Form header */}
      <div
        className="flex items-center justify-between px-5 py-4 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, var(--goal-accent) 0%, var(--color-secondary) 100%)' }}
          >
            <UserPlus size={15} color="var(--color-on-accent)" />
          </div>
          <h3 className="font-bold text-[var(--color-text-primary)] text-base">
            {t('profiles.add')}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
          style={{ background: 'var(--color-bg-secondary)' }}
          aria-label={t('common.cancel')}
        >
          <X size={14} className="text-[var(--color-text-muted)]" />
        </button>
      </div>

      <div className="px-5 py-4 flex flex-col gap-4">
        {/* Name */}
        <Input
          id="add-profile-name"
          label={t('onboarding.nameLabel')}
          placeholder="e.g. Nusrat…"
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
            Relation
          </p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {RELATIONS.map((rel) => {
              const isSelected = relation === rel;
              const colors = RELATION_COLORS[rel];
              return (
                <button
                  key={rel}
                  onClick={() => setRelation(rel)}
                  className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border text-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
                  style={{
                    background: isSelected ? colors.bg : 'var(--color-bg-secondary)',
                    borderColor: isSelected ? colors.border : 'var(--color-border)',
                    boxShadow: isSelected ? `0 0 0 1.5px ${colors.border}` : 'none',
                  }}
                  aria-pressed={isSelected}
                >
                  <span className="text-lg leading-none">{RELATION_ICONS[rel]}</span>
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
                  className="flex flex-col items-center gap-1 py-2.5 px-1.5 rounded-xl border text-center transition-[color,background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
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
                    className="text-[10px] font-semibold leading-tight"
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
            Last period start *
          </label>
          <input
            id="last-period-date"
            type="date"
            value={lastPeriodDate}
            onChange={(e) => {
              setLastPeriodDate(e.target.value);
              if (lastPeriodError) setLastPeriodError('');
            }}
            max={new Date().toISOString().slice(0, 10)}
            min={new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}
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
          <p className="text-sm font-medium text-[var(--color-text-secondary)] mb-2">Flow intensity</p>
          <div className="flex gap-2" role="group" aria-label="Flow intensity">
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
                <span className="mr-1" aria-hidden="true">
                  {f === 'light' ? '💧' : f === 'medium' ? '🩸' : '🌊'}
                </span>
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
          <Button variant="outline" size="sm" onClick={onClose} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={disabled} className="flex-1">
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

function EditProfileForm({ profile, onClose, onSubmit, serverError, disabled }: EditProfileFormProps) {
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-8"
      style={{ background: 'color-mix(in srgb, var(--color-brand-navy) 55%, transparent)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-dialog-title"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        className="w-full max-w-md rounded-2xl border overflow-hidden overscroll-contain"
        style={{
          background: 'var(--color-bg-card)',
          borderColor: 'var(--goal-accent)',
          boxShadow: '0 0 0 2px color-mix(in srgb, var(--goal-accent) 15%, transparent), 0 8px 32px color-mix(in srgb, var(--goal-accent) 10%, transparent)',
        }}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        {/* Form header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, var(--goal-accent) 0%, var(--color-secondary) 100%)' }}
            >
              <Pencil size={15} color="var(--color-on-accent)" />
            </div>
            <h3 id="edit-profile-dialog-title" className="font-bold text-[var(--color-text-primary)] text-base">
              {t('profiles.editProfile')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
            style={{ background: 'var(--color-bg-secondary)' }}
            aria-label={t('common.cancel')}
          >
            <X size={14} className="text-[var(--color-text-muted)]" aria-hidden="true" />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-4">
          {/* Name */}
          <Input
            id="edit-profile-name"
            label={t('onboarding.nameLabel')}
            placeholder="e.g. Nusrat…"
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
              Relation
            </p>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
              {RELATIONS.map((rel) => {
                const isSelected = relation === rel;
                const colors = RELATION_COLORS[rel];
                return (
                  <button
                    key={rel}
                    onClick={() => setRelation(rel)}
                    className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border text-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
                    style={{
                      background: isSelected ? colors.bg : 'var(--color-bg-secondary)',
                      borderColor: isSelected ? colors.border : 'var(--color-border)',
                      boxShadow: isSelected ? `0 0 0 1.5px ${colors.border}` : 'none',
                    }}
                    aria-pressed={isSelected}
                  >
                    <span className="text-lg leading-none">{RELATION_ICONS[rel]}</span>
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
                    className="flex flex-col items-center gap-1 py-2.5 px-1.5 rounded-xl border text-center transition-[color,background-color,border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
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
                      className="text-[10px] font-semibold leading-tight"
                      style={{ color: isSelected ? accentVar : 'var(--color-text-muted)' }}
                    >
                      {t(GOAL_I18N_KEYS[g])}
                    </span>
                  </button>
                );
              })}
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
            <Button variant="outline" size="sm" onClick={onClose} className="flex-1">
              {t('common.cancel')}
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={disabled} className="flex-1">
              {t('profiles.saveChanges')}
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

interface DeleteDialogProps {
  profileName: string;
  error?: string;
  onConfirm: () => void;
  onCancel: () => void;
  disabled?: boolean;
}

function DeleteDialog({ profileName, error, onConfirm, onCancel, disabled }: DeleteDialogProps) {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-8"
      style={{ background: 'color-mix(in srgb, var(--color-brand-navy) 55%, transparent)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
      onKeyDown={(e) => { if (e.key === 'Escape') onCancel(); }}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        className="w-full max-w-md rounded-2xl p-5 overscroll-contain"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'color-mix(in srgb, var(--color-error) 10%, transparent)' }}>
            <Trash2 size={18} color="var(--color-error)" />
          </div>
          <div>
            <h3 id="delete-dialog-title" className="font-bold text-[var(--color-text-primary)]">Remove Profile</h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              Remove <strong>{profileName}</strong>?
            </p>
          </div>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          All symptom logs and data for this profile will be permanently deleted.
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
          <Button variant="outline" size="sm" onClick={onCancel} className="flex-1">
            {t('common.cancel')}
          </Button>
          <button
            onClick={onConfirm}
            disabled={disabled}
            className="flex-1 py-2 rounded-xl text-sm font-bold text-[var(--color-on-action)] transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
            style={{ background: 'var(--color-error)' }}
          >
            {t('common.delete')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Client Component ────────────────────────────────────────────────────

interface ProfilesClientProps {
  profiles: Profile[];
}

export function ProfilesClient({ profiles }: ProfilesClientProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { activeProfileId, setActiveProfile } = useAppStore();

  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [editTarget, setEditTarget] = useState<Profile | null>(null);
  const [justSwitched, setJustSwitched] = useState<string | null>(null);
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
    setJustSwitched(id);
    await setActiveProfileCookie(id);
    router.push('/dashboard');
    setTimeout(() => setJustSwitched(null), 1500);
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
      <div className="flex flex-col min-h-[calc(100dvh-8rem)] pb-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="pt-3 pb-4"
        >
          <h1 className="text-xl md:text-2xl font-bold text-[var(--color-text-primary)]">
            {t('profiles.title')}
          </h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
            {profiles.length} / {MAX_PROFILES} {t('nav.profiles').toLowerCase()}
          </p>
        </motion.div>

        {/* Profile list */}
        <div className="flex flex-col gap-3 md:grid md:grid-cols-2 md:gap-4">
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
                  setEditTarget(profile);
                }}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Switch confirmation toast */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {justSwitched ? `Switched to ${profiles.find((p) => p.id === justSwitched)?.name}` : ''}
        </div>
        <AnimatePresence>
          {justSwitched && (
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              className="fixed top-20 left-1/2 -translate-x-1/2 z-50 rounded-full px-4 py-2 flex items-center gap-2 shadow-glow"
              style={{
                background: 'linear-gradient(135deg, var(--goal-accent) 0%, var(--color-secondary) 100%)',
              }}
            >
              <Check size={14} color="var(--color-on-accent)" />
              <span className="text-[var(--color-on-accent)] text-sm font-semibold">
                {t('profiles.switchedTo', { name: profiles.find((p) => p.id === justSwitched)?.name })}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add Profile Section */}
        <div className="mt-4">
          <AnimatePresence mode="wait">
            {showForm ? (
              <AddProfileForm
                key="form"
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
                    className="rounded-2xl border border-dashed p-4 flex flex-col items-center gap-1.5 text-center"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-bg-secondary)' }}
                  >
                    <span className="text-2xl">🔒</span>
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
                    className="w-full rounded-2xl border border-dashed p-4 flex items-center justify-center gap-2.5 transition-colors duration-200 group hover:border-[var(--goal-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent)]"
                    style={{
                      borderColor: 'var(--color-border)',
                      background: 'var(--color-bg-secondary)',
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
                      style={{
                        background: 'linear-gradient(135deg, var(--goal-accent) 0%, var(--color-secondary) 100%)',
                      }}
                    >
                      <Plus size={18} color="var(--color-on-accent)" strokeWidth={2.5} />
                    </div>
                    <div className="text-left">
                      <p
                        className="font-semibold text-sm group-hover:text-[var(--goal-accent)] transition-colors"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {t('profiles.add')}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {MAX_PROFILES - profiles.length} slot{MAX_PROFILES - profiles.length !== 1 ? 's' : ''} remaining
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
          className="mt-5 rounded-2xl p-4 flex items-start gap-3"
          style={{ background: 'color-mix(in srgb, var(--color-secondary) 7%, transparent)', border: '1px solid color-mix(in srgb, var(--color-secondary) 20%, transparent)' }}
        >
          <span className="text-xl flex-shrink-0 mt-0.5">🔐</span>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--color-secondary)' }}>
              Data Isolation
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              Each profile&apos;s cycle data, symptoms, and history are stored completely separately. Switching profiles never mixes data.
            </p>
          </div>
        </motion.div>
      </div>

      {/* Delete confirmation dialog */}
      <AnimatePresence>
        {deleteTarget && (
          <DeleteDialog
            profileName={deleteTarget.name}
            error={deleteError}
            onConfirm={handleDeleteConfirm}
            onCancel={closeDeleteDialog}
            disabled={isPending}
          />
        )}
      </AnimatePresence>

      {/* Edit profile dialog */}
      <AnimatePresence>
        {editTarget && (
          <EditProfileForm
            key={editTarget.id}
            profile={editTarget}
            onClose={closeEditForm}
            serverError={editError}
            onSubmit={handleEditSubmit}
            disabled={isPending}
          />
        )}
      </AnimatePresence>
    </>
  );
}
