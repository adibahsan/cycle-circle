export const ADMIN_CACHE_TTL = 300
/** Dashboard and every other KPI/stat view must reflect the database within a minute (SRS v1.4). */
export const KPI_CACHE_TTL = 60
export const DASHBOARD_CACHE_TTL = KPI_CACHE_TTL

export const adminCacheTags = {
  dashboard: 'admin:dashboard',
  users: 'admin:users',
  user: (id: string) => `admin:user:${id}`,
  subscriptions: 'admin:subscriptions',
  content: 'admin:content',
  article: (id: string) => `admin:article:${id}`,
  analytics: 'admin:analytics',
  sms: 'admin:sms',
  feedback: 'admin:feedback',
  emails: 'admin:emails',
  auditLogs: 'admin:audit-logs',
  auth: (adminId: string) => `admin:auth:${adminId}`,
} as const
