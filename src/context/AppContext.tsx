import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { addDays, differenceInDays, startOfDay } from 'date-fns';
import { DEMO_PROFILES, UserProfile, seedUserData } from '../data/profiles';

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
  flow: [], mood: [], pain: [], discharge: [], lifestyle: [], sexualActivity: [], note: '',
};

// ─── Anonymous name pool ──────────────────────────────────────────────────────
const ANON_ADJ = ['Silent', 'Hidden', 'Quiet', 'Gentle', 'Soft', 'Calm', 'Brave', 'Wise', 'Kind', 'Bold', 'Swift', 'Warm', 'Bright', 'Clear', 'Free'];
const ANON_NOUN = ['Orchid', 'Lily', 'Rose', 'Willow', 'Fern', 'Dawn', 'Moon', 'Star', 'River', 'Cloud', 'Sage', 'Wren', 'Lark', 'Bloom', 'Pearl'];
const genAnonName = () =>
  `${ANON_ADJ[Math.floor(Math.random() * ANON_ADJ.length)]} ${ANON_NOUN[Math.floor(Math.random() * ANON_NOUN.length)]}`;

// ─── ML: exponentially-weighted rolling average ───────────────────────────────
function predictCycleLength(history: number[]): number {
  if (history.length === 0) return 28;
  if (history.length === 1) return history[0];
  const weights = history.map((_, i) => i + 1);
  const totalW = weights.reduce((s, w) => s + w, 0);
  const weightedS = history.reduce((s, v, i) => s + v * weights[i], 0);
  return Math.round(weightedS / totalW);
}

// ─── localStorage helpers ─────────────────────────────────────────────────────
// Global (not user-scoped)
function gLsGet<T>(key: string, fallback: T): T {
  try { const r = localStorage.getItem(key); return r === null ? fallback : JSON.parse(r) as T; }
  catch { return fallback; }
}
function gLsSet<T>(key: string, v: T) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* full */ }
}

// User-scoped
function uLsGet<T>(userId: string, key: string, fallback: T): T {
  return gLsGet<T>(`cc_${userId}_${key}`, fallback);
}
function uLsSet<T>(userId: string, key: string, v: T) {
  gLsSet(`cc_${userId}_${key}`, v);
}

// ─── Default demo dates ───────────────────────────────────────────────────────
const DEFAULT_LAST_PERIOD = startOfDay(addDays(new Date(), -14)).toISOString();
const DEFAULT_PREG_START = startOfDay(addDays(new Date(), -154)).toISOString();
const DEFAULT_CYCLE_HISTORY = [27, 29, 28, 30, 27, 28];

// ─── Context shape ────────────────────────────────────────────────────────────
interface AppState {
  // Auth
  currentUserId: string | null;
  currentProfile: UserProfile | null;
  login: (userId: string) => void;
  logout: () => void;

  // App state
  mode: Mode;
  theme: Theme;
  cycleLength: number;
  periodLength: number;
  predictedCycleLength: number;
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
  setLastPeriodStart: (d: string) => void;
  addCycleToHistory: (length: number) => void;
  logSymptom: (date: string, cat: keyof Omit<SymptomLog, 'note'>, value: string) => void;
  removeSymptom: (date: string, cat: keyof Omit<SymptomLog, 'note'>, value: string) => void;
  setNote: (date: string, note: string) => void;
}

const AppContext = createContext<AppState>({} as AppState);

