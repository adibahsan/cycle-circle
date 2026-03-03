import React from 'react';
import { useAppContext } from '../context/AppContext';
import { differenceInDays, startOfDay } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export const Home: React.FC = () => {
  const {
    mode,
    cycleLength,
    predictedCycleLength,
    periodLength,
    lastPeriodStart,
    pregnancyStartDate,
    symptoms,
    anonymousMode,
    anonymousName,
  } = useAppContext();
  const navigate = useNavigate();

  // Use ML-predicted cycle length for all computations
  const activeCycleLength = predictedCycleLength;

  const today = startOfDay(new Date());
  const lastPeriodDate = new Date(lastPeriodStart);
  const daysSincePeriod = differenceInDays(today, lastPeriodDate);
  const currentCycleDay = (daysSincePeriod % activeCycleLength) + 1;
  const daysUntilNextPeriod = activeCycleLength - currentCycleDay;

  // Ovulation calculation (approx 14 days before next period)
  const ovulationDay = activeCycleLength - 14;
  const isOvulationPhase = currentCycleDay >= ovulationDay - 2 && currentCycleDay <= ovulationDay + 2;

  // Pregnancy week calculation — dynamic from pregnancyStartDate
  const gestationalWeek = pregnancyStartDate
    ? Math.floor(differenceInDays(today, new Date(pregnancyStartDate)) / 7)
    : 22;
  const trimesterLabel =
    gestationalWeek < 14 ? 'First Trimester' :
      gestationalWeek < 28 ? 'Second Trimester' : 'Third Trimester';
  const journeyPercent = Math.min(Math.round((gestationalWeek / 40) * 100), 100);

  // Fruit comparisons per gestational week (weeks 4–40)
  const FRUITS: Record<number, [string, string, string]> = {
    4: ['poppy seed', '0.04 oz', '0.2 in'], 5: ['sesame seed', '0.04 oz', '0.13 in'],
    6: ['lentil', '0.04 oz', '0.25 in'], 7: ['blueberry', '0.04 oz', '0.51 in'],
    8: ['kidney bean', '0.04 oz', '0.63 in'], 9: ['grape', '0.07 oz', '0.9 in'],
    10: ['kumquat', '0.14 oz', '1.2 in'], 11: ['fig', '0.25 oz', '1.6 in'],
    12: ['lime', '0.49 oz', '2.1 in'], 13: ['pea pod', '0.81 oz', '2.9 in'],
    14: ['lemon', '1.5 oz', '3.4 in'], 15: ['apple', '2.5 oz', '4 in'],
    16: ['avocado', '3.5 oz', '4.6 in'], 17: ['turnip', '5 oz', '5.1 in'],
    18: ['bell pepper', '6.7 oz', '5.6 in'], 19: ['mango', '8.5 oz', '6 in'],
    20: ['banana', '10.2 oz', '6.5 in'], 21: ['carrot', '12.7 oz', '10.5 in'],
    22: ['papaya', '1.0 lb', '11 in'], 23: ['grapefruit', '1.1 lb', '11.4 in'],
    24: ['ear of corn', '1.3 lb', '11.8 in'], 25: ['head of cauliflower', '1.5 lb', '13.6 in'],
    26: ['scallion', '1.7 lb', '14 in'], 27: ['head of lettuce', '1.9 lb', '14.4 in'],
    28: ['eggplant', '2.2 lb', '14.8 in'], 29: ['butternut squash', '2.5 lb', '15.2 in'],
    30: ['cabbage', '2.9 lb', '15.7 in'], 31: ['coconut', '3.3 lb', '16.2 in'],
    32: ['jicama', '3.75 lb', '16.7 in'], 33: ['pineapple', '4.2 lb', '17.2 in'],
    34: ['cantaloupe', '4.7 lb', '17.7 in'], 35: ['honeydew melon', '5.3 lb', '18.2 in'],
    36: ['romaine lettuce', '5.8 lb', '18.7 in'], 37: ['winter melon', '6.3 lb', '19.1 in'],
    38: ['leek', '6.8 lb', '19.6 in'], 39: ['watermelon', '7.3 lb', '20 in'],
    40: ['small pumpkin', '7.6 lb', '20.2 in'],
  };
  const clampedWeek = Math.min(Math.max(gestationalWeek, 4), 40);
  const [fruitName, fruitWeight, fruitLength] = FRUITS[clampedWeek] ?? ['papaya', '1.0 lb', '11 in'];

  // Display name
  const displayName = anonymousMode ? anonymousName : 'Sarah';

  // Check if there are symptoms logged today
  const todayStr = today.toISOString().split('T')[0];
  const todaySymptoms = symptoms[todayStr];
  const hasSymptoms = todaySymptoms && (
    todaySymptoms.mood.length > 0 ||
    todaySymptoms.pain.length > 0 ||
    todaySymptoms.discharge.length > 0 ||
    todaySymptoms.lifestyle.length > 0
  );

  if (mode === 'pregnancy') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <aside className="lg:col-span-3 flex flex-col gap-6">
          <div className="glass-card rounded-xl p-6 flex flex-col items-center text-center">
            <div className="size-24 rounded-full border-4 border-primary/20 p-1 mb-4">
              {anonymousMode ? (
                <div className="w-full h-full rounded-full bg-gradient-to-tr from-pink-400 to-indigo-400 flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-3xl">visibility_off</span>
                </div>
              ) : (
                <div className="w-full h-full rounded-full bg-cover bg-center" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuA5pPL9DFH9CmFcwRWJCAWdbGl24f7kLWPea1Utv1xl5oVAZyxvkCikl76LwoRjP2DZcHongd00OsOA51dejS_n5p2pXrpPgkJiHl-Z02g96lWqie4iVWS_C9OcRF6yrE6TTBNhYf0pfJ2PUidmExYg-XJ-_4GR0snwjCEGnNQ3f64LywJMky3xTQcNEFN97SMK80YaAQzhSm4XvpCdDWuxOJzQABtUSy8DkPgn8Jz6hhGWmjuGoQyCSDZBQxvMY3keYGIbomYihuE")' }}></div>
              )}
            </div>
            <h3 className="text-lg font-bold">{displayName}{anonymousMode ? '' : ' Jenkins'}</h3>
            <p className="text-sm text-slate-500 mb-4">Week {gestationalWeek} · Pregnant</p>
            <div className="w-full bg-warm-accent/30 rounded-full h-2 overflow-hidden">
              <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: `${journeyPercent}%` }}></div>
            </div>
            <p className="text-xs font-medium mt-2 text-primary">{journeyPercent}% of your journey complete</p>
          </div>

          <div className="glass-card rounded-xl p-6">
            <h3 className="font-bold mb-4">Upcoming Appointments</h3>
            <div className="flex items-center gap-3 p-3 bg-warm-accent/20 rounded-lg">
              <div className="bg-white dark:bg-slate-800 p-2 rounded text-center min-w-[3rem]">
                <p className="text-[10px] font-bold text-primary uppercase">Oct</p>
                <p className="text-lg font-bold leading-none">14</p>
              </div>
              <div>
                <p className="font-bold text-sm">Anatomy Scan</p>
                <p className="text-xs text-slate-500">Dr. Smith • 10:00 AM</p>
              </div>
            </div>
          </div>
        </aside>

        <div className="lg:col-span-9 flex flex-col gap-8">
          <section className="bg-gradient-to-br from-[#FFFFE0] to-[#fdf6b2] rounded-xl p-8 relative overflow-hidden shadow-sm border border-warm-accent/50">
            <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/60 backdrop-blur-sm text-primary text-sm font-bold mb-4">
                  <span className="material-symbols-outlined text-sm">auto_awesome</span>
                  Week {gestationalWeek} • {trimesterLabel}
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Hello, {displayName}!</h1>
                <p className="text-lg text-slate-700 max-w-md">Your baby is the size of a <span className="text-primary font-bold">{fruitName}</span> this week.</p>
                <div className="mt-8 flex gap-4">
                  <div className="bg-white/80 p-4 rounded-xl flex flex-col shadow-sm">
                    <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Weight</span>
                    <span className="text-xl font-bold">{fruitWeight}</span>
                  </div>
                  <div className="bg-white/80 p-4 rounded-xl flex flex-col shadow-sm">
                    <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Length</span>
                    <span className="text-xl font-bold">{fruitLength}</span>
                  </div>
                </div>
              </div>
              <div className="w-64 h-64 md:w-80 md:h-80 bg-white/40 rounded-full flex items-center justify-center yellow-glow">
                <div className="relative group cursor-pointer">
                  <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl animate-pulse"></div>
                  <div className="relative size-48 md:size-60 bg-contain bg-center bg-no-repeat transition-transform hover:scale-110" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCfi4F8WWPJJ0xlv23Cia1uny4xRErzqY8CRSzqt4N3Sjp7yH-y8SMhdMl9g2ucDFyitLeGUmxajnfVD6WlRe_EDC6HZKV9hLudb3EHoEnXmCwD5WscX9g7935oksdtwRDawG2C5dpDbbFb7vZYkEdCuK4RB4c-FZY32P-xirlRgpy9Sug5tdAhIzsy45wYfPtxJBYSBKhx7-ngIxcZtMCb_g7T_wmEncxYaNPj_EwK6qz6pl4Y9kItOT3QUPl6D9WxDv0zAssPQGg")' }}></div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <section className="flex flex-col gap-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">task_alt</span>
                Weekly Checklist
              </h3>
              <div className="glass-card rounded-xl p-6 flex flex-col gap-4">
                <label className="flex items-center gap-4 group cursor-pointer">
                  <input defaultChecked className="w-6 h-6 rounded border-warm-accent text-primary focus:ring-primary" type="checkbox" />
                  <span className="text-slate-700 group-hover:text-primary transition-colors">Book 20-week anatomy scan</span>
                </label>
                <label className="flex items-center gap-4 group cursor-pointer">
                  <input className="w-6 h-6 rounded border-warm-accent text-primary focus:ring-primary" type="checkbox" />
                  <span className="text-slate-700 group-hover:text-primary transition-colors">Start registry research</span>
                </label>
                <label className="flex items-center gap-4 group cursor-pointer">
                  <input className="w-6 h-6 rounded border-warm-accent text-primary focus:ring-primary" type="checkbox" />
                  <span className="text-slate-700 group-hover:text-primary transition-colors">Take prenatal vitamins daily</span>
                </label>
                <label className="flex items-center gap-4 group cursor-pointer">
                  <input className="w-6 h-6 rounded border-warm-accent text-primary focus:ring-primary" type="checkbox" />
                  <span className="text-slate-700 group-hover:text-primary transition-colors">Moisturize stretching skin</span>
                </label>
                <button className="mt-2 text-primary text-sm font-bold flex items-center gap-1 hover:underline">
                  <span className="material-symbols-outlined text-sm">add</span>
                  Add Custom Milestone
                </button>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">insights</span>
                Daily Vitals
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-warm-accent/30">
                  <span className="material-symbols-outlined text-blue-400 mb-2">water_drop</span>
                  <div className="text-2xl font-bold">1.8L</div>
                  <div className="text-xs text-slate-500 uppercase">Hydration</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-warm-accent/30">
                  <span className="material-symbols-outlined text-green-400 mb-2">directions_walk</span>
                  <div className="text-2xl font-bold">4,200</div>
                  <div className="text-xs text-slate-500 uppercase">Steps</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-warm-accent/30">
                  <span className="material-symbols-outlined text-orange-400 mb-2">bedtime</span>
                  <div className="text-2xl font-bold">7h 45m</div>
                  <div className="text-xs text-slate-500 uppercase">Sleep</div>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-warm-accent/30">
                  <span className="material-symbols-outlined text-red-400 mb-2">favorite</span>
                  <div className="text-2xl font-bold">78 bpm</div>
                  <div className="text-xs text-slate-500 uppercase">Resting HR</div>
                </div>
              </div>
            </section>
          </div>

          <section className="flex flex-col gap-4">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">menu_book</span>
              Learning for Week 22
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="group relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer">
                <div className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCY8qjBYQyxM2mkFDkVxkQ0QmIyuC1yWcZSRA9w4GDH_Y-K_nNTOeqR6po0h2FPU_6hslqWkyHujn0MUIycV0HJ3N8l3McktQgmjQINLQ5oT35VMxGldvadVoRw7y-EaVX7Dvtj0vddlXHiaRydhDNTnOyxXXaeHN_YaEoql5t5sF0QsmKIRLhxEhts1WgbukxJSE7qdKQCS59iGP-L8bsXv9eQOI25I38y_xF0xxIGcSHPYAyaMtz4h7P-wdFqyQlkIKrId_CkNwE")' }}></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4">
                  <h4 className="text-white font-bold leading-tight">Prenatal Yoga: Back Pain Relief</h4>
                  <p className="text-white/70 text-xs">12 min video</p>
                </div>
              </div>
              <div className="group relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer">
                <div className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuADyaiXcE8aYEgPF8nXSOwu0uxJrOjU383MJK8f8_N6zrO0Squ3qB27CGFkkAm_dmHEgz6sO_qS2lRILGbglnpo08CH85bEaSN--9dH2CKnbFSKWcYO34VdSDZ7Fi4NWU5UwfdBivJzjK9G171WF2gtth85qYWcHllesc-wkBembaVCcvZi-2jwIrdQDR1Out2VF5s6My4OrgoildI0zIUaK7kvNNXLd6CZVaIuPzBC4Aet2yVllppqLpoPoMRlr76VlzqvvWGRv04")' }}></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4">
                  <h4 className="text-white font-bold leading-tight">Iron-Rich Diet for Trimester 2</h4>
                  <p className="text-white/70 text-xs">5 min read</p>
                </div>
              </div>
              <div className="group relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer">
                <div className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDdguphDRcMPxlLbuwgFvpFj-v3d3xOMYNfI9UL65pGy637s9PgaaJisG2n7o0uJ1k9MMjRRWleRZhqsJUo4cXfvAqZlUmCp6qaxhYXj0MLsa7febrLqyaUP07zF6_fQOqK0cTlrJUHd5d0PYGKm3KLjA5060zJTU6EsWiyFRTibmkVDje9w5xfVZbLXZaJU5_NQfsyOR1bn6w3Z0mcHyf8CGcQ76K1yy4b5e4r5d9oxHi4yuPXIj-sqgTnXwfzwVUVemO5UG0zjjQ")' }}></div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4">
                  <h4 className="text-white font-bold leading-tight">Nursery Essentials Checklist</h4>
                  <p className="text-white/70 text-xs">8 min read</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // Tracking Mode
  return (
    <div className="flex flex-col gap-10 max-w-[500px] mx-auto pb-8">

      {/* ── 1. Health Insights ──────────────────────────────────────────────── */}
      <section>
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400 mb-6 px-2">Health Insights</h2>
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide no-scrollbar px-2">
          {[
            { label: 'Nutrition', active: true, src: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=150&h=150&fit=crop' },
            { label: 'Fitness', src: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=150&h=150&fit=crop' },
            { label: 'Sleep', src: 'https://images.unsplash.com/photo-1541781774459-bb2af2f05b55?w=150&h=150&fit=crop' },
            { label: 'Hormones', src: 'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?w=150&h=150&fit=crop' },
            { label: 'Mood', src: 'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?w=150&h=150&fit=crop' },
          ].map(({ label, src, active }) => (
            <div key={label} className="flex flex-col items-center gap-2 min-w-[72px] group cursor-pointer">
              <div className={`size-[72px] rounded-full p-1 transition-all duration-300 ${active ? 'bg-primary shadow-[0_0_15px_rgba(236,72,153,0.4)] scale-105' : 'bg-transparent border-2 border-slate-200 dark:border-slate-800 group-hover:border-primary/50'}`}>
                <img className="w-full h-full object-cover rounded-full" src={src} alt={label} />
              </div>
              <span className={`text-[11px] font-bold ${active ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── 2. Central Cycle Ring ───────────────────────────────────────────── */}
      <section className="flex justify-center relative py-6">
        <div className="relative w-[320px] h-[320px] flex items-center justify-center">

          {/* Top Badge: Ovulation Phase */}
          {isOvulationPhase && (
            <div className="absolute -top-4 z-20 bg-white dark:bg-slate-900 px-5 py-2 rounded-full shadow-lg shadow-black/5 border border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">Ovulation Phase</span>
            </div>
          )}

          {/* Glowing Ring */}
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(from -90deg, #ec4899 ${(currentCycleDay / cycleLength) * 360}deg, transparent ${(currentCycleDay / cycleLength) * 360}deg)`,
              maskImage: 'radial-gradient(transparent 65%, black 66%)',
              WebkitMaskImage: 'radial-gradient(transparent 65%, black 66%)',
            }}
          />
          {/* Subtle background track */}
          <div className="absolute inset-0 rounded-full border-[10px] border-primary/5 dark:border-primary/10 -z-10" />

          {/* Heavy Pink Glow behind the active segment (simulated) */}
          <div className="absolute inset-4 rounded-full bg-primary/20 blur-2xl -z-20 opacity-50" />

          {/* Inner Content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center z-10 pt-4">
            <p className="text-xs font-bold text-primary uppercase tracking-[0.2em] mb-2">Day {currentCycleDay}</p>
            <h3 className="text-[80px] font-extrabold text-slate-900 dark:text-white leading-[0.85] tracking-tighter mb-4">
              {daysUntilNextPeriod}
            </h3>
            <p className="text-base font-medium text-slate-600 dark:text-slate-400">Days until period</p>
            <p className="text-xs text-slate-400 mt-1 mb-8">AI Cycle: {activeCycleLength}d</p>

            {/* Bottom Inner Badge: Chance of Pregnancy */}
            <div className="absolute bottom-6 w-[200px] h-[36px] bg-red-50 dark:bg-rose-950/30 rounded-full flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-primary text-[14px]">favorite</span>
              <span className="text-[10px] font-extrabold text-primary uppercase tracking-wider">
                Chance of pregnancy: {isOvulationPhase ? 'High' : 'Low'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Stat Cards ───────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-4">
        {/* AI Predicted */}
        <div className="bg-white dark:bg-slate-900 p-6 pt-5 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.03)] dark:shadow-none dark:border dark:border-slate-800 flex flex-col justify-between min-h-[140px]">
          <span className="material-symbols-outlined text-primary text-xl mb-6">smart_toy</span>
          <div>
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">AI Predicted</h4>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {activeCycleLength} <span className="text-lg font-bold text-slate-500">days</span>
            </p>
          </div>
        </div>

        {/* Period Length */}
        <div className="bg-white dark:bg-slate-900 p-6 pt-5 rounded-3xl shadow-[0_4px_24px_rgba(0,0,0,0.03)] dark:shadow-none dark:border dark:border-slate-800 flex flex-col justify-between min-h-[140px]">
          <span className="material-symbols-outlined text-primary text-xl mb-6">water_drop</span>
          <div>
            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">Period Length</h4>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white">
              {periodLength} <span className="text-lg font-bold text-slate-500">days</span>
            </p>
          </div>
        </div>
      </section>

      {/* ── 4. Bottom Insight Banner ────────────────────────────────────────── */}
      {hasSymptoms ? (
        <section
          className="bg-white dark:bg-slate-900 p-6 rounded-3xl flex items-center gap-5 cursor-pointer shadow-[0_4px_24px_rgba(0,0,0,0.03)] hover:shadow-glow-primary transition-shadow duration-300 dark:border dark:border-slate-800"
          onClick={() => navigate('/log')}
        >
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-[24px]">check_circle</span>
          </div>
          <div>
            <h4 className="font-exrabold text-slate-900 dark:text-white text-[15px] mb-1">Symptoms logged today</h4>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-[90%]">
              You've logged {todaySymptoms.mood.length + todaySymptoms.pain.length + todaySymptoms.discharge.length + todaySymptoms.lifestyle.length} symptoms today. Keep it up!
            </p>
          </div>
        </section>
      ) : (
        <section
          className="bg-white dark:bg-slate-900 p-6 rounded-3xl flex items-center gap-5 cursor-pointer shadow-[0_4px_24px_rgba(0,0,0,0.03)] hover:shadow-glow-primary transition-shadow duration-300 dark:border dark:border-slate-800"
          onClick={() => navigate('/log')}
        >
          <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-rose-950/30 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-[22px]">lightbulb</span>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white text-[15px] mb-1">Feeling more energetic?</h4>
            <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-[95%]">
              It's common during your ovulation phase. This is a great time for high-intensity workouts or tackling big projects.
            </p>
          </div>
        </section>
      )}

    </div>
  );
};
