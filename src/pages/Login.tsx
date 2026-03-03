import React from 'react';
import { useNavigate } from 'react-router-dom';
import { DEMO_PROFILES, GOAL_LABELS, GOAL_COLORS, UserProfile } from '../data/profiles';
import { useAppContext } from '../context/AppContext';
import { formatDistanceToNow } from 'date-fns';

// ─── Avatar component ─────────────────────────────────────────────────────────
const Avatar: React.FC<{ profile: UserProfile; size?: string }> = ({ profile, size = 'w-20 h-20' }) =>
    profile.avatar ? (
        <img
            src={profile.avatar}
            alt={profile.name}
            className={`${size} rounded-full object-cover`}
        />
    ) : (
        <div className={`${size} rounded-full bg-gradient-to-br ${profile.gradientFrom} ${profile.gradientTo} flex items-center justify-center text-white font-bold text-2xl`}>
            {profile.name.charAt(0)}
        </div>
    );

// ─── Profile Card ─────────────────────────────────────────────────────────────
const ProfileCard: React.FC<{ profile: UserProfile; onSelect: () => void }> = ({ profile, onSelect }) => {
    const lastActive = formatDistanceToNow(new Date(profile.lastPeriodStart), { addSuffix: true });

    return (
        <button
            onClick={onSelect}
            className="group bg-white/70 dark:bg-slate-900/40 p-6 rounded-3xl flex flex-col items-center gap-4 text-center hover:border-primary/40 border border-transparent dark:border-slate-800 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 transition-all duration-300 cursor-pointer"
        >
            <div className="relative">
                <Avatar profile={profile} size="w-20 h-20" />
                <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 ${profile.mode === 'pregnancy' ? 'bg-amber-400' : 'bg-primary'} flex items-center justify-center`}>
                    <span className="material-symbols-outlined text-white text-xs">
                        {profile.mode === 'pregnancy' ? 'child_care' : 'favorite'}
                    </span>
                </div>
            </div>

            <div>
                <h3 className="font-bold text-lg leading-tight text-slate-900 dark:text-white">{profile.name}</h3>
                <p className="text-slate-500 text-sm mt-0.5">{profile.bio}</p>
            </div>

            <span className={`px-3 py-1 rounded-full text-xs font-bold ${GOAL_COLORS[profile.goal]}`}>
                {GOAL_LABELS[profile.goal]}
            </span>

            <div className="mt-auto flex items-center gap-1.5 text-xs text-slate-400">
                <span className="material-symbols-outlined text-sm">schedule</span>
                <span>Active {lastActive}</span>
            </div>

            {/* Hover highlight ring */}
            <div className="absolute inset-0 rounded-2xl ring-2 ring-primary ring-offset-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        </button>
    );
};

// ─── Login page ───────────────────────────────────────────────────────────────
export const Login: React.FC = () => {
    const { login } = useAppContext();
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-background-light dark:bg-slate-950 px-4 py-12 transition-colors duration-500">
            {/* Background gradient blobs */}
            <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] -z-10" />
            <div className="fixed bottom-[-20%] right-[-10%] w-[40%] h-[50%] bg-violet-500/10 rounded-full blur-[120px] -z-10" />

            {/* App logo + heading */}
            <div className="text-center mb-10 flex flex-col items-center">
                <img src="https://flo.health/images/flo.svg" alt="Flo Logo" className="h-16 w-auto mb-6 drop-shadow-sm" />
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">Cycle Circle</h1>
                <p className="mt-2 text-slate-500 dark:text-slate-400 text-lg">Who's tracking today?</p>
            </div>

            {/* Profile grid */}
            <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-3 gap-5 relative">
                {DEMO_PROFILES.map(profile => (
                    <ProfileCard
                        key={profile.id}
                        profile={profile}
                        onSelect={() => login(profile.id)}
                    />
                ))}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4 w-full max-w-3xl my-8">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                <span className="text-slate-400 text-sm font-medium">or</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            </div>

            {/* Create new profile */}
            <button
                onClick={() => navigate('/onboarding')}
                className="w-full max-w-3xl bg-white/70 dark:bg-slate-900/40 p-5 rounded-3xl border border-transparent dark:border-slate-800 flex items-center gap-4 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 transition-all duration-300 group"
            >
                <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center group-hover:border-primary group-hover:bg-primary/5 transition-colors">
                    <span className="material-symbols-outlined text-2xl text-slate-400 group-hover:text-primary transition-colors">add</span>
                </div>
                <div className="text-left">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">Create Your Profile</h3>
                    <p className="text-slate-500 text-sm">Set up your cycle preferences in 2 minutes</p>
                </div>
                <span className="material-symbols-outlined ml-auto text-slate-400 group-hover:text-primary transition-colors">chevron_right</span>
            </button>

            <p className="mt-10 text-xs text-slate-400 text-center max-w-sm">
                Your data is stored locally on this device and never shared with anyone.
            </p>
        </div>
    );
};
