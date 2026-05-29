import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AdminStore {
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
  sidebarCollapsed: boolean
  toggleSidebar: () => void
}

export const useAdminStore = create<AdminStore>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme }),
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
    }),
    { name: 'vesta-admin-store' }
  )
)
