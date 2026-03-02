import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { addDays, differenceInDays, startOfDay } from 'date-fns';

type Mode = 'tracking' | 'pregnancy';
type Theme = 'light' | 'dark';

export interface SymptomLog {
  flow: string[];
  mood: string[];
  pain: string[];
  discharge: string[];
  lifestyle: string[];
  sexualActivity: string[];
  note: string;
}

const EMPTY_LOG: SymptomLog = {
  flow: [],
  mood: [],
  pain: [],
  discharge: [],
  lifestyle: [],
  sexualActivity: [],
  note: '',
};

// Pool of anonymous names for "Anonymous Mode"
const ANON_ADJECTIVES = [
  'Silent', 'Hidden', 'Quiet', 'Gentle', 'Soft', 'Calm', 'Brave', 'Wise',
  'Kind', 'Bold', 'Swift', 'Warm', 'Bright', 'Clear', 'Free',
];
const ANON_NOUNS = [
  'Orchid', 'Lily', 'Rose', 'Willow', 'Fern', 'Dawn', 'Moon', 'Star',
  'River', 'Cloud', 'Sage', 'Wren', 'Lark', 'Bloom', 'Pearl',
];

function generateAnonName(): string {
  const adj = ANON_ADJECTIVES[Math.floor(Math.random() * ANON_ADJECTIVES.length)];
  const noun = ANON_NOUNS[Math.floor(Math.random() * ANON_NOUNS.length)];
  return `${adj} ${noun}`;
}

/**
 * Weighted rolling average (exponential) prediction.
 * More recent cycles carry higher weight.
 * This is a lightweight, client-side analogue to ARIMA/LSTM described in the research doc.
 *
 * @param history array of past cycle lengths, oldest first
 * @returns predicted next cycle length (rounded to nearest integer)
 */
function predictCycleLength(history: number[]): number {
  if (history.length === 0) return 28;
  if (history.length === 1) return history[0];

  // Assign linearly increasing weights: oldest = 1, newest = n
  const weights = history.map((_, i) => i + 1);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const weightedSum = history.reduce((sum, val, i) => sum + val * weights[i], 0);
  return Math.round(weightedSum / totalWeight);
}

// ─── localStorage helpers ────────────────────────────────────────────────────
function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function lsSet<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable — silently fail
  }
}

// ─── Default demo cycle history (simulates ~6 months of data) ────────────────
const DEFAULT_CYCLE_HISTORY = [27, 29, 28, 30, 27, 28];

// ─── Default dates ────────────────────────────────────────────────────────────
const DEFAULT_LAST_PERIOD = startOfDay(addDays(new Date(), -14)).toISOString();
const DEFAULT_PREGNANCY_START = startOfDay(addDays(new Date(), -22 * 7)).toISOString();

// ─── Context shape ────────────────────────────────────────────────────────────
interface AppState {
  mode: Mode;
  theme: Theme;
  cycleLength: number;
  periodLength: number;
  predictedCycleLength: number;  // ML-weighted prediction
  cycleHistory: number[];
  lastPeriodStart: string;
  pregnancyStartDate: string | null;
  symptoms: Record<string, SymptomLog>;
  anonymousMode: boolean;
  anonymousName: string;

  // Setters
  toggleMode: () => void;
  toggleTheme: () => void;
  toggleAnonymousMode: () => void;
  setCycleLength: (n: number) => void;
  setPeriodLength: (n: number) => void;
  setLastPeriodStart: (date: string) => void;
  addCycleToHistory: (length: number) => void;

  // Symptom helpers
  logSymptom: (date: string, category: keyof Omit<SymptomLog, 'note'>, value: string) => void;
  removeSymptom: (date: string, category: keyof Omit<SymptomLog, 'note'>, value: string) => void;
  setNote: (date: string, note: string) => void;
}

const defaultState: AppState = {
  mode: 'tracking',
  theme: 'light',
  cycleLength: 28,
  periodLength: 5,
  predictedCycleLength: 28,
  cycleHistory: DEFAULT_CYCLE_HISTORY,
  lastPeriodStart: DEFAULT_LAST_PERIOD,
  pregnancyStartDate: DEFAULT_PREGNANCY_START,
  symptoms: {},
  anonymousMode: false,
  anonymousName: '',
  toggleMode: () => { },
  toggleTheme: () => { },
  toggleAnonymousMode: () => { },
  setCycleLength: () => { },
  setPeriodLength: () => { },
  setLastPeriodStart: () => { },
  addCycleToHistory: () => { },
  logSymptom: () => { },
  removeSymptom: () => { },
  setNote: () => { },
};

const AppContext = createContext<AppState>(defaultState);

