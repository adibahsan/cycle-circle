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
  primary: { bg: 'bg-primary text-white', text: 'text-primary', ring: 'ring-2 ring-primary', container: 'glass bg-primary/5' },
  pink: { bg: 'bg-pink-100 dark:bg-pink-900/30 text-pink-500', text: 'text-pink-500', ring: 'ring-2 ring-pink-400', container: 'glass bg-pink-50/50 dark:bg-pink-900/10 border-pink-100 dark:border-pink-900/30' },
  purple: { bg: 'bg-primary text-white', text: 'text-primary', ring: 'ring-2 ring-primary', container: 'glass bg-purple-50/50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900/30' },
  blue: { bg: 'bg-white dark:bg-slate-800 border-2 border-blue-200 dark:border-blue-900 text-blue-400', text: 'text-blue-500', ring: 'ring-2 ring-blue-400', container: 'glass bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30' },
  cyan: { bg: 'bg-white dark:bg-slate-800 border-2 border-cyan-200 dark:border-cyan-900 text-cyan-400', text: 'text-cyan-500', ring: 'ring-2 ring-cyan-400', container: 'glass bg-cyan-50/50 dark:bg-cyan-900/10 border-cyan-100 dark:border-cyan-900/30' },
  red: { bg: 'bg-red-100 dark:bg-red-900/20 text-red-500', text: 'text-red-500', ring: 'ring-2 ring-red-400', container: 'glass bg-red-50/50 dark:bg-red-900/10' },
  green: { bg: 'bg-green-100 dark:bg-green-900/20 text-green-600', text: 'text-green-600', ring: 'ring-2 ring-green-400', container: 'glass bg-green-50/50 dark:bg-green-900/10' },
  orange: { bg: 'bg-orange-100 dark:bg-orange-900/20 text-orange-500', text: 'text-orange-500', ring: 'ring-2 ring-orange-400', container: 'glass bg-orange-50/50 dark:bg-orange-900/10' },
  indigo: { bg: 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-500', text: 'text-indigo-500', ring: 'ring-2 ring-indigo-400', container: 'glass bg-indigo-50/50 dark:bg-indigo-900/10' },
  amber: { bg: 'bg-amber-100 dark:bg-amber-900/20 text-amber-500', text: 'text-amber-500', ring: 'ring-2 ring-amber-400', container: 'glass bg-amber-50/50 dark:bg-amber-900/10' },
  slate: { bg: 'bg-slate-100 dark:bg-slate-800 text-slate-500', text: 'text-slate-600', ring: 'ring-2 ring-slate-400', container: 'glass' },
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
          'p-4 rounded-lg flex flex-col items-center gap-3 cursor-pointer transition-all group active:scale-95',
          isSelected ? `${style.container} ${style.ring}` : 'glass hover:border-primary'
        )}
      >
        <div className={clsx(
          'w-14 h-14 rounded-full flex items-center justify-center transition-transform',
          isSelected ? style.bg : 'bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:scale-110'
        )}>
          <span className="material-symbols-outlined text-3xl">{option.icon}</span>
        </div>
        <span className={clsx('text-sm font-semibold text-center leading-tight', isSelected ? style.text : '')}>{option.label}</span>
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
      <section key={label}>
        <button
          type="button"
          onClick={() => toggleSection(label)}
          className="w-full flex items-center justify-between mb-4 px-2 group"
        >
          <h2 className="text-xl font-extrabold flex items-center gap-2">
            <span className={`material-symbols-outlined ${iconColor}`}>{icon}</span>
            {label}
            {selectedCount > 0 && (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-bold">
                {selectedCount}
              </span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{options.length} Options</span>
            <span className={`material-symbols-outlined text-slate-400 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}>
              expand_more
            </span>
          </div>
        </button>
        {!isCollapsed && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {options.map(opt => renderOption(category, opt))}
          </div>
        )}
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
      <header className="sticky top-0 z-50 px-6 py-4 flex items-center justify-between glass mb-4 mt-2 mx-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white shadow-lg shadow-primary/30">
            <span className="material-symbols-outlined text-2xl">favorite</span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Log Symptoms</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{formattedDate}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="w-10 h-10 rounded-full flex items-center justify-center bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all">
            <span className="material-symbols-outlined">calendar_today</span>
          </button>
          <button className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-200/50 dark:bg-slate-800/50">
            <span className="material-symbols-outlined">more_vert</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 pb-4">
        {/* Completeness bar */}
        <section className="glass p-6 rounded-xl mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1 w-full">
            <div className="flex justify-between items-end mb-2">
              <h3 className="font-bold text-lg">Daily Completeness</h3>
              <span className="text-primary font-bold">{completeness}%</span>
            </div>
            <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${completeness}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {completeness === 100
                ? "You've logged all categories today. Great job!"
                : `${filledCount} of 6 categories logged today.`}
            </p>
          </div>
          <div className="flex -space-x-3">
            {[
              { bg: 'bg-pink-100', text: 'text-pink-500', icon: 'opacity' },
              { bg: 'bg-red-100', text: 'text-red-500', icon: 'sentiment_satisfied' },
              { bg: 'bg-blue-100', text: 'text-blue-500', icon: 'water_drop' },
              { bg: 'bg-purple-100', text: 'text-purple-500', icon: 'bolt' },
            ].map((b, i) => (
              <div key={i} className={`w-12 h-12 rounded-full border-4 border-background-light dark:border-background-dark ${b.bg} flex items-center justify-center ${b.text}`}>
                <span className="material-symbols-outlined">{b.icon}</span>
              </div>
            ))}
            <div className="w-12 h-12 rounded-full border-4 border-background-light dark:border-background-dark bg-primary flex items-center justify-center text-white text-xs font-bold">
              +{CATEGORIES.length}
            </div>
          </div>
        </section>

        {/* Category sections */}
        <div className="space-y-10">
          {renderSection('Flow', 'opacity', 'text-pink-500', 'flow', FLOW_OPTIONS)}
          {renderSection('Mood', 'mood', 'text-pink-400', 'mood', MOOD_OPTIONS)}
          {renderSection('Pain', 'personal_injury', 'text-red-400', 'pain', PAIN_OPTIONS)}
          {renderSection('Discharge', 'water', 'text-blue-400', 'discharge', DISCHARGE_OPTIONS)}
          {renderSection('Lifestyle', 'self_improvement', 'text-orange-400', 'lifestyle', LIFESTYLE_OPTIONS)}

          {/* Sexual Activity — collapsible gated section */}
          <section>
            <button
              type="button"
              onClick={() => toggleSection('Sexual Activity')}
              className="w-full flex items-center justify-between mb-4 px-2 group"
            >
              <h2 className="text-xl font-extrabold flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-400">favorite</span>
                Sexual Activity
                {(current.sexualActivity as string[]).length > 0 && (
                  <span className="ml-1 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-xs font-bold">
                    {(current.sexualActivity as string[]).length}
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-bold rounded-full uppercase tracking-widest">Private</span>
                <span className={`material-symbols-outlined text-slate-400 transition-transform duration-200 ${collapsedSections.has('Sexual Activity') ? '-rotate-90' : 'rotate-0'
                  }`}>expand_more</span>
              </div>
            </button>
            {!collapsedSections.has('Sexual Activity') && (
              <>
                <p className="text-sm text-slate-500 mb-4 px-2">Your data stays on your device and is never shared.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {SEXUAL_ACTIVITY_OPTIONS.map(opt => renderOption('sexualActivity', opt))}
                </div>
              </>
            )}
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
          className="flex items-center justify-center w-12 h-12 rounded-full glass hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex-shrink-0"
        >
          <span className="material-symbols-outlined">close</span>
        </button>
        <button
          onClick={() => navigate('/')}
          className="flex-1 bg-primary text-white font-bold py-3.5 rounded-full shadow-xl shadow-primary/30 hover:brightness-110 active:scale-95 transition-all text-center"
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
