import React from 'react';
import { useAppContext } from '../context/AppContext';
import { differenceInDays, addDays, startOfDay } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export const Home: React.FC = () => {
  const { mode, cycleLength, periodLength, lastPeriodStart, symptoms } = useAppContext();
  const navigate = useNavigate();

  const today = startOfDay(new Date());
  const lastPeriodDate = new Date(lastPeriodStart);
  const daysSincePeriod = differenceInDays(today, lastPeriodDate);
  const currentCycleDay = (daysSincePeriod % cycleLength) + 1;
  const daysUntilNextPeriod = cycleLength - currentCycleDay;
  
  // Simple ovulation calculation (approx 14 days before next period)
  const ovulationDay = cycleLength - 14;
  const isOvulationPhase = currentCycleDay >= ovulationDay - 2 && currentCycleDay <= ovulationDay + 2;

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
              <div className="w-full h-full rounded-full bg-cover bg-center" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuA5pPL9DFH9CmFcwRWJCAWdbGl24f7kLWPea1Utv1xl5oVAZyxvkCikl76LwoRjP2DZcHongd00OsOA51dejS_n5p2pXrpPgkJiHl-Z02g96lWqie4iVWS_C9OcRF6yrE6TTBNhYf0pfJ2PUidmExYg-XJ-_4GR0snwjCEGnNQ3f64LywJMky3xTQcNEFN97SMK80YaAQzhSm4XvpCdDWuxOJzQABtUSy8DkPgn8Jz6hhGWmjuGoQyCSDZBQxvMY3keYGIbomYihuE")'}}></div>
            </div>
            <h3 className="text-lg font-bold">Sarah Jenkins</h3>
            <p className="text-sm text-slate-500 mb-4">22 Weeks Pregnant</p>
            <div className="w-full bg-warm-accent/30 rounded-full h-2 overflow-hidden">
              <div className="bg-primary h-full rounded-full w-[55%]"></div>
            </div>
            <p className="text-xs font-medium mt-2 text-primary">55% of your journey complete</p>
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
                Week 22 • Second Trimester
              </div>
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-2">Hello, Sarah!</h1>
              <p className="text-lg text-slate-700 max-w-md">Your baby is the size of a <span className="text-primary font-bold">papaya</span> this week. They can now hear your heartbeat and voice!</p>
              <div className="mt-8 flex gap-4">
                <div className="bg-white/80 p-4 rounded-xl flex flex-col shadow-sm">
                  <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Weight</span>
                  <span className="text-xl font-bold">1.0 lb</span>
                </div>
                <div className="bg-white/80 p-4 rounded-xl flex flex-col shadow-sm">
                  <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Length</span>
                  <span className="text-xl font-bold">11 in</span>
                </div>
              </div>
            </div>
            <div className="w-64 h-64 md:w-80 md:h-80 bg-white/40 rounded-full flex items-center justify-center yellow-glow">
              <div className="relative group cursor-pointer">
                <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl animate-pulse"></div>
                <div className="relative size-48 md:size-60 bg-contain bg-center bg-no-repeat transition-transform hover:scale-110" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCfi4F8WWPJJ0xlv23Cia1uny4xRErzqY8CRSzqt4N3Sjp7yH-y8SMhdMl9g2ucDFyitLeGUmxajnfVD6WlRe_EDC6HZKV9hLudb3EHoEnXmCwD5WscX9g7935oksdtwRDawG2C5dpDbbFb7vZYkEdCuK4RB4c-FZY32P-xirlRgpy9Sug5tdAhIzsy45wYfPtxJBYSBKhx7-ngIxcZtMCb_g7T_wmEncxYaNPj_EwK6qz6pl4Y9kItOT3QUPl6D9WxDv0zAssPQGg")'}}></div>
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
              <div className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuCY8qjBYQyxM2mkFDkVxkQ0QmIyuC1yWcZSRA9w4GDH_Y-K_nNTOeqR6po0h2FPU_6hslqWkyHujn0MUIycV0HJ3N8l3McktQgmjQINLQ5oT35VMxGldvadVoRw7y-EaVX7Dvtj0vddlXHiaRydhDNTnOyxXXaeHN_YaEoql5t5sF0QsmKIRLhxEhts1WgbukxJSE7qdKQCS59iGP-L8bsXv9eQOI25I38y_xF0xxIGcSHPYAyaMtz4h7P-wdFqyQlkIKrId_CkNwE")'}}></div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4">
                <h4 className="text-white font-bold leading-tight">Prenatal Yoga: Back Pain Relief</h4>
                <p className="text-white/70 text-xs">12 min video</p>
              </div>
            </div>
            <div className="group relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer">
              <div className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuADyaiXcE8aYEgPF8nXSOwu0uxJrOjU383MJK8f8_N6zrO0Squ3qB27CGFkkAm_dmHEgz6sO_qS2lRILGbglnpo08CH85bEaSN--9dH2CKnbFSKWcYO34VdSDZ7Fi4NWU5UwfdBivJzjK9G171WF2gtth85qYWcHllesc-wkBembaVCcvZi-2jwIrdQDR1Out2VF5s6My4OrgoildI0zIUaK7kvNNXLd6CZVaIuPzBC4Aet2yVllppqLpoPoMRlr76VlzqvvWGRv04")'}}></div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4">
                <h4 className="text-white font-bold leading-tight">Iron-Rich Diet for Trimester 2</h4>
                <p className="text-white/70 text-xs">5 min read</p>
              </div>
            </div>
            <div className="group relative aspect-[4/3] rounded-xl overflow-hidden cursor-pointer">
              <div className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-110" style={{backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDdguphDRcMPxlLbuwgFvpFj-v3d3xOMYNfI9UL65pGy637s9PgaaJisG2n7o0uJ1k9MMjRRWleRZhqsJUo4cXfvAqZlUmCp6qaxhYXj0MLsa7febrLqyaUP07zF6_fQOqK0cTlrJUHd5d0PYGKm3KLjA5060zJTU6EsWiyFRTibmkVDje9w5xfVZbLXZaJU5_NQfsyOR1bn6w3Z0mcHyf8CGcQ76K1yy4b5e4r5d9oxHi4yuPXIj-sqgTnXwfzwVUVemO5UG0zjjQ")'}}></div>
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
    <>
      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-4 px-2">Health Insights</h2>
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide no-scrollbar">
          <div className="flex flex-col items-center gap-2 min-w-[84px]">
            <div className="size-20 rounded-xl p-0.5 border-2 border-primary">
              <div className="w-full h-full rounded-lg overflow-hidden relative">
                <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCIuxohAQTuq2F6q01wvMr3wKYnwWY-sU8c41QcyvE33VPR5tYfuf-w_jiOMXjy3vijXCB01V8g5nfXciB6fRRLlToYxiUp41IsJCHAyoXvn48jBrKx1o2N-bn_DBOwOlPFiw1bG-CWWSr5G1aF59c4BMb2G57rkRKOtdzoSqV7IMK5J-x575zuYUTNf5pzy2Npn8LZqQ3aBQCYcq_rrPfV6R9gAZkAGWLsVDszK-pTVuu66dCXv0deUO9JkFx5ssmAEMOF8gRE3dU" alt="Nutrition" />
              </div>
            </div>
            <span className="text-xs font-semibold">Nutrition</span>
          </div>
          <div className="flex flex-col items-center gap-2 min-w-[84px]">
            <div className="size-20 rounded-xl p-0.5 border-2 border-slate-200">
              <div className="w-full h-full rounded-lg overflow-hidden">
                <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC1IsUP7mL0mu-k4tQ9gg156dCVXTQDbajq87rhJWhPHnvwD7ugGYa_YzyrrKRY6M9ONPPtzLKl6YU-2_2jIuIZF4a6erQHv8XtZ2hQSn7ylpWHwGyQL9rYP_cDCIQZgpIy73i4EjpdzS2-nSMmn4fXLP7h7DGK912caN5Yvg_Ga96446SxW-EP4RUx1UglR3IEa1sKOFhImOuou4P7QvZiMaZE8KNWvPKImtZwC3T86-nvrVHXaxRB5kf2fjZEMbJmrQwWhLYW5HI" alt="Fitness" />
              </div>
            </div>
            <span className="text-xs font-semibold">Fitness</span>
          </div>
          <div className="flex flex-col items-center gap-2 min-w-[84px]">
            <div className="size-20 rounded-xl p-0.5 border-2 border-slate-200">
              <div className="w-full h-full rounded-lg overflow-hidden">
                <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBh6UyVIQ9R1Zbk8xcjI1F_lVDuF00B90uZt9MWXGTLnOm1S0Mb2O4bLhabzg-Gzt1Z3UGjgU5pUfjx8CJ7lTrdAARYn0CFS6hYdxWCj8BxU--JByA0iKwzN8jV42EFGXv4zR8U6PH7L5ubzBWjEy80-XdIHxTXgBT8fmLa0IKBroRKqYJQXYuM-iDNO7YDZB_UzSZyQeDSeTrnDGlBe5r3o46Gr3HfBiN4VxIMrqKk4ecVCc_fLDyHjbGC2fB3SQffunKV5vYfFt8" alt="Sleep" />
              </div>
            </div>
            <span className="text-xs font-semibold">Sleep</span>
          </div>
          <div className="flex flex-col items-center gap-2 min-w-[84px]">
            <div className="size-20 rounded-xl p-0.5 border-2 border-slate-200">
              <div className="w-full h-full rounded-lg overflow-hidden">
                <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBdi85T2Dy5XVsJAuByGDSBRBC-LIqGCubLjL5Yn5I4gk7jwTPCudYN87yO8DGD11U2A7huueKqZqDCn0C3e5cqBCh_b2dkXf0AsGkLHd-88bzjoDlmqSOlRbbllZebNLRnBt6y5pYMmF1wsUlqxUjTjIwuybKg_vOW-coa-ritibpwtTprp3akHQKjKwCf4mPmk9Tyb2lpHDjEOJkADk7-ED2D0A2EDQ3YaJKNa04HzDkzoNVayeBWBIy059myv2UWugffcQKzMUk" alt="Hormones" />
              </div>
            </div>
            <span className="text-xs font-semibold">Hormones</span>
          </div>
          <div className="flex flex-col items-center gap-2 min-w-[84px]">
            <div className="size-20 rounded-xl p-0.5 border-2 border-slate-200">
              <div className="w-full h-full rounded-lg overflow-hidden">
                <img className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAulJkDX5ExVlNiYIzJgouFRMuc6yqYdLbzdkHLkySW2uzucIrsMe69D6Pa7nlnJP2VHOBbow2K_mc8WENYrKQ9mDioMQBcTem-N0GMkEXw6ZziyEOhtUU9KS_bAb1s-wgGThiyUZX340xpehk0hDyz39J2dZbNWukBcAvy53kyLNHaxzcBNWxD1EHDpAfUnxLmXNb-ptteKA1amcQ90SRwteIDpt3dmx9C6jrBlqqT2FNxwP74drDGVGL1JcjlIHsyoQ-PrLI8MCc" alt="Mood" />
              </div>
            </div>
            <span className="text-xs font-semibold">Mood</span>
          </div>
        </div>
      </section>

      <section className="flex flex-col items-center justify-center py-6">
        <div className="relative flex items-center justify-center">
          <div 
            className="size-[320px] rounded-full flex items-center justify-center p-6 shadow-2xl shadow-primary/20"
            style={{
              background: `conic-gradient(from 0deg, var(--color-primary) ${(currentCycleDay / cycleLength) * 100}%, #f4e6e9 ${(currentCycleDay / cycleLength) * 100}%)`
            }}
          >
            <div className="size-full rounded-full bg-white dark:bg-slate-900 glass flex flex-col items-center justify-center text-center p-8">
              <p className="text-sm font-bold text-primary uppercase tracking-widest mb-1">Day {currentCycleDay}</p>
              <h3 className="text-5xl font-extrabold text-slate-900 dark:text-white leading-tight">{daysUntilNextPeriod}</h3>
              <p className="text-lg font-medium text-slate-600 dark:text-slate-400">Days until period</p>
              
              <div className="mt-6 px-4 py-2 rounded-full bg-primary/10 text-primary border border-primary/20 flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">favorite</span>
                <span className="text-xs font-bold uppercase tracking-wide">
                  Chance of pregnancy: {isOvulationPhase ? 'High' : 'Low'}
                </span>
              </div>
            </div>
          </div>
          
          {isOvulationPhase && (
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-800 px-3 py-1 rounded-full shadow-md border border-slate-100 dark:border-slate-700">
              <span className="text-[10px] font-bold text-slate-500 uppercase">Ovulation Phase</span>
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4">
        <div className="glass p-6 rounded-xl flex flex-col gap-1">
          <span className="material-symbols-outlined text-primary mb-2">calendar_today</span>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cycle Length</h4>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{cycleLength} days</p>
        </div>
        <div className="glass p-6 rounded-xl flex flex-col gap-1">
          <span className="material-symbols-outlined text-primary mb-2">water_drop</span>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Period Length</h4>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{periodLength} days</p>
        </div>
      </section>

      {hasSymptoms ? (
        <section className="glass p-5 rounded-xl border-l-4 border-primary cursor-pointer" onClick={() => navigate('/log')}>
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-lg bg-primary/20 flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined">check_circle</span>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white mb-1">Symptoms logged today</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                You've logged {todaySymptoms.mood.length + todaySymptoms.pain.length + todaySymptoms.discharge.length + todaySymptoms.lifestyle.length} symptoms today. Keep it up!
              </p>
            </div>
          </div>
        </section>
      ) : (
        <section className="glass p-5 rounded-xl border-l-4 border-primary cursor-pointer" onClick={() => navigate('/log')}>
          <div className="flex items-start gap-4">
            <div className="size-12 rounded-lg bg-primary/20 flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined">lightbulb</span>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 dark:text-white mb-1">Feeling more energetic?</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                It's common during your ovulation phase. This is a great time for high-intensity workouts or tackling big projects.
              </p>
            </div>
          </div>
        </section>
      )}
    </>
  );
};
