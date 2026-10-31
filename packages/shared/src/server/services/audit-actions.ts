/**
 * Single source of truth for AdminAuditLog action names and target types.
 * Dependency-free so client components can import it
 * (`@vesta/shared/server/services/audit-actions`). Services that write audit rows
 * must use these constants; the admin Action filter and badges derive from them.
 */
export const AUDIT_ACTIONS = {
  USER_SUSPENDED: 'USER_SUSPENDED',
  USER_REACTIVATED: 'USER_REACTIVATED',
  USER_DELETED: 'USER_DELETED',
  USER_RESTORED: 'USER_RESTORED',
  PRO_GRANTED: 'PRO_GRANTED',
  PRO_REVOKED: 'PRO_REVOKED',
  SUBSCRIPTION_SET_FREE: 'SUBSCRIPTION_SET_FREE',
  SUBSCRIPTION_SET_PRO: 'SUBSCRIPTION_SET_PRO',
  SUBSCRIPTION_SET_LAPSED: 'SUBSCRIPTION_SET_LAPSED',
  ARTICLE_CREATED: 'ARTICLE_CREATED',
  ARTICLE_DELETED: 'ARTICLE_DELETED',
  SEND_SMS_BROADCAST: 'SEND_SMS_BROADCAST',
  UPDATE_SMS_BROADCAST: 'UPDATE_SMS_BROADCAST',
  RESCHEDULE_SMS_BROADCAST: 'RESCHEDULE_SMS_BROADCAST',
  DISPATCH_SMS_BROADCAST: 'DISPATCH_SMS_BROADCAST',
  CREATE_SMS_CAMPAIGN: 'CREATE_SMS_CAMPAIGN',
  ADD_SMS_MESSAGE: 'ADD_SMS_MESSAGE',
  UPDATE_SMS_MESSAGE: 'UPDATE_SMS_MESSAGE',
  RESCHEDULE_SMS_MESSAGE: 'RESCHEDULE_SMS_MESSAGE',
  DELETE_SMS_CAMPAIGN: 'DELETE_SMS_CAMPAIGN',
  EXPORT_USERS_CSV: 'EXPORT_USERS_CSV',
  EXPORT_FEEDBACK_CSV: 'EXPORT_FEEDBACK_CSV',
  NOTIFICATION_PREFS_UPDATED: 'NOTIFICATION_PREFS_UPDATED',
  SEND_USER_REMINDERS: 'SEND_USER_REMINDERS',
  TRIGGER_CRON_DAILY_REMINDERS: 'TRIGGER_CRON_DAILY_REMINDERS',
  TRIGGER_CRON_CAAS_CHECK: 'TRIGGER_CRON_CAAS_CHECK',
  SET_CRON_ENABLED: 'SET_CRON_ENABLED',
  SET_SMS_SEND_TIME: 'SET_SMS_SEND_TIME',
} as const

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS]

export const AUDIT_ACTION_VALUES = Object.values(AUDIT_ACTIONS) as AuditAction[]

/** `targetType` values exactly as services write them. */
export const AUDIT_TARGET_TYPES = [
  'User',
  'Article',
  'Subscription',
  'SmsBroadcast',
  'SmsCampaign',
  'SmsCampaignMessage',
  'Profile',
  'Feedback',
  'CronJob',
  'SystemSetting',
] as const

/** Human label for an action: USER_SUSPENDED -> "User Suspended". */
export function auditActionLabel(action: string): string {
  return action
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}
