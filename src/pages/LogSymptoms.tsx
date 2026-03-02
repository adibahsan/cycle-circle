import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import { format, startOfDay } from 'date-fns';
import { clsx } from 'clsx';

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
  { id: 'ovulation', label: 'Ovulation Pain', icon: 'radiology', color: 'slate' },
];

const DISCHARGE_OPTIONS = [
  { id: 'creamy', label: 'Creamy', icon: 'bubble_chart', color: 'blue' },
  { id: 'egg_white', label: 'Egg White', icon: 'egg', color: 'cyan' },
  { id: 'sticky', label: 'Sticky', icon: 'grain', color: 'slate' },
  { id: 'watery', label: 'Watery', icon: 'invert_colors', color: 'slate' },
];

const LIFESTYLE_OPTIONS = [
  { id: 'stress', label: 'Stress', icon: 'bolt', color: 'orange' },
  { id: 'travel', label: 'Travel', icon: 'flight', color: 'blue' },
  { id: 'healthy', label: 'Healthy Meal', icon: 'restaurant', color: 'green' },
  { id: 'alcohol', label: 'Alcohol', icon: 'wine_bar', color: 'indigo' },
  { id: 'exercise', label: 'Exercise', icon: 'exercise', color: 'purple' },
  { id: 'caffeine', label: 'Caffeine', icon: 'coffee', color: 'amber' },
];

