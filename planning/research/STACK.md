# Technology Stack

**Project:** Vesta -- Reproductive Health & Cycle Intelligence Platform
**Researched:** 2026-03-26
**Overall Confidence:** HIGH

---

## Recommended Stack

### Core Frontend

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| React | ^19.2.4 | UI framework | Already chosen by client. React 19 stable with Server Components, use() hook, Actions. Ecosystem dominance. | HIGH |
| Vite | ^6.x (stay on v6 line) | Build tool | Already in project. v6 is the LTS-supported line. v8 (Rolldown) is too new for production health app -- wait for ecosystem to stabilize. Vite 6.4 still receives security patches. | HIGH |
| TypeScript | ~5.8 | Type safety | Already in project. Non-negotiable for health data -- catches schema/API contract bugs at compile time. | HIGH |
| Tailwind CSS | ^4.2 | Styling | Already in project. v4 is CSS-first config (no JS config file), OKLCH colors, 5x faster builds. Use @theme directive. | HIGH |
| @tailwindcss/vite | ^4.2 | Vite integration | Direct Vite plugin for Tailwind v4. Replaces PostCSS-based setup. Already in use. | HIGH |

### UI Components & Design System

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| shadcn/ui | latest (copy-paste) | Component library | De facto standard for Tailwind + React. Not a dependency -- copies components into your project. Full control over markup. Updated for Tailwind v4 + React 19 with data-slot attributes and OKLCH colors. | HIGH |
| Lucide React | ^0.546 | Icons | Already in project. Tree-shakeable, consistent icon set. Used by shadcn/ui. | HIGH |
| Motion (Framer Motion) | ^12.x | Animations | Already in project (as `motion`). Smooth transitions for onboarding flows, cycle visualizations, pregnancy trackers. | HIGH |
| clsx + tailwind-merge | ^2.1 / ^3.5 | Class utilities | Already in project. clsx for conditional classes, tailwind-merge for deduplication. Required by shadcn/ui pattern. | HIGH |
| Sonner | ^2.x | Toast notifications | shadcn/ui officially deprecated its own toast in favor of Sonner. Beautiful, accessible toasts. | MEDIUM |

### Frontend State & Data

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| TanStack Query | ^5.x | Server state / data fetching | Industry standard for React server state. Automatic caching, background refetching, stale-while-revalidate, optimistic updates. Handles all API calls to the Express backend. | HIGH |
| Zustand | ^5.x | Client state | Lightweight (1KB), zero boilerplate, hook-based. Perfect for UI state: active profile selection, sidebar open/closed, calendar view mode, locale preference. Overkill to use Redux for this project's client state needs. | HIGH |
| React Hook Form | ^7.x | Form management | Uncontrolled components = minimal re-renders. Critical for data-heavy forms: symptom logging (20+ fields), medicine tracker, onboarding wizard. | HIGH |
| Zod | ^3.x | Schema validation | TypeScript-first validation. Share schemas between frontend forms and backend API validation. Single source of truth for data contracts. | HIGH |

### Frontend Routing & i18n

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| React Router | ^7.x | Client-side routing | Already in project. Standard SPA routing. Use lazy() for code-splitting heavy pages (analytics dashboard, pregnancy tracker). | HIGH |
| i18next + react-i18next | ^24.x / ^15.x | Internationalization | Dominant i18n solution for React. JSON-based translation files, namespace support, interpolation, pluralization. Bengali locale fully supported. Use i18next-browser-languagedetector for auto-detection. | HIGH |
| date-fns | ^4.1 | Date utilities | Already in project. Tree-shakeable, immutable. Essential for cycle date calculations, fertile window display, pregnancy week counting. Use with locale (bn for Bengali date formatting). | HIGH |

### Charting & Data Visualization

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Recharts | ^2.x | Health analytics charts | React-first (SVG-based, component API). Ideal for cycle length trends, symptom correlation charts, sleep/exercise analysis, admin analytics dashboards. Better React integration than Chart.js. | HIGH |

---

### Core Backend

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Node.js | ^22 LTS | Runtime | LTS line (supported through April 2027). Native fetch, improved performance, ESM support. Use even-numbered LTS releases for production. | HIGH |
| Express.js | ^5.2 | HTTP framework | Client-specified. Express 5 is now stable: promise-based error handling, path-to-regexp v8 (ReDoS-safe), dropped legacy API. Migrate from the v4 in current package.json. | HIGH |
| TypeScript | ~5.8 | Type safety | Same version as frontend. Shared types package for API contracts. | HIGH |
| tsx | ^4.x | Dev runner | Already in project. TypeScript execution for Node.js without compilation step during development. | HIGH |

