'use client';

import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
  isWithinInterval,
} from 'date-fns';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

import { useAppStore } from '@/lib/store';
import { computePrediction } from '@vesta/shared/utils/cycle-utils';
import type { PeriodLog, SymptomLog } from '@vesta/shared/types';
import { Card } from '@/components/ui/Card';
import { tracking } from '@/lib/api';
import { useDummyData } from '@vesta/shared/utils/config';
import { Button } from '@/components/ui/Button';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DayMeta {
  date: Date;
  isPeriod: boolean;
  isFertile: boolean;
  isOvulation: boolean;
  isFuturePredicted: boolean;
  periodLog?: PeriodLog;
}

// ─── Legend ──────────────────────────────────────────────────────────────────

function Legend() {
  const { t } = useTranslation();
  const items = [
    { color: 'var(--color-menstrual)', label: t('calendar.period'), dotted: false },
    { color: 'var(--color-fertile)', label: t('calendar.fertile'), dotted: false },
    { color: 'var(--color-ovulation)', label: t('calendar.ovulationDay'), dotted: false },
    { color: 'var(--color-text-primary)', label: t('calendar.today'), ring: true },
  ];

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center">
      {items.map(({ color, label, ring }) => (
        <div key={label} className="flex items-center gap-1.5">
          {ring ? (
            <div
              className="w-4 h-4 rounded-full border-2"
              style={{ borderColor: 'var(--color-text-primary)' }}
            />
          ) : (
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: color }} />
          )}
          <span className="text-[11px] font-medium text-[var(--color-text-secondary)]">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Day Cell ─────────────────────────────────────────────────────────────────

interface DayCellProps {
  meta: DayMeta;
  isCurrentMonth: boolean;
  isSelected: boolean;
  onClick: () => void;
}

function DayCell({ meta, isCurrentMonth, isSelected, onClick }: DayCellProps) {
  const { date, isPeriod, isFertile, isOvulation, isFuturePredicted } = meta;
  const today = new Date();
  const isToday = isSameDay(date, today);

  // Background colour logic — period takes priority, then fertile/ov
  let bgColor = 'transparent';
  let textColor = isCurrentMonth ? 'var(--color-text-primary)' : 'var(--color-text-muted)';
  let opacity = isFuturePredicted ? 0.5 : 1;

  if (isPeriod && isCurrentMonth) {
    bgColor = isFuturePredicted ? '#F2728E40' : '#E8476C22';
    textColor = 'var(--color-menstrual)';
  } else if (isOvulation && isCurrentMonth) {
    bgColor = '#FF8C6B22';
    textColor = 'var(--color-ovulation)';
  } else if (isFertile && isCurrentMonth) {
    bgColor = '#7BC5AE22';
    textColor = 'var(--color-fertile)';
  }

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center aspect-square w-full rounded-xl transition-all duration-150 active:scale-95${(isPeriod || isFertile || isOvulation) && isCurrentMonth ? ' hover:scale-105' : ''}`}
      style={{
        backgroundColor: isSelected
          ? isPeriod
            ? '#E8476C33'
            : isFertile
            ? '#7BC5AE33'
            : isOvulation
            ? '#FF8C6B33'
            : 'var(--color-bg-secondary)'
          : bgColor,
        opacity,
      }}
    >
      {/* Today ring */}
      {isToday && (
        <motion.div
          className="absolute inset-0.5 rounded-[10px] border-2 pointer-events-none"
          style={{ borderColor: 'var(--color-text-primary)' }}
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}

      {/* Ovulation accent dot */}
      {isOvulation && isCurrentMonth && (
        <div
          className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: 'var(--color-ovulation)' }}
        />
      )}

      {/* Date number */}
      <span
        className="text-sm md:text-base font-semibold leading-none"
        style={{ color: isCurrentMonth ? textColor : 'var(--color-text-muted)', fontWeight: isToday ? 800 : 600 }}
      >
        {format(date, 'd')}
      </span>

      {/* Period log dot indicator */}
      {meta.periodLog && (
        <div
          className="absolute bottom-1 w-1 h-1 rounded-full"
          style={{ backgroundColor: 'var(--color-menstrual)' }}
        />
      )}

      {/* Future dashed border */}
      {isFuturePredicted && isCurrentMonth && (isPeriod || isFertile || isOvulation) && (
        <div
          className="absolute inset-0.5 rounded-[10px] border border-dashed pointer-events-none"
          style={{
            borderColor: isPeriod
              ? 'var(--color-menstrual)'
              : isOvulation
              ? 'var(--color-ovulation)'
              : 'var(--color-fertile)',
          }}
        />
      )}

      {/* Selected ring */}
      {isSelected && (
        <div
          className="absolute inset-0 rounded-xl border-2 pointer-events-none"
          style={{ borderColor: 'var(--color-primary)' }}
        />
      )}
    </button>
  );
}

// ─── Day Detail Sheet ─────────────────────────────────────────────────────────

interface DayDetailProps {
  date: Date;
  meta: DayMeta;
  symptomLogs: SymptomLog[];
  onClose: () => void;
}

function DayDetail({ date, meta, symptomLogs, onClose }: DayDetailProps) {
  const dateStr = format(date, 'yyyy-MM-dd');
  const daySymptoms = symptomLogs.filter((s) => s.date === dateStr);

  const today = new Date();
  const isFuture = date > today;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.25 }}
    >
      <Card padding="md">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
            {format(date, 'EEEE, MMMM d')}
            {isFuture && (
              <span className="ml-2 text-[10px] font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)] px-2 py-0.5 rounded-full">
                Predicted
              </span>
            )}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[var(--color-bg-secondary)] transition-colors"
          >
            <X size={14} className="text-[var(--color-text-muted)]" />
          </button>
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap gap-2 mb-3">
          {meta.isPeriod && (
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--color-menstrual)' }}
            >
              🩸 Period day
            </div>
          )}
          {meta.isOvulation && (
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--color-ovulation)' }}
            >
              🌸 Ovulation
            </div>
          )}
          {meta.isFertile && !meta.isOvulation && (
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--color-fertile)' }}
            >
              🌱 Fertile window
            </div>
          )}
          {!meta.isPeriod && !meta.isFertile && !meta.isOvulation && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-bg-secondary)]">
              Regular day
            </div>
          )}
        </div>

        {/* Period log details */}
        {meta.periodLog && (
          <div className="mb-3 p-2.5 rounded-xl bg-[var(--color-bg-secondary)]">
            <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-1">Period Log</p>
            <div className="flex gap-3 text-xs text-[var(--color-text-muted)]">
              <span>
                {format(parseISO(meta.periodLog.startDate), 'MMM d')}
                {' – '}
                {format(parseISO(meta.periodLog.endDate), 'MMM d')}
              </span>
              <span className="capitalize">• {meta.periodLog.flowIntensity} flow</span>
            </div>
          </div>
        )}

        {/* Symptoms */}
        {daySymptoms.length > 0 ? (
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">Symptoms</p>
            <div className="flex flex-wrap gap-1.5">
              {daySymptoms.map((s) => (
                <span
                  key={s.id}
                  className="px-2 py-0.5 rounded-full text-xs bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]"
                >
                  {s.symptomId}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-[var(--color-text-muted)]">No symptoms logged.</p>
        )}
      </Card>
    </motion.div>
  );
}

// ─── Calendar Page ────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const { t } = useTranslation();
  const { profiles, activeProfileId, periodLogs, symptomLogs } = useAppStore();

  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [apiCalendar, setApiCalendar] = useState<any[] | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeProfileId || useDummyData) {
      setApiCalendar(null);
      setCalendarError(null);
      return;
    }
    const month = format(currentMonth, 'yyyy-MM');
    setCalendarError(null);
    tracking.getCalendar(activeProfileId, month)
      .then(setApiCalendar)
      .catch((err: Error) => {
        setApiCalendar(null);
        setCalendarError(err.message ?? 'Failed to load calendar');
      });
  }, [activeProfileId, currentMonth]);

  const profile = profiles.find((p) => p.id === activeProfileId);

  if (calendarError && !useDummyData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4 px-4 text-center">
        <p className="text-[var(--color-text-muted)]">{calendarError}</p>
        <Button variant="primary" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  // Compute prediction & build date metadata
  const prediction = useMemo(() => {
    if (!profile) return null;
    return computePrediction(profile);
  }, [profile]);

  // Build a set of all days in the calendar grid for the current month
  const gridDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [currentMonth]);

  // Build an apiCalendar lookup map for fast access
  const apiCalendarMap = useMemo(() => {
    if (!apiCalendar) return null;
    const map = new Map<string, { date: string; period: boolean; fertile: boolean; ovulation: boolean; predicted: boolean }>();
    for (const entry of apiCalendar) {
      map.set(entry.date, entry);
    }
    return map;
  }, [apiCalendar]);

  // Build DayMeta for each grid day
  const dayMetaMap = useMemo(() => {
    if (!profile || !prediction) return new Map<string, DayMeta>();

    const profileLogs = periodLogs.filter((l) => l.profileId === activeProfileId);
    const map = new Map<string, DayMeta>();

    const fertileStart = parseISO(prediction.fertileStart);
    const fertileEnd = parseISO(prediction.fertileEnd);
    const ovulationDay = parseISO(prediction.ovulationDay);
    const nextPeriodStart = parseISO(prediction.nextPeriodStart);
    const nextPeriodEnd = new Date(nextPeriodStart);
    nextPeriodEnd.setDate(nextPeriodStart.getDate() + profile.periodLength - 1);

    const lastPeriodEnd = profile.lastPeriodStart
      ? (() => {
          const end = parseISO(profile.lastPeriodStart);
          end.setDate(end.getDate() + profile.periodLength - 1);
          return end;
        })()
      : null;

    for (const date of gridDays) {
      const dateStr = format(date, 'yyyy-MM-dd');

      // Check actual period logs
      const periodLog = profileLogs.find((l) =>
        isWithinInterval(date, {
          start: parseISO(l.startDate),
          end: parseISO(l.endDate),
        })
      );

      // Check predicted period window (future)
      const isInPredictedPeriod =
        date >= nextPeriodStart && date <= nextPeriodEnd;

      // Fertile window (from prediction)
      const isFertile =
        date >= fertileStart && date <= fertileEnd;

      // Ovulation
      const isOvulation = isSameDay(date, ovulationDay);

      const isFuture = date > today;

      const isInLastPeriodWindow =
        profile.lastPeriodStart &&
        lastPeriodEnd &&
        isWithinInterval(date, {
          start: parseISO(profile.lastPeriodStart),
          end: lastPeriodEnd,
        });

      // Prefer API calendar data when available, fall back to store-computed values
      const apiDay = apiCalendarMap?.get(dateStr);
      map.set(dateStr, {
        date,
        isPeriod: apiDay
          ? (apiDay.period || Boolean(periodLog))
          : (Boolean(periodLog) || isInLastPeriodWindow || isInPredictedPeriod),
        isFertile: apiDay ? apiDay.fertile : isFertile,
        isOvulation: apiDay ? apiDay.ovulation : isOvulation,
        isFuturePredicted: apiDay
          ? (apiDay.predicted && isFuture)
          : (isFuture && (isInPredictedPeriod || isFertile || isOvulation)),
        periodLog,
      });
    }

    return map;
  }, [gridDays, periodLogs, activeProfileId, profile, prediction, today, apiCalendarMap]);

  const selectedMeta = selectedDate
    ? dayMetaMap.get(format(selectedDate, 'yyyy-MM-dd'))
    : null;

  const prevMonth = () => {
    setSelectedDate(null);
    setCurrentMonth((m) => subMonths(m, 1));
  };
  const nextMonth = () => {
    setSelectedDate(null);
    setCurrentMonth((m) => addMonths(m, 1));
  };

  const handleDayClick = (date: Date) => {
    if (selectedDate && isSameDay(selectedDate, date)) {
      setSelectedDate(null);
    } else {
      setSelectedDate(date);
    }
  };

  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[var(--color-text-muted)]">No profile found.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-3 relative overflow-hidden">

      {/* ── Decorative floating blobs ── */}
      <motion.div
        className="absolute -top-8 -right-8 w-40 h-40 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(232,71,108,0.07) 0%, transparent 70%)' }}
        animate={{ y: [0, -10, 0], x: [0, 6, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-24 -left-10 w-32 h-32 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(123,197,174,0.06) 0%, transparent 70%)' }}
        animate={{ y: [0, 10, 0], x: [0, -5, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />

      {/* ── Month Header ─────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card padding="md">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={prevMonth}
              className="p-2 rounded-xl hover:bg-[var(--color-bg-secondary)] transition-colors"
            >
              <ChevronLeft size={20} className="text-[var(--color-text-secondary)]" />
            </button>

            <motion.h2
              key={format(currentMonth, 'yyyy-MM')}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="text-base font-bold text-[var(--color-text-primary)]"
            >
              {format(currentMonth, 'MMMM yyyy')}
            </motion.h2>

            <button
              onClick={nextMonth}
              className="p-2 rounded-xl hover:bg-[var(--color-bg-secondary)] transition-colors"
            >
              <ChevronRight size={20} className="text-[var(--color-text-secondary)]" />
            </button>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1 md:mb-2">
            {DOW.map((d) => (
              <div key={d} className="flex items-center justify-center">
                <span className="text-[10px] md:text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider">
                  {d}
                </span>
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <AnimatePresence mode="wait">
            <motion.div
              key={format(currentMonth, 'yyyy-MM')}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.22 }}
              className="grid grid-cols-7 gap-0.5 md:gap-1"
            >
              {gridDays.map((date) => {
                const dateStr = format(date, 'yyyy-MM-dd');
                const meta = dayMetaMap.get(dateStr)!;
                const inMonth = isSameMonth(date, currentMonth);
                const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;

                return (
                  <DayCell
                    key={dateStr}
                    meta={meta}
                    isCurrentMonth={inMonth}
                    isSelected={isSelected}
                    onClick={() => handleDayClick(date)}
                  />
                );
              })}
            </motion.div>
          </AnimatePresence>
        </Card>
      </motion.div>

      {/* ── Legend + Day Detail + Monthly Summary ────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Legend */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="md:col-span-2"
        >
          <Card padding="sm">
            <Legend />
          </Card>
        </motion.div>

        {/* Day Detail */}
        <AnimatePresence>
          {selectedDate && selectedMeta && (
            <DayDetail
              key={format(selectedDate, 'yyyy-MM-dd')}
              date={selectedDate}
              meta={selectedMeta}
              symptomLogs={symptomLogs.filter((s) => s.profileId === activeProfileId)}
              onClose={() => setSelectedDate(null)}
            />
          )}
        </AnimatePresence>

      {/* Monthly Summary */}
      {prediction && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          <Card padding="md">
            <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-3">
              This Cycle
            </h3>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-menstrual)' }} />
                  <span className="text-xs text-[var(--color-text-secondary)]">Next Period</span>
                </div>
                <span className="text-xs font-bold text-[var(--color-text-primary)]">
                  {format(parseISO(prediction.nextPeriodStart), 'MMM d')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-ovulation)' }} />
                  <span className="text-xs text-[var(--color-text-secondary)]">Ovulation</span>
                </div>
                <span className="text-xs font-bold text-[var(--color-text-primary)]">
                  {format(parseISO(prediction.ovulationDay), 'MMM d')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: 'var(--color-fertile)' }} />
                  <span className="text-xs text-[var(--color-text-secondary)]">Fertile Window</span>
                </div>
                <span className="text-xs font-bold text-[var(--color-text-primary)]">
                  {format(parseISO(prediction.fertileStart), 'MMM d')}
                  {' – '}
                  {format(parseISO(prediction.fertileEnd), 'MMM d')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-[var(--color-secondary)]" />
                  <span className="text-xs text-[var(--color-text-secondary)]">Confidence</span>
                </div>
                <span className="text-xs font-bold" style={{ color: 'var(--color-secondary)' }}>
                  {prediction.confidence}%
                </span>
              </div>
            </div>
          </Card>
        </motion.div>
      )}
      </div>
    </div>
  );
}