// ─── Provider ─────────────────────────────────────────────────────────────────
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const [currentUserId] = useState<string | null>(() =>
    gLsGet<string | null>('cc_activeUser', null)
  );

  const currentProfile = useMemo(
    () => DEMO_PROFILES.find(p => p.id === currentUserId) ?? null,
    [currentUserId]
  );

  const login = (userId: string) => {
    // Seed demo data if this is the first time logging in as this user
    const demoProfile = DEMO_PROFILES.find(p => p.id === userId);
    if (demoProfile) seedUserData(demoProfile);
    gLsSet('cc_activeUser', userId);
    window.location.href = '/';
  };

  const logout = () => {
    localStorage.removeItem('cc_activeUser');
    window.location.href = '/login';
  };

  // ── Per-user init helpers ──────────────────────────────────────────────────
  const uid = currentUserId ?? '__guest__';
  const uGet = <T,>(key: string, fallback: T) => uLsGet<T>(uid, key, fallback);
  const uSet = <T,>(key: string, v: T) => uLsSet<T>(uid, key, v);

  // ── Theme (global, not user-scoped) ───────────────────────────────────────
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = gLsGet<Theme>('theme', 'system' as any);
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // ── User-scoped state (lazy init from localStorage) ────────────────────────
  const [mode, setMode] = useState<Mode>(() => uGet<Mode>('mode', currentProfile?.mode ?? 'tracking'));

  const [cycleLength, setCycleLengthState] = useState<number>(() =>
    uGet<number>('cycleLength', currentProfile?.cycleLength ?? 28)
  );
  const [periodLength, setPeriodLengthState] = useState<number>(() =>
    uGet<number>('periodLength', currentProfile?.periodLength ?? 5)
  );
  const [lastPeriodStart, setLastPeriodStartState] = useState<string>(() =>
    uGet<string>('lastPeriodStart', currentProfile?.lastPeriodStart ?? DEFAULT_LAST_PERIOD)
  );
  const [pregnancyStartDate] = useState<string | null>(
    currentProfile?.pregnancyStartDate ?? DEFAULT_PREG_START
  );
  const [cycleHistory, setCycleHistoryState] = useState<number[]>(() =>
    uGet<number[]>('cycleHistory', currentProfile?.cycleHistory ?? DEFAULT_CYCLE_HISTORY)
  );
  const [symptoms, setSymptoms] = useState<Record<string, SymptomLog>>(() =>
    uGet<Record<string, SymptomLog>>('symptoms', {})
  );
  const [anonymousMode, setAnonymousMode] = useState<boolean>(() =>
    uGet<boolean>('anonymousMode', false)
  );
  const [anonymousName, setAnonymousName] = useState<string>(() =>
    uGet<string>('anonymousName', genAnonName())
  );

  // ── ML prediction ──────────────────────────────────────────────────────────
  const predictedCycleLength = useMemo(() => predictCycleLength(cycleHistory), [cycleHistory]);

  // ── Theme side-effect (global) ─────────────────────────────────────────────
  useEffect(() => {
    gLsSet('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // ── User-scoped persistence ────────────────────────────────────────────────
  useEffect(() => { uSet('mode', mode); }, [mode]);
  useEffect(() => { uSet('cycleLength', cycleLength); }, [cycleLength]);
  useEffect(() => { uSet('periodLength', periodLength); }, [periodLength]);
  useEffect(() => { uSet('lastPeriodStart', lastPeriodStart); }, [lastPeriodStart]);
  useEffect(() => { uSet('cycleHistory', cycleHistory); }, [cycleHistory]);
  useEffect(() => { uSet('symptoms', symptoms); }, [symptoms]);
  useEffect(() => { uSet('anonymousMode', anonymousMode); }, [anonymousMode]);
  useEffect(() => { uSet('anonymousName', anonymousName); }, [anonymousName]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const toggleMode = () => setMode(p => p === 'tracking' ? 'pregnancy' : 'tracking');
  const toggleTheme = () => setTheme(p => p === 'light' ? 'dark' : 'light');

  const toggleAnonymousMode = () => {
    setAnonymousMode(prev => {
      if (!prev) {
        const name = genAnonName();
        setAnonymousName(name);
        uSet('anonymousName', name);
      }
      return !prev;
    });
  };

  const setCycleLength = (n: number) => setCycleLengthState(Math.max(21, Math.min(45, n)));
  const setPeriodLength = (n: number) => setPeriodLengthState(Math.max(1, Math.min(10, n)));
  const setLastPeriodStart = (d: string) => setLastPeriodStartState(d);

  const addCycleToHistory = (len: number) =>
    setCycleHistoryState(prev => [...prev, len].slice(-12));

  const logSymptom = (date: string, cat: keyof Omit<SymptomLog, 'note'>, value: string) => {
    setSymptoms(prev => {
      const cur = prev[date] || { ...EMPTY_LOG };
      if ((cur[cat] as string[]).includes(value)) return prev;
      return { ...prev, [date]: { ...cur, [cat]: [...(cur[cat] as string[]), value] } };
    });
  };

  const removeSymptom = (date: string, cat: keyof Omit<SymptomLog, 'note'>, value: string) => {
    setSymptoms(prev => {
      const cur = prev[date];
      if (!cur) return prev;
      return { ...prev, [date]: { ...cur, [cat]: (cur[cat] as string[]).filter(v => v !== value) } };
    });
  };

  const setNote = (date: string, note: string) => {
    setSymptoms(prev => {
      const cur = prev[date] || { ...EMPTY_LOG };
      return { ...prev, [date]: { ...cur, note } };
    });
  };

  return (
    <AppContext.Provider value={{
      currentUserId, currentProfile, login, logout,
      mode, theme, cycleLength, periodLength, predictedCycleLength,
      cycleHistory, lastPeriodStart, pregnancyStartDate,
      symptoms, anonymousMode, anonymousName,
      toggleMode, toggleTheme, toggleAnonymousMode,
      setCycleLength, setPeriodLength, setLastPeriodStart, addCycleToHistory,
      logSymptom, removeSymptom, setNote,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
