'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Check, Trash2, Plus, Minus, UserPlus, X, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import type { ProfileRelation } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import '@/lib/i18n';

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_PROFILES = 6;

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
  self: { bg: 'rgba(232,71,108,0.1)', text: '#C93558', border: 'rgba(232,71,108,0.3)' },
  wife: { bg: 'rgba(155,127,212,0.1)', text: '#7A5CB8', border: 'rgba(155,127,212,0.3)' },
  sister: { bg: 'rgba(123,197,174,0.1)', text: '#2D8C72', border: 'rgba(123,197,174,0.3)' },
  mother: { bg: 'rgba(255,140,107,0.1)', text: '#C4592A', border: 'rgba(255,140,107,0.3)' },
  daughter: { bg: 'rgba(255,193,7,0.1)', text: '#9A7209', border: 'rgba(255,193,7,0.3)' },
  girlfriend: { bg: 'rgba(232,71,108,0.08)', text: '#9B2D4A', border: 'rgba(232,71,108,0.25)' },
};

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
          className="w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
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
          className="w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
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
  profile: {
    id: string;
    name: string;
    relation: ProfileRelation;
    cycleLength: number;
    periodLength: number;
  };
  isActive: boolean;
  onSwitch: () => void;
  onDelete: () => void;
}

function ProfileCard({ profile, isActive, onSwitch, onDelete }: ProfileCardProps) {
  const { t } = useTranslation();
  const colors = RELATION_COLORS[profile.relation];

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
        className="w-full text-left rounded-2xl border transition-all duration-200 p-4 relative overflow-hidden"
        style={{
          background: isActive
            ? 'linear-gradient(135deg, rgba(232,71,108,0.07) 0%, rgba(155,127,212,0.07) 100%)'
            : 'var(--color-bg-card)',
          borderColor: isActive ? 'var(--color-primary)' : 'var(--color-border)',
          boxShadow: isActive
            ? '0 0 0 2px rgba(232,71,108,0.2), 0 4px 16px rgba(232,71,108,0.08)'
            : '0 2px 8px rgba(0,0,0,0.03)',
        }}
        aria-label={`${t('profiles.switchTo')} ${profile.name}`}
      >
        {/* Active glow line */}
        {isActive && (
          <motion.div
            layoutId="active-line"
            className="absolute left-0 top-0 bottom-0 w-1 rounded-l-2xl"
            style={{ background: 'linear-gradient(180deg, var(--color-primary) 0%, var(--color-secondary) 100%)' }}
          />
        )}

        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: colors.bg, border: `1.5px solid ${colors.border}` }}
          >
            {RELATION_ICONS[profile.relation]}
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
                    background: 'var(--color-primary)',
                    color: '#fff',
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
                {t(`profiles.${profile.relation}`)}
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
                style={{ background: 'var(--color-primary)' }}
              >
                <Check size={14} color="#fff" strokeWidth={2.5} />
              </div>
            ) : (
              <ChevronRight size={16} className="text-[var(--color-text-muted)]" />
            )}

            {/* Delete — only for non-active profiles */}
            {!isActive && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150 hover:scale-110"
                style={{
                  background: 'rgba(232,71,108,0.08)',
                  border: '1px solid rgba(232,71,108,0.2)',
                }}
                aria-label={`${t('common.delete')} ${profile.name}`}
              >
                <Trash2 size={13} color="#E8476C" />
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
  onSubmit: (data: {
    name: string;
    relation: ProfileRelation;
    cycleLength: number;
    periodLength: number;
    lastPeriodStart: string;
    cycleHistory: number[];
    predictionTier: 'average';
  }) => void;
}

