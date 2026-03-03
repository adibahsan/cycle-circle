import React, { useState } from 'react';
import { useAppContext, SymptomLog } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { format, startOfDay } from 'date-fns';
import { clsx } from 'clsx';

// ─── Option definitions ───────────────────────────────────────────────────────

const FLOW_OPTIONS = [
  { id: 'light', label: 'Light', icon: 'water_drop', color: 'pink' },
  { id: 'medium', label: 'Medium', icon: 'water', color: 'primary' },
  { id: 'strong', label: 'Strong', icon: 'waves', color: 'red' },
  { id: 'spotting', label: 'Spotting', icon: 'blur_on', color: 'purple' },
  { id: 'clots', label: 'Clots', icon: 'circle', color: 'red' },
];

const MOOD_OPTIONS = [
  { id: 'happy', label: 'Happy', icon: 'sentiment_very_satisfied', color: 'pink' },
  { id: 'sensitive', label: 'Sensitive', icon: 'psychology', color: 'purple' },
  { id: 'calm', label: 'Calm', icon: 'sentiment_neutral', color: 'slate' },
  { id: 'irritable', label: 'Irritable', icon: 'sentiment_dissatisfied', color: 'slate' },
  { id: 'sad', label: 'Sad', icon: 'mood_bad', color: 'slate' },
  { id: 'tired', label: 'Tired', icon: 'bedtime', color: 'slate' },
];

const PAIN_OPTIONS = [
  { id: 'cramps', label: 'Cramps', icon: 'water_drop', color: 'primary' },
  { id: 'headache', label: 'Headache', icon: 'head_mounted_device', color: 'red' },
  { id: 'backache', label: 'Backache', icon: 'back_hand', color: 'slate' },
  { id: 'breast_tenderness', label: 'Tender Breasts', icon: 'favorite_border', color: 'pink' },
  { id: 'ovulation', label: 'Ovulation Pain', icon: 'radiology', color: 'slate' },
];

const DISCHARGE_OPTIONS = [
  { id: 'creamy', label: 'Creamy', icon: 'bubble_chart', color: 'blue' },
  { id: 'egg_white', label: 'Egg White', icon: 'egg', color: 'cyan' },
  { id: 'sticky', label: 'Sticky', icon: 'grain', color: 'slate' },
  { id: 'watery', label: 'Watery', icon: 'invert_colors', color: 'slate' },
  { id: 'spotting', label: 'Spotting', icon: 'blur_circular', color: 'pink' },
];

const LIFESTYLE_OPTIONS = [
  { id: 'stress', label: 'Stress', icon: 'bolt', color: 'orange' },
  { id: 'travel', label: 'Travel', icon: 'flight', color: 'blue' },
  { id: 'healthy', label: 'Healthy Meal', icon: 'restaurant', color: 'green' },
  { id: 'alcohol', label: 'Alcohol', icon: 'wine_bar', color: 'indigo' },
  { id: 'exercise', label: 'Exercise', icon: 'exercise', color: 'purple' },
  { id: 'caffeine', label: 'Caffeine', icon: 'coffee', color: 'amber' },
];

const SEXUAL_ACTIVITY_OPTIONS = [
  { id: 'protected', label: 'Protected Sex', icon: 'verified_user', color: 'green' },
  { id: 'unprotected', label: 'Unprotected Sex', icon: 'favorite', color: 'pink' },
  { id: 'high_drive', label: 'High Sex Drive', icon: 'local_fire_department', color: 'orange' },
];

type LogCategory = keyof Omit<SymptomLog, 'note'>;

