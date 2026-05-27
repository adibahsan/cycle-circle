# Vesta v1 — Knowledge Base

> Reference document for SRS authoring. Captures all confirmed decisions, constraints, and technical context from customer discussions and the MVP plan. **Do not treat anything here as a proposal — these are settled.**

---

## 1. Customer Decisions (Post-Discussion Changes)

| # | Decision | Detail |
|---|----------|--------|
| 1 | **User verification via BDApps OTP** | Phone number sign-up. BDApps `otp/request` sends OTP to MSISDN. `otp/verify` confirms it. Replaces email verification. |
| 2 | **User charging via BDApps CAAS** | `caas/directDebit` charges subscriber mobile account for Pro upgrades. `caas/queryBalance` used for daily status checks. |
| 3 | **No partner sharing in v1** | Removed entirely. Deferred to v2. No invite codes, no read-only calendar, no partner view. |
| 4 | **No SSL Wireless / SMS API** | Removed entirely. Email-only notifications via Resend. No SMS gateway integration in v1. |
| 5 | **BDApps billing items promoted to Must Have** | CAAS charging + auto-disable on lapse + grace period warning moved from Phase 3 Should Have → Must Have. They are confirmed core requirements, not optional. |

---

## 2. BDApps API Reference (Used in v1)

Source: `docs/vesta/source/bdapps-tap-api.html`

### OTP — User Verification

**Request OTP**
- Endpoint: `https://developer.bdapps.com/otp/request`
- Method: POST
- Required: `applicationId`, `password`, `subscriberId` (format: `tel:8801XXXXXXXXX`)
- Optional: `applicationHash`, `applicationMetaData`
- Returns: `referenceNo` (used in verify step)

**Verify OTP**
- Endpoint: `https://developer.bdapps.com/otp/verify`
- Method: POST
- Required: `applicationId`, `password`, `referenceNo`, `otp`
- Returns: `subscriptionStatus`, `subscriberId`

**Flow:** Sign-up → `otp/request` → user enters OTP → `otp/verify` → account created on success.

**Risk:** Intermittent API failures block sign-up. Mitigate with 60s resend timeout + exponential backoff retry.

---

### CAAS — Subscription Charging

**Direct Debit (charge user)**
- Endpoint: `https://developer.bdapps.com/caas/direct/debit`
- Method: POST
- Required: `applicationId`, `password`, `externalTrxId`, `subscriberId`, `paymentInstrumentName`, `amount`
- Optional: `accountId`, `currency` (BDT only)
- Returns: `externalTrxId`, `internalTrxId`, `referenceId`, `timeStamp`

**Query Balance (check subscription status)**
- Endpoint: `https://developer.bdapps.com/caas/get/balance`
- Method: POST
- Required: `applicationId`, `password`, `subscriberId`, `paymentInstrumentName`
- Returns: `accountType`, `accountStatus`, `chargeableBalance`

**Subscription lifecycle:**
1. User selects Pro → trigger `caas/directDebit`
2. Daily cron calls `caas/queryBalance` per Pro subscriber
3. On lapse: start grace period countdown (configurable N days)
4. At grace expiry: disable Pro, send email warning
5. Only revoke after N consecutive daily check failures (tolerates transient errors)

---

## 3. Confirmed Tech Stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Frontend | React 19 + TypeScript + Vite 6 | SPA, Vercel CDN |
| Styling | Tailwind CSS v4 | CSS-first config, no `tailwind.config.js` |
| State | TanStack Query + Zustand | TQ for server state, Zustand for UI/locale |
| Routing | React Router v7 | Client-side SPA routing |
| Backend | Express 5 + TypeScript | Wrapped as Vercel serverless function |
| ORM | Prisma 6.13 (pinned) | Pinned for `prisma-field-encryption` compat |
| Database | PostgreSQL 16 via Supabase | RLS enabled for profile isolation |
| Encryption | prisma-field-encryption | AES-256-GCM on sensitive health fields |
| Auth | JWT + BDApps OTP | Phone number auth, HttpOnly cookies |
| Sessions | Upstash Redis | JWT blacklist, rate-limit state |
| Job queue | Upstash QStash | Async jobs (email delivery, prediction recalc) |
| Cron | Vercel Cron (2 jobs) | Daily reminders + CAAS subscription check |
| Email | Resend + React Email | 3K/mo free tier |
| i18n | i18next + react-i18next | EN + BN from day one, Noto Sans Bengali |
| Billing | BDApps CAAS API | Direct debit + balance query |
| Charts | Recharts 3.x | Admin analytics |
| CMS editor | Tiptap 3.x | Bilingual article CRUD |
| Hosting | Vercel (frontend + API) + Supabase | See deployment section |

