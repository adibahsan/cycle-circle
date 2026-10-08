import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import i18n from '@vesta/shared/utils/i18n'
import { chooseTheme, restoreTheme, type Theme } from '@vesta/shared/utils/theme'

interface AppStore {
  // Language
  language: 'en' | 'bn'
  setLanguage: (lang: 'en' | 'bn') => void

  // Theme
  theme: Theme
  setTheme: (theme: Theme) => void
  /** True once the user picked a theme; until then the system preference applies and nothing is persisted. */
  themeChosen: boolean

  // Active profile selection (UI state only)
  activeProfileId: string
  activeProfileName: string
  setActiveProfile: (id: string, name?: string) => void

  // Onboarding
  onboardingComplete: boolean
  setOnboardingComplete: (v: boolean) => void
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
      setTheme: (theme) => set(chooseTheme(theme)),
      themeChosen: false,

      activeProfileId: '',
      activeProfileName: '',
      setActiveProfile: (activeProfileId, name) => set({ activeProfileId, activeProfileName: name ?? '' }),

      onboardingComplete: false,
      setOnboardingComplete: (onboardingComplete) => set({ onboardingComplete }),
    }),
    {
      name: 'vesta-store',
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppStore>
        return { ...current, ...p, ...restoreTheme(p.theme) }
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
      }),
    },
  ),
)