function AddProfileForm({ onClose, onSubmit }: AddProfileFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [relation, setRelation] = useState<ProfileRelation>('sister');
  const [cycleLength, setCycleLength] = useState(28);
  const [periodLength, setPeriodLength] = useState(5);
  const [nameError, setNameError] = useState('');

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Name is required');
      return;
    }
    if (trimmed.length < 2) {
      setNameError('Name must be at least 2 characters');
      return;
    }
    onSubmit({
      name: trimmed,
      relation,
      cycleLength,
      periodLength,
      lastPeriodStart: new Date().toISOString().slice(0, 10),
      cycleHistory: [],
      predictionTier: 'average',
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
        borderColor: 'var(--color-primary)',
        boxShadow: '0 0 0 2px rgba(232,71,108,0.15), 0 8px 32px rgba(232,71,108,0.1)',
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
            style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)' }}
          >
            <UserPlus size={15} color="#fff" />
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
          label="Name"
          placeholder="e.g. Nusrat"
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
                  className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border text-center transition-all duration-150"
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
            label="Cycle length"
            value={cycleLength}
            min={21}
            max={45}
            onChange={setCycleLength}
          />
          <div style={{ height: '1px', background: 'var(--color-border)' }} />
          <Stepper
            label="Period length"
            value={periodLength}
            min={1}
            max={10}
            onChange={setPeriodLength}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={handleSubmit} className="flex-1">
            Create Profile
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────

interface DeleteDialogProps {
  profileName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteDialog({ profileName, onConfirm, onCancel }: DeleteDialogProps) {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-8"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        className="w-full max-w-md rounded-2xl p-5"
        style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(232,71,108,0.1)' }}>
            <Trash2 size={18} color="#E8476C" />
          </div>
          <div>
            <h3 className="font-bold text-[var(--color-text-primary)]">Remove Profile</h3>
            <p className="text-sm text-[var(--color-text-muted)]">
              Remove <strong>{profileName}</strong>?
            </p>
          </div>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          All symptom logs and data for this profile will be permanently deleted.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} className="flex-1">
            {t('common.cancel')}
          </Button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-xl text-sm font-bold text-white transition-all active:scale-95"
            style={{ background: 'var(--color-primary)' }}
          >
            {t('common.delete')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProfilesPage() {
  const { t, i18n } = useTranslation();
  const {
    profiles,
    activeProfileId,
    setActiveProfile,
    addProfile,
    deleteProfile,
    language,
  } = useAppStore();

  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [justSwitched, setJustSwitched] = useState<string | null>(null);

  // Keep i18n in sync with store language
  useEffect(() => {
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  const atMax = profiles.length >= MAX_PROFILES;

  function handleSwitchProfile(id: string) {
    if (id === activeProfileId) return;
    setActiveProfile(id);
    setJustSwitched(id);
    setTimeout(() => setJustSwitched(null), 1500);
  }

  function handleAddProfile(data: Parameters<typeof addProfile>[0]) {
    addProfile(data);
    setShowForm(false);
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return;
    deleteProfile(deleteTarget.id);
    setDeleteTarget(null);
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
            {profiles.length} / {MAX_PROFILES} profiles
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
                onSwitch={() => handleSwitchProfile(profile.id)}
                onDelete={() => setDeleteTarget({ id: profile.id, name: profile.name })}
              />
            ))}
          </AnimatePresence>
        </div>

        {/* Switch confirmation toast */}
        <AnimatePresence>
          {justSwitched && (
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ type: 'spring', stiffness: 400, damping: 35 }}
              className="fixed top-20 left-1/2 -translate-x-1/2 z-50 rounded-full px-4 py-2 flex items-center gap-2 shadow-glow"
              style={{
                background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
              }}
            >
              <Check size={14} color="#fff" />
              <span className="text-white text-sm font-semibold">
                Switched to {profiles.find((p) => p.id === justSwitched)?.name}
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
                onClose={() => setShowForm(false)}
                onSubmit={handleAddProfile}
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
                      Delete a profile to add a new one
                    </p>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowForm(true)}
                    className="w-full rounded-2xl border border-dashed p-4 flex items-center justify-center gap-2.5 transition-all duration-200 group hover:border-[var(--color-primary)]"
                    style={{
                      borderColor: 'var(--color-border)',
                      background: 'var(--color-bg-secondary)',
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:scale-105"
                      style={{
                        background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)',
                      }}
                    >
                      <Plus size={18} color="#fff" strokeWidth={2.5} />
                    </div>
                    <div className="text-left">
                      <p
                        className="font-semibold text-sm group-hover:text-[var(--color-primary)] transition-colors"
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
          style={{ background: 'rgba(155,127,212,0.07)', border: '1px solid rgba(155,127,212,0.2)' }}
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
            onConfirm={handleDeleteConfirm}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
