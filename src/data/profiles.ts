import { addDays, startOfDay } from 'date-fns';

export type UserGoal = 'tracking' | 'ttc' | 'pregnancy';

export interface UserProfile {
    id: string;
    name: string;
    age: number;
    avatar: string | null;      // remote image URL, or null → use gradient
    gradientFrom: string;       // Tailwind from-* class
    gradientTo: string;         // Tailwind to-* class
    mode: 'tracking' | 'pregnancy';
    cycleLength: number;
    periodLength: number;
    lastPeriodStart: string;    // ISO date string
    pregnancyStartDate: string | null;
    goal: UserGoal;
    bio: string;
    cycleHistory: number[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const daysAgo = (n: number) => startOfDay(addDays(new Date(), -n)).toISOString();

// ─── Demo profiles ────────────────────────────────────────────────────────────
export const DEMO_PROFILES: UserProfile[] = [
    {
        id: 'sarah',
        name: 'Sarah Jenkins',
        age: 28,
        avatar: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA5pPL9DFH9CmFcwRWJCAWdbGl24f7kLWPea1Utv1xl5oVAZyxvkCikl76LwoRjP2DZcHongd00OsOA51dejS_n5p2pXrpPgkJiHl-Z02g96lWqie4iVWS_C9OcRF6yrE6TTBNhYf0pfJ2PUidmExYg-XJ-_4GR0snwjCEGnNQ3f64LywJMky3xTQcNEFN97SMK80YaAQzhSm4XvpCdDWuxOJzQABtUSy8DkPgn8Jz6hhGWmjuGoQyCSDZBQxvMY3keYGIbomYihuE',
        gradientFrom: 'from-pink-400',
        gradientTo: 'to-rose-500',
        mode: 'pregnancy',
        cycleLength: 28,
        periodLength: 5,
        lastPeriodStart: daysAgo(154),
        pregnancyStartDate: daysAgo(154),
        goal: 'pregnancy',
        bio: '22 weeks pregnant 🤰',
        cycleHistory: [27, 28, 29, 28, 27, 28],
    },
    {
        id: 'maya',
        name: 'Maya Singh',
        age: 25,
        avatar: null,
        gradientFrom: 'from-violet-400',
        gradientTo: 'to-pink-500',
        mode: 'tracking',
        cycleLength: 30,
        periodLength: 4,
        lastPeriodStart: daysAgo(7),
        pregnancyStartDate: null,
        goal: 'ttc',
        bio: 'Trying to conceive ✨',
        cycleHistory: [30, 31, 29, 30, 32, 30],
    },
    {
        id: 'emma',
        name: 'Emma Park',
        age: 31,
        avatar: null,
        gradientFrom: 'from-teal-400',
        gradientTo: 'to-sky-500',
        mode: 'tracking',
        cycleLength: 26,
        periodLength: 3,
        lastPeriodStart: daysAgo(14),
        pregnancyStartDate: null,
        goal: 'tracking',
        bio: 'Regular cycle tracker 🌸',
        cycleHistory: [26, 25, 27, 26, 26, 27],
    },
];

export const GOAL_LABELS: Record<UserGoal, string> = {
    tracking: 'Cycle Tracking',
    ttc: 'Trying to Conceive',
    pregnancy: 'Pregnancy',
};

export const GOAL_COLORS: Record<UserGoal, string> = {
    tracking: 'bg-primary/10 text-primary',
    ttc: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
    pregnancy: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
};

// ─── Seed a user's localStorage data from their profile on first login ─────────
export function seedUserData(profile: UserProfile): void {
    const p = (key: string) => `cc_${profile.id}_${key}`;
    const set = (key: string, val: unknown) =>
        localStorage.setItem(p(key), JSON.stringify(val));

    // Only seed if no data exists yet for this user
    if (localStorage.getItem(p('seeded'))) return;

    set('mode', profile.mode);
    set('cycleLength', profile.cycleLength);
    set('periodLength', profile.periodLength);
    set('lastPeriodStart', profile.lastPeriodStart);
    set('cycleHistory', profile.cycleHistory);
    set('symptoms', {});
    set('anonymousMode', false);
    set('anonymousName', '');
    set('seeded', true);
}
