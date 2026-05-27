'use client';

import { useState, useCallback, useEffect, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import { format, differenceInDays, parseISO } from 'date-fns';
import Link from 'next/link';
import { X, CalendarDays, Activity, ChevronRight, Droplets } from 'lucide-react';

import { useAppStore } from '@/lib/store';
import {
  getCurrentCycleDay,
  getCurrentPhase,
  getDaysUntilNextPeriod,
  computePrediction,
  getPhaseColor,
  getPhaseEmoji,
} from '@/lib/cycle-utils';
import type { FlowIntensity } from '@/lib/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { tracking } from '@/lib/api';

// ─── Helpers ────────────────────────────────────────────────────────────────

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const FLOW_LABELS: Record<FlowIntensity, string> = {
  light: 'Light',
  medium: 'Medium',
  heavy: 'Heavy',
};

const FLOW_COLORS: Record<FlowIntensity, string> = {
  light: '#F2728E',
  medium: '#E8476C',
  heavy: '#C93558',
};

// ─── Circular Progress ───────────────────────────────────────────────────────

function CycleRing({
  cycleDay,
  cycleLength,
  phase,
  phaseColor,
}: {
  cycleDay: number;
  cycleLength: number;
  phase: string;
  phaseColor: string;
}) {
  const SIZE = 220;
  const STROKE = 16;
  const RADIUS = (SIZE - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const progress = cycleDay / cycleLength;
  const offset = CIRCUMFERENCE * (1 - progress);

  return (
    <div className="relative flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
      {/* Track ring */}
      <svg
        width={SIZE}
        height={SIZE}
        className="absolute rotate-[-90deg]"
        style={{ filter: 'drop-shadow(0 4px 24px rgba(232,71,108,0.12))' }}
      >
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={STROKE}
        />
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={phaseColor}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          initial={{ strokeDashoffset: CIRCUMFERENCE }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
          filter="url(#glow)"
        />
      </svg>

      {/* Center content */}
      <motion.div
        className="flex flex-col items-center gap-1"
        animate={{ scale: [1, 1.03, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="text-5xl font-bold"
          style={{ color: phaseColor }}
        >
          {cycleDay}
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-sm font-medium text-[var(--color-text-muted)] tracking-widest uppercase"
        >
          Day
        </motion.div>
      </motion.div>
    </div>
  );
}

// ─── Period Logging Modal ────────────────────────────────────────────────────

interface LogModalProps {
  profileId: string;
  existingLogId?: string;
  initialStart?: string;
  initialEnd?: string;
  initialFlow?: FlowIntensity;
  onClose: () => void;
}

function PeriodLogModal({
  profileId,
  existingLogId,
  initialStart = '',
  initialEnd = '',
  initialFlow = 'medium',
  onClose,
}: LogModalProps) {
  const { addPeriodLog, updatePeriodLog } = useAppStore();
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [flow, setFlow] = useState<FlowIntensity>(initialFlow);
  const [saved, setSaved] = useState(false);

  const isEdit = Boolean(existingLogId);

  const handleSave = () => {
    if (!startDate || !endDate) return;
    if (isEdit && existingLogId) {
      updatePeriodLog(existingLogId, { startDate, endDate, flowIntensity: flow });
    } else {
      addPeriodLog({ profileId, startDate, endDate, flowIntensity: flow });
    }
    setSaved(true);
    setTimeout(onClose, 700);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <motion.div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      <motion.div
        className="relative w-full max-w-md bg-[var(--color-bg-card)] rounded-t-3xl px-5 py-6 shadow-2xl"
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--color-border)]" />

        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
            {isEdit ? 'Edit Period Log' : 'Log Period'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <X size={18} className="text-[var(--color-text-muted)]" />
          </button>
        </div>

        {/* Start date */}
        <div className="mb-4">
          <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors"
          />
        </div>

        {/* End date */}
        <div className="mb-5">
          <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-1.5 uppercase tracking-wider">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            min={startDate}
            max={new Date().toISOString().split('T')[0]}
            className="w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-[var(--color-primary)] transition-colors"
          />
        </div>

        {/* Flow intensity */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-[var(--color-text-secondary)] mb-2.5 uppercase tracking-wider">
            Flow Intensity
          </label>
          <div className="flex gap-2">
            {(['light', 'medium', 'heavy'] as FlowIntensity[]).map((f) => (
              <button
                key={f}
                onClick={() => setFlow(f)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                  flow === f
                    ? 'text-white shadow-soft'
                    : 'border-[var(--color-border)] text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)]'
                }`}
                style={
                  flow === f
                    ? { backgroundColor: FLOW_COLORS[f], borderColor: FLOW_COLORS[f] }
                    : {}
                }
              >
                <span className="mr-1">
                  {f === 'light' ? '💧' : f === 'medium' ? '🩸' : '🌊'}
                </span>
                {FLOW_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        {/* Save */}
        <AnimatePresence mode="wait">
          {saved ? (
            <motion.div
              key="saved"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full py-3 rounded-xl bg-green-100 text-green-700 text-center font-semibold"
            >
              Saved!
            </motion.div>
          ) : (
            <motion.div key="save-btn">
              <Button
                variant="primary"
                fullWidth
                size="lg"
                onClick={handleSave}
                disabled={!startDate || !endDate}
              >
                {isEdit ? 'Update Log' : 'Save Period'}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ─── Dashboard Page ──────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { t } = useTranslation();
  const { profiles, activeProfileId, periodLogs } = useAppStore();

  const [showModal, setShowModal] = useState(false);
  const [editLogId, setEditLogId] = useState<string | undefined>(undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [apiDashboard, setApiDashboard] = useState<any>(null);

  useEffect(() => {
    if (!activeProfileId) return;
    tracking.getDashboard(activeProfileId)
      .then(setApiDashboard)
      .catch(() => {}); // Silently fail — use store data as fallback
  }, [activeProfileId]);

  const profile = profiles.find((p) => p.id === activeProfileId);

  const openNewLog = useCallback(() => {
    setEditLogId(undefined);
    setShowModal(true);
  }, []);

  const openEditLog = useCallback((id: string) => {
    setEditLogId(id);
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => setShowModal(false), []);

  // Guard: no active profile
  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-[var(--color-text-muted)]">No profile found.</p>
        <Link href="/profiles">
          <Button variant="primary">Set Up Profile</Button>
        </Link>
      </div>
    );
  }

  const cycleDay = apiDashboard?.currentCycleDay ?? getCurrentCycleDay(profile.lastPeriodStart, profile.cycleLength);
  const phase = apiDashboard?.currentPhase ?? getCurrentPhase(cycleDay, profile.periodLength, profile.cycleLength);
  const phaseColor = getPhaseColor(phase);
  const phaseEmoji = getPhaseEmoji(phase);
  const daysUntilNext = apiDashboard?.countdownToNextPeriod ?? getDaysUntilNextPeriod(cycleDay, profile.cycleLength);
  const prediction = computePrediction(profile);

  // Most recent period log for this profile
  const profileLogs = periodLogs
    .filter((l) => l.profileId === activeProfileId)
    .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  const lastLog = profileLogs[0];

  // Find the edit log data if editing
  const editLog = editLogId ? periodLogs.find((l) => l.id === editLogId) : undefined;

  // Confidence tier label
  const tierLabel = prediction.tier === 'arima' ? 'Tier 2 · ARIMA' : 'Tier 1 · Average';

  const phaseLabel = t(`dashboard.${phase}`);

  return (
    <>
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <motion.div
          className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-[0.07]"
          style={{ background: 'radial-gradient(circle, var(--color-primary) 0%, transparent 70%)' }}
          animate={{ x: [0, 15, 0], y: [0, -10, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle, var(--color-secondary) 0%, transparent 70%)' }}
          animate={{ x: [0, -10, 0], y: [0, 12, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
      <div className="flex flex-col gap-5 py-3">

        {/* ── Hero Section ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center md:flex-row md:items-center md:gap-8 pt-4 pb-2"
        >
          <CycleRing
            cycleDay={cycleDay}
            cycleLength={profile.cycleLength}
            phase={phase}
            phaseColor={phaseColor}
          />

          {/* Phase label */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.4 }}
            className="mt-4 flex flex-col items-center gap-1"
          >
            <div
              className="flex items-center gap-2 px-4 py-1.5 rounded-full text-white text-sm font-semibold shadow-soft"
              style={{ backgroundColor: phaseColor }}
            >
              <span>{phaseEmoji}</span>
              <span>{phaseLabel} Phase</span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">
              Day {cycleDay} of {profile.cycleLength}
            </p>
          </motion.div>
        </motion.div>

        {/* ── Cards Grid ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">

          {/* Countdown Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 100, damping: 20 }}
          >
            <Card padding="md" className="h-full">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <CalendarDays size={14} className="text-[var(--color-primary)]" />
                  <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    Next Period
                  </span>
                </div>
                <div
                  className="text-4xl font-extrabold leading-none"
                  style={{ color: 'var(--color-primary)' }}
                >
                  {daysUntilNext}
                </div>
                <p className="text-xs text-[var(--color-text-muted)]">days away</p>

                {/* Mini bar */}
                <div className="h-1.5 rounded-full bg-[var(--color-border)] mt-1 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${((profile.cycleLength - daysUntilNext) / profile.cycleLength) * 100}%` }}
                    transition={{ delay: 0.6, duration: 0.8, ease: 'easeOut' }}
                  />
                </div>

                <p className="text-[10px] text-[var(--color-text-muted)]">
                  {format(parseISO(prediction.nextPeriodStart), 'MMM d')}
                </p>
              </div>
            </Card>
          </motion.div>

          {/* Last Period Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, type: "spring", stiffness: 100, damping: 20 }}
          >
            <Card padding="md" className="h-full">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <Droplets size={14} className="text-[var(--color-primary)]" />
                  <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    Last Period
                  </span>
                </div>
                {lastLog ? (
                  <>
                    <p className="text-sm font-bold text-[var(--color-text-primary)]">
                      {format(parseISO(lastLog.startDate), 'MMM d')}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {differenceInDays(parseISO(lastLog.endDate), parseISO(lastLog.startDate)) + 1}d duration
                    </p>
                    <div
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white self-start"
                      style={{ backgroundColor: FLOW_COLORS[lastLog.flowIntensity] }}
                    >
                      🩸 {capitalize(lastLog.flowIntensity)}
                    </div>
                    <button
                      onClick={() => openEditLog(lastLog.id)}
                      className="text-[10px] text-[var(--color-primary)] font-semibold hover:underline self-start mt-auto"
                    >
                      Edit log
                    </button>
                  </>
                ) : (
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    No logs yet
                  </p>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Confidence Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.26, type: "spring", stiffness: 100, damping: 20 }}
          >
            <Card padding="md" className="h-full">
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Confidence
                </span>
                <div className="flex items-end gap-1">
                  <span
                    className="text-4xl font-extrabold"
                    style={{ color: 'var(--color-secondary)' }}
                  >
                    {prediction.confidence}
                  </span>
                  <span className="text-lg font-bold text-[var(--color-text-muted)] mb-0.5">%</span>
                </div>

                {/* Confidence arc */}
                <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: 'var(--color-secondary)' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${prediction.confidence}%` }}
                    transition={{ delay: 0.8, duration: 0.8, ease: 'easeOut' }}
                  />
                </div>

                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] self-start">
                  <span className="text-[10px] font-semibold text-[var(--color-secondary)]">
                    {tierLabel}
                  </span>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Quick Actions Card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34, type: "spring", stiffness: 100, damping: 20 }}
          >
            <Card padding="md" className="h-full">
              <div className="flex flex-col gap-2.5 h-full">
                <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                  Quick Actions
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  onClick={openNewLog}
                  className="text-xs"
                >
                  🩸 Log Period
                </Button>
                <Link href="/symptoms" className="block">
                  <button className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] hover:border-[var(--color-secondary)] transition-colors">
                    <div className="flex items-center gap-1.5">
                      <Activity size={12} className="text-[var(--color-secondary)]" />
                      <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                        Log Symptoms
                      </span>
                    </div>
                    <ChevronRight size={12} className="text-[var(--color-text-muted)]" />
                  </button>
                </Link>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* ── Cycle Phase Overview + Predicted Windows ────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.45 }}
          >
            <Card padding="md" className="h-full">
              <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-3">
                Cycle Overview
              </h3>
              <div className="flex gap-1.5">
                {(
                  [
                    { ph: 'menstrual', label: 'Menstrual', days: profile.periodLength },
                    { ph: 'follicular', label: 'Follicular', days: profile.cycleLength - 14 - profile.periodLength - 5 },
                    { ph: 'ovulation', label: 'Ovulation', days: 6 },
                    { ph: 'luteal', label: 'Luteal', days: 14 },
                  ] as const
                ).map(({ ph, label, days }) => {
                  const isActive = ph === phase;
                  const color = getPhaseColor(ph as any);
                  return (
                    <div
                      key={ph}
                      className={`flex-1 rounded-lg px-1 py-2 md:py-3 flex flex-col items-center gap-1 transition-all ${
                        isActive ? 'ring-2' : ''
                      }`}
                      style={{
                        backgroundColor: `${color}20`,
                        outline: isActive ? `2px solid ${color}` : 'none',
                      }}
                    >
                      <span className="text-base md:text-lg">{getPhaseEmoji(ph as any)}</span>
                      <span
                        className="text-[9px] md:text-[11px] font-bold text-center leading-tight"
                        style={{ color }}
                      >
                        {label}
                      </span>
                      <span className="text-[9px] md:text-[10px] text-[var(--color-text-muted)]">{days}d</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.52, duration: 0.45 }}
          >
            <Card padding="md" className="h-full">
              <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-3">
                Predicted Windows
              </h3>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-[var(--color-bg-secondary)]">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-fertile)' }} />
                    <span className="text-xs font-medium text-[var(--color-text-secondary)]">Fertile Window</span>
                  </div>
                  <span className="text-xs font-bold text-[var(--color-text-primary)]">
                    {format(parseISO(prediction.fertileStart), 'MMM d')}
                    {' – '}
                    {format(parseISO(prediction.fertileEnd), 'MMM d')}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-[var(--color-bg-secondary)]">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-ovulation)' }} />
                    <span className="text-xs font-medium text-[var(--color-text-secondary)]">Ovulation Day</span>
                  </div>
                  <span className="text-xs font-bold text-[var(--color-text-primary)]">
                    {format(parseISO(prediction.ovulationDay), 'MMM d')}
                  </span>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      </div>

      {/* ── Period Log Modal ─────────────────────────────────── */}
      <AnimatePresence>
        {showModal && (
          <PeriodLogModal
            key="log-modal"
            profileId={activeProfileId}
            existingLogId={editLog?.id}
            initialStart={editLog?.startDate ?? ''}
            initialEnd={editLog?.endDate ?? ''}
            initialFlow={editLog?.flowIntensity ?? 'medium'}
            onClose={closeModal}
          />
        )}
      </AnimatePresence>
    </>
  );
}
