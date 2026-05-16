import { addDays, subDays, format } from 'date-fns';
import type { User, UserProfile, PeriodLog, Prediction, Article, Symptom, FeedbackSubmission, NotificationPreference } from './types';

const today = new Date();

export const DEMO_USER: User = {
  id: 'user-1',
  phone: '8801712345678',
  email: 'demo@vesta.app',
  fullName: 'Fatima Rahman',
  authMethod: 'otp',
  subscriptionStatus: 'free',
  language: 'en',
  profileCompleted: true,
  createdAt: '2026-04-01T00:00:00Z',
};

export const DEMO_PROFILES: UserProfile[] = [
  {
    id: 'profile-1',
    userId: 'user-1',
    name: 'Fatima',
    relation: 'self',
    cycleLength: 28,
    periodLength: 5,
    lastPeriodStart: format(subDays(today, 14), 'yyyy-MM-dd'),
    cycleHistory: [27, 29, 28, 30, 27, 28, 29, 28],
    predictionTier: 'arima',
    createdAt: '2026-04-01T00:00:00Z',
  },
  {
    id: 'profile-2',
    userId: 'user-1',
    name: 'Nusrat',
    relation: 'sister',
    cycleLength: 30,
    periodLength: 4,
    lastPeriodStart: format(subDays(today, 7), 'yyyy-MM-dd'),
    cycleHistory: [30, 31, 29, 30],
    predictionTier: 'average',
    createdAt: '2026-04-15T00:00:00Z',
  },
];

export const DEMO_PERIOD_LOGS: PeriodLog[] = [
  { id: 'pl-1', profileId: 'profile-1', startDate: format(subDays(today, 14), 'yyyy-MM-dd'), endDate: format(subDays(today, 10), 'yyyy-MM-dd'), flowIntensity: 'medium' },
  { id: 'pl-2', profileId: 'profile-1', startDate: format(subDays(today, 42), 'yyyy-MM-dd'), endDate: format(subDays(today, 38), 'yyyy-MM-dd'), flowIntensity: 'heavy' },
  { id: 'pl-3', profileId: 'profile-1', startDate: format(subDays(today, 70), 'yyyy-MM-dd'), endDate: format(subDays(today, 66), 'yyyy-MM-dd'), flowIntensity: 'medium' },
];

export const DEMO_PREDICTION: Prediction = {
  profileId: 'profile-1',
  tier: 'arima',
  nextPeriodStart: format(addDays(today, 14), 'yyyy-MM-dd'),
  ovulationDay: format(addDays(today, 0), 'yyyy-MM-dd'),
  fertileStart: format(subDays(today, 2), 'yyyy-MM-dd'),
  fertileEnd: format(addDays(today, 2), 'yyyy-MM-dd'),
  confidence: 87,
};

export const SYMPTOMS_DATA: Symptom[] = [
  // Physical
  { id: 'cramps', name: 'Cramps', nameEn: 'Cramps', nameBn: '[BN] Cramps', icon: '🔥', category: 'physical' },
  { id: 'headache', name: 'Headache', nameEn: 'Headache', nameBn: '[BN] Headache', icon: '🤕', category: 'physical' },
  { id: 'bloating', name: 'Bloating', nameEn: 'Bloating', nameBn: '[BN] Bloating', icon: '🎈', category: 'physical' },
  { id: 'fatigue', name: 'Fatigue', nameEn: 'Fatigue', nameBn: '[BN] Fatigue', icon: '😴', category: 'physical' },
  { id: 'breast-tenderness', name: 'Breast Tenderness', nameEn: 'Breast Tenderness', nameBn: '[BN] Breast Tenderness', icon: '💗', category: 'physical' },
  { id: 'backache', name: 'Backache', nameEn: 'Backache', nameBn: '[BN] Backache', icon: '🦴', category: 'physical' },
  { id: 'nausea', name: 'Nausea', nameEn: 'Nausea', nameBn: '[BN] Nausea', icon: '🤢', category: 'physical' },
  { id: 'acne', name: 'Acne', nameEn: 'Acne', nameBn: '[BN] Acne', icon: '😣', category: 'physical' },
  { id: 'hot-flashes', name: 'Hot Flashes', nameEn: 'Hot Flashes', nameBn: '[BN] Hot Flashes', icon: '🌡️', category: 'physical' },
  { id: 'dizziness', name: 'Dizziness', nameEn: 'Dizziness', nameBn: '[BN] Dizziness', icon: '💫', category: 'physical' },
  // Mood
  { id: 'happy', name: 'Happy', nameEn: 'Happy', nameBn: '[BN] Happy', icon: '😊', category: 'mood' },
  { id: 'sad', name: 'Sad', nameEn: 'Sad', nameBn: '[BN] Sad', icon: '😢', category: 'mood' },
  { id: 'anxious', name: 'Anxious', nameEn: 'Anxious', nameBn: '[BN] Anxious', icon: '😰', category: 'mood' },
  { id: 'irritable', name: 'Irritable', nameEn: 'Irritable', nameBn: '[BN] Irritable', icon: '😤', category: 'mood' },
  { id: 'calm', name: 'Calm', nameEn: 'Calm', nameBn: '[BN] Calm', icon: '😌', category: 'mood' },
  { id: 'energetic', name: 'Energetic', nameEn: 'Energetic', nameBn: '[BN] Energetic', icon: '⚡', category: 'mood' },
  { id: 'mood-swings', name: 'Mood Swings', nameEn: 'Mood Swings', nameBn: '[BN] Mood Swings', icon: '🎭', category: 'mood' },
  { id: 'emotional', name: 'Emotional', nameEn: 'Emotional', nameBn: '[BN] Emotional', icon: '🥺', category: 'mood' },
  // Discharge
  { id: 'dry', name: 'Dry', nameEn: 'Dry', nameBn: '[BN] Dry', icon: '🏜️', category: 'discharge' },
  { id: 'sticky', name: 'Sticky', nameEn: 'Sticky', nameBn: '[BN] Sticky', icon: '🫧', category: 'discharge' },
  { id: 'creamy', name: 'Creamy', nameEn: 'Creamy', nameBn: '[BN] Creamy', icon: '🥛', category: 'discharge' },
  { id: 'watery', name: 'Watery', nameEn: 'Watery', nameBn: '[BN] Watery', icon: '💧', category: 'discharge' },
  { id: 'egg-white', name: 'Egg White', nameEn: 'Egg White', nameBn: '[BN] Egg White', icon: '🥚', category: 'discharge' },
  { id: 'spotting', name: 'Spotting', nameEn: 'Spotting', nameBn: '[BN] Spotting', icon: '🩸', category: 'discharge' },
  // Lifestyle
  { id: 'exercise', name: 'Exercise', nameEn: 'Exercise', nameBn: '[BN] Exercise', icon: '🏃‍♀️', category: 'lifestyle' },
  { id: 'poor-sleep', name: 'Poor Sleep', nameEn: 'Poor Sleep', nameBn: '[BN] Poor Sleep', icon: '😵', category: 'lifestyle' },
  { id: 'good-sleep', name: 'Good Sleep', nameEn: 'Good Sleep', nameBn: '[BN] Good Sleep', icon: '😴', category: 'lifestyle' },
  { id: 'stress', name: 'Stress', nameEn: 'Stress', nameBn: '[BN] Stress', icon: '😫', category: 'lifestyle' },
  { id: 'high-libido', name: 'High Libido', nameEn: 'High Libido', nameBn: '[BN] High Libido', icon: '❤️‍🔥', category: 'lifestyle' },
  { id: 'low-libido', name: 'Low Libido', nameEn: 'Low Libido', nameBn: '[BN] Low Libido', icon: '💤', category: 'lifestyle' },
  { id: 'cravings', name: 'Cravings', nameEn: 'Cravings', nameBn: '[BN] Cravings', icon: '🍫', category: 'lifestyle' },
  { id: 'travel', name: 'Travel', nameEn: 'Travel', nameBn: '[BN] Travel', icon: '✈️', category: 'lifestyle' },
];

