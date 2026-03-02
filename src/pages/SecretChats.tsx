import React from 'react';

export const SecretChats: React.FC = () => {
  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
      {/* Top Navigation */}
      <header className="flex items-center justify-between py-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="bg-primary p-2 rounded-lg text-white">
            <span className="material-symbols-outlined text-2xl">lock_open</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Secret Chats</h1>
        </div>
        
        <div className="hidden md:flex items-center gap-2 bg-primary/10 p-1 rounded-full">
          <button className="px-6 py-2 rounded-full bg-primary text-white font-semibold text-sm">Feed</button>
          <button className="px-6 py-2 rounded-full hover:bg-primary/20 text-slate-700 dark:text-slate-200 font-semibold text-sm transition-all">Communities</button>
          <button className="px-6 py-2 rounded-full hover:bg-primary/20 text-slate-700 dark:text-slate-200 font-semibold text-sm transition-all">Saved</button>
        </div>
        
        <div className="flex items-center gap-3">
          <button className="p-3 rounded-full glass hover:bg-primary/10 transition-colors">
            <span className="material-symbols-outlined">search</span>
          </button>
          <button className="p-3 rounded-full glass hover:bg-primary/10 transition-colors relative">
            <span className="material-symbols-outlined">notifications</span>
            <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full"></span>
          </button>
        </div>
      </header>

      {/* Category Scroll */}
      <div className="flex gap-3 overflow-x-auto pb-6 no-scrollbar scrollbar-hide">
        <div className="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full bg-primary text-white px-6 font-bold cursor-pointer">
          <span className="text-sm">All Topics</span>
        </div>
        <div className="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full glass px-6 font-bold cursor-pointer hover:border-primary/50 transition-all">
          <span className="text-primary text-sm">#TTC</span>
        </div>
        <div className="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full glass px-6 font-bold cursor-pointer hover:border-primary/50 transition-all">
          <span className="text-primary text-sm">#PMS</span>
        </div>
        <div className="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full glass px-6 font-bold cursor-pointer hover:border-primary/50 transition-all">
          <span className="text-primary text-sm">#Pregnancy</span>
        </div>
        <div className="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full glass px-6 font-bold cursor-pointer hover:border-primary/50 transition-all">
          <span className="text-primary text-sm">#IVF</span>
        </div>
        <div className="flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-full glass px-6 font-bold cursor-pointer hover:border-primary/50 transition-all">
          <span className="text-primary text-sm">#MentalHealth</span>
        </div>
      </div>

      {/* Feed Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
        {/* Card 1 */}
        <div className="glass dark:glass-dark p-6 rounded-xl hover:shadow-xl transition-shadow flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div className="flex gap-3 items-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-pink-400 to-indigo-400"></div>
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-100">Anonymous Butterfly</p>
                <p className="text-xs text-slate-500">2 hours ago</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">#TTC</span>
          </div>
          <h3 className="text-lg font-bold leading-snug">First cycle of Clomid and feeling very anxious. Anyone else in the same boat?</h3>
          
          <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-lg border-l-4 border-primary">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-primary text-sm">verified</span>
              <span className="text-xs font-bold text-primary uppercase">Expert Verified Response</span>
            </div>
            <p className="text-sm italic text-slate-600 dark:text-slate-300 line-clamp-2">"It's completely normal to feel this way. The hormonal shift can amplify anxiety..."</p>
          </div>
          
          <div className="flex items-center justify-between pt-2">
            <div className="flex gap-4">
              <button className="flex items-center gap-1 text-slate-500 hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-xl">favorite</span>
                <span className="text-sm font-medium">24</span>
              </button>
              <button className="flex items-center gap-1 text-slate-500 hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-xl">chat_bubble</span>
                <span className="text-sm font-medium">12</span>
              </button>
            </div>
            <button className="text-sm font-bold text-primary hover:underline">View Discussion</button>
          </div>
        </div>

        {/* Card 2 */}
        <div className="glass dark:glass-dark p-6 rounded-xl hover:shadow-xl transition-shadow flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div className="flex gap-3 items-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-yellow-300 to-orange-500"></div>
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-100">Hidden Harmony</p>
                <p className="text-xs text-slate-500">4 hours ago</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">#PMS</span>
          </div>
          <h3 className="text-lg font-bold leading-snug">Natural remedies for severe mood swings? Magnesium is not working as fast as I hoped.</h3>
          
          <div className="flex items-center justify-between pt-2 mt-auto">
            <div className="flex gap-4">
              <button className="flex items-center gap-1 text-slate-500 hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-xl text-primary" style={{fontVariationSettings: "'FILL' 1"}}>favorite</span>
                <span className="text-sm font-medium text-primary">56</span>
              </button>
              <button className="flex items-center gap-1 text-slate-500 hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-xl">chat_bubble</span>
                <span className="text-sm font-medium">31</span>
              </button>
            </div>
            <button className="text-sm font-bold text-primary hover:underline">View Discussion</button>
          </div>
        </div>

        {/* Card 3 */}
        <div className="glass dark:glass-dark p-6 rounded-xl hover:shadow-xl transition-shadow flex flex-col gap-4">
          <div className="flex justify-between items-start">
            <div className="flex gap-3 items-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-green-400 to-cyan-500"></div>
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-100">Quiet Hope</p>
                <p className="text-xs text-slate-500">6 hours ago</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">#Pregnancy</span>
          </div>
          <h3 className="text-lg font-bold leading-snug">Finally saw the two lines today after 3 years! I'm crying and don't know who to tell.</h3>
          
          <div className="p-4 bg-primary/5 rounded-lg border-l-4 border-primary">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-primary text-sm">celebration</span>
              <span className="text-xs font-bold text-primary uppercase">Community Support</span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">Over 140 people have sent congratulations!</p>
          </div>
          
          <div className="flex items-center justify-between pt-2">
            <div className="flex gap-4">
              <button className="flex items-center gap-1 text-slate-500 hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-xl">favorite</span>
                <span className="text-sm font-medium">142</span>
              </button>
              <button className="flex items-center gap-1 text-slate-500 hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-xl">chat_bubble</span>
                <span className="text-sm font-medium">89</span>
              </button>
            </div>
            <button className="text-sm font-bold text-primary hover:underline">View Discussion</button>
          </div>
        </div>

        {/* Card 4 */}
        <div className="glass dark:glass-dark p-6 rounded-xl hover:shadow-xl transition-shadow flex flex-col gap-4 border-2 border-primary/20">
          <div className="flex justify-between items-start">
            <div className="flex gap-3 items-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-purple-500 to-pink-600"></div>
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-100">Asking Anon</p>
                <p className="text-xs text-slate-500">12 hours ago</p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">#IVF</span>
          </div>
          <h3 className="text-lg font-bold leading-snug">What should I expect during the first egg retrieval? I'm nervous about the sedation.</h3>
          
          <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-lg border-l-4 border-primary">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-primary text-sm">verified</span>
              <span className="text-xs font-bold text-primary uppercase">Expert Verified Response</span>
            </div>
            <p className="text-sm italic text-slate-600 dark:text-slate-300">"The procedure typically takes 20-30 minutes. Most patients describe the sedation as a light, peaceful sleep..."</p>
            <p className="text-[10px] mt-2 text-slate-400 font-medium">— Dr. Elena R., Fertility Specialist</p>
          </div>
          
          <div className="flex items-center justify-between pt-2">
            <div className="flex gap-4">
              <button className="flex items-center gap-1 text-slate-500 hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-xl">favorite</span>
                <span className="text-sm font-medium">45</span>
              </button>
              <button className="flex items-center gap-1 text-slate-500 hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-xl">chat_bubble</span>
                <span className="text-sm font-medium">22</span>
              </button>
            </div>
            <button className="text-sm font-bold text-primary hover:underline">View Discussion</button>
          </div>
        </div>
      </div>
    </div>
  );
};
