## Admin App

Single Super Admin account (email/password login at `/login`). Seeded via `packages/shared/prisma/seed.ts` with env vars `ADMIN_EMAIL` / `ADMIN_PASSWORD` (defaults: `admin@vesta.health` / `admin123`).

**Auth flow:** bcrypt password verification in `@vesta/shared/server/auth` (`verifyAdminLogin`), same JWT/cookie system as web app with `role=ADMIN` check in Edge proxy + server-side `requireAdminAuth()`.

**Pages:** Dashboard, Users (list + detail), Subscriptions, Content/CMS (Tiptap 3.x rich-text editor with EN/BN side-by-side), Analytics (Recharts 3.x), SMS Broadcasts, Feedback.

**Pattern:** RSC pages fetch data via `queries/*.ts` (thin `cache()` wrappers over shared services), pass to `*Client.tsx` components. Mutations go through `actions/*.ts` (thin `'use server'` wrappers over shared services + `revalidatePath`).

**Env:** Admin requires `DATABASE_URL`, `DIRECT_URL` (for migrations), `JWT_SECRET` (its own, different from web's), `AUTH_COOKIE_NAME=vesta_admin_token` (required, no default), `APP_ENV`, `APP_URL` (web URL, for cron-trigger calls from System page), and `CRON_SECRET` (same as web). `REDIS_URL` and BDApps vars are optional (in-memory fallback / not used by admin).
