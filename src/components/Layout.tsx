import React, { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { clsx } from 'clsx';

export const Layout: React.FC = () => {
  const { mode, toggleMode, theme, toggleTheme, currentProfile, logout } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isPregnancy = mode === 'pregnancy';

  const navItems = isPregnancy ? [
    { path: '/', label: 'Overview', icon: 'dashboard' },
    { path: '/log', label: 'Health Logs', icon: 'medical_services' },
    { path: '/chats', label: 'Community', icon: 'groups' },
    { path: '/calendar', label: 'Calendar', icon: 'calendar_month' },
  ] : [
    { path: '/', label: 'Dashboard', icon: 'home' },
    { path: '/log', label: 'Log Symptoms', icon: 'add' },
    { path: '/calendar', label: 'Calendar', icon: 'calendar_month' },
    { path: '/chats', label: 'Community', icon: 'groups' },
  ];

  return (
    <div className={clsx(
      "min-h-screen font-display text-slate-900 dark:text-slate-100 transition-colors duration-300",
      isPregnancy ? "bg-[#FFFEF2] dark:bg-background-dark" : "bg-background-light dark:bg-background-dark"
    )}>
      <header className={clsx(
        "sticky top-0 z-50 w-full backdrop-blur-md border-b transition-colors duration-300",
        isPregnancy
          ? "bg-[#FFFEF2]/80 dark:bg-background-dark/80 border-warm-accent/30"
          : "bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800"
      )}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
              <div className={clsx(
                "p-2 rounded-full flex items-center justify-center text-white",
                isPregnancy ? "bg-pregnancy-gold" : "bg-primary"
              )}>
                <span className="material-symbols-outlined">{isPregnancy ? 'child_care' : 'track_changes'}</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight">
                {isPregnancy ? 'Bloom Health' : 'Cycle Circle'}
              </h1>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              {navItems.map(item => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={clsx(
                    "text-sm font-bold transition-colors",
                    location.pathname === item.path
                      ? "text-primary"
                      : "text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2 sm:gap-4">
              <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300" title="Toggle Theme">
                <span className="material-symbols-outlined">
                  {theme === 'dark' ? 'light_mode' : 'dark_mode'}
                </span>
              </button>
              <button onClick={() => navigate('/settings')} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-600 dark:text-slate-300" title="Settings">
                <span className="material-symbols-outlined">settings</span>
              </button>
              {/* User avatar + menu */}
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setUserMenuOpen(o => !o)}
                  className="size-9 rounded-full border-2 border-primary overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary/50"
                  title="Account"
                >
                  {currentProfile?.avatar ? (
                    <img className="w-full h-full object-cover" src={currentProfile.avatar} alt={currentProfile.name} />
                  ) : currentProfile ? (
                    <div className={`w-full h-full bg-gradient-to-br ${currentProfile.gradientFrom} ${currentProfile.gradientTo} flex items-center justify-center text-white font-bold text-sm`}>
                      {currentProfile.name.charAt(0)}
                    </div>
                  ) : (
                    <div className="w-full h-full bg-primary flex items-center justify-center">
                      <span className="material-symbols-outlined text-white text-sm">person</span>
                    </div>
                  )}
                </button>

                {/* Dropdown menu */}
                {userMenuOpen && (
                  <div className="absolute right-0 top-12 w-56 glass rounded-xl shadow-2xl shadow-black/10 z-50 overflow-hidden border border-slate-200 dark:border-slate-700">
                    {/* User info */}
                    {currentProfile && (
                      <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                        <p className="font-bold text-sm truncate">{currentProfile.name}</p>
                        <p className="text-xs text-slate-500 truncate">{currentProfile.bio}</p>
                      </div>
                    )}
                    <button
                      onClick={() => { setUserMenuOpen(false); navigate('/settings'); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <span className="material-symbols-outlined text-slate-400">settings</span>
                      Settings
                    </button>
                    <button
                      onClick={() => { setUserMenuOpen(false); navigate('/login'); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-primary"
                    >
                      <span className="material-symbols-outlined">switch_account</span>
                      Switch Account
                    </button>
                    <button
                      onClick={() => { setUserMenuOpen(false); logout(); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-red-500 border-t border-slate-200 dark:border-slate-700"
                    >
                      <span className="material-symbols-outlined">logout</span>
                      Log Out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Nav */}
      <nav className="md:hidden overflow-x-auto border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
        <div className="flex px-4 py-2 gap-6 min-w-max">
          {navItems.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={clsx(
                "text-sm font-bold transition-colors whitespace-nowrap py-2",
                location.pathname === item.path
                  ? "text-primary border-b-2 border-primary"
                  : "text-slate-600 dark:text-slate-300 hover:text-primary dark:hover:text-primary"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
};
