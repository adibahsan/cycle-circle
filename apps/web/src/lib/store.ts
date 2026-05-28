import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Language, Theme, UserProfile, User, PeriodLog, SymptomLog, FeedbackSubmission, NotificationPreference } from '@vesta/shared/types';
import { DEMO_USER, DEMO_PROFILES, DEMO_PERIOD_LOGS, DEMO_NOTIFICATION_PREFS } from './dummy-data';
import { profiles as profilesApi, tracking, feedback as feedbackApi, auth as authApi } from '@/lib/api';
import { currentDataMode, useDummyData, type DataMode } from '@vesta/shared/utils/config';

interface AppStore {
  dataMode: DataMode;
  isHydrated: boolean;
  isHydrating: boolean;
  setHydrating: (v: boolean) => void;

  // Auth
  isAuthenticated: boolean;
  user: User | null;
  login: (method: 'otp' | 'email') => void;
  loginWithUser: (user: User, method: 'otp' | 'email') => void;
  logout: () => void;
  completeProfile: (name: string, phone: string) => void;

  // Profiles
  profiles: UserProfile[];
  activeProfileId: string;
  setActiveProfile: (id: string) => void;
  addProfile: (
    profile: Omit<UserProfile, 'id' | 'userId' | 'createdAt'> & { goal?: string },
  ) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;

  // Period tracking
  periodLogs: PeriodLog[];
  addPeriodLog: (log: Omit<PeriodLog, 'id'>) => Promise<void>;
  updatePeriodLog: (id: string, updates: Partial<PeriodLog>) => Promise<void>;

  // Symptoms
  symptomLogs: SymptomLog[];
  toggleSymptom: (profileId: string, date: string, category: string, symptomId: string) => Promise<void>;

  // Settings
  language: Language;
  theme: Theme;
  setLanguage: (lang: Language) => void;
  setTheme: (theme: Theme) => void;
  notificationPrefs: NotificationPreference;
  setNotificationPref: (key: keyof Omit<NotificationPreference, 'profileId'>, value: boolean) => void;

  // Feedback
  feedbackHistory: FeedbackSubmission[];
  submitFeedback: (feedback: Omit<FeedbackSubmission, 'id' | 'createdAt'>) => Promise<void>;

  // Onboarding
  onboardingComplete: boolean;
  setOnboardingComplete: (v: boolean) => void;
  showProfileCompletion: boolean;
  setShowProfileCompletion: (v: boolean) => void;

  resetStore: () => void;
}

