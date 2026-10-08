'use client';

import { useState, useCallback, useId } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Plus } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { useHasMounted } from '@/components/motion/useHasMounted';
import { useAppStore } from '@/lib/store';
import { SYMPTOMS_DATA } from '@/lib/symptoms-data';
import {
  SymptomChip,
  toDbCategory,
} from '@/app/(main)/symptoms/SymptomsClient';
import { saveSymptoms, markAllGoodToday } from '@/app/actions/tracking-actions';
import { QuickSymptomModal } from '@/components/modals/QuickSymptomModal';
import { CelebrationModal } from '@/components/modals/CelebrationModal';
import '@vesta/shared/utils/i18n';

// ── Types ─────────────────────────────────────────────────────────────────────

interface EngagementSummary {
  loggedToday: boolean;
  lastLoggedDate: string | null;
  streak: number;
  streakAtRisk: boolean;
  last30: { date: string; logged: boolean }[];
  cyclesLogged: number;
  unlockTarget: number;
  tier: string | null;
  confidence: number;
  periodLogCount: number;
}

interface TodayCheckInModalProps {
  open: boolean;
  onClose: () => void;
  profileId: string;
  goal: string | null;
  engagement: EngagementSummary;
  cycleDay?: number | null;
  phase?: string | null;
}

// ── Quick chip IDs ────────────────────────────────────────────────────────────

const QUICK_CHIP_IDS = [
  'cramps',
  'headache',
  'fatigue',
  'bloating',
  'mood-swings',
  'acne',
  'breast-tenderness',
  'nausea',
];

// ── Greeting helper ───────────────────────────────────────────────────────────

function getGreetingKey(): 'checkIn.greetingMorning' | 'checkIn.greetingAfternoon' | 'checkIn.greetingEvening' {
  const h = new Date().getHours();
  if (h < 12) return 'checkIn.greetingMorning';
  if (h < 17) return 'checkIn.greetingAfternoon';
  return 'checkIn.greetingEvening';
}

