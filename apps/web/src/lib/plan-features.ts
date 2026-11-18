/** Which features are Free and which are Pro. Keep it true: only SMS alerts are gated by plan (isProSubscriber). Source of truth for /subscription and the landing page. */
export const COMPARISON_FEATURE_KEYS = [
  { key: 'cycleTracking', labelKey: 'subscription.cycleTracking', free: true, pro: true },
  { key: 'calendar', labelKey: 'subscription.calendarView', free: true, pro: true },
  { key: 'symptoms', labelKey: 'subscription.symptomLogging', free: true, pro: true },
  { key: 'content', labelKey: 'subscription.healthArticles', free: true, pro: true },
  { key: 'export', labelKey: 'subscription.dataExport', free: true, pro: true },
  { key: 'predictions', labelKey: 'subscription.advancedPredictions', free: true, pro: true },
  { key: 'smsAlerts', labelKey: 'subscription.smsAlertsShort', free: false, pro: true },
]
