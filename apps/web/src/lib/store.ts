import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Language, Theme, UserProfile, User, PeriodLog, SymptomLog, FeedbackSubmission, NotificationPreference } from './types';
import { DEMO_USER, DEMO_PROFILES, DEMO_PERIOD_LOGS, DEMO_PREDICTION, DEMO_NOTIFICATION_PREFS } from './dummy-data';
import { profiles as profilesApi, tracking, feedback as feedbackApi, auth as authApi } from '@/lib/api';

interface AppStore {
  // Auth
  isAuthenticated: boolean;
  user: User | null;
  login: (method: 'otp' | 'email') => void;
  logout: () => void;
  completeProfile: (name: string, phone: string) => void;

  // Profiles
  profiles: UserProfile[];
  activeProfileId: string;
  setActiveProfile: (id: string) => void;
  addProfile: (profile: Omit<UserProfile, 'id' | 'userId' | 'createdAt'>) => void;
  deleteProfile: (id: string) => void;

  // Period tracking
  periodLogs: PeriodLog[];
  addPeriodLog: (log: Omit<PeriodLog, 'id'>) => void;
  updatePeriodLog: (id: string, updates: Partial<PeriodLog>) => void;

  // Symptoms
  symptomLogs: SymptomLog[];
  toggleSymptom: (profileId: string, date: string, category: string, symptomId: string) => void;

  // Settings
  language: Language;
  theme: Theme;
  setLanguage: (lang: Language) => void;
  setTheme: (theme: Theme) => void;
  notificationPrefs: NotificationPreference;
  setNotificationPref: (key: keyof Omit<NotificationPreference, 'profileId'>, value: boolean) => void;

  // Feedback
  feedbackHistory: FeedbackSubmission[];
  submitFeedback: (feedback: Omit<FeedbackSubmission, 'id' | 'createdAt'>) => void;

  // Onboarding
  onboardingComplete: boolean;
  setOnboardingComplete: (v: boolean) => void;
  showProfileCompletion: boolean;
  setShowProfileCompletion: (v: boolean) => void;
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Auth
      isAuthenticated: false,
      user: null,
      login: (method) => {
        set({
          isAuthenticated: true,
          user: { ...DEMO_USER, authMethod: method },
          showProfileCompletion: method === 'otp',
        });
        if (method === 'otp') {
          setTimeout(() => set({ showProfileCompletion: true }), 60000);
        }
      },
      logout: () => {
        set({ isAuthenticated: false, user: null });
        authApi.logout().catch(console.error);
      },
      completeProfile: (name, phone) => set((state) => ({
        user: state.user ? { ...state.user, fullName: name, phone, profileCompleted: true } : null,
        showProfileCompletion: false,
      })),

      // Profiles
      profiles: DEMO_PROFILES,
      activeProfileId: 'profile-1',
      setActiveProfile: (id) => set({ activeProfileId: id }),
      addProfile: (profile) => {
        set((state) => ({
          profiles: [...state.profiles, {
            ...profile,
            id: `profile-${Date.now()}`,
            userId: 'user-1',
            createdAt: new Date().toISOString(),
          }],
        }));
        profilesApi.create({
          name: profile.name,
          relation: profile.relation,
          cycleLength: profile.cycleLength,
          periodLength: profile.periodLength,
          lastPeriodStart: profile.lastPeriodStart,
        }).catch(console.error);
      },
      deleteProfile: (id) => {
        set((state) => ({
          profiles: state.profiles.filter(p => p.id !== id),
          activeProfileId: state.activeProfileId === id ? state.profiles[0]?.id ?? '' : state.activeProfileId,
        }));
        profilesApi.delete(id).catch(console.error);
      },

      // Period tracking
      periodLogs: DEMO_PERIOD_LOGS,
      addPeriodLog: (log) => {
        set((state) => ({
          periodLogs: [...state.periodLogs, { ...log, id: `pl-${Date.now()}` }],
        }));
        tracking.createPeriodLog({
          profileId: log.profileId,
          startDate: log.startDate,
          endDate: log.endDate,
          flowIntensity: log.flowIntensity,
        }).catch(console.error);
      },
      updatePeriodLog: (id, updates) => {
        set((state) => ({
          periodLogs: state.periodLogs.map(l => l.id === id ? { ...l, ...updates } : l),
        }));
        tracking.updatePeriodLog(id, {
          startDate: updates.startDate,
          endDate: updates.endDate,
          flowIntensity: updates.flowIntensity,
        }).catch(console.error);
      },

      // Symptoms
      symptomLogs: [],
      toggleSymptom: (profileId, date, category, symptomId) => {
        // Check before toggling to determine if this is an add or remove
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
              category: category as any,
              symptomId,
              value: symptomId,
            }],
          };
        });
        // Fire-and-forget: createSymptom for additions (deletions not yet supported by API)
        if (isAdding) {
          tracking.createSymptom({
            profileId,
            date,
            category: category as import('./types').SymptomCategory,
            symptomId,
            value: symptomId,
          }).catch(console.error);
        }
      },

      // Settings
      language: 'en',
      theme: 'light',
      setLanguage: (lang) => set({ language: lang }),
      setTheme: (theme) => set({ theme }),
      notificationPrefs: DEMO_NOTIFICATION_PREFS,
      setNotificationPref: (key, value) => set((state) => ({
        notificationPrefs: { ...state.notificationPrefs, [key]: value },
      })),

      // Feedback
      feedbackHistory: [],
      submitFeedback: (feedback) => {
        set((state) => ({
          feedbackHistory: [...state.feedbackHistory, {
            ...feedback,
            id: `fb-${Date.now()}`,
            createdAt: new Date().toISOString(),
          }],
        }));
        feedbackApi.submit({
          userId: feedback.userId,
          profileId: feedback.profileId,
          category: feedback.category,
          message: feedback.message,
          rating: feedback.rating,
        }).catch(console.error);
      },

      // Onboarding
      onboardingComplete: false,
      setOnboardingComplete: (v) => set({ onboardingComplete: v }),
      showProfileCompletion: false,
      setShowProfileCompletion: (v) => set({ showProfileCompletion: v }),
    }),
    {
      name: 'vesta-store',
      partialize: (state) => ({
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
      }),
    }
  )
);