### Database & ORM

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| PostgreSQL | 16 | Primary database | Relational model fits multi-profile/multi-entity health data perfectly. pgcrypto for field-level encryption. Row-Level Security for multi-tenant profile isolation. JSON columns for flexible symptom data. | HIGH |
| Prisma ORM | ^6.19 (stay on v6 line) | Database toolkit | Type-safe queries, auto-generated client, migrations, seeding. Use v6 (not v7) because prisma-field-encryption only supports up to v6.13 -- verify compatibility. v6.19 is latest stable. Prisma 7 dropped Rust engine (faster) but broke field-encryption plugin ecosystem. | HIGH |
| prisma-field-encryption | ^1.x | Field-level encryption | Transparent AES-256-GCM encryption for sensitive columns (sex life data, medical notes). Uses Prisma client extensions. Mark encrypted fields with /// @encrypted in schema. Non-deterministic -- use companion hash fields for lookups. | MEDIUM |
| Redis | ^7.x | Caching + job queues | Session store, API response caching, BullMQ backing store. In-memory speed for rate limiting counters. Required by BullMQ. | HIGH |

### Authentication & Security

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| jsonwebtoken | ^9.x | JWT tokens | Access tokens (15min) + refresh tokens (7 days) in HttpOnly Secure cookies. Role claims in payload for admin panel RBAC. | HIGH |
| argon2 | ^0.41.x | Password hashing | OWASP-recommended Argon2id. Memory-hard (resistant to GPU attacks). Preferred over bcrypt for new projects in 2025+. Config: 19MiB memory, 2 iterations, 1 parallelism. | HIGH |
| helmet | ^8.x | HTTP security headers | HSTS, CSP, X-Frame-Options. First middleware in chain. Non-negotiable for health data app. | HIGH |
| cors | ^2.x | CORS policy | Restrict to Vercel frontend domain(s) only. Never `origin: *` in production. | HIGH |
| express-rate-limit | ^7.x | Rate limiting | Prevent brute-force on auth endpoints (strict: 5 req/15min for login). Generous limits for API (100 req/min). Use Redis store for distributed deployment. | HIGH |
| cookie-parser | ^1.x | Cookie handling | Parse HttpOnly refresh token cookies. | HIGH |

### Background Jobs & Notifications

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| BullMQ | ^5.71 | Job queue | Redis-backed. Scheduled jobs for: period/ovulation reminders, medicine alarms, appointment notifications. Supports delayed jobs, repeatable cron jobs, retries, dead letter queues. Production-proven at scale. | HIGH |
| Resend | ^4.x (SDK) | Transactional email | Clean DX, 3,000 emails/month free tier. Welcome emails, password reset, appointment reminders, partner sharing invites. No surprise billing on overage. | MEDIUM |
| ssl-wireless-sms-send | ^1.x (or direct HTTP) | SMS (Bangladesh) | SSL Wireless is Bangladesh's premier SMS gateway. npm package exists but documentation is thin -- plan to write a thin wrapper over their HTTP API. Supports Bangla SMS (Unicode). Alternatives: Alpha Net BD, BulkSMSBD. | MEDIUM |

### File Storage

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Multer | ^1.x | File upload middleware | Parse multipart/form-data for ultrasound image uploads, profile photos. Stream to cloud storage. | HIGH |
| AWS S3 (or S3-compatible) | SDK v3 | Object storage | Ultrasound images, uploaded documents. S3 for control + encryption-at-rest (SSE-S3/SSE-KMS). Prefer over Cloudinary for medical data -- Cloudinary is optimized for media transformation, not encrypted health document storage. Use presigned URLs for secure access. | MEDIUM |

### API Documentation & Validation

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Zod | ^3.x | Request validation | Same library as frontend. Validate request bodies, query params, route params in Express middleware. Share schemas via shared package. | HIGH |
| Swagger/OpenAPI (swagger-jsdoc + swagger-ui-express) | ^6.x / ^5.x | API documentation | Auto-generate API docs from JSDoc annotations. Essential for client handoff and admin panel integration. | MEDIUM |

---

### Prediction Engine (Three Tiers)

#### Tier 1: Simple Algorithm (Node.js native)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Custom TypeScript | -- | Average-based cycle prediction | Pure math: rolling average of last 3-6 cycle lengths. No external libraries needed. Calculate: next period = last period start + average cycle length. Fertile window = ovulation day (cycle length - 14) +/- 2 days. | HIGH |