// ─── Color → CSS helper (avoids Tailwind purge issues) ───────────────────────
const COLOR_STYLES: Record<string, { bg: string; text: string; ring: string; container: string }> = {
  primary: { bg: 'bg-primary text-white shadow-glow-primary', text: 'text-primary', ring: 'ring-2 ring-primary border-transparent', container: 'bg-white dark:bg-slate-900 shadow-soft' },
  pink: { bg: 'bg-pink-100 dark:bg-pink-900/40 text-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.3)]', text: 'text-pink-500', ring: 'ring-2 ring-pink-400 border-transparent', container: 'bg-white dark:bg-slate-900 shadow-soft' },
  purple: { bg: 'bg-primary text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]', text: 'text-primary', ring: 'ring-2 ring-primary border-transparent', container: 'bg-white dark:bg-slate-900 shadow-soft' },
  blue: { bg: 'bg-blue-100 dark:bg-blue-900/40 text-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)]', text: 'text-blue-500', ring: 'ring-2 ring-blue-400 border-transparent', container: 'bg-white dark:bg-slate-900 shadow-soft' },
  cyan: { bg: 'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.3)]', text: 'text-cyan-500', ring: 'ring-2 ring-cyan-400 border-transparent', container: 'bg-white dark:bg-slate-900 shadow-soft' },
  red: { bg: 'bg-red-100 dark:bg-red-900/40 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]', text: 'text-red-500', ring: 'ring-2 ring-red-400 border-transparent', container: 'bg-white dark:bg-slate-900 shadow-soft' },
  green: { bg: 'bg-green-100 dark:bg-green-900/40 text-green-600 shadow-[0_0_15px_rgba(34,197,94,0.3)]', text: 'text-green-600', ring: 'ring-2 ring-green-400 border-transparent', container: 'bg-white dark:bg-slate-900 shadow-soft' },
  orange: { bg: 'bg-orange-100 dark:bg-orange-900/40 text-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]', text: 'text-orange-500', ring: 'ring-2 ring-orange-400 border-transparent', container: 'bg-white dark:bg-slate-900 shadow-soft' },
  indigo: { bg: 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]', text: 'text-indigo-500', ring: 'ring-2 ring-indigo-400 border-transparent', container: 'bg-white dark:bg-slate-900 shadow-soft' },
  amber: { bg: 'bg-amber-100 dark:bg-amber-900/40 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]', text: 'text-amber-500', ring: 'ring-2 ring-amber-400 border-transparent', container: 'bg-white dark:bg-slate-900 shadow-soft' },
  slate: { bg: 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300', text: 'text-slate-700 dark:text-slate-200', ring: 'ring-2 ring-slate-400 border-transparent', container: 'bg-white dark:bg-slate-900 shadow-soft' },
};

// ─── Main component ───────────────────────────────────────────────────────────
export const LogSymptoms: React.FC = () => {
  const { symptoms, logSymptom, removeSymptom, setNote } = useAppContext();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const today = startOfDay(new Date());
  const dateStr = today.toISOString().split('T')[0];
  const formattedDate = format(today, 'EEEE, MMM d');

  const EMPTY: SymptomLog = { flow: [], mood: [], pain: [], discharge: [], lifestyle: [], sexualActivity: [], note: '' };
  const current = symptoms[dateStr] || EMPTY;

  const handleToggle = (category: LogCategory, value: string) => {
    setIsSaving(true);
    if ((current[category] as string[]).includes(value)) {
      removeSymptom(dateStr, category, value);
    } else {
      logSymptom(dateStr, category, value);
    }
    setTimeout(() => setIsSaving(false), 600);
  };

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setIsSaving(true);
    setNote(dateStr, e.target.value);
    setTimeout(() => setIsSaving(false), 1000);
  };

  // Completeness: 6 categories
  const CATEGORIES: LogCategory[] = ['flow', 'mood', 'pain', 'discharge', 'lifestyle', 'sexualActivity'];
  const filledCount = CATEGORIES.filter(cat => (current[cat] as string[]).length > 0).length;
  const completeness = Math.round((filledCount / CATEGORIES.length) * 100);

  // ── Option card renderer ──────────────────────────────────────────────────
  const renderOption = (category: LogCategory, option: { id: string; label: string; icon: string; color: string }) => {
    const isSelected = (current[category] as string[]).includes(option.id);
    const style = COLOR_STYLES[option.color] ?? COLOR_STYLES.slate;

    return (
      <div
        key={option.id}
        onClick={() => handleToggle(category, option.id)}
        className={clsx(
          'p-4 rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-300 group active:scale-95 border min-h-[110px]',
          isSelected ? `${style.container} ${style.ring}` : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:border-primary/40 hover:bg-white dark:hover:bg-slate-800'
        )}
      >
        <div className={clsx(
          'size-14 rounded-full flex items-center justify-center transition-transform duration-300',
          isSelected ? style.bg : 'bg-white dark:bg-slate-700 text-slate-400 group-hover:scale-110 group-hover:text-primary shadow-sm'
        )}>
          <span className="material-symbols-outlined text-[28px]">{option.icon}</span>
        </div>
        <span className={clsx('text-[11px] font-bold text-center uppercase tracking-widest', isSelected ? style.text : 'text-slate-500')}>{option.label}</span>
      </div>
    );
  };

  const toggleSection = (label: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  // ── Section renderer ─────────────────────────────────────────────────────
  const renderSection = (
    label: string,
    icon: string,
    iconColor: string,
    category: LogCategory,
    options: typeof FLOW_OPTIONS
  ) => {
    const isCollapsed = collapsedSections.has(label);
    const selectedCount = (current[category] as string[]).length;
    return (
      <section key={label} className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-soft dark:border dark:border-slate-800">
        <button
          type="button"
          onClick={() => toggleSection(label)}
          className="w-full flex items-center justify-between group outline-none focus:ring-2 focus:ring-primary/20 rounded-xl"
        >
          <h2 className="text-lg font-extrabold flex items-center gap-3">
            <span className={`material-symbols-outlined ${iconColor}`}>{icon}</span>
            {label}
            {selectedCount > 0 && (
              <span className="ml-2 size-6 flex items-center justify-center rounded-full bg-primary/15 text-primary text-[11px] font-black">
                {selectedCount}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 hidden sm:block">{options.length} Options</span>
            <div className="size-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
              <span className={`material-symbols-outlined text-slate-400 group-hover:text-primary transition-transform duration-300 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}>
                expand_more
              </span>
            </div>
          </div>
        </button>

        <div className={clsx(
          "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 transition-all duration-500 overflow-hidden",
          isCollapsed ? "max-h-0 opacity-0 mt-0" : "max-h-[2000px] opacity-100 mt-6"
        )}>
          {options.map(opt => renderOption(category, opt))}
        </div>
      </section>
    );
  };

  return (
    <div className="-mx-4 sm:-mx-6 lg:-mx-8 -my-8 flex flex-col overflow-hidden relative"
      style={{ height: 'calc(100dvh - 4rem)' }}>
      {/* Background blobs */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] -z-10" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px] -z-10" />

      {/* Header */}
      <header className="sticky top-0 z-50 px-6 py-4 flex items-center justify-between bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 mb-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="size-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
            <span className="material-symbols-outlined text-[22px]">edit_calendar</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight leading-none text-slate-900 dark:text-white">Log Symptoms</h1>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mt-1">{formattedDate}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="size-10 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary transition-all">
            <span className="material-symbols-outlined text-[20px]">calendar_today</span>
          </button>
          <button className="size-10 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary transition-all">
            <span className="material-symbols-outlined text-[20px]">more_vert</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pb-4">
        {/* Completeness bar */}
        <section className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-soft dark:border dark:border-slate-800 mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1 w-full">
            <div className="flex justify-between items-end mb-3">
              <h3 className="font-exrabold text-[15px] tracking-wide text-slate-900 dark:text-white">Daily Completeness</h3>
              <span className="text-primary font-black text-lg leading-none">{completeness}%</span>
            </div>
            <div className="w-full h-4 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-primary rounded-full transition-all duration-1000 ease-out relative overflow-hidden"
                style={{ width: `${completeness}%` }}
              >
                <div className="absolute inset-0 bg-white/20 w-1/2 skew-x-12 translate-x-[-100%] animate-[shimmer_2s_infinite]" />
              </div>
            </div>
            <p className="mt-3 text-[13px] text-slate-500 dark:text-slate-400 font-medium">
              {completeness === 100
                ? "You've logged all categories today. Great job!"
                : `${filledCount} of 6 categories logged today.`}
            </p>
          </div>
        </section>

        {/* Category sections */}
        <div className="space-y-6">
          {renderSection('Flow', 'opacity', 'text-pink-500', 'flow', FLOW_OPTIONS)}
          {renderSection('Mood', 'mood', 'text-pink-400', 'mood', MOOD_OPTIONS)}
          {renderSection('Pain', 'personal_injury', 'text-red-400', 'pain', PAIN_OPTIONS)}
          {renderSection('Discharge', 'water', 'text-blue-400', 'discharge', DISCHARGE_OPTIONS)}
          {renderSection('Lifestyle', 'self_improvement', 'text-orange-400', 'lifestyle', LIFESTYLE_OPTIONS)}

          {/* Sexual Activity — collapsible gated section */}
          <section className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-soft dark:border dark:border-slate-800 border-2 border-transparent hover:border-pink-100 dark:hover:border-pink-900/40 transition-colors">
            <button
              type="button"
              onClick={() => toggleSection('Sexual Activity')}
              className="w-full flex items-center justify-between group outline-none rounded-xl"
            >
              <h2 className="text-lg font-extrabold flex items-center gap-3">
                <span className="material-symbols-outlined text-rose-400">favorite</span>
                Sexual Activity
                {(current.sexualActivity as string[]).length > 0 && (
                  <span className="ml-2 size-6 flex items-center justify-center rounded-full bg-primary/15 text-primary text-[11px] font-black">
                    {(current.sexualActivity as string[]).length}
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold rounded-full uppercase tracking-widest hidden sm:block">Private</span>
                <div className="size-8 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                  <span className={`material-symbols-outlined text-slate-400 group-hover:text-primary transition-transform duration-300 ${collapsedSections.has('Sexual Activity') ? '-rotate-90' : 'rotate-0'}`}>
                    expand_more
                  </span>
                </div>
              </div>
            </button>
            <div className={clsx(
              "transition-all duration-500 overflow-hidden",
              collapsedSections.has('Sexual Activity') ? "max-h-0 opacity-0 mt-0" : "max-h-[2000px] opacity-100 mt-4"
            )}>
              <p className="text-[13px] text-slate-500 font-medium mb-6 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px]">lock</span>
                Your data stays on your device and is never shared.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {SEXUAL_ACTIVITY_OPTIONS.map(opt => renderOption('sexualActivity', opt))}
              </div>
            </div>
          </section>
        </div>

        {/* Notes */}
        <section className="mt-12 mb-8">
          <div className="flex items-center gap-2 mb-4 px-2">
            <span className="material-symbols-outlined text-slate-400">edit_note</span>
            <h2 className="text-xl font-extrabold">Add Note</h2>
          </div>
          <div className="glass p-4 rounded-lg">
            <textarea
              value={current.note}
              onChange={handleNoteChange}
              className="w-full bg-transparent border-none focus:ring-0 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 resize-none min-h-[120px] outline-none"
              placeholder="Write down any additional details about how you feel today..."
            />
          </div>
        </section>

      </main>

      {/* ── Sticky save bar ───────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-4 px-4 sm:px-6 lg:px-8 py-3 border-t border-slate-200 dark:border-slate-800 bg-background-light/90 dark:bg-background-dark/90 backdrop-blur-md">
        <button
          onClick={() => navigate('/')}
          className="flex items-center justify-center size-[52px] rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors shrink-0"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
        <button
          onClick={() => navigate('/')}
          className="flex-1 h-[52px] bg-primary text-white font-extrabold rounded-full shadow-glow-primary hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center text-[15px] tracking-wide"
        >
          Save Symptoms
        </button>
        <div className="hidden sm:flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-full px-4 py-3 min-w-[130px] justify-center flex-shrink-0">
          {isSaving ? (
            <>
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-bold text-slate-500">Auto-saving...</span>
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-sm text-green-500">check</span>
              <span className="text-xs font-bold text-slate-500">Saved</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
