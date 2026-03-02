import React from 'react';
import { useAppContext } from '../context/AppContext';

export const Settings: React.FC = () => {
  const { mode, toggleMode, theme, toggleTheme } = useAppContext();

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>
      
      <div className="glass p-6 rounded-xl space-y-6">
        <div>
          <h2 className="text-xl font-bold mb-2">App Mode</h2>
          <p className="text-slate-500 mb-4">Switch between standard cycle tracking and pregnancy mode.</p>
          
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${mode === 'pregnancy' ? 'bg-primary text-white' : 'bg-slate-200 text-slate-500'}`}>
                <span className="material-symbols-outlined">child_care</span>
              </div>
              <div>
                <p className="font-bold">Pregnancy Mode</p>
                <p className="text-xs text-slate-500">Track your baby's growth and milestones</p>
              </div>
            </div>
            
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={mode === 'pregnancy'}
                onChange={toggleMode}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>

        <hr className="border-slate-200 dark:border-slate-700" />
        
        <div>
          <h2 className="text-xl font-bold mb-2">Appearance</h2>
          <p className="text-slate-500 mb-4">Customize the look and feel of the application.</p>
          
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-300">
                <span className="material-symbols-outlined">{theme === 'dark' ? 'dark_mode' : 'light_mode'}</span>
              </div>
              <div>
                <p className="font-bold">Dark Mode</p>
                <p className="text-xs text-slate-500">Toggle dark theme</p>
              </div>
            </div>
            
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={theme === 'dark'}
                onChange={toggleTheme}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>
        
        <hr className="border-slate-200 dark:border-slate-700" />
        
        <div>
          <h2 className="text-xl font-bold mb-4">Account</h2>
          <div className="space-y-3">
            <button className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <span className="font-medium">Profile Information</span>
              <span className="material-symbols-outlined text-slate-400">chevron_right</span>
            </button>
            <button className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <span className="font-medium">Notifications</span>
              <span className="material-symbols-outlined text-slate-400">chevron_right</span>
            </button>
            <button className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-red-500">
              <span className="font-medium">Log Out</span>
              <span className="material-symbols-outlined">logout</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
