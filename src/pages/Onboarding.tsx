import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { UserGoal, GOAL_LABELS, UserProfile, seedUserData } from '../data/profiles';
import { addDays, startOfDay } from 'date-fns';
import { clsx } from 'clsx';

const STEPS = ['Goal', 'Your Name', 'Cycle Info', 'All Set!'];

const GOAL_OPTIONS: { id: UserGoal; icon: string; title: string; desc: string; color: string }[] = [
    {
        id: 'tracking',
        icon: 'calendar_month',
        title: 'Track My Cycle',
        desc: 'Monitor your period, symptoms, and patterns',
        color: 'primary',
    },
    {
        id: 'ttc',
        icon: 'child_friendly',
        title: 'Trying to Conceive',
        desc: 'Identify your fertile window and track ovulation',
        color: 'violet',
    },
    {
        id: 'pregnancy',
        icon: 'pregnant_woman',
        title: "I'm Pregnant",
        desc: "Follow your baby's growth week by week",
        color: 'amber',
    },
];

export const Onboarding: React.FC = () => {
    const { login } = useAppContext();
    const navigate = useNavigate();

    const [step, setStep] = useState(0);
    const [goal, setGoal] = useState<UserGoal | null>(null);
    const [name, setName] = useState('');
    const [cycleLen, setCycleLen] = useState(28);
    const [periodLen, setPeriodLen] = useState(5);
    const [lastPeriodStr, setLastPeriodStr] = useState(
        startOfDay(addDays(new Date(), -14)).toISOString().split('T')[0]
    );
    const [pregWeeks, setPregWeeks] = useState(8);

    const goNext = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
    const goBack = () => setStep(s => Math.max(s - 1, 0));

    const handleFinish = () => {
        if (!goal || !name.trim()) return;
        const userId = `user_${Date.now()}`;
        const pregStart = addDays(new Date(), -(pregWeeks * 7)).toISOString();
        const newProfile: UserProfile = {
            id: userId,
            name: name.trim(),
            age: 0,
            avatar: null,
            gradientFrom: 'from-primary',
            gradientTo: 'to-pink-500',
            mode: goal === 'pregnancy' ? 'pregnancy' : 'tracking',
            cycleLength: cycleLen,
            periodLength: periodLen,
            lastPeriodStart: lastPeriodStr
                ? new Date(lastPeriodStr + 'T00:00:00').toISOString()
                : addDays(new Date(), -14).toISOString(),
            pregnancyStartDate: goal === 'pregnancy' ? pregStart : null,
            goal,
            bio: GOAL_LABELS[goal],
            cycleHistory: [cycleLen, cycleLen, cycleLen - 1, cycleLen + 1, cycleLen],
        };
        const existing = JSON.parse(localStorage.getItem('cc_customProfiles') || '[]');
        localStorage.setItem('cc_customProfiles', JSON.stringify([...existing, newProfile]));
        seedUserData(newProfile);
        login(userId);
    };

    const ProgressBar = () => (
        <div className="flex items-center gap-2 mb-8">
            {STEPS.map((label, i) => (
                <React.Fragment key={label}>
                    <div className="flex items-center gap-2">
                        <div className={clsx(
                            'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                            i < step ? 'bg-primary text-white' :
                                i === step ? 'bg-primary text-white ring-4 ring-primary/20' :
                                    'bg-slate-200 dark:bg-slate-700 text-slate-400'
                        )}>
                            {i < step
                                ? <span className="material-symbols-outlined text-sm">check</span>
                                : i + 1}
                        </div>
                        <span className={clsx(
                            'text-xs font-semibold hidden sm:block',
                            i === step ? 'text-primary' : 'text-slate-400'
                        )}>{label}</span>
                    </div>
                    {i < STEPS.length - 1 && (
                        <div className={clsx(
                            'flex-1 h-0.5 rounded-full transition-all',
                            i < step ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
                        )} />
                    )}
                </React.Fragment>
            ))}
        </div>
    );

    return (
        <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-background-light dark:bg-background-dark px-4 py-12">
            <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] -z-10" />
            <div className="fixed bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-violet-500/10 rounded-full blur-[120px] -z-10" />

            <div className="w-full max-w-lg">
                {step > 0 && step < STEPS.length - 1 && (
                    <button
                        onClick={goBack}
                        className="flex items-center gap-1 text-slate-400 hover:text-primary mb-6 text-sm font-medium transition-colors"
                    >
                        <span className="material-symbols-outlined text-sm">arrow_back</span> Back
                    </button>
                )}

                {step === 0 && (
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary shadow-xl shadow-primary/30 mb-4">
                            <span className="material-symbols-outlined text-white text-2xl">favorite</span>
                        </div>
                        <h1 className="text-3xl font-extrabold">Let's get started</h1>
                        <p className="text-slate-500 mt-2">What's your main goal with Cycle Circle?</p>
                    </div>
                )}

                <ProgressBar />

                {/* Step 0: Goal */}
                {step === 0 && (
                    <div className="space-y-3">
                        {GOAL_OPTIONS.map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => { setGoal(opt.id); goNext(); }}
                                className={clsx(
                                    'w-full glass p-5 rounded-2xl flex items-center gap-4 text-left hover:border-primary active:scale-[0.98] transition-all group',
                                    goal === opt.id && 'border-primary ring-2 ring-primary/20'
                                )}
                            >
                                <div className={clsx(
                                    'w-12 h-12 rounded-xl flex items-center justify-center transition-colors',
                                    opt.color === 'primary'
                                        ? 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white'
                                        : opt.color === 'violet'
                                            ? 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 group-hover:bg-violet-500 group-hover:text-white'
                                            : 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 group-hover:bg-amber-500 group-hover:text-white'
                                )}>
                                    <span className="material-symbols-outlined text-2xl">{opt.icon}</span>
                                </div>
                                <div className="flex-1">
                                    <p className="font-bold">{opt.title}</p>
                                    <p className="text-slate-500 text-sm">{opt.desc}</p>
                                </div>
                                <span className="material-symbols-outlined text-slate-300 group-hover:text-primary transition-colors">chevron_right</span>
                            </button>
                        ))}
                    </div>
                )}

                {/* Step 1: Name */}
                {step === 1 && (
                    <div className="glass p-8 rounded-2xl">
                        <h2 className="text-2xl font-bold mb-2">What's your name?</h2>
                        <p className="text-slate-500 mb-6">This is how we'll address you in the app.</p>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Your first name"
                            autoFocus
                            className="w-full px-5 py-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-transparent text-lg font-medium focus:outline-none focus:border-primary transition-colors"
                        />
                        <button
                            onClick={goNext}
                            disabled={!name.trim()}
                            className="mt-6 w-full bg-primary text-white font-bold py-4 rounded-full shadow-xl shadow-primary/30 hover:brightness-110 active:scale-95 disabled:opacity-40 transition-all"
                        >
                            Continue
                        </button>
                    </div>
                )}

                {/* Step 2: Cycle Info */}
                {step === 2 && (
                    <div className="glass p-8 rounded-2xl">
                        <h2 className="text-2xl font-bold mb-2">
                            {goal === 'pregnancy' ? 'Pregnancy Info' : 'Your Cycle'}
                        </h2>
                        <p className="text-slate-500 mb-6">
                            {goal === 'pregnancy'
                                ? "Help us calculate your baby's age."
                                : "We'll use this to predict your next period."}
                        </p>

                        {goal === 'pregnancy' ? (
                            <div className="space-y-5">
                                <label className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2 block">
                                    How many weeks pregnant are you?
                                </label>
                                <div className="flex items-center gap-4">
                                    <button onClick={() => setPregWeeks(w => Math.max(1, w - 1))} className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 font-bold hover:bg-primary/20 transition-colors">-</button>
                                    <span className="text-3xl font-extrabold text-primary w-16 text-center">{pregWeeks}</span>
                                    <button onClick={() => setPregWeeks(w => Math.min(42, w + 1))} className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 font-bold hover:bg-primary/20 transition-colors">+</button>
                                    <span className="text-slate-500 ml-1">weeks</span>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                <div>
                                    <label className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2 block">Cycle Length</label>
                                    <div className="flex items-center gap-4">
                                        <button onClick={() => setCycleLen(n => Math.max(21, n - 1))} className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 font-bold hover:bg-primary/20 transition-colors">-</button>
                                        <span className="text-3xl font-extrabold text-primary w-16 text-center">{cycleLen}</span>
                                        <button onClick={() => setCycleLen(n => Math.min(45, n + 1))} className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 font-bold hover:bg-primary/20 transition-colors">+</button>
                                        <span className="text-slate-500 ml-1">days</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2 block">Period Length</label>
                                    <div className="flex items-center gap-4">
                                        <button onClick={() => setPeriodLen(n => Math.max(1, n - 1))} className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 font-bold hover:bg-primary/20 transition-colors">-</button>
                                        <span className="text-3xl font-extrabold text-primary w-16 text-center">{periodLen}</span>
                                        <button onClick={() => setPeriodLen(n => Math.min(10, n + 1))} className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 font-bold hover:bg-primary/20 transition-colors">+</button>
                                        <span className="text-slate-500 ml-1">days</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2 block">Last Period Start Date</label>
                                    <input
                                        type="date"
                                        value={lastPeriodStr}
                                        max={new Date().toISOString().split('T')[0]}
                                        onChange={e => setLastPeriodStr(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-transparent focus:outline-none focus:border-primary transition-colors"
                                    />
                                </div>
                            </div>
                        )}

                        <button
                            onClick={goNext}
                            className="mt-8 w-full bg-primary text-white font-bold py-4 rounded-full shadow-xl shadow-primary/30 hover:brightness-110 active:scale-95 transition-all"
                        >
                            Continue
                        </button>
                    </div>
                )}

                {/* Step 3: Done */}
                {step === 3 && (
                    <div className="glass p-10 rounded-2xl text-center">
                        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                            <span className="material-symbols-outlined text-primary text-5xl">celebrate</span>
                        </div>
                        <h2 className="text-3xl font-extrabold mb-2">You're all set, {name.split(' ')[0]}!</h2>
                        <p className="text-slate-500 mb-8">
                            Your profile is ready. Start logging your symptoms and tracking your cycle today.
                        </p>
                        <div className="grid grid-cols-3 gap-4 mb-8">
                            {[
                                { icon: 'calendar_month', label: 'Cycle tracking' },
                                { icon: 'mood', label: 'Symptom logs' },
                                { icon: 'smart_toy', label: 'AI predictions' },
                            ].map(f => (
                                <div key={f.label} className="bg-primary/5 rounded-xl p-4 flex flex-col items-center gap-2">
                                    <span className="material-symbols-outlined text-primary text-2xl">{f.icon}</span>
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{f.label}</span>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={handleFinish}
                            className="w-full bg-primary text-white font-extrabold py-5 rounded-full shadow-2xl shadow-primary/30 hover:brightness-110 active:scale-95 transition-all text-lg"
                        >
                            Start Tracking
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
