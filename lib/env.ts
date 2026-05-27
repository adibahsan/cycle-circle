import { z } from 'zod'

const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),

  // BDApps
  BDAPPS_APP_ID: z.string().min(1, 'BDAPPS_APP_ID is required'),
  BDAPPS_PASSWORD: z.string().min(1, 'BDAPPS_PASSWORD is required'),
  BDAPPS_BASE_URL: z.string().default('https://developer.bdapps.com'),
  BDAPPS_WEBHOOK_IPS: z.string().optional(),
  BDAPPS_SIMULATOR_BASE_URL: z.string().optional(),

  // Auth
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  // Email
  RESEND_API_KEY: z.string().optional(),
  MAILPIT_SMTP_URL: z.string().default('smtp://localhost:1025'),

  // Cron
  CRON_SECRET: z.string().min(1, 'CRON_SECRET is required'),

  // Runtime
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
})

export type Env = z.infer<typeof envSchema>

export const env: Env = envSchema.parse(process.env)
