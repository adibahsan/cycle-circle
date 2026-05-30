import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AppStore {
  // Language
  language: 'en' | 'bn'
  setLanguage: (lang: 'en' | 'bn') => void

  // Theme
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void

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
      setLanguage: (language) => set({ language }),

      theme: 'light',
      setTheme: (theme) => set({ theme }),

      activeProfileId: '',
      activeProfileName: '',
      setActiveProfile: (activeProfileId, name) => set({ activeProfileId, activeProfileName: name ?? '' }),

      onboardingComplete: false,
      setOnboardingComplete: (onboardingComplete) => set({ onboardingComplete }),
    }),
    {
      name: 'vesta-store',
    },
  ),
)