function emptyState() {
  return {
    dataMode: currentDataMode(),
    isHydrated: useDummyData,
    isHydrating: false,
    isAuthenticated: false,
    user: null as User | null,
    profiles: useDummyData ? DEMO_PROFILES : ([] as UserProfile[]),
    activeProfileId: useDummyData ? 'profile-1' : '',
    periodLogs: useDummyData ? DEMO_PERIOD_LOGS : ([] as PeriodLog[]),
    symptomLogs: [] as SymptomLog[],
    language: 'en' as Language,
    theme: 'light' as Theme,
    notificationPrefs: DEMO_NOTIFICATION_PREFS,
    feedbackHistory: [] as FeedbackSubmission[],
    onboardingComplete: false,
    showProfileCompletion: false,
  };
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...emptyState(),
      setHydrating: (v) => set({ isHydrating: v }),

      login: (method) => {
        get().loginWithUser({ ...DEMO_USER, authMethod: method }, method);
        set({ onboardingComplete: true });
      },

      loginWithUser: (user, method) => {
        set({
          isAuthenticated: true,
          user: { ...user, authMethod: method },
          dataMode: currentDataMode(),
          isHydrated: useDummyData,
          showProfileCompletion: method === 'otp' && !user.profileCompleted,
        });
        if (method === 'otp' && !useDummyData) {
          setTimeout(() => set({ showProfileCompletion: true }), 60000);
        }
      },

      logout: () => {
        const wasDummy = useDummyData;
        set({
          ...emptyState(),
          isAuthenticated: false,
          user: null,
          dataMode: currentDataMode(),
          isHydrated: wasDummy,
        });
        if (!useDummyData) {
          authApi.logout().catch(console.error);
        }
      },

      completeProfile: (name, phone) => set((state) => ({
        user: state.user ? { ...state.user, fullName: name, phone, profileCompleted: true } : null,
        showProfileCompletion: false,
      })),

      setActiveProfile: (id) => set({ activeProfileId: id }),

      addProfile: async (profile) => {
        if (useDummyData) {
          set((state) => ({
            profiles: [...state.profiles, {
              ...profile,
              id: `profile-${Date.now()}`,
              userId: state.user?.id ?? 'user-1',
              createdAt: new Date().toISOString(),
            }],
          }));
          return;
        }

        const created = await profilesApi.create({
          name: profile.name,
          relation: profile.relation,
          cycleLength: profile.cycleLength,
          periodLength: profile.periodLength,
          lastPeriodStart: profile.lastPeriodStart,
          goal: profile.goal,
        });
        const detail = await profilesApi.get(created.id);
        const { prediction: _prediction, ...profileRow } = detail;
        set((state) => ({
          profiles: [...state.profiles, profileRow],
          activeProfileId: state.activeProfileId || profileRow.id,
        }));
      },

      deleteProfile: async (id) => {
        if (useDummyData) {
          set((state) => ({
            profiles: state.profiles.filter(p => p.id !== id),
            activeProfileId: state.activeProfileId === id ? state.profiles[0]?.id ?? '' : state.activeProfileId,
          }));
          return;
        }

        await profilesApi.delete(id);
        set((state) => ({
          profiles: state.profiles.filter(p => p.id !== id),
          activeProfileId: state.activeProfileId === id ? state.profiles[0]?.id ?? '' : state.activeProfileId,
        }));
      },

      addPeriodLog: async (log) => {
        if (useDummyData) {
          set((state) => ({
            periodLogs: [...state.periodLogs, { ...log, id: `pl-${Date.now()}` }],
          }));
          return;
        }

        const created = await tracking.createPeriodLog({
          profileId: log.profileId,
          startDate: log.startDate,
          endDate: log.endDate,
          flowIntensity: log.flowIntensity,
        });
        set((state) => ({
          periodLogs: [...state.periodLogs, created],
        }));
      },

      updatePeriodLog: async (id, updates) => {
        if (useDummyData) {
          set((state) => ({
            periodLogs: state.periodLogs.map(l => l.id === id ? { ...l, ...updates } : l),
          }));
          return;
        }

        const updated = await tracking.updatePeriodLog(id, {
          startDate: updates.startDate,
          endDate: updates.endDate,
          flowIntensity: updates.flowIntensity,
        });
        set((state) => ({
          periodLogs: state.periodLogs.map(l => l.id === id ? updated : l),
        }));
      },

      toggleSymptom: async (profileId, date, category, symptomId) => {
        const isAdding = !get().symptomLogs.find(
          s => s.profileId === profileId && s.date === date && s.symptomId === symptomId
        );

        set((state) => {
          const existing = state.symptomLogs.find(
            s => s.profileId === profileId && s.date === date && s.symptomId === symptomId
          );
          if (existing) {
            return { symptomLogs: state.symptomLogs.filter(s => s.id !== existing.id) };
          }
          return {
            symptomLogs: [...state.symptomLogs, {
              id: `sym-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              profileId,
              date,
              category: category as SymptomLog['category'],
              symptomId,
              value: symptomId,
            }],
          };
        });

        if (!useDummyData && isAdding) {
          const created = await tracking.createSymptom({
            profileId,
            date,
            category: category as import('@vesta/shared/types').SymptomCategory,
            symptomId,
            value: symptomId,
          });
          set((state) => ({
            symptomLogs: state.symptomLogs.map(s =>
              s.profileId === profileId && s.date === date && s.symptomId === symptomId && s.id.startsWith('sym-')
                ? created
                : s
            ),
          }));
        }
      },

      setLanguage: (lang) => set({ language: lang }),
      setTheme: (theme) => set({ theme }),

      setNotificationPref: (key, value) => set((state) => ({
        notificationPrefs: { ...state.notificationPrefs, [key]: value },
      })),

      submitFeedback: async (feedback) => {
        if (useDummyData) {
          set((state) => ({
            feedbackHistory: [...state.feedbackHistory, {
              ...feedback,
              id: `fb-${Date.now()}`,
              createdAt: new Date().toISOString(),
            }],
          }));
          return;
        }

        const submitted = await feedbackApi.submit({
          userId: feedback.userId,
          profileId: feedback.profileId,
          category: feedback.category,
          message: feedback.message,
          rating: feedback.rating,
        });
        set((state) => ({
          feedbackHistory: [...state.feedbackHistory, submitted],
        }));
      },

      setOnboardingComplete: (v) => set({ onboardingComplete: v }),
      setShowProfileCompletion: (v) => set({ showProfileCompletion: v }),

      resetStore: () => set(emptyState()),
    }),
    {
      name: 'vesta-store',
      partialize: (state) => ({
        dataMode: state.dataMode,
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        profiles: state.profiles,
        activeProfileId: state.activeProfileId,
        periodLogs: state.periodLogs,
        symptomLogs: state.symptomLogs,
        language: state.language,
        theme: state.theme,
        notificationPrefs: state.notificationPrefs,
        feedbackHistory: state.feedbackHistory,
        onboardingComplete: state.onboardingComplete,
        isHydrated: state.isHydrated,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const expected = currentDataMode();
        if (state.dataMode !== expected) {
          useAppStore.getState().resetStore();
        }
      },
    }
  )
);