function isMilestone(streak: number): boolean {
  return [3, 7, 14, 30, 60, 100].includes(streak);
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TodayCheckInModal({
  open,
  onClose,
  profileId,
  goal,
  engagement,
  cycleDay,
  phase,
}: TodayCheckInModalProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { language } = useAppStore();
  const titleId = useId();

  const mounted = useHasMounted();
  const reduceRaw = useReducedMotion() ?? false;
  const prm = mounted && reduceRaw;

  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  const [backfillDate, setBackfillDate] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{ kind: 'streak' | 'milestone' | 'symptom'; count?: number } | null>(null);
  const [celebrationOpen, setCelebrationOpen] = useState(false);

  const quickSymptoms = SYMPTOMS_DATA.filter((s) => QUICK_CHIP_IDS.includes(s.id));

  function getSymptomName(s: (typeof SYMPTOMS_DATA)[0]) {
    return language === 'bn' ? s.nameBn : s.nameEn;
  }

  const handleToggle = useCallback((id: string) => {
    setLocalSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  function fireCelebration(kind: 'streak' | 'milestone', count: number) {
    setCelebration({ kind, count });
    setCelebrationOpen(true);
  }

  async function handleSave() {
    if (localSelected.size === 0 || saving) return;
    setSaving(true);
    try {
      const addedPayload = [...localSelected].flatMap((id) => {
        const symptom = SYMPTOMS_DATA.find((s) => s.id === id);
        return symptom
          ? [{ symptomId: id, category: toDbCategory(symptom.category), value: id }]
          : [];
      });
      if (addedPayload.length) {
        await saveSymptoms({
          profileId,
          date: new Date().toISOString().slice(0, 10),
          added: addedPayload,
          removed: [],
        });
      }
      router.refresh();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vesta:profile-updated'));
      }
      const newStreak = engagement.streak + 1;
      if (isMilestone(newStreak)) {
        fireCelebration('milestone', newStreak);
      } else {
        fireCelebration('streak', newStreak);
      }
      setLocalSelected(new Set());
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleAllGood() {
    if (saving) return;
    setSaving(true);
    try {
      await markAllGoodToday(profileId);
      router.refresh();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vesta:profile-updated'));
      }
      const newStreak = engagement.streak + 1;
      if (isMilestone(newStreak)) {
        fireCelebration('milestone', newStreak);
      } else {
        fireCelebration('streak', newStreak);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  }

  // Vignette backdrop: darker at edges, slightly transparent center — focuses on panel
  const vignetteStyle: React.CSSProperties = {
    background: 'radial-gradient(ellipse at center, color-mix(in srgb, var(--color-brand-navy) 40%, transparent) 0%, color-mix(in srgb, var(--color-brand-navy) 82%, transparent) 100%)',
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        titleId={titleId}
        accentVar="var(--goal-accent, var(--color-primary))"
        closeOnBackdrop={true}
        hideClose={false}
        backdropClassName="backdrop-blur-sm"
        backdropStyle={vignetteStyle}
        panelClassName="max-w-sm"
      >
        <div className="px-5 pt-4 pb-6 flex flex-col gap-4">
          {/* ── Header ── */}
          <div className="flex flex-col gap-0.5 pr-8">
            <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
              {t(getGreetingKey())}
            </p>
            <h2
              id={titleId}
              className="text-base font-bold text-[var(--color-text-primary)] leading-snug"
            >
              {t('checkIn.title')}
            </h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              {t('checkIn.subtitle')}
            </p>
            {cycleDay && phase && (
              <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                {t('dashboard.day')} {cycleDay} · {phase}
              </p>
            )}
          </div>

          {/* ── Quick chips ── */}
          <div
            className="grid grid-cols-4 gap-2"
            role="group"
            aria-label={t('checkIn.title')}
          >
            {quickSymptoms.map((symptom, i) =>
              prm ? (
                <SymptomChip
                  key={symptom.id}
                  id={symptom.id}
                  icon={symptom.icon}
                  name={getSymptomName(symptom)}
                  selected={localSelected.has(symptom.id)}
                  category={symptom.category}
                  onToggle={handleToggle}
                />
              ) : (
                <motion.div
                  key={symptom.id}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    delay: 0.08 + i * 0.04,
                    type: 'spring',
                    stiffness: 320,
                    damping: 24,
                  }}
                  className="h-full"
                >
                  <SymptomChip
                    id={symptom.id}
                    icon={symptom.icon}
                    name={getSymptomName(symptom)}
                    selected={localSelected.has(symptom.id)}
                    category={symptom.category}
                    onToggle={handleToggle}
                  />
                </motion.div>
              )
            )}
          </div>

          {/* ── CTA row: More + All Good ── */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowQuick(true)}
              aria-label={t('checkIn.more')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-xs font-semibold text-[var(--color-text-secondary)] transition-colors hover:border-[var(--goal-accent,var(--color-primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--goal-accent,var(--color-primary))]/40"
            >
              <Plus size={12} aria-hidden="true" />
              {t('checkIn.more')}
            </button>

            <motion.button
              type="button"
              onClick={handleAllGood}
              disabled={saving}
              whileTap={prm ? undefined : { scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              aria-label={t('checkIn.allGood')}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-[var(--color-on-accent)] transition-opacity disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                background: 'linear-gradient(135deg, var(--goal-accent, var(--color-primary)) 0%, color-mix(in srgb, var(--goal-accent, var(--color-primary)) 70%, var(--color-secondary)) 100%)',
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ['--tw-ring-color' as any]: 'color-mix(in srgb, var(--goal-accent, var(--color-primary)) 50%, transparent)',
              }}
            >
              {saving ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="animate-spin">
                  <circle cx="7" cy="7" r="5" stroke="var(--color-on-accent)" strokeWidth="2" strokeDasharray="24" strokeDashoffset="8" strokeLinecap="round" />
                </svg>
              ) : (
                <CheckCircle2 size={14} aria-hidden="true" />
              )}
              {t('checkIn.allGood')}
            </motion.button>
          </div>

          {/* ── Save bar (appears when chips selected) ── */}
          <AnimatePresence>
            {localSelected.size > 0 && (
              <motion.div
                key="save-bar"
                initial={prm ? undefined : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prm ? undefined : { opacity: 0, y: 8 }}
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                aria-live="polite"
              >
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full py-3 rounded-xl font-bold text-sm text-[var(--color-on-accent)] transition-opacity disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{
                    background: 'linear-gradient(135deg, var(--goal-accent, var(--color-primary)) 0%, color-mix(in srgb, var(--goal-accent, var(--color-primary)) 65%, var(--color-secondary)) 100%)',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ['--tw-ring-color' as any]: 'color-mix(in srgb, var(--goal-accent, var(--color-primary)) 50%, transparent)',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    ['--tw-ring-offset-color' as any]: 'var(--color-bg-card)',
                  }}
                >
                  {saving
                    ? t('checkIn.save')
                    : `${t('checkIn.save')} (${localSelected.size})`}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Modal>

      {/* ── Full symptom modal (More / backfill) ── */}
      <QuickSymptomModal
        open={showQuick || backfillDate !== null}
        onClose={() => {
          setShowQuick(false);
          setBackfillDate(null);
        }}
        profileId={profileId}
        goal={goal}
        initialDate={backfillDate ?? undefined}
        onSaved={(count) => {
          setShowQuick(false);
          setBackfillDate(null);
          router.refresh();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('vesta:profile-updated'));
          }
          setCelebration({ kind: 'symptom', count });
          setCelebrationOpen(true);
          onClose();
        }}
      />

      {/* ── Celebration modal — stays mounted briefly after popup closes ── */}
      <CelebrationModal
        open={celebrationOpen}
        onClose={() => {
          setCelebrationOpen(false);
          setCelebration(null);
        }}
        goal={goal}
        kind={celebration?.kind ?? 'streak'}
        count={celebration?.count}
      />
    </>
  );
}