---

## 4. Deployment Architecture

### Free-Tier Stack ($0/month experimental)

| Service | Provider | Free Limits | Upgrade Trigger |
|---------|----------|-------------|-----------------|
| Frontend + API | Vercel Hobby | 100 GB BW, 10s timeout, 1M invocations | Team or >100 GB |
| Database | Supabase Free | 500 MB, pauses after 7d inactivity | >500 MB or no-pause needed |
| Sessions/cache | Upstash Redis | 10K commands/day, 256 MB | >10K commands/day |
| Cron jobs | Vercel Cron | 2 jobs, daily minimum frequency | >2 crons or sub-daily |
| Job queue | Upstash QStash | 500 messages/day | >500 messages/day |
| Email | Resend Free | 3K emails/mo, 100/day | >3K emails/mo |

**After upgrade: ~$45/month** (Vercel Pro $20 + Supabase Pro $25)

### Infrastructure

```
  VERCEL (Hobby)
  ├── React + Vite (static)
  ├── Express via api/index.ts (@vercel/node)
  └── Cron: /api/cron/daily-reminders
           /api/cron/caas-check

  SUPABASE (Free)
  ├── PostgreSQL 16
  ├── RLS policies (profile isolation at DB level)
  └── pgcrypto extension

  UPSTASH Redis (Free) — JWT blacklist, sessions, rate limits
  UPSTASH QStash (Free) — prediction recalc, email jobs
  RESEND (Free) — transactional email
```

### Express → Serverless Adapter

- Single entry: `api/index.ts` exports Express app via `@vercel/node`
- All existing middleware (JWT, RLS, rate-limit) unchanged
- BullMQ replaced by: Vercel Cron (scheduled) + Upstash QStash (async)
- Function timeout: 10s (Hobby) — sufficient for all API routes; upgrade to Pro if prediction recalc grows

### Supabase RLS

Enable Row Level Security on `period_logs`, `symptom_logs`, `profiles`. Policy: `auth.uid()` matches `user_id`. Enforced at DB level — belt-and-suspenders on top of `checkProfileOwnership` middleware. Field-level encryption (`prisma-field-encryption`) still applies on top of RLS.

### Vercel Cron Config (`vercel.json`)

```json
{
  "crons": [
    { "path": "/api/cron/daily-reminders", "schedule": "0 8 * * *" },
    { "path": "/api/cron/caas-check",      "schedule": "0 2 * * *" }
  ]
}
```

Both secured with `CRON_SECRET` header. CAAS check: only revokes Pro after N consecutive failures (configurable, tolerates transient BDApps errors).

### Upgrade Path

1. **Supabase pausing** → Supabase Pro ($25/mo): 8 GB DB, daily backups, no pausing
2. **Team access or long functions** → Vercel Pro ($20/mo): 60s timeout, 1 TB BW, team seats, more crons
3. **Redis/QStash over limits** → Upstash pay-as-you-go (typically <$1/mo at early scale, no migration)
4. **Persistent workers needed** → Railway ($5/mo): add worker process only; frontend + DB stay on Vercel + Supabase

