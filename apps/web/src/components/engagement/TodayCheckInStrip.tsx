'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { useHasMounted } from '@/components/motion/useHasMounted';
import { StreakBadge } from './StreakBadge';
import { ConsistencyGrid } from './ConsistencyGrid';
import { QuickSymptomModal } from '@/components/modals/QuickSymptomModal';
import { useRouter } from 'next/navigation';
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

interface TodayCheckInStripProps {
  engagement: EngagementSummary;
  goal: string | null;
  onOpenCheckIn: () => void;
  profileId: string;
  variant?: 'card' | 'hero';
  className?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TodayCheckInStrip({
  engagement,
  goal,
  onOpenCheckIn,
  profileId,
  variant = 'card',
  className,
}: TodayCheckInStripProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const mounted = useHasMounted();
  const reduceRaw = useReducedMotion() ?? false;
  const prm = mounted && reduceRaw;

  const [backfillDate, setBackfillDate] = useState<string | null>(null);

  function handleBackfill(date: string) {
    setBackfillDate(date);
  }

  const innerContent = (
    <>
      {/* ── Top row: streak + CTA ── */}
      <div className="flex items-center justify-between gap-3">
        <StreakBadge
          streak={engagement.streak}
          streakAtRisk={engagement.streakAtRisk}
          className="shrink-0"
        />

        {engagement.loggedToday ? (
          <div
            className="flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: 'var(--goal-accent, var(--color-primary))' }}
            aria-live="polite"
          >
            <CheckCircle2 size={14} aria-hidden="true" />
            {t('checkIn.doneTitle')}
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenCheckIn}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold text-[var(--color-on-accent)] transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--goal-accent,var(--color-primary))]"
            style={{ backgroundColor: 'var(--goal-accent, var(--color-primary))' }}
            aria-label={t('checkIn.cta')}
          >
            {t('checkIn.cta')}
          </button>
        )}
      </div>

      {/* ── Consistency grid ── */}
      <ConsistencyGrid
        last30={engagement.last30}
        onBackfill={handleBackfill}
        variant="inline"
        className="w-full"
      />
    </>
  );

  const inner = variant === 'card' ? (
    <Card padding="md" className="flex flex-col gap-3">
      {innerContent}
    </Card>
  ) : (
    <div className="flex flex-col gap-3">
      {innerContent}
    </div>
  );

  return (
    <>
      {prm ? (
        <div className={className}>{inner}</div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          className={className}
        >
          {inner}
        </motion.div>
      )}

      {/* ── Backfill modal ── */}
      <QuickSymptomModal
        open={backfillDate !== null}
        onClose={() => setBackfillDate(null)}
        profileId={profileId}
        goal={goal}
        initialDate={backfillDate ?? undefined}
        onSaved={() => {
          setBackfillDate(null);
          router.refresh();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('vesta:profile-updated'));
          }
        }}
      />
    </>
  );
}
