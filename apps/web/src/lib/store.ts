import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import i18n from '@vesta/shared/utils/i18n'
import { resolveTheme, systemPrefersDark } from '@vesta/shared/utils/theme'

interface AppStore {
  // Language
  language: 'en' | 'bn'
  setLanguage: (lang: 'en' | 'bn') => void

  // Theme
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
  /** True once the user picked a theme; until then the system preference applies and nothing is persisted. */
  themeChosen: boolean

  // Active profile selection (UI state only)
  activeProfileId: string
  activeProfileName: string
  setActiveProfile: (id: string, name?: string) => void

  // Onboarding
  onboardingComplete: boolean
  setOnboardingComplete: (v: boolean) => void

  // Tour sequencing (NOT persisted — resets to 'pending' on every reload)
  tourState: 'pending' | 'active' | 'done'
  setTourState: (s: 'pending' | 'active' | 'done') => void
}

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      language: 'en',
      setLanguage: (language) => {
        i18n.changeLanguage(language)
        set({ language })
      },

      theme: 'light',
      setTheme: (theme) => set({ theme, themeChosen: true }),
      themeChosen: false,

      activeProfileId: '',
      activeProfileName: '',
      setActiveProfile: (activeProfileId, name) => set({ activeProfileId, activeProfileName: name ?? '' }),

      onboardingComplete: false,
      setOnboardingComplete: (onboardingComplete) => set({ onboardingComplete }),

      tourState: 'pending',
      setTourState: (tourState) => set({ tourState }),
    }),
    {
      name: 'vesta-store',
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppStore>
        const chosen = p.theme === 'light' || p.theme === 'dark'
        return { ...current, ...p, theme: resolveTheme(p.theme, systemPrefersDark()), themeChosen: chosen }
      },
      onRehydrateStorage: () => (state) => {
        if (state?.language) i18n.changeLanguage(state.language)
      },
      partialize: (state) => ({
        language: state.language,
        theme: state.themeChosen ? state.theme : undefined,
        activeProfileId: state.activeProfileId,
        activeProfileName: state.activeProfileName,
        onboardingComplete: state.onboardingComplete,
        // tourState is intentionally excluded — it must reset to 'pending' each session
      }),
    },
  ),
)
