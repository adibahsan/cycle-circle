import React, { createContext, useContext, useState, useEffect } from 'react';
import { addDays, differenceInDays, startOfDay } from 'date-fns';

type Mode = 'tracking' | 'pregnancy';
type Theme = 'light' | 'dark';

interface SymptomLog {
  mood: string[];
  pain: string[];
  discharge: string[];
  lifestyle: string[];
  note: string;
}

interface AppState {
  mode: Mode;
  theme: Theme;
  cycleLength: number;
  periodLength: number;
  lastPeriodStart: string; // ISO date string
  pregnancyStartDate: string | null; // ISO date string
  symptoms: Record<string, SymptomLog>; // key: YYYY-MM-DD
  toggleMode: () => void;
  toggleTheme: () => void;
  logSymptom: (date: string, category: keyof SymptomLog, value: string) => void;
  removeSymptom: (date: string, category: keyof SymptomLog, value: string) => void;
  setNote: (date: string, note: string) => void;
}

const defaultState: AppState = {
  mode: 'tracking',
  theme: 'light',
  cycleLength: 28,
  periodLength: 5,
  lastPeriodStart: startOfDay(new Date()).toISOString(),
  pregnancyStartDate: null,
  symptoms: {},
  toggleMode: () => {},
  toggleTheme: () => {},
  logSymptom: () => {},
  removeSymptom: () => {},
  setNote: () => {},
};

const AppContext = createContext<AppState>(defaultState);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<Mode>('tracking');
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  
  const [cycleLength, setCycleLength] = useState(28);
  const [periodLength, setPeriodLength] = useState(5);
  
  // Set default last period start to 14 days ago for demo purposes
  const [lastPeriodStart, setLastPeriodStart] = useState(
    startOfDay(addDays(new Date(), -14)).toISOString()
  );
  
  // Set default pregnancy start to 22 weeks ago for demo purposes
  const [pregnancyStartDate, setPregnancyStartDate] = useState<string | null>(
    startOfDay(addDays(new Date(), -22 * 7)).toISOString()
  );
  
  const [symptoms, setSymptoms] = useState<Record<string, SymptomLog>>({});

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleMode = () => {
    setMode(prev => prev === 'tracking' ? 'pregnancy' : 'tracking');
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const logSymptom = (date: string, category: keyof SymptomLog, value: string) => {
    setSymptoms(prev => {
      const currentLog = prev[date] || { mood: [], pain: [], discharge: [], lifestyle: [], note: '' };
      if (category === 'note') return prev; // handled separately
      
      const currentCategory = currentLog[category] as string[];
      if (!currentCategory.includes(value)) {
        return {
          ...prev,
          [date]: {
            ...currentLog,
            [category]: [...currentCategory, value]
          }
        };
      }
      return prev;
    });
  };

  const removeSymptom = (date: string, category: keyof SymptomLog, value: string) => {
    setSymptoms(prev => {
      const currentLog = prev[date];
      if (!currentLog || category === 'note') return prev;
      
      return {
        ...prev,
        [date]: {
          ...currentLog,
          [category]: (currentLog[category] as string[]).filter(v => v !== value)
        }
      };
    });
  };

  const setNote = (date: string, note: string) => {
    setSymptoms(prev => {
      const currentLog = prev[date] || { mood: [], pain: [], discharge: [], lifestyle: [], note: '' };
      return {
        ...prev,
        [date]: {
          ...currentLog,
          note
        }
      };
    });
  };

  return (
    <AppContext.Provider value={{
      mode,
      theme,
      cycleLength,
      periodLength,
      lastPeriodStart,
      pregnancyStartDate,
      symptoms,
      toggleMode,
      toggleTheme,
      logSymptom,
      removeSymptom,
      setNote
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => useContext(AppContext);
