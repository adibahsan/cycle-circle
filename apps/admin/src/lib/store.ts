import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { resolveTheme, systemPrefersDark } from '@vesta/shared/utils/theme'

interface AdminStore {
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
  /** True once the user picked a theme; until then the system preference applies and nothing is persisted. */
  themeChosen: boolean
  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

export const useAdminStore = create<AdminStore>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme, themeChosen: true }),
      themeChosen: false,
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    {
      name: 'vesta-admin-store',
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AdminStore>
        const chosen = p.theme === 'light' || p.theme === 'dark'
        return { ...current, ...p, theme: resolveTheme(p.theme, systemPrefersDark()), themeChosen: chosen }
      },
      partialize: (state) => ({
        theme: state.themeChosen ? state.theme : undefined,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
)
