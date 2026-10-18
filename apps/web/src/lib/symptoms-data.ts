import {
  Angry,
  ArrowUpDown,
  BatteryLow,
  Bone,
  Brain,
  CircleDot,
  CloudMoon,
  CloudRain,
  Cookie,
  Dot,
  Droplet,
  Droplets,
  Dumbbell,
  Egg,
  Flame,
  Frown,
  Gauge,
  HandHeart,
  HeartOff,
  HeartPulse,
  Leaf,
  Milk,
  Moon,
  Orbit,
  Plane,
  Smile,
  Sparkles,
  Sun,
  Thermometer,
  Waves,
  Wind,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { SymptomCategory } from '@vesta/shared/types';

export interface Symptom {
  id: string;
  nameEn: string;
  nameBn: string;
  /** Drawn icon (decorative; render with aria-hidden). */
  icon: LucideIcon;
  category: SymptomCategory;
}

export const SYMPTOMS_DATA: Symptom[] = [
  // Physical
  { id: 'cramps', nameEn: 'Cramps', nameBn: 'ব্যথা', icon: Flame, category: 'physical' },
  { id: 'headache', nameEn: 'Headache', nameBn: 'মাথাব্যথা', icon: Brain, category: 'physical' },
  { id: 'bloating', nameEn: 'Bloating', nameBn: 'ফোলাভাব', icon: Wind, category: 'physical' },
  { id: 'fatigue', nameEn: 'Fatigue', nameBn: 'ক্লান্তি', icon: BatteryLow, category: 'physical' },
  { id: 'breast-tenderness', nameEn: 'Breast Tenderness', nameBn: 'স্তন কোমলতা', icon: HeartPulse, category: 'physical' },
  { id: 'backache', nameEn: 'Backache', nameBn: 'পিঠে ব্যথা', icon: Bone, category: 'physical' },
  { id: 'nausea', nameEn: 'Nausea', nameBn: 'বমি বমি ভাব', icon: Waves, category: 'physical' },
  { id: 'acne', nameEn: 'Acne', nameBn: 'ব্রণ', icon: CircleDot, category: 'physical' },
  { id: 'hot-flashes', nameEn: 'Hot Flashes', nameBn: 'গরম ঝলকানি', icon: Thermometer, category: 'physical' },
  { id: 'dizziness', nameEn: 'Dizziness', nameBn: 'মাথা ঘোরা', icon: Orbit, category: 'physical' },
  // Mood
  { id: 'happy', nameEn: 'Happy', nameBn: 'খুশি', icon: Smile, category: 'mood' },
  { id: 'sad', nameEn: 'Sad', nameBn: 'দুঃখী', icon: Frown, category: 'mood' },
  { id: 'anxious', nameEn: 'Anxious', nameBn: 'উদ্বিগ্ন', icon: CloudRain, category: 'mood' },
  { id: 'irritable', nameEn: 'Irritable', nameBn: 'খিটখিটে', icon: Angry, category: 'mood' },
  { id: 'calm', nameEn: 'Calm', nameBn: 'শান্ত', icon: Leaf, category: 'mood' },
  { id: 'energetic', nameEn: 'Energetic', nameBn: 'উদ্যমী', icon: Zap, category: 'mood' },
  { id: 'mood-swings', nameEn: 'Mood Swings', nameBn: 'মেজাজের ওঠানামা', icon: ArrowUpDown, category: 'mood' },
  { id: 'emotional', nameEn: 'Emotional', nameBn: 'আবেগপ্রবণ', icon: HandHeart, category: 'mood' },
  // Discharge
  { id: 'dry', nameEn: 'Dry', nameBn: 'শুষ্ক', icon: Sun, category: 'discharge' },
  { id: 'sticky', nameEn: 'Sticky', nameBn: 'আঠালো', icon: Droplets, category: 'discharge' },
  { id: 'creamy', nameEn: 'Creamy', nameBn: 'ক্রিমি', icon: Milk, category: 'discharge' },
  { id: 'watery', nameEn: 'Watery', nameBn: 'পানিদার', icon: Droplet, category: 'discharge' },
  { id: 'egg-white', nameEn: 'Egg White', nameBn: 'ডিমের সাদা অংশ', icon: Egg, category: 'discharge' },
  { id: 'spotting', nameEn: 'Spotting', nameBn: 'স্পটিং', icon: Dot, category: 'discharge' },
  // Lifestyle
  { id: 'exercise', nameEn: 'Exercise', nameBn: 'ব্যায়াম', icon: Dumbbell, category: 'lifestyle' },
  { id: 'poor-sleep', nameEn: 'Poor Sleep', nameBn: 'খারাপ ঘুম', icon: CloudMoon, category: 'lifestyle' },
  { id: 'good-sleep', nameEn: 'Good Sleep', nameBn: 'ভালো ঘুম', icon: Moon, category: 'lifestyle' },
  { id: 'stress', nameEn: 'Stress', nameBn: 'মানসিক চাপ', icon: Gauge, category: 'lifestyle' },
  { id: 'high-libido', nameEn: 'High Libido', nameBn: 'উচ্চ কামশক্তি', icon: Sparkles, category: 'lifestyle' },
  { id: 'low-libido', nameEn: 'Low Libido', nameBn: 'কম কামশক্তি', icon: HeartOff, category: 'lifestyle' },
  { id: 'cravings', nameEn: 'Cravings', nameBn: 'খাবারের লালসা', icon: Cookie, category: 'lifestyle' },
  { id: 'travel', nameEn: 'Travel', nameBn: 'ভ্রমণ', icon: Plane, category: 'lifestyle' },
];

export function toDbCategory(
  category: SymptomCategory
): 'PHYSICAL' | 'MOOD' | 'DISCHARGE' | 'LIFESTYLE' {
  return category.toUpperCase() as 'PHYSICAL' | 'MOOD' | 'DISCHARGE' | 'LIFESTYLE';
}
