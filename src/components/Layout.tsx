import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { clsx } from 'clsx';

export const Layout: React.FC = () => {
  const { mode, toggleMode, theme, toggleTheme } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();

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
                "p-2 rounded-lg flex items-center justify-center text-white",
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
              <div 
                className="size-9 rounded-full border-2 border-primary overflow-hidden cursor-pointer"
                onClick={toggleMode}
                title="Toggle App Mode"
              >
                <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCVBUZd47u2rQy7_LXtmeWSkshHcO_bS1-FhwpHeZmp55NuUubBp1_Wdrb_FZFqLbsL9eiIqbVoDbiC8dkiPPg2mSRM56Wji5oRxEZ20A4btep4iKHiQPAeQhT4rbF8RWX0OPSYiZivIYxR290Z5hStCyzNZlbUUZlE02AAYTLlJOKhHUdDgg0dAC2w8Cncqo6h2kuun_--fe-bd29RSk949eKo-k8JGLGOZqYjXWBZHMbE876lEQn1-E0eis_N5HGj7_NmQ-6vIhE" alt="User" />
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