#### Tier 2: Statistical Model (ARIMA in Node.js)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| arima (npm) | ^0.2.8 | ARIMA/SARIMA time-series | Pure JavaScript ARIMA implementation. Runs in Node.js without Python dependency. AutoARIMA for automatic p,d,q selection. Handles seasonal patterns in cycle data (SARIMA). ~10 npm dependents, but backed by validated statistical methods. | MEDIUM |

#### Tier 3: Full ML Pipeline (LSTM via TensorFlow.js or Python microservice)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| TensorFlow.js (tfjs-node) | ^4.x | LSTM neural network | Run LSTM models directly in Node.js. 38% faster inference than Python equivalent in benchmarks. Multi-factor inputs: cycle lengths, symptoms, sleep, exercise, stress, age. Train offline, deploy model weights to Node.js for inference. | MEDIUM |
| **Alternative:** Python FastAPI microservice | -- | If TensorFlow.js limitations hit | If model complexity exceeds tfjs capabilities, deploy a Python FastAPI sidecar with TensorFlow/PyTorch. Communicate via internal HTTP. More ML ecosystem support (scikit-learn, statsmodels). Adds operational complexity. | LOW |

**Recommendation:** Start with TensorFlow.js in Node.js. Only introduce Python microservice if model performance demands it. Keep the prediction engine behind an internal API boundary so the implementation can be swapped.

---

### Infrastructure & DevOps

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Vercel | -- | Frontend hosting | Client-specified. CDN-backed, automatic preview deployments, GitHub integration. Free tier sufficient for launch. | HIGH |
| Railway / Render | -- | Backend API hosting | Express.js needs persistent process (not serverless). Railway: $5/mo hobby, auto-sleep, managed PostgreSQL + Redis addons. Render: free tier with cold starts, $7/mo for always-on. Both support Docker. **Recommend Railway** for simpler DX and built-in database provisioning. | MEDIUM |
| Docker | -- | Containerization | Consistent environments. Required for Railway/Render deployment. Multi-stage build: builder (tsc) -> runner (node). | HIGH |
| GitHub Actions | -- | CI/CD | Lint, type-check, test on PR. Auto-deploy to Vercel (frontend) and Railway (backend) on merge to main. | HIGH |
| Vitest | ^3.x | Unit/integration tests | Vite-native test runner. Jest-compatible API but 2-10x faster. Shares Vite config. Use for both frontend component tests and backend API tests. | HIGH |
| Playwright | ^1.x | E2E tests | Cross-browser E2E testing. Test critical flows: onboarding, cycle logging, profile switching, admin panel. | MEDIUM |

### Monitoring & Logging

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Pino | ^9.x | Structured logging | Fast JSON logger for Node.js. 5x faster than Winston. Structured logs are essential for debugging health data flows. Use pino-http for Express request logging. | HIGH |
| Sentry | @sentry/node ^8.x | Error tracking | Catch unhandled exceptions, track API errors, performance monitoring. Free tier covers early stage. Critical for a health app -- silent failures are unacceptable. | MEDIUM |

---

## Monorepo Structure

Use a **pnpm workspace** monorepo with three packages:

```
vesta/
  packages/
    web/           # React + Vite frontend
    api/           # Express.js backend
    shared/        # Zod schemas, TypeScript types, constants, i18n keys
  pnpm-workspace.yaml
  turbo.json       # Turborepo for build orchestration
```

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| pnpm | ^9.x | Package manager | Strict dependency resolution, disk-efficient. Better for monorepos than npm. |
| Turborepo | ^2.x | Monorepo build tool | Caches builds, runs tasks in parallel. `turbo run build` builds shared -> api + web in correct order. |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Build tool | Vite 6 (LTS) | Vite 8 (Rolldown) | Rolldown is brand new (March 2026). Plugin ecosystem not fully tested. Health app needs stability over bleeding edge. Upgrade after 6 months of community validation. |
| ORM | Prisma 6 | Prisma 7 | prisma-field-encryption (critical for health data) only supports up to v6.13. Prisma 7 broke backward compatibility with client extensions. Wait for native field encryption or updated plugin. |
| ORM | Prisma 6 | Drizzle ORM | Drizzle is lighter and SQL-closer, but Prisma's migration system, studio UI, and field-encryption extension are more valuable for this project's needs. Drizzle lacks equivalent encryption middleware. |
| State management | Zustand | Redux Toolkit | Redux is overkill. Vesta's client state is simple (active profile, UI toggles, locale). Zustand's 1KB footprint and zero-boilerplate API is a better fit. No devtools fatigue. |
| State management | Zustand | Jotai | Jotai is atomic (bottom-up), Zustand is store-based (top-down). Zustand is more intuitive for team onboarding and this app's state shape (user, profiles, settings). |
| Charts | Recharts | Chart.js (react-chartjs-2) | Chart.js is canvas-based, harder to style with Tailwind. Recharts is SVG + React components -- easier to theme, animate, and integrate with the React component tree. |
| Email | Resend | SendGrid | SendGrid is enterprise-heavy, complex API surface. Resend has superior DX, simpler pricing, no surprise billing. Free tier is sufficient for launch (3,000/month). |
| Email | Resend | Nodemailer (direct SMTP) | Nodemailer requires managing deliverability, bounces, retries yourself. Resend handles all of this. Worth the abstraction for a health app where emails (reminders, alerts) must arrive reliably. |
| Password hashing | Argon2id | bcrypt | Both are secure. Argon2id is OWASP-recommended for new projects, memory-hard (GPU-resistant). bcrypt is battle-tested but not memory-hard. Since this is greenfield, go with the modern standard. |
| SMS | SSL Wireless | Twilio | Twilio is expensive for Bangladesh market and has no local number support. SSL Wireless is the local leader with Bengali Unicode SMS support and bKash payment integration. |
| Backend hosting | Railway | DigitalOcean App Platform | Railway is simpler for small teams, has built-in PostgreSQL + Redis, and better DX. DO App Platform requires more configuration. Railway's $5/hobby plan is sufficient for launch. |
| Backend hosting | Railway | Fly.io | Fly.io requires more Docker/infrastructure knowledge. Railway abstracts more away. For a client delivery project, simplicity wins. |
| File storage | AWS S3 | Cloudinary | Cloudinary optimizes media delivery (CDN, transforms). Ultrasound images need encryption-at-rest and access control, not image optimization. S3 with SSE-KMS + presigned URLs is the correct tool for medical data. |
| Testing | Vitest | Jest | Vitest shares Vite's config and transform pipeline -- no duplicate setup. Jest-compatible API means zero learning curve. 2-10x faster on Vite projects. |
| Logger | Pino | Winston | Pino is 5x faster (benchmarked). Structured JSON output. Winston has more transports but Pino + pino-http covers Express logging needs. |

---

## Installation

### Frontend (`packages/web`)

```bash
# Core (already partially in place)
pnpm add react react-dom react-router-dom
pnpm add @tanstack/react-query zustand
pnpm add react-hook-form @hookform/resolvers zod
pnpm add i18next react-i18next i18next-browser-languagedetector
pnpm add recharts
pnpm add sonner
pnpm add date-fns
pnpm add clsx tailwind-merge lucide-react motion

# Dev
pnpm add -D typescript vite @vitejs/plugin-react @tailwindcss/vite tailwindcss
pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom
pnpm add -D playwright @playwright/test

# shadcn/ui (CLI-based, not a package dependency)
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button card dialog input label select tabs
```

### Backend (`packages/api`)

```bash
# Core
pnpm add express cors helmet cookie-parser express-rate-limit
pnpm add @prisma/client
pnpm add jsonwebtoken argon2
pnpm add bullmq ioredis
pnpm add resend
pnpm add multer @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
pnpm add pino pino-http
pnpm add zod
pnpm add arima                    # Tier 2 prediction
pnpm add @tensorflow/tfjs-node    # Tier 3 prediction (install when needed)

# Dev
pnpm add -D typescript tsx prisma @types/express @types/jsonwebtoken @types/multer @types/cors @types/cookie-parser
pnpm add -D vitest
pnpm add -D @sentry/node
```

### Shared (`packages/shared`)

```bash
pnpm add zod
pnpm add -D typescript
```

### Monorepo Root

```bash
pnpm add -D turbo
```

---

## Environment Variables

### Frontend (.env)

```env
VITE_API_URL=https://api.vesta-health.com
VITE_SENTRY_DSN=...
```

### Backend (.env)

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/vesta?schema=public
REDIS_URL=redis://host:6379

# Auth
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
FIELD_ENCRYPTION_KEY=...       # AES-256 key for prisma-field-encryption

# Services
RESEND_API_KEY=...
SSL_WIRELESS_API_TOKEN=...
SSL_WIRELESS_SID=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=vesta-uploads
AWS_REGION=ap-southeast-1      # Singapore (closest to Bangladesh)

# Monitoring
SENTRY_DSN=...