export const DEMO_ARTICLES: Article[] = [
  {
    id: 'art-1',
    titleEn: 'Understanding Your Menstrual Phase',
    titleBn: '[BN] Understanding Your Menstrual Phase',
    bodyEn: 'During menstruation, your body sheds the uterine lining. This phase typically lasts 3-7 days. It is normal to experience cramps, fatigue, and mood changes. Focus on rest, hydration, and gentle movement like yoga or walking.',
    bodyBn: '[BN] During menstruation, your body sheds the uterine lining...',
    phaseTags: ['menstrual'],
    category: 'Health',
    published: true,
    createdAt: '2026-04-10T00:00:00Z',
  },
  {
    id: 'art-2',
    titleEn: 'Nutrition During Your Follicular Phase',
    titleBn: '[BN] Nutrition During Your Follicular Phase',
    bodyEn: 'As estrogen rises during the follicular phase, your energy increases. This is a great time to focus on iron-rich foods, leafy greens, and lean proteins to replenish what was lost during menstruation.',
    bodyBn: '[BN] As estrogen rises during the follicular phase...',
    phaseTags: ['follicular'],
    category: 'Nutrition',
    published: true,
    createdAt: '2026-04-12T00:00:00Z',
  },
  {
    id: 'art-3',
    titleEn: 'Maximizing Your Ovulation Window',
    titleBn: '[BN] Maximizing Your Ovulation Window',
    bodyEn: 'Ovulation is when your body releases an egg. You may notice increased energy, higher libido, and clearer skin. This is your most fertile time — if you are trying to conceive, this is your window.',
    bodyBn: '[BN] Ovulation is when your body releases an egg...',
    phaseTags: ['ovulation'],
    category: 'Fertility',
    published: true,
    createdAt: '2026-04-14T00:00:00Z',
  },
  {
    id: 'art-4',
    titleEn: 'Managing the Luteal Phase',
    titleBn: '[BN] Managing the Luteal Phase',
    bodyEn: 'The luteal phase can bring PMS symptoms as progesterone rises then falls. Combat bloating with magnesium-rich foods, manage mood swings with mindfulness, and prioritize sleep.',
    bodyBn: '[BN] The luteal phase can bring PMS symptoms...',
    phaseTags: ['luteal'],
    category: 'Wellness',
    published: true,
    createdAt: '2026-04-16T00:00:00Z',
  },
  {
    id: 'art-5',
    titleEn: 'Exercise Throughout Your Cycle',
    titleBn: '[BN] Exercise Throughout Your Cycle',
    bodyEn: 'Adapt your workouts to your cycle. High-intensity during follicular/ovulation phases, and gentler activities like yoga and walking during menstrual and luteal phases.',
    bodyBn: '[BN] Adapt your workouts to your cycle...',
    phaseTags: ['menstrual', 'follicular', 'ovulation', 'luteal'],
    category: 'Fitness',
    published: true,
    createdAt: '2026-04-18T00:00:00Z',
  },
];

export const DEMO_FEEDBACK: FeedbackSubmission[] = [
  { id: 'fb-1', userId: 'user-1', profileId: 'profile-1', category: 'general', message: 'Love the app! Very intuitive.', rating: 5, createdAt: '2026-05-01T10:00:00Z' },
];

export const DEMO_NOTIFICATION_PREFS: NotificationPreference = {
  profileId: 'profile-1',
  periodAlert: true,
  fertileWindow: true,
  loggingReminder: false,
};
