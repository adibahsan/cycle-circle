import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { chooseTheme, restoreTheme, type Theme } from '@vesta/shared/utils/theme'

interface AdminStore {
  theme: Theme
  setTheme: (theme: Theme) => void
  /** True once the user picked a theme; until then the system preference applies and nothing is persisted. */
  themeChosen: boolean
  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

export const useAdminStore = create<AdminStore>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => set(chooseTheme(theme)),
      themeChosen: false,
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    {
      name: 'vesta-admin-store',
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AdminStore>
        return { ...current, ...p, ...restoreTheme(p.theme) }
      },
      partialize: (state) => ({
        theme: state.themeChosen ? state.theme : undefined,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
)
