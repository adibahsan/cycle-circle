# Credential Rotation Checklist

Use this after production secrets were removed from git history. **Purging history does not invalidate leaked secrets** — rotate every value that was ever committed.

## 1. Supabase (project ref in old env file)

1. [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Project Settings** → **Database**
2. **Reset database password**
3. Update connection strings in:
   - Vercel → `cycle-circle` (web) → `DATABASE_URL`, `DIRECT_URL`
   - Vercel → admin project → `DATABASE_URL`, `DIRECT_URL`
   - Local (gitignored): `apps/web/env.prod`, `apps/admin/env.prod`, `apps/admin/.env.local`

## 2. JWT_SECRET (invalidates all user sessions)

```bash
openssl rand -hex 32
```

Web and admin each have their own `JWT_SECRET` (ADR 0007): rotate the one for the app you are rotating, and never copy the value across apps.

## 3. CRON_SECRET

```bash
openssl rand -hex 16
```

Update in Vercel web project (used by `/api/cron/*` Bearer auth).

## 4. Resend API key

1. [Resend Dashboard](https://resend.com/api-keys) → **Revoke** the leaked key
2. Create a new API key
3. Update Vercel web + local `apps/web/env.prod`
4. Optionally rotate `apps/admin/env.prod` Resend key if stored on the same machine

## 5. Resend webhook signing secret

1. Resend → **Webhooks** → rotate signing secret for your endpoint
2. On the VPS, edit `RESEND_WEBHOOK_SECRET` in `/opt/vesta/.env.web.production`
3. From `/opt/vesta`: `docker compose -f ops/deploy/compose.prod.yml up -d web`
4. Verify with the "Verify" step in [ops/03-deployment.md](./ops/03-deployment.md) §7 (human sends a test event, agent checks the nginx log for a 200)

## 6. Post-rotation

- [ ] Redeploy web and admin on the VPS (see [ops/03-deployment.md](./ops/03-deployment.md) §5)
- [ ] Verify login, cron jobs, email send, and Resend webhooks
- [ ] Re-clone the repo on any machine that had a pre-purge copy
- [ ] If the repo was public, [request GitHub sensitive data removal](https://support.github.com/)

## Never commit

- `apps/web/env.prod`, `apps/admin/env.prod`
- `apps/*/.env.local`, `packages/shared/.env.local`

Use `apps/web/env.prod.example` as the committed template only.
