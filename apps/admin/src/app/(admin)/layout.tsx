'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  CreditCard,
  FileText,
  BarChart3,
  Activity,
  MessageSquare,
  MessageCircle,
  ScrollText,
  Mail,
  ServerCog,
  Terminal,
  BookOpen,
  Sun,
  Moon,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
} from 'lucide-react'
import VestaLogo from '@/components/ui/VestaLogo'
import { Drawer } from '@/components/ui/Drawer'
import { useAdminStore } from '@/lib/store'

const NAV_ITEMS = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/users', icon: Users, label: 'Users' },
  { href: '/subscriptions', icon: CreditCard, label: 'Subscriptions' },
  { href: '/content', icon: FileText, label: 'Content' },
  { href: '/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/engagement', icon: Activity, label: 'Engagement' },
  { href: '/sms', icon: MessageSquare, label: 'SMS Campaigns' },
  { href: '/feedback', icon: MessageCircle, label: 'Feedback' },
  { href: '/emails', icon: Mail, label: 'Emails' },
  { href: '/audit-logs', icon: ScrollText, label: 'Audit Logs' },
  { href: '/logs', icon: Terminal, label: 'Logs' },
  { href: '/system', icon: ServerCog, label: 'System' },
  { href: '/api-docs', icon: BookOpen, label: 'API Docs' },
]

interface SidebarContentProps {
  pathname: string
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  theme: string
  toggleTheme: () => void
  handleLogout: () => Promise<void>
  setMobileMenuOpen: (open: boolean) => void
}

function SidebarContent({
  pathname,
  sidebarCollapsed,
  toggleSidebar,
  theme,
  toggleTheme,
  handleLogout,
  setMobileMenuOpen,
}: SidebarContentProps) {
  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Sidebar header */}
      <div
        className={`flex items-center gap-3 px-4 py-5 border-b border-[var(--color-border)] ${
          sidebarCollapsed ? 'justify-center px-3' : ''
        }`}
      >
        <VestaLogo size={28} animate={false} />
        {!sidebarCollapsed && (
          <div className="flex-1 min-w-0">
            <h1 className="text-lg leading-tight font-extrabold text-[var(--color-text-primary)]">
              Cycle Circle Admin
            </h1>
          </div>
        )}
        {/* Collapse toggle — desktop only */}
        <button
          onClick={toggleSidebar}
          className="hidden md:flex p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)]"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <PanelLeftOpen aria-hidden="true" size={16} /> : <PanelLeftClose aria-hidden="true" size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto" aria-label="Admin navigation">
        {!sidebarCollapsed && (
          <p className="px-3 mb-2 text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
            Navigation
          </p>
        )}
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMobileMenuOpen(false)}
              title={sidebarCollapsed ? label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)] group ${
                sidebarCollapsed ? 'justify-center' : ''
              } ${
                active
                  ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
              }`}
            >
              <Icon
                size={18}
                strokeWidth={active ? 2.5 : 1.5}
                className="shrink-0"
              />
              {!sidebarCollapsed && (
                <span className="text-sm font-semibold truncate">{label}</span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Sidebar footer */}
      <div
        className={`px-2 py-3 border-t border-[var(--color-border)] space-y-1 ${
          sidebarCollapsed ? 'flex flex-col items-center' : ''
        }`}
      >
        <button
          onClick={toggleTheme}
          title={sidebarCollapsed ? (theme === 'dark' ? 'Light mode' : 'Dark mode') : undefined}
          aria-label={sidebarCollapsed ? (theme === 'dark' ? 'Light mode' : 'Dark mode') : undefined}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-bg-primary)] hover:border-[var(--color-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)] ${
            sidebarCollapsed ? 'w-10 h-10 justify-center px-0' : 'w-full'
          }`}
        >
          {theme === 'dark' ? <Sun aria-hidden="true" size={15} /> : <Moon aria-hidden="true" size={15} />}
          {!sidebarCollapsed && (
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          )}
        </button>

        <button
          onClick={handleLogout}
          title={sidebarCollapsed ? 'Sign out' : undefined}
          aria-label={sidebarCollapsed ? 'Log out' : undefined}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/8 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)] ${
            sidebarCollapsed ? 'w-10 h-10 justify-center px-0' : 'w-full'
          }`}
        >
          <LogOut aria-hidden="true" size={15} />
          {!sidebarCollapsed && <span>Sign out</span>}
        </button>
      </div>
    </>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme, sidebarCollapsed, toggleSidebar } = useAdminStore()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  function isActive(href: string) {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex">
      <a
        href="#main-content"
        className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-4 focus-visible:z-[100] focus-visible:rounded-xl focus-visible:bg-[var(--color-action)] focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-semibold focus-visible:text-[var(--color-on-action)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)]"
      >
        Skip to main content
      </a>
      {/* ── Desktop Sidebar ── */}
      <aside
        className={`hidden md:flex md:flex-col md:sticky md:top-0 md:h-screen md:shrink-0 glass border-r border-[var(--color-border)] z-40 transition-[width] duration-300 ${
          sidebarCollapsed ? 'md:w-16' : 'md:w-64'
        }`}
      >
        <SidebarContent
          pathname={pathname}
          sidebarCollapsed={sidebarCollapsed}
          toggleSidebar={toggleSidebar}
          theme={theme}
          toggleTheme={toggleTheme}
          handleLogout={handleLogout}
          setMobileMenuOpen={setMobileMenuOpen}
        />
      </aside>

      {/* Mobile Sidebar drawer (shell: ESC, focus trap, inert background, scroll lock) */}
      <Drawer
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        label="Navigation menu"
        title={
          <div className="flex items-center gap-3">
            <VestaLogo size={24} animate={false} />
            <span className="text-lg font-extrabold text-[var(--color-text-primary)]">
              Cycle Circle Admin
            </span>
          </div>
        }
      >
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)] ${
                  active
                    ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)]'
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 1.5} className="shrink-0" />
                <span className="text-sm font-semibold">{label}</span>
              </Link>
            )
          })}
        </nav>
        <div className="px-2 py-3 border-t border-[var(--color-border)] space-y-1">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-bg-primary)] hover:border-[var(--color-primary)] transition-colors w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)]"
          >
            {theme === 'dark' ? <Sun aria-hidden="true" size={15} /> : <Moon aria-hidden="true" size={15} />}
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/8 transition-colors w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)]"
          >
            <LogOut aria-hidden="true" size={15} />
            <span>Sign out</span>
          </button>
        </div>
      </Drawer>

      {/* ── Main content column ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top header */}
        <header className="sticky top-0 z-30 glass border-b border-[var(--color-border)] px-4 py-3 flex items-center justify-between md:hidden">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)]"
              aria-label="Open menu"
            >
              <Menu aria-hidden="true" size={18} />
            </button>
            <div className="flex items-center gap-2">
              <VestaLogo size={22} animate={false} />
              <span className="text-base font-extrabold text-[var(--color-text-primary)]">
                Cycle Circle Admin
              </span>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-primary)] hover:border-[var(--color-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)]"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun aria-hidden="true" size={16} /> : <Moon aria-hidden="true" size={16} />}
          </button>
        </header>

        <main id="main-content" tabIndex={-1} className="flex-1 flex flex-col p-4 sm:p-6 md:p-8 page-enter focus:outline-none">
          {children}
        </main>
      </div>
    </div>
  )
}
