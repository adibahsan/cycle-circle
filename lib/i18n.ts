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
      app: { name: 'ভেস্তা', tagline: 'আপনার চক্র, আপনার পথে' },
      nav: { dashboard: 'ড্যাশবোর্ড', calendar: 'ক্যালেন্ডার', symptoms: 'লক্ষণ', content: 'শিখুন', settings: 'সেটিংস', feedback: 'মতামত', profiles: 'প্রোফাইল', subscription: 'সাবস্ক্রিপশন' },
      auth: {
        login: 'লগ ইন', signup: 'সাইন আপ', phone: 'ফোন নম্বর', otp: 'ওটিপি দিন',
        sendOtp: 'ওটিপি পাঠান', verifyOtp: 'যাচাই করুন', resendIn: '{{seconds}} সেকেন্ডে পুনরায় পাঠান',
        emailFallback: 'ইমেইল দিয়ে লগইন করুন', emailPlaceholder: 'আপনার ইমেইল দিন',
        sendMagicLink: 'ম্যাজিক লিংক পাঠান', magicLinkSent: 'আপনার ইনবক্স দেখুন!',
        profileCompletion: 'প্রোফাইল সম্পূর্ণ করুন', fullName: 'পুরো নাম',
        phoneVerified: 'ফোন যাচাইকৃত', continue: 'এগিয়ে যান',
      },
      onboarding: {
        welcome: 'ভেস্তায় স্বাগতম', privacy: 'আপনার তথ্য এনক্রিপ্টেড ও ব্যক্তিগত',
        goal: 'আপনার লক্ষ্য কী?', goalTracking: 'পিরিয়ড ট্র্যাকিং',
        goalConceive: 'গর্ভধারণের চেষ্টা', goalPerimenopause: 'পেরিমেনোপজ',
        cycleLength: 'সাধারণ চক্রের দৈর্ঘ্য', periodLength: 'সাধারণ পিরিয়ডের দৈর্ঘ্য',
        lastPeriod: 'শেষ পিরিয়ড শুরুর তারিখ', skip: 'আপাতত বাদ দিন', next: 'পরবর্তী', done: 'শুরু করুন',
      },
      dashboard: {
        day: 'দিন', phase: 'পর্যায়', nextPeriod: 'পরবর্তী পিরিয়ড', days: 'দিন',
        lastPeriod: 'শেষ পিরিয়ড', confidence: 'নির্ভুলতা', logPeriod: 'পিরিয়ড লগ করুন',
        tier: 'পূর্বাভাস স্তর', menstrual: 'ঋতুস্রাব', follicular: 'ফলিকুলার',
        ovulation: 'ডিম্বস্ফোটন', luteal: 'লুটিয়াল',
      },
      calendar: {
        title: 'ক্যালেন্ডার', period: 'পিরিয়ড', fertile: 'উর্বর', ovulationDay: 'ডিম্বস্ফোটন',
        today: 'আজ',
      },
      symptoms: {
        title: 'লক্ষণ লগ করুন', physical: 'শারীরিক', mood: 'মেজাজ',
        discharge: 'স্রাব', lifestyle: 'জীবনযাত্রা', selectDate: 'তারিখ নির্বাচন করুন',
        saved: 'লক্ষণ সংরক্ষিত!',
      },
      content: {
        title: 'স্বাস্থ্য নিবন্ধ', forYourPhase: 'আপনার বর্তমান পর্যায়ের জন্য',
        allArticles: 'সব নিবন্ধ', readMore: 'আরও পড়ুন',
      },
      feedback: {
        title: 'মতামত', bug: 'বাগ রিপোর্ট', feature: 'ফিচার অনুরোধ',
        general: 'সাধারণ', satisfaction: 'সন্তুষ্টি', message: 'আপনার বার্তা...',
        rating: 'রেটিং', submit: 'মতামত জমা দিন', success: 'আপনার মতামতের জন্য ধন্যবাদ!',
      },
      subscription: {
        title: 'প্রো হন', currentPlan: 'বর্তমান প্ল্যান', free: 'ফ্রি', pro: 'প্রো',
        upgrade: 'প্রো তে আপগ্রেড করুন', price: '৳৯৯/মাস', features: 'প্রো ফিচার',
        smsAlerts: 'এসএমএস পিরিয়ড ও উর্বর সতর্কতা', prioritySupport: 'অগ্রাধিকার সহায়তা',
        advancedInsights: 'উন্নত চক্র বিশ্লেষণ',
      },
      settings: {
        title: 'সেটিংস', language: 'ভাষা', theme: 'থিম', notifications: 'বিজ্ঞপ্তি',
        export: 'ডেটা এক্সপোর্ট', exportCsv: 'CSV হিসেবে এক্সপোর্ট', exportExcel: 'Excel হিসেবে এক্সপোর্ট',
        logout: 'লগ আউট', periodAlert: 'পিরিয়ড সতর্কতা', fertileAlert: 'উর্বর উইন্ডো সতর্কতা',
        reminderAlert: 'লগিং রিমাইন্ডার',
      },
      profiles: {
        title: 'আমার প্রোফাইল', add: 'প্রোফাইল যোগ করুন', switchTo: 'পরিবর্তন করুন',
        self: 'নিজে', wife: 'স্ত্রী', sister: 'বোন', mother: 'মা',
        daughter: 'মেয়ে', girlfriend: 'বান্ধবী', maxReached: 'সর্বোচ্চ ৬টি প্রোফাইল',
      },
      common: {
        save: 'সংরক্ষণ', cancel: 'বাতিল', delete: 'মুছুন', edit: 'সম্পাদনা', back: 'ফিরে যান',
        loading: 'লোড হচ্ছে...', error: 'কিছু একটা ভুল হয়েছে',
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
