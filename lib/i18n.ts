import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      app: { name: 'Vesta', tagline: 'Your cycle, your way' },
      nav: { dashboard: 'Dashboard', calendar: 'Calendar', symptoms: 'Symptoms', content: 'Learn', settings: 'Settings', feedback: 'Feedback', profiles: 'Profiles', subscription: 'Subscription' },
      auth: {
        login: 'Log In', signup: 'Sign Up', phone: 'Phone Number', otp: 'Enter OTP',
        sendOtp: 'Send OTP', verifyOtp: 'Verify', resendIn: 'Resend in {{seconds}}s',
        emailFallback: 'Login with Email instead', emailPlaceholder: 'Enter your email',
        sendMagicLink: 'Send Magic Link', magicLinkSent: 'Check your inbox!',
        profileCompletion: 'Complete Your Profile', fullName: 'Full Name',
        phoneVerified: 'Verified Phone', continue: 'Continue',
      },
      onboarding: {
        welcome: 'Welcome to Vesta', privacy: 'Your data is encrypted & private',
        goal: 'What is your goal?', goalTracking: 'Period Tracking',
        goalConceive: 'Trying to Conceive', goalPerimenopause: 'Perimenopause',
        cycleLength: 'Typical cycle length', periodLength: 'Typical period length',
        lastPeriod: 'Last period start date', skip: 'Skip for now', next: 'Next', done: 'Get Started',
      },
      dashboard: {
        day: 'Day', phase: 'Phase', nextPeriod: 'Next period in', days: 'days',
        lastPeriod: 'Last Period', confidence: 'Confidence', logPeriod: 'Log Period',
        tier: 'Prediction Tier', menstrual: 'Menstrual', follicular: 'Follicular',
        ovulation: 'Ovulation', luteal: 'Luteal',
      },
      calendar: {
        title: 'Calendar', period: 'Period', fertile: 'Fertile', ovulationDay: 'Ovulation',
        today: 'Today',
      },
      symptoms: {
        title: 'Log Symptoms', physical: 'Physical', mood: 'Mood',
        discharge: 'Discharge', lifestyle: 'Lifestyle', selectDate: 'Select date',
        saved: 'Symptoms saved!',
      },
      content: {
        title: 'Health Articles', forYourPhase: 'For your current phase',
        allArticles: 'All Articles', readMore: 'Read more',
      },
      feedback: {
        title: 'Feedback', bug: 'Bug Report', feature: 'Feature Request',
        general: 'General', satisfaction: 'Satisfaction', message: 'Your message...',
        rating: 'Rating', submit: 'Submit Feedback', success: 'Thank you for your feedback!',
      },
      subscription: {
        title: 'Go Pro', currentPlan: 'Current Plan', free: 'Free', pro: 'Pro',
        upgrade: 'Upgrade to Pro', price: '৳99/month', features: 'Pro Features',
        smsAlerts: 'SMS Period & Fertile Alerts', prioritySupport: 'Priority Support',
        advancedInsights: 'Advanced Cycle Insights',
      },
      settings: {
        title: 'Settings', language: 'Language', theme: 'Theme', notifications: 'Notifications',
        export: 'Export Data', exportCsv: 'Export as CSV', exportExcel: 'Export as Excel',
        logout: 'Log Out', periodAlert: 'Period Alerts', fertileAlert: 'Fertile Window Alerts',
        reminderAlert: 'Logging Reminders',
      },
      profiles: {
        title: 'My Profiles', add: 'Add Profile', switchTo: 'Switch to',
        self: 'Self', wife: 'Wife', sister: 'Sister', mother: 'Mother',
        daughter: 'Daughter', girlfriend: 'Girlfriend', maxReached: 'Maximum 6 profiles',
      },
      common: {
        save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit', back: 'Back',
        loading: 'Loading...', error: 'Something went wrong',
      },
    },
  },
  bn: {
    translation: {
      app: { name: '[BN] Vesta', tagline: '[BN] Your cycle, your way' },
      nav: { dashboard: '[BN] Dashboard', calendar: '[BN] Calendar', symptoms: '[BN] Symptoms', content: '[BN] Learn', settings: '[BN] Settings', feedback: '[BN] Feedback', profiles: '[BN] Profiles', subscription: '[BN] Subscription' },
      auth: {
        login: '[BN] Log In', signup: '[BN] Sign Up', phone: '[BN] Phone Number', otp: '[BN] Enter OTP',
        sendOtp: '[BN] Send OTP', verifyOtp: '[BN] Verify', resendIn: '[BN] Resend in {{seconds}}s',
        emailFallback: '[BN] Login with Email instead', emailPlaceholder: '[BN] Enter your email',
        sendMagicLink: '[BN] Send Magic Link', magicLinkSent: '[BN] Check your inbox!',
        profileCompletion: '[BN] Complete Your Profile', fullName: '[BN] Full Name',
        phoneVerified: '[BN] Verified Phone', continue: '[BN] Continue',
      },
      onboarding: {
        welcome: '[BN] Welcome to Vesta', privacy: '[BN] Your data is encrypted & private',
        goal: '[BN] What is your goal?', goalTracking: '[BN] Period Tracking',
        goalConceive: '[BN] Trying to Conceive', goalPerimenopause: '[BN] Perimenopause',
        cycleLength: '[BN] Typical cycle length', periodLength: '[BN] Typical period length',
        lastPeriod: '[BN] Last period start date', skip: '[BN] Skip for now', next: '[BN] Next', done: '[BN] Get Started',
      },
      dashboard: {
        day: '[BN] Day', phase: '[BN] Phase', nextPeriod: '[BN] Next period in', days: '[BN] days',
        lastPeriod: '[BN] Last Period', confidence: '[BN] Confidence', logPeriod: '[BN] Log Period',
        tier: '[BN] Prediction Tier', menstrual: '[BN] Menstrual', follicular: '[BN] Follicular',
        ovulation: '[BN] Ovulation', luteal: '[BN] Luteal',
      },
      calendar: {
        title: '[BN] Calendar', period: '[BN] Period', fertile: '[BN] Fertile', ovulationDay: '[BN] Ovulation',
        today: '[BN] Today',
      },
      symptoms: {
        title: '[BN] Log Symptoms', physical: '[BN] Physical', mood: '[BN] Mood',
        discharge: '[BN] Discharge', lifestyle: '[BN] Lifestyle', selectDate: '[BN] Select date',
        saved: '[BN] Symptoms saved!',
      },
      content: {
        title: '[BN] Health Articles', forYourPhase: '[BN] For your current phase',
        allArticles: '[BN] All Articles', readMore: '[BN] Read more',
      },
      feedback: {
        title: '[BN] Feedback', bug: '[BN] Bug Report', feature: '[BN] Feature Request',
        general: '[BN] General', satisfaction: '[BN] Satisfaction', message: '[BN] Your message...',
        rating: '[BN] Rating', submit: '[BN] Submit Feedback', success: '[BN] Thank you for your feedback!',
      },
      subscription: {
        title: '[BN] Go Pro', currentPlan: '[BN] Current Plan', free: '[BN] Free', pro: '[BN] Pro',
        upgrade: '[BN] Upgrade to Pro', price: '[BN] ৳99/month', features: '[BN] Pro Features',
        smsAlerts: '[BN] SMS Period & Fertile Alerts', prioritySupport: '[BN] Priority Support',
        advancedInsights: '[BN] Advanced Cycle Insights',
      },
      settings: {
        title: '[BN] Settings', language: '[BN] Language', theme: '[BN] Theme', notifications: '[BN] Notifications',
        export: '[BN] Export Data', exportCsv: '[BN] Export as CSV', exportExcel: '[BN] Export as Excel',
        logout: '[BN] Log Out', periodAlert: '[BN] Period Alerts', fertileAlert: '[BN] Fertile Window Alerts',
        reminderAlert: '[BN] Logging Reminders',
      },
      profiles: {
        title: '[BN] My Profiles', add: '[BN] Add Profile', switchTo: '[BN] Switch to',
        self: '[BN] Self', wife: '[BN] Wife', sister: '[BN] Sister', mother: '[BN] Mother',
        daughter: '[BN] Daughter', girlfriend: '[BN] Girlfriend', maxReached: '[BN] Maximum 6 profiles',
      },
      common: {
        save: '[BN] Save', cancel: '[BN] Cancel', delete: '[BN] Delete', edit: '[BN] Edit', back: '[BN] Back',
        loading: '[BN] Loading...', error: '[BN] Something went wrong',
      },
    },
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
  });

export default i18n;