// ─── Provider ─────────────────────────────────────────────────────────────────
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<Mode>(() => lsGet<Mode>('cc_mode', 'tracking'));

  const [theme, setTheme] = useState<Theme>(() => {
    const saved = lsGet<Theme>('theme', 'system' as any);
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  const [cycleLength, setCycleLengthState] = useState<number>(() =>
    lsGet<number>('cc_cycleLength', 28)
  );

  const [periodLength, setPeriodLengthState] = useState<number>(() =>
    lsGet<number>('cc_periodLength', 5)
  );

  const [lastPeriodStart, setLastPeriodStartState] = useState<string>(() =>
    lsGet<string>('cc_lastPeriodStart', DEFAULT_LAST_PERIOD)
  );

  const [pregnancyStartDate] = useState<string | null>(DEFAULT_PREGNANCY_START);

  const [cycleHistory, setCycleHistory] = useState<number[]>(() =>
    lsGet<number[]>('cc_cycleHistory', DEFAULT_CYCLE_HISTORY)
  );

  const [symptoms, setSymptoms] = useState<Record<string, SymptomLog>>(() =>
    lsGet<Record<string, SymptomLog>>('cc_symptoms', {})
  );

  const [anonymousMode, setAnonymousMode] = useState<boolean>(() =>
    lsGet<boolean>('cc_anonymousMode', false)
  );

  const [anonymousName, setAnonymousName] = useState<string>(() =>
    lsGet<string>('cc_anonymousName', generateAnonName())
  );

  // ── Computed: ML-weighted cycle prediction ───────────────────────────────
  const predictedCycleLength = useMemo(
    () => predictCycleLength(cycleHistory),
    [cycleHistory]
  );

  // ── Side-effects: persist to localStorage ────────────────────────────────
  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => { lsSet('cc_mode', mode); }, [mode]);
  useEffect(() => { lsSet('cc_cycleLength', cycleLength); }, [cycleLength]);
  useEffect(() => { lsSet('cc_periodLength', periodLength); }, [periodLength]);
  useEffect(() => { lsSet('cc_lastPeriodStart', lastPeriodStart); }, [lastPeriodStart]);
  useEffect(() => { lsSet('cc_cycleHistory', cycleHistory); }, [cycleHistory]);
  useEffect(() => { lsSet('cc_symptoms', symptoms); }, [symptoms]);
  useEffect(() => { lsSet('cc_anonymousMode', anonymousMode); }, [anonymousMode]);
  useEffect(() => { lsSet('cc_anonymousName', anonymousName); }, [anonymousName]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const toggleMode = () => setMode(prev => prev === 'tracking' ? 'pregnancy' : 'tracking');
  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const toggleAnonymousMode = () => {
    setAnonymousMode(prev => {
      const next = !prev;
      // Generate a fresh name every time they toggle ON
      if (next) {
        const name = generateAnonName();
        setAnonymousName(name);
        lsSet('cc_anonymousName', name);
      }
      return next;
    });
  };

  const setCycleLength = (n: number) => setCycleLengthState(Math.max(21, Math.min(45, n)));
  const setPeriodLength = (n: number) => setPeriodLengthState(Math.max(1, Math.min(10, n)));
  const setLastPeriodStart = (date: string) => setLastPeriodStartState(date);

  const addCycleToHistory = (length: number) => {
    setCycleHistory(prev => {
      // Keep last 12 cycles (one year)
      const next = [...prev, length].slice(-12);
      return next;
    });
  };

  const logSymptom = (
    date: string,
    category: keyof Omit<SymptomLog, 'note'>,
    value: string
  ) => {
    setSymptoms(prev => {
      const current = prev[date] || { ...EMPTY_LOG };
      const currentCategory = current[category] as string[];
      if (currentCategory.includes(value)) return prev;
      return {
        ...prev,
        [date]: { ...current, [category]: [...currentCategory, value] },
      };
    });
  };

  const removeSymptom = (
    date: string,
    category: keyof Omit<SymptomLog, 'note'>,
    value: string
  ) => {
    setSymptoms(prev => {
      const current = prev[date];
      if (!current) return prev;
      return {
        ...prev,
        [date]: {
          ...current,
          [category]: (current[category] as string[]).filter(v => v !== value),
        },
      };
    });
  };

  const setNote = (date: string, note: string) => {
    setSymptoms(prev => {
      const current = prev[date] || { ...EMPTY_LOG };
      return { ...prev, [date]: { ...current, note } };
    });
  };

  return (
    <AppContext.Provider value={{
      mode,
      theme,
      cycleLength,
      periodLength,
      predictedCycleLength,
      cycleHistory,
      lastPeriodStart,
      pregnancyStartDate,
      symptoms,
      anonymousMode,
      anonymousName,
      toggleMode,
      toggleTheme,
      toggleAnonymousMode,
      setCycleLength,
      setPeriodLength,
      setLastPeriodStart,
      addCycleToHistory,
      logSymptom,
      removeSymptom,
      setNote,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
