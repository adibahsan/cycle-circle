export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal';
export type FlowIntensity = 'light' | 'medium' | 'heavy';
export type SubscriptionStatus = 'free' | 'pro' | 'lapsed';
export type AuthMethod = 'otp' | 'email';
export type Language = 'en' | 'bn';
export type Theme = 'light' | 'dark';
export type ProfileRelation = 'self' | 'wife' | 'sister' | 'mother' | 'daughter' | 'girlfriend';
export type PredictionTier = 'average' | 'arima' | 'lstm';
export type FeedbackCategory = 'bug' | 'feature' | 'general' | 'satisfaction';
export type NotificationType = 'period_alert' | 'fertile_window' | 'logging_reminder';
export type SymptomCategory = 'physical' | 'mood' | 'discharge' | 'lifestyle';

export interface UserProfile {
  id: string;
  userId: string;
  name: string;
  relation: ProfileRelation;
  cycleLength: number;
  periodLength: number;
  lastPeriodStart: string;
  cycleHistory: number[];
  predictionTier: PredictionTier;
  createdAt: string;
}

export interface User {
  id: string;
  phone: string;
  email?: string;
  fullName: string;
  authMethod: AuthMethod;
  subscriptionStatus: SubscriptionStatus;
  language: Language;
  emailTrialExpiresAt?: string;
  profileCompleted: boolean;
  createdAt: string;
}

export interface PeriodLog {
  id: string;
  profileId: string;
  startDate: string;
  endDate: string;
  flowIntensity: FlowIntensity;
}

export interface SymptomLog {
  id: string;
  profileId: string;
  date: string;
  category: SymptomCategory;
  symptomId: string;
  value: string;
}

export interface Prediction {
  profileId: string;
  tier: PredictionTier;
  nextPeriodStart: string;
  ovulationDay: string;
  fertileStart: string;
  fertileEnd: string;
  confidence: number;
}

export interface Article {
  id: string;
  titleEn: string;
  titleBn: string;
  bodyEn: string;
  bodyBn: string;
  phaseTags: CyclePhase[];
  category: string;
  published: boolean;
  createdAt: string;
}

export interface FeedbackSubmission {
  id: string;
  userId: string;
  profileId: string;
  category: FeedbackCategory;
  message: string;
  rating?: number;
  createdAt: string;
}

export interface NotificationPreference {
  profileId: string;
  periodAlert: boolean;
  fertileWindow: boolean;
  loggingReminder: boolean;
}

export interface Symptom {
  id: string;
  name: string;
  nameEn: string;
  nameBn: string;
  icon: string;
  category: SymptomCategory;
}