export const LogSymptoms: React.FC = () => {
  const { symptoms, logSymptom, removeSymptom, setNote } = useAppContext();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  
  const today = startOfDay(new Date());
  const dateStr = today.toISOString().split('T')[0];
  const formattedDate = format(today, 'EEEE, MMM d');
  
  const currentSymptoms = symptoms[dateStr] || { mood: [], pain: [], discharge: [], lifestyle: [], note: '' };

  const handleToggle = (category: 'mood' | 'pain' | 'discharge' | 'lifestyle', value: string) => {
    setIsSaving(true);
    if (currentSymptoms[category].includes(value)) {
      removeSymptom(dateStr, category, value);
    } else {
      logSymptom(dateStr, category, value);
    }
    setTimeout(() => setIsSaving(false), 500);
  };

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setIsSaving(true);
    setNote(dateStr, e.target.value);
    setTimeout(() => setIsSaving(false), 1000);
  };

  const calculateCompleteness = () => {
    let count = 0;
    if (currentSymptoms.mood.length > 0) count++;
    if (currentSymptoms.pain.length > 0) count++;
    if (currentSymptoms.discharge.length > 0) count++;
    if (currentSymptoms.lifestyle.length > 0) count++;
    return (count / 4) * 100;
  };

  const completeness = calculateCompleteness();

  const renderOption = (
    category: 'mood' | 'pain' | 'discharge' | 'lifestyle',
    option: any
  ) => {
    const isSelected = currentSymptoms[category].includes(option.id);
    
    let bgClass = 'bg-slate-100 dark:bg-slate-800';
    let textClass = 'text-slate-500';
    let ringClass = '';
    let containerClass = 'glass';

    if (isSelected) {
      if (option.color === 'primary') {
        bgClass = 'bg-primary text-white';
        textClass = 'text-primary';
        ringClass = 'ring-2 ring-primary';
        containerClass = 'glass bg-primary/5';
      } else if (option.color === 'pink') {
        bgClass = 'bg-pink-100 dark:bg-pink-900/30 text-pink-500';
        textClass = 'text-pink-500';
        ringClass = 'ring-2 ring-pink-400';
        containerClass = 'glass bg-pink-50/50 dark:bg-pink-900/10 border-pink-100 dark:border-pink-900/30';
      } else if (option.color === 'purple') {
        bgClass = 'bg-primary text-white';
        textClass = 'text-primary';
        ringClass = 'ring-2 ring-primary';
        containerClass = 'glass bg-purple-50/50 dark:bg-purple-900/10 border-purple-100 dark:border-purple-900/30';
      } else if (option.color === 'blue') {
        bgClass = 'bg-white dark:bg-slate-800 border-2 border-blue-200 dark:border-blue-900 text-blue-400';
        textClass = 'text-blue-500';
        ringClass = 'ring-2 ring-blue-400';
        containerClass = 'glass bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30';
      } else if (option.color === 'cyan') {
        bgClass = 'bg-white dark:bg-slate-800 border-2 border-cyan-200 dark:border-cyan-900 text-cyan-400';
        textClass = 'text-cyan-500';
        ringClass = 'ring-2 ring-cyan-400';
        containerClass = 'glass bg-cyan-50/50 dark:bg-cyan-900/10 border-cyan-100 dark:border-cyan-900/30';
      } else {
        bgClass = `bg-${option.color}-100 dark:bg-${option.color}-900/20 text-${option.color}-500`;
        textClass = `text-${option.color}-500`;
        ringClass = `ring-2 ring-${option.color}-400`;
        containerClass = `glass bg-${option.color}-50/50 dark:bg-${option.color}-900/10`;
      }
    }

    return (
      <div 
        key={option.id}
        onClick={() => handleToggle(category, option.id)}
        className={clsx(
          "p-4 rounded-lg flex flex-col items-center gap-3 cursor-pointer hover:border-primary transition-all group active:scale-95",
          containerClass,
          isSelected ? ringClass : ""
        )}
      >
        <div className={clsx(
          "w-14 h-14 rounded-full flex items-center justify-center transition-transform",
          bgClass,
          isSelected && option.color === 'purple' ? "shadow-lg shadow-primary/20" : "",
          !isSelected ? "group-hover:scale-110" : ""
        )}>
          <span className="material-symbols-outlined text-3xl">{option.icon}</span>
        </div>
        <span className={clsx("text-sm font-semibold", isSelected ? textClass : "")}>{option.label}</span>
      </div>
    );
  };

  return (
    <div className="max-w-[1200px] mx-auto min-h-screen flex flex-col relative">
      {/* Background Elements */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] -z-10"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px] -z-10"></div>

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

      <main className="flex-1 px-4 pb-12">
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
              ></div>
            </div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {completeness === 100 
                ? "You've logged all categories today. Great job!" 
                : `You've logged ${Math.round(completeness / 25)} categories today.`}
            </p>
          </div>
          <div className="flex -space-x-3">
            <div className="w-12 h-12 rounded-full border-4 border-background-light dark:border-background-dark bg-pink-100 flex items-center justify-center text-pink-500">
              <span className="material-symbols-outlined">sentiment_satisfied</span>
            </div>
            <div className="w-12 h-12 rounded-full border-4 border-background-light dark:border-background-dark bg-blue-100 flex items-center justify-center text-blue-500">
              <span className="material-symbols-outlined">water_drop</span>
            </div>
            <div className="w-12 h-12 rounded-full border-4 border-background-light dark:border-background-dark bg-purple-100 flex items-center justify-center text-purple-500">
              <span className="material-symbols-outlined">bolt</span>
            </div>
            <div className="w-12 h-12 rounded-full border-4 border-background-light dark:border-background-dark bg-primary flex items-center justify-center text-white text-xs font-bold">
              +8
            </div>
          </div>
        </section>

        <div className="space-y-10">
          <section>
            <div className="flex items-center justify-between mb-4 px-2">
              <h2 className="text-xl font-extrabold flex items-center gap-2">
                <span className="material-symbols-outlined text-pink-400">mood</span>
                Mood
              </h2>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{MOOD_OPTIONS.length} Options</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {MOOD_OPTIONS.map(opt => renderOption('mood', opt))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4 px-2">
              <h2 className="text-xl font-extrabold flex items-center gap-2">
                <span className="material-symbols-outlined text-red-400">personal_injury</span>
                Pain
              </h2>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{PAIN_OPTIONS.length} Options</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {PAIN_OPTIONS.map(opt => renderOption('pain', opt))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4 px-2">
              <h2 className="text-xl font-extrabold flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-400">opacity</span>
                Discharge
              </h2>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{DISCHARGE_OPTIONS.length} Options</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {DISCHARGE_OPTIONS.map(opt => renderOption('discharge', opt))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-4 px-2">
              <h2 className="text-xl font-extrabold flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-400">self_improvement</span>
                Lifestyle
              </h2>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">{LIFESTYLE_OPTIONS.length} Options</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {LIFESTYLE_OPTIONS.map(opt => renderOption('lifestyle', opt))}
            </div>
          </section>
        </div>

        <section className="mt-12 mb-8">
          <div className="flex items-center gap-2 mb-4 px-2">
            <span className="material-symbols-outlined text-slate-400">edit_note</span>
            <h2 className="text-xl font-extrabold">Add Note</h2>
          </div>
          <div className="glass p-4 rounded-lg">
            <textarea 
              value={currentSymptoms.note}
              onChange={handleNoteChange}
              className="w-full bg-transparent border-none focus:ring-0 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 resize-none min-h-[120px] outline-none" 
              placeholder="Write down any additional details about how you feel today..."
            ></textarea>
          </div>
        </section>

        <div className="flex items-center justify-between gap-4 mt-8 pt-8 border-t border-slate-200 dark:border-slate-800">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center justify-center w-12 h-12 rounded-full glass hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
          <button 
            onClick={() => navigate('/')}
            className="flex-1 max-w-md bg-primary text-white font-bold py-4 rounded-full shadow-xl shadow-primary/30 hover:brightness-110 active:scale-95 transition-all text-center"
          >
            Save Symptoms
          </button>
          <div className="hidden sm:flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-full px-4 py-3 min-w-[140px] justify-center">
            {isSaving ? (
              <>
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
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
      </main>
    </div>
  );
};
