import { z } from 'zod'

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  // Direct DB connection for migrations (bypasses PgBouncer)
  DIRECT_URL: z.string().optional(),

  // Redis
  REDIS_URL: z.string().optional(),

  // BDApps (required for web app, optional for admin)
  BDAPPS_APP_ID: z.string().optional(),
  BDAPPS_PASSWORD: z.string().optional(),
  BDAPPS_BASE_URL: z.string().default('https://developer.bdapps.com'),
  BDAPPS_WEBHOOK_IPS: z.string().optional(),
  BDAPPS_SIMULATOR_BASE_URL: z.string().optional(),

  // Auth
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  // Auth cookie name — override per-app so web (vesta_token) and admin (vesta_admin_token) sessions don't collide on localhost
  AUTH_COOKIE_NAME: z.string().default('vesta_token'),

  // App URL (used for magic-link callbacks)
  APP_URL: z.string().default('http://localhost:3000'),

  // Email
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().default('Vesta <noreply@vesta.app>'),
  MAILPIT_SMTP_URL: z.string().default('smtp://localhost:1025'),
  RESEND_WEBHOOK_SECRET: z.string().optional(),

  // Cron (required for web app, optional for admin)
  CRON_SECRET: z.string().optional(),

  // Runtime
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  DEV_MODE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
})

export type Env = z.infer<typeof envSchema>

export const env: Env = envSchema.parse(process.env)
