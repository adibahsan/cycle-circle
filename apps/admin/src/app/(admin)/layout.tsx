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
  MessageSquare,
  MessageCircle,
  ScrollText,
  Mail,
  Sun,
  Moon,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from 'lucide-react'
import VestaLogo from '@/components/ui/VestaLogo'
import { useAdminStore } from '@/lib/store'

const NAV_ITEMS = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/users', icon: Users, label: 'Users' },
  { href: '/subscriptions', icon: CreditCard, label: 'Subscriptions' },
  { href: '/content', icon: FileText, label: 'Content' },
  { href: '/analytics', icon: BarChart3, label: 'Analytics' },
  { href: '/sms', icon: MessageSquare, label: 'SMS Broadcasts' },
  { href: '/feedback', icon: MessageCircle, label: 'Feedback' },
  { href: '/emails', icon: Mail, label: 'Emails' },
  { href: '/audit-logs', icon: ScrollText, label: 'Audit Logs' },
]

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

  const SidebarContent = () => (
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
            <h1 className="text-lg font-bold leading-tight" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Vesta Admin
            </h1>
          </div>
        )}
        {/* Collapse toggle — desktop only */}
        <button
          onClick={toggleSidebar}
          className="hidden md:flex p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500 group ${
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
          className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-bg-primary)] hover:border-[var(--color-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500 ${
            sidebarCollapsed ? 'w-10 h-10 justify-center px-0' : 'w-full'
          }`}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          {!sidebarCollapsed && (
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          )}
        </button>

        <button
          onClick={handleLogout}
          title={sidebarCollapsed ? 'Sign out' : undefined}
          aria-label={sidebarCollapsed ? 'Log out' : undefined}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/8 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500 ${
            sidebarCollapsed ? 'w-10 h-10 justify-center px-0' : 'w-full'
          }`}
        >
          <LogOut size={15} />
          {!sidebarCollapsed && <span>Sign out</span>}
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)] flex">
      {/* ── Desktop Sidebar ── */}
      <aside
        className={`hidden md:flex md:flex-col md:sticky md:top-0 md:h-screen md:shrink-0 glass border-r border-[var(--color-border)] z-40 transition-[width] duration-300 ${
          sidebarCollapsed ? 'md:w-16' : 'md:w-64'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* ── Mobile Sidebar Overlay ── */}
      {mobileMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 md:hidden w-full cursor-default"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation menu"
          tabIndex={-1}
        >
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
        </button>
      )}

      {/* Mobile Sidebar drawer */}
      <aside
        role="dialog"
        aria-label="Navigation menu"
        aria-modal="true"
        className={`fixed top-0 left-0 h-full w-72 z-50 flex flex-col glass border-r border-[var(--color-border)] md:hidden transition-transform duration-300 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <VestaLogo size={24} animate={false} />
            <span className="text-lg font-bold" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Vesta Admin
            </span>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const active = isActive(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500 ${
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
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-sm font-medium hover:bg-[var(--color-bg-primary)] hover:border-[var(--color-primary)] transition-colors w-full"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/8 transition-colors w-full"
          >
            <LogOut size={15} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Main content column ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top header */}
        <header className="sticky top-0 z-30 glass border-b border-[var(--color-border)] px-4 py-3 flex items-center justify-between md:hidden">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-xl text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500"
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>
            <div className="flex items-center gap-2">
              <VestaLogo size={22} animate={false} />
              <span className="text-base font-bold" style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-secondary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Vesta Admin
              </span>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-primary)] hover:border-[var(--color-primary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-rose-500"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </header>

        <main className="flex-1 p-6 md:p-8 page-enter">
          {children}
        </main>
      </div>
    </div>
  )
}
