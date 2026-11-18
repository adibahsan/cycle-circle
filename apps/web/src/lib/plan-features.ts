/** Which features are Free and which are Pro. Source of truth for /subscription and the landing page. */
export const COMPARISON_FEATURE_KEYS = [
  { key: 'cycleTracking', labelKey: 'subscription.cycleTracking', free: true, pro: true },
  { key: 'calendar', labelKey: 'subscription.calendarView', free: true, pro: true },
  { key: 'symptoms', labelKey: 'subscription.symptomLogging', free: true, pro: true },
  { key: 'content', labelKey: 'subscription.healthArticles', free: true, pro: true },
  { key: 'smsAlerts', labelKey: 'subscription.smsAlertsShort', free: false, pro: true },
  { key: 'export', labelKey: 'subscription.dataExport', free: false, pro: true },
  { key: 'predictions', labelKey: 'subscription.advancedPredictions', free: false, pro: true },
  { key: 'adFree', labelKey: 'subscription.adFree', free: false, pro: true },
]