### Required Environment Variables

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
QSTASH_URL
QSTASH_TOKEN
JWT_SECRET
FIELD_ENCRYPTION_KEY
BDAPPS_APP_ID
BDAPPS_PASSWORD
RESEND_API_KEY
CRON_SECRET
```

---

## 5. MoSCoW Summary (v1 Scope)

### Must Have (Weeks 1–2)
- Phone auth + BDApps OTP verification
- Multi-profile accounts (self, wife, sister, mother, daughter, girlfriend)
- Bilingual UI (EN + BN, i18next)
- Period tracking (start/end, flow intensity, retroactive editing)
- Cycle dashboard (day hero, phase label, countdown)
- Monthly calendar (color-coded: period/fertile/ovulation)
- Symptom logging (30+ symptoms, 4 categories, icon-based)
- Three-tier prediction engine (Avg → ARIMA → LSTM stub)
- Onboarding flow (trust screens, goal, cycle history)
- Field-level encryption (AES-256-GCM)
- Profile switcher with data isolation
- Feature gating middleware (free/pro)
- Redis session store + JWT blacklist
- BDApps CAAS charging for Pro subscription
- Auto-disable Pro on charging lapse + grace period

### Should Have (Week 3)
- Email notifications (period alert, fertile window, logging reminder)
- Content platform (bilingual articles, phase-based)
- Notification preferences per-profile

### Could Have (Week 4)
- Admin dashboard + user management
- Content CMS (Tiptap)
- Population health analytics
- Prediction accuracy reports
- RBAC (Super Admin, Content Admin)
- Admin session + subscription management
- Data export (CSV/Excel)

### Won't Have (v2)
- Partner sharing
- Pregnancy mode
- SMS notifications
- Native mobile apps
- AI health chatbot
- Doctor consultations
- Medicine/sleep/exercise tracker
- Community forum

---

## 6. Data Model (Key Tables)

| Table | Key Fields | Notes |
|-------|-----------|-------|
| `users` | id, phone, password_hash, role, created_at | Phone replaces email as primary identifier |
| `profiles` | id, user_id, relation_type, avg_cycle_length, mode, goal | Scoped per user, RLS enforced |
| `period_logs` | id, profile_id, start_date, end_date, flow_intensity | Triggers prediction recalc via QStash |
| `symptom_logs` | id, profile_id, date, category, key, value | Encrypted fields via prisma-field-encryption |
| `predictions` | id, profile_id, tier, next_period_start, ovulation_day, fertile_start, fertile_end, confidence | Updated by QStash job |
| `subscriptions` | id, user_id, status, last_caas_check, grace_start, consecutive_failures | Managed by daily CAAS cron |
| `notification_preferences` | id, profile_id, type, enabled | Per-profile toggles |
| `articles` | id, title_en, title_bn, body_en, body_bn, phase_tags, category | Bilingual content |

Sensitive fields (`symptom_logs.value`, health notes) encrypted at rest.

---

## 7. Key Risks

| Risk | Level | Mitigation |
|------|-------|-----------|
| BDApps OTP/CAAS intermittent failures | High | Exponential backoff + OTP resend after 60s + grace period absorbs CAAS transient failures |
| Supabase free tier pauses after 7d inactivity | Medium | Cron job pings DB daily; upgrade to Pro ($25) if it becomes an issue |
| Bengali text layout overflow (20–40% longer) | Medium | Design all components with text expansion; test every page in BN mode |
| prisma-field-encryption breaks on Prisma upgrade | Medium | Pinned to ^6.13.0, CI integration test for encrypt→store→retrieve→decrypt |
| Prediction cold-start accuracy | Low | Show "estimate" disclaimer; Tier 1 from onboarding data; confidence % visible to user |

---

## 8. Definition of Done (v1 Launch Gates)

- [ ] Phone sign-up + BDApps OTP end-to-end in production
- [ ] Multi-profile create/switch/delete works with data isolation
- [ ] Period logging → prediction recalc → calendar update in < 3s
- [ ] Symptom logging: all 30+ symptoms, 4 categories
- [ ] Bilingual UI: all strings translated, Bengali layout not broken
- [ ] Email notifications deliver to correct profile
- [ ] Content articles render in both languages with phase tags
- [ ] Pro upgrade via CAAS charges and gates features immediately
- [ ] Daily CAAS cron runs, grace period activates on lapse
- [ ] Admin dashboard: KPIs, user management, CMS operational
- [ ] RBAC: Super Admin vs Content Admin separation enforced
- [ ] Field encryption verified: sensitive data encrypted at rest
- [ ] RLS verified: user A cannot read user B's health data
- [ ] Responsive: 375px / 768px / 1280px — no broken layouts
- [ ] BDApps CAAS charge verified in production (real transaction)
- [ ] Zero third-party analytics touching health event data
- [ ] Production deploy: Vercel + Supabase live and stable
