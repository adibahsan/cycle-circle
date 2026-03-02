import React from 'react';
import { useAppContext } from '../context/AppContext';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { GOAL_LABELS, GOAL_COLORS } from '../data/profiles';

export const Settings: React.FC = () => {
  const {
    mode, toggleMode,
    theme, toggleTheme,
    anonymousMode, toggleAnonymousMode, anonymousName,
    cycleLength, setCycleLength,
    periodLength, setPeriodLength,
    lastPeriodStart, setLastPeriodStart,
    predictedCycleLength, cycleHistory,
    currentProfile, logout,
  } = useAppContext();
  const navigate = useNavigate();

  // Format lastPeriodStart as YYYY-MM-DD for the date input
  const lastPeriodDateValue = lastPeriodStart
    ? new Date(lastPeriodStart).toISOString().split('T')[0]
    : '';

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      {/* ── Profile Card ──────────────────────────────────────────── */}
      {currentProfile && (
        <div className="glass p-6 rounded-xl flex items-center gap-4">
          {currentProfile.avatar ? (
            <img src={currentProfile.avatar} alt={currentProfile.name}
              className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${currentProfile.gradientFrom} ${currentProfile.gradientTo} flex items-center justify-center text-white text-2xl font-bold flex-shrink-0`}>
              {currentProfile.name.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold truncate">{currentProfile.name}</h2>
            <p className="text-slate-500 text-sm">{currentProfile.bio}</p>
            <span className={`inline-block mt-1.5 px-3 py-0.5 rounded-full text-xs font-bold ${GOAL_COLORS[currentProfile.goal]}`}>
              {GOAL_LABELS[currentProfile.goal]}
            </span>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="flex-shrink-0 flex flex-col items-center gap-1 text-primary hover:bg-primary/5 px-3 py-2 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined">switch_account</span>
            <span className="text-xs font-bold">Switch</span>
          </button>
        </div>
      )}

      {/* ── Cycle Configuration ─────────────────────────────────────── */}
      <div className="glass p-6 rounded-xl space-y-6">
        <div>
          <h2 className="text-xl font-bold mb-1">Cycle Configuration</h2>
          <p className="text-slate-500 text-sm mb-5">Personalise your cycle data for more accurate predictions.</p>

          {/* ML Prediction Badge */}
          <div className="flex items-center gap-3 p-4 mb-5 rounded-xl bg-primary/5 border border-primary/20">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <span className="material-symbols-outlined">smart_toy</span>
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm">AI-Predicted Cycle Length</p>
              <p className="text-xs text-slate-500">
                Based on your last {cycleHistory.length} cycles using weighted averaging
              </p>
            </div>
            <span className="text-2xl font-extrabold text-primary">{predictedCycleLength}d</span>
          </div>

          <div className="space-y-4">
            {/* Cycle Length */}
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <div>
                <p className="font-bold">Cycle Length</p>
                <p className="text-xs text-slate-500">Average days between periods (21–45)</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCycleLength(cycleLength - 1)}
                  disabled={cycleLength <= 21}
                  className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold disabled:opacity-30 hover:bg-primary/20 transition-colors"
                >−</button>
                <span className="w-10 text-center font-extrabold text-lg">{cycleLength}</span>
                <button
                  onClick={() => setCycleLength(cycleLength + 1)}
                  disabled={cycleLength >= 45}
                  className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold disabled:opacity-30 hover:bg-primary/20 transition-colors"
                >+</button>
              </div>
            </div>

            {/* Period Length */}
            <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <div>
                <p className="font-bold">Period Length</p>
                <p className="text-xs text-slate-500">Duration of your period (1–10 days)</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPeriodLength(periodLength - 1)}
                  disabled={periodLength <= 1}
                  className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold disabled:opacity-30 hover:bg-primary/20 transition-colors"
                >−</button>
                <span className="w-10 text-center font-extrabold text-lg">{periodLength}</span>
                <button
                  onClick={() => setPeriodLength(periodLength + 1)}
                  disabled={periodLength >= 10}
                  className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold disabled:opacity-30 hover:bg-primary/20 transition-colors"
                >+</button>
              </div>
            </div>

            {/* Last Period Date */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <div>
                <p className="font-bold">Last Period Start Date</p>
                <p className="text-xs text-slate-500">When did your most recent period begin?</p>
              </div>
              <input
                type="date"
                value={lastPeriodDateValue}
                max={new Date().toISOString().split('T')[0]}
                onChange={e => {
                  if (e.target.value) {
                    setLastPeriodStart(new Date(e.target.value + 'T00:00:00').toISOString());
                  }
                }}
                className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── App Mode ────────────────────────────────────────────────── */}
      <div className="glass p-6 rounded-xl space-y-6">
        <div>
          <h2 className="text-xl font-bold mb-2">App Mode</h2>
          <p className="text-slate-500 mb-4">Switch between standard cycle tracking and pregnancy mode.</p>

          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${mode === 'pregnancy' ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'}`}>
                <span className="material-symbols-outlined">child_care</span>
              </div>
              <div>
                <p className="font-bold">Pregnancy Mode</p>
                <p className="text-xs text-slate-500">Track your baby's growth and milestones</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={mode === 'pregnancy'} onChange={toggleMode} />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary" />
            </label>
          </div>
        </div>
      </div>

      {/* ── Anonymous Mode ──────────────────────────────────────────── */}
      <div className="glass p-6 rounded-xl space-y-4">
        <div>
          <h2 className="text-xl font-bold mb-1">Anonymous Mode</h2>
          <p className="text-slate-500 text-sm mb-4">
            Hides your identity in community spaces. Your data never leaves your device in this mode.
          </p>

          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${anonymousMode ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'}`}>
                <span className="material-symbols-outlined">visibility_off</span>
              </div>
              <div>
                <p className="font-bold">Enable Anonymous Mode</p>
                <p className="text-xs text-slate-500">Your name and photo are hidden from others</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={anonymousMode} onChange={toggleAnonymousMode} />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary" />
            </label>
          </div>

          {anonymousMode && (
            <div className="mt-3 flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-pink-400 to-indigo-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-widest font-bold">Your Anonymous Identity</p>
                <p className="font-extrabold text-primary text-lg">{anonymousName}</p>
              </div>
              <button
                onClick={toggleAnonymousMode}
                className="ml-auto text-xs font-bold text-primary hover:underline"
                title="Toggle to regenerate"
              >
                Regenerate
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Appearance ──────────────────────────────────────────────── */}
      <div className="glass p-6 rounded-xl space-y-6">
        <div>
          <h2 className="text-xl font-bold mb-2">Appearance</h2>
          <p className="text-slate-500 mb-4">Customize the look and feel of the application.</p>

          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300">
                <span className="material-symbols-outlined">{theme === 'dark' ? 'dark_mode' : 'light_mode'}</span>
              </div>
              <div>
                <p className="font-bold">Dark Mode</p>
                <p className="text-xs text-slate-500">Toggle dark theme</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={theme === 'dark'} onChange={toggleTheme} />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary" />
            </label>
          </div>
        </div>
      </div>

      {/* ── Account ─────────────────────────────────────────────────── */}
      <div className="glass p-6 rounded-xl">
        <h2 className="text-xl font-bold mb-4">Account</h2>
        <div className="space-y-3">
          <button className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <span className="font-medium">Profile Information</span>
            <span className="material-symbols-outlined text-slate-400">chevron_right</span>
          </button>
          <button className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <span className="font-medium">Notifications</span>
            <span className="material-symbols-outlined text-slate-400">chevron_right</span>
          </button>
          <button
            onClick={() => navigate('/login')}
            className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-primary"
          >
            <span className="font-medium">Switch Account</span>
            <span className="material-symbols-outlined">switch_account</span>
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-red-500"
          >
            <span className="font-medium">Log Out</span>
            <span className="material-symbols-outlined">logout</span>
          </button>
        </div>
      </div>
    </div>
  );
};
