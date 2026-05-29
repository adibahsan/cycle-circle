import type { SymptomCategory } from '@vesta/shared/types';

export interface Symptom {
  id: string;
  nameEn: string;
  nameBn: string;
  icon: string;
  category: SymptomCategory;
}

export const SYMPTOMS_DATA: Symptom[] = [
  // Physical
  { id: 'cramps', nameEn: 'Cramps', nameBn: 'ব্যথা', icon: '🔥', category: 'physical' },
  { id: 'headache', nameEn: 'Headache', nameBn: 'মাথাব্যথা', icon: '🤕', category: 'physical' },
  { id: 'bloating', nameEn: 'Bloating', nameBn: 'ফোলাভাব', icon: '🎈', category: 'physical' },
  { id: 'fatigue', nameEn: 'Fatigue', nameBn: 'ক্লান্তি', icon: '😴', category: 'physical' },
  { id: 'breast-tenderness', nameEn: 'Breast Tenderness', nameBn: 'স্তন কোমলতা', icon: '💗', category: 'physical' },
  { id: 'backache', nameEn: 'Backache', nameBn: 'পিঠে ব্যথা', icon: '🦴', category: 'physical' },
  { id: 'nausea', nameEn: 'Nausea', nameBn: 'বমি বমি ভাব', icon: '🤢', category: 'physical' },
  { id: 'acne', nameEn: 'Acne', nameBn: 'ব্রণ', icon: '😣', category: 'physical' },
  { id: 'hot-flashes', nameEn: 'Hot Flashes', nameBn: 'গরম ঝলকানি', icon: '🌡️', category: 'physical' },
  { id: 'dizziness', nameEn: 'Dizziness', nameBn: 'মাথা ঘোরা', icon: '💫', category: 'physical' },
  // Mood
  { id: 'happy', nameEn: 'Happy', nameBn: 'খুশি', icon: '😊', category: 'mood' },
  { id: 'sad', nameEn: 'Sad', nameBn: 'দুঃখী', icon: '😢', category: 'mood' },
  { id: 'anxious', nameEn: 'Anxious', nameBn: 'উদ্বিগ্ন', icon: '😰', category: 'mood' },
  { id: 'irritable', nameEn: 'Irritable', nameBn: 'খিটখিটে', icon: '😤', category: 'mood' },
  { id: 'calm', nameEn: 'Calm', nameBn: 'শান্ত', icon: '😌', category: 'mood' },
  { id: 'energetic', nameEn: 'Energetic', nameBn: 'উদ্যমী', icon: '⚡', category: 'mood' },
  { id: 'mood-swings', nameEn: 'Mood Swings', nameBn: 'মেজাজের ওঠানামা', icon: '🎭', category: 'mood' },
  { id: 'emotional', nameEn: 'Emotional', nameBn: 'আবেগপ্রবণ', icon: '🥺', category: 'mood' },
  // Discharge
  { id: 'dry', nameEn: 'Dry', nameBn: 'শুষ্ক', icon: '🏜️', category: 'discharge' },
  { id: 'sticky', nameEn: 'Sticky', nameBn: 'আঠালো', icon: '🫧', category: 'discharge' },
  { id: 'creamy', nameEn: 'Creamy', nameBn: 'ক্রিমি', icon: '🥛', category: 'discharge' },
  { id: 'watery', nameEn: 'Watery', nameBn: 'পানিদার', icon: '💧', category: 'discharge' },
  { id: 'egg-white', nameEn: 'Egg White', nameBn: 'ডিমের সাদা অংশ', icon: '🥚', category: 'discharge' },
  { id: 'spotting', nameEn: 'Spotting', nameBn: 'স্পটিং', icon: '🩸', category: 'discharge' },
  // Lifestyle
  { id: 'exercise', nameEn: 'Exercise', nameBn: 'ব্যায়াম', icon: '🏃‍♀️', category: 'lifestyle' },
  { id: 'poor-sleep', nameEn: 'Poor Sleep', nameBn: 'খারাপ ঘুম', icon: '😵', category: 'lifestyle' },
  { id: 'good-sleep', nameEn: 'Good Sleep', nameBn: 'ভালো ঘুম', icon: '😴', category: 'lifestyle' },
  { id: 'stress', nameEn: 'Stress', nameBn: 'মানসিক চাপ', icon: '😫', category: 'lifestyle' },
  { id: 'high-libido', nameEn: 'High Libido', nameBn: 'উচ্চ কামশক্তি', icon: '❤️‍🔥', category: 'lifestyle' },
  { id: 'low-libido', nameEn: 'Low Libido', nameBn: 'কম কামশক্তি', icon: '💤', category: 'lifestyle' },
  { id: 'cravings', nameEn: 'Cravings', nameBn: 'খাবারের লালসা', icon: '🍫', category: 'lifestyle' },
  { id: 'travel', nameEn: 'Travel', nameBn: 'ভ্রমণ', icon: '✈️', category: 'lifestyle' },
];