# App
NODE_ENV=production
CORS_ORIGIN=https://vesta-health.com
```

---

## Key Technical Decisions

### Why Prisma 6 over Prisma 7

Prisma 7 (released early 2026) rewrote the engine from Rust to TypeScript -- faster type-checking but broke the `prisma-field-encryption` extension ecosystem. Field-level encryption is non-negotiable for sex life tracking, medical notes, and potentially other sensitive health data. Stay on Prisma 6.19 until either:
- The prisma-field-encryption package is updated for v7, or
- Prisma adds native field-level encryption

### Why Vite 6 over Vite 8

Vite 8 integrates Rolldown (Rust-based bundler) promising 10-30x faster builds. However, it shipped in March 2026 and plugin compatibility is still being validated. For a health platform where build stability matters more than build speed, stay on the Vite 6 LTS line (6.4.x receives security patches). Revisit after Q3 2026.

### Why Express 5 (upgrade from 4)

The current project has Express 4.21. Express 5 is now stable with critical improvements:
- Promise-based error handling (no more uncaught promise rejections crashing the server)
- path-to-regexp v8 eliminates ReDoS vulnerability
- This is a security-sensitive health app -- the ReDoS fix alone justifies the migration

### Why Railway over Vercel Serverless for Backend

Express.js with BullMQ workers needs a persistent process. Vercel's serverless functions have cold starts (bad for real-time reminders) and cannot run background job workers. Railway provides always-on containers with managed PostgreSQL and Redis -- exactly what this backend needs.

### Why S3 over Cloudinary for Medical Images

Ultrasound images are medical data requiring encryption-at-rest and strict access control. S3 with SSE-KMS encryption, bucket policies, and presigned URLs (time-limited access) is the correct model. Cloudinary's value proposition (image transformation, CDN optimization) is irrelevant for medical documents that should not be publicly accessible.

---

## Sources

### Verified (HIGH confidence)
- [React Versions](https://react.dev/versions) -- React 19.2.4 latest stable
- [Vite Releases](https://vite.dev/releases) -- Vite 8.0.2 latest, v6 LTS supported
- [Tailwind CSS v4.0](https://tailwindcss.com/blog/tailwindcss-v4) -- v4.2 latest
- [Express.js](https://expressjs.com/) -- Express 5.2.1 stable
- [Prisma Changelog](https://www.prisma.io/changelog) -- Prisma 6.19.0, Prisma 7.2.0
- [TanStack Query](https://tanstack.com/query/latest) -- v5 stable with React 19
- [shadcn/ui Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4) -- Full Tailwind v4 + React 19 support
- [BullMQ](https://bullmq.io/) -- v5.71 latest
- [Resend Pricing](https://resend.com/pricing) -- 3,000 emails/month free
- [prisma-field-encryption](https://github.com/47ng/prisma-field-encryption) -- Supports Prisma 4.7.0 to 6.13.0
- [HIPAA Encryption 2025](https://censinet.com/perspectives/hipaa-encryption-protocols-2025-updates) -- AES-256 at rest, TLS 1.3 in transit
- [arima npm](https://www.npmjs.com/package/arima) -- v0.2.8, ARIMA/SARIMA/AutoARIMA for Node.js
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html) -- helmet + cors + rate-limit baseline

### Community-verified (MEDIUM confidence)
- [Password Hashing Guide 2025](https://guptadeepak.com/the-complete-guide-to-password-hashing-argon2-vs-bcrypt-vs-scrypt-vs-pbkdf2-2026/) -- Argon2id recommended
- [SSL Wireless SMS](https://www.npmjs.com/package/ssl-wireless-sms-send) -- npm package for Bangladesh SMS
- [Alpha SMS API](https://www.alpha.net.bd/sms/) -- Alternative Bangladesh SMS provider
- [TensorFlow.js](https://www.tensorflow.org/js) -- LSTM in Node.js viable
- [Zustand vs Redux 2025](https://www.meerako.com/blogs/react-state-management-zustand-vs-redux-vs-context-2025) -- Zustand preferred for lightweight apps
- [Recharts vs Chart.js](https://blog.logrocket.com/best-react-chart-libraries-2025/) -- Recharts better for React-first projects
- [Railway vs Vercel](https://docs.railway.com/platform/compare-to-vercel) -- Railway for persistent backend processes
- [Resend vs SendGrid 2025](https://medium.com/@nermeennasim/email-apis-in-2025-sendgrid-vs-resend-vs-aws-ses-a-developers-journey-8db7b5545233) -- Resend superior DX
- [React i18next](https://react.i18next.com/) -- De facto i18n for React, Bengali supported

### Unverified (LOW confidence -- needs validation)
- prisma-field-encryption compatibility ceiling at v6.13 -- need to test if it works with v6.19
- ssl-wireless-sms-send npm package quality -- documentation described as "inadequate," may need custom wrapper
- TensorFlow.js LSTM inference speed claims (38% faster than Python) -- single source benchmark
