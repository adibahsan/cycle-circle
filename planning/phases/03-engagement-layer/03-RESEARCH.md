# Phase 3: Engagement Layer - Research

**Researched:** 2026-03-26
**Domain:** Notifications (SMS/Email), Educational Content Platform, Partner Sharing
**Confidence:** HIGH

## Summary

Phase 3 adds the engagement and retention layer to Vesta: timely notifications via SMS and email, a bilingual educational content platform, and a partner sharing system. This phase builds directly on Phase 1 (auth, multi-profile, i18n) and Phase 2 (cycle tracking, predictions, symptom logging) -- notifications depend on prediction data, content recommendations depend on cycle phase, and partner sharing depends on the cycle calendar.

The three sub-domains are architecturally distinct but share infrastructure: BullMQ for background job processing (notification delivery, scheduled reminders), the multi-profile data model (notifications and content route per-profile, partner access scoped per-profile), and the i18n system (Bengali SMS per BTRC, bilingual content articles).

**Primary recommendation:** Build the notification infrastructure first (BullMQ setup, email/SMS delivery services, notification preferences per-profile), then content platform (Prisma schema for articles with bilingual fields, category/tag system, phase-based recommendations), then partner sharing (invite code generation, PartnerAccess model, read-only scoped endpoints). The notification infrastructure (BullMQ workers, job queues) is reused by both partner daily insights and content notification triggers.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| NOTF-01 | Period start prediction alert via email and SMS | BullMQ job scheduler with daily cron + prediction data lookup; Resend for email, SSL Wireless wrapper for SMS |
| NOTF-02 | Period logging reminder via email and SMS | BullMQ scheduled job checking profiles with active periods that haven't logged end date |
| NOTF-03 | Fertile window alert via email and SMS | Same delivery infrastructure as NOTF-01, triggered by prediction data showing fertile window within 1-2 days |
| NOTF-04 | User can toggle each notification type on/off | NotificationPref model per-profile with boolean fields per notification type and channel selection |
| NOTF-05 | Notification routing works per-profile in multi-profile system | Two-hop lookup: Profile -> Owner User -> Preferred Channel; notification preferences stored at profile level |
| NOTF-06 | SMS delivery via SSL Wireless (Bangladesh provider) | Thin HTTP wrapper over SSL Wireless REST API; Bengali text encoded as UTF-16 BE hex uppercase; dual SID (Bengali/English) |
| NOTF-07 | SMS content in Bengali per BTRC requirements | BTRC mandates all bulk SMS in Bengali from March 2022; OTP/numbers/URLs can be English; templates stored as Bengali i18n strings |
| CONT-01 | Blog-style articles on menstrual health, fertility, reproductive wellness | Article Prisma model with bilingual title/body fields, rich text (HTML/Markdown), published status |
| CONT-02 | All content available in English and Bengali | Dual-column approach: titleEn/titleBn, bodyEn/bodyBn on Article model (not i18n JSON files -- CMS content is database-driven) |
| CONT-03 | Content categorized by topic and tagged by cycle phase | Category and CyclePhaseTag models with many-to-many relations to Article; phases: menstrual, follicular, ovulatory, luteal |
| CONT-04 | Phase-specific content recommendations on dashboard | API endpoint returns articles matching active profile's current cycle phase; TanStack Query hook on dashboard |
| CONT-05 | Content addresses Bangladeshi cultural context and menstrual myths | Content authoring concern (not architectural); schema supports "cultural_context" category; admin CMS from Phase 4 manages content |
| PRTN-01 | Profile owner generates sharing code for partner | nanoid-based 8-character alphanumeric code stored in PartnerAccess model with expiry |
| PRTN-02 | Partner gets read-only access to current cycle calendar and phase insights | Partner-scoped API endpoints return filtered cycle data; partnerAccess middleware enforces read-only |
| PRTN-03 | Partner receives daily insights about partner's current phase | BullMQ daily cron job generates partner insight notifications; reuses email/SMS delivery infrastructure |
| PRTN-04 | Partner sees fertile window visibility (if TTC mode) | PartnerAccess permissions JSON includes fertileWindow boolean; only true when profile goalType is TTC |
| PRTN-05 | Partner cannot see logged symptoms or edit any data | partnerAccess middleware applies field-level filtering; symptom data excluded from partner response; all partner endpoints are GET-only |
| PRTN-06 | Primary user can revoke partner access instantly | DELETE endpoint sets PartnerAccess.isActive = false; TanStack Query cache for partner invalidated; partner's next request returns 403 |
</phase_requirements>

## Standard Stack

### Core (Phase 3 additions to existing stack)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| BullMQ | ^5.71.1 | Job queue for notifications | Redis-backed, supports Job Schedulers (cron), deduplication, retry with backoff. Already planned in stack. Replaces deprecated repeatable jobs API with upsertJobScheduler. |
| ioredis | ^5.10.1 | Redis client for BullMQ | Required backing store for BullMQ queues, also used for notification deduplication tracking and rate limit counters. |
| Resend | ^6.9.4 | Transactional email delivery | Clean SDK, 3000 emails/month free tier. Period reminders, fertile window alerts, partner invites. Supports React Email templates via `react` property. |
| @react-email/components | latest | Email template components | Build email templates as React components. Cross-client compatible primitives (Container, Row, Column, Button). Renders to HTML server-side. |
| nanoid | ^5.1.7 | Share code generation | Cryptographically secure (uses crypto module), URL-safe alphabet, customizable length. For partner invite codes (8-char alphanumeric). |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| ssl-wireless-sms-send | ^1.0.4 | SSL Wireless SMS wrapper | Reference only -- write a thin custom HTTP wrapper instead. The npm package has inadequate docs and hardcoded patterns. Use its Bengali-to-Unicode converter function as reference. |
| node-cron (NOT needed) | -- | Cron scheduling | NOT needed -- BullMQ Job Schedulers handle all cron scheduling natively. Do not add a separate cron library. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Resend | Nodemailer (direct SMTP) | Nodemailer requires managing deliverability, bounces, retries manually. Resend abstracts this. Worth it for health app where emails must arrive. |
| Resend | SendGrid | SendGrid is enterprise-heavy, complex API. Resend has superior DX and simpler pricing. |
| Custom SSL Wireless wrapper | ssl-wireless-sms-send npm package | npm package has inadequate Node.js docs, GPL-3.0 license, hardcoded patterns. A thin fetch wrapper over the REST API is simpler and more maintainable. |
| nanoid | crypto.randomBytes + base62 | nanoid is a well-tested, 118-byte library that handles the exact use case. No need to hand-roll. |
| Database-stored articles | i18n JSON files for content | Blog articles are CMS-managed dynamic content, not static UI strings. Database storage enables admin CRUD, search, pagination, and dynamic recommendations. |

**Installation (packages/api):**

```bash
pnpm add bullmq ioredis resend nanoid
pnpm add @react-email/components react react-dom  # for email templates (server-side)
```

**Installation (packages/web):**

```bash
# No new frontend dependencies -- uses existing TanStack Query, Zustand, React Router, i18next
# Partner view and content pages use existing shadcn/ui components
```

## Architecture Patterns

### Recommended Structure (Phase 3 additions)

```
packages/
  api/
    src/
      services/
        notification.service.ts      # Orchestrates notification delivery
        content.service.ts           # Article CRUD, phase-based recommendations
        partner.service.ts           # Share code generation, access management
      jobs/
        queues.ts                    # Queue definitions (notification, reminder, partner-insight)
        processors/
          sendSms.processor.ts       # SSL Wireless delivery with retry
          sendEmail.processor.ts     # Resend delivery with retry
          dailyReminder.processor.ts # Cron: check predictions, queue notifications
          partnerInsight.processor.ts # Cron: generate daily partner insights
      utils/
        sms.ts                       # SSL Wireless HTTP wrapper (Bengali encoding)
        email.ts                     # Resend wrapper with template rendering
        shareCode.ts                 # nanoid-based invite code generation
      routes/
        notification.routes.ts       # GET/PUT notification preferences
        content.routes.ts            # GET articles (list, by-id, by-phase)
        partner.routes.ts            # POST share, GET partner view, DELETE revoke
      middleware/
        partnerAccess.ts             # Verify partner relationship + field filtering
      emails/                        # React Email templates
        PeriodReminder.tsx           # Period prediction alert template
        FertileWindowAlert.tsx       # Fertile window notification template
        PartnerInvite.tsx            # Partner sharing invitation template
        PartnerDailyInsight.tsx      # Daily partner phase update template
  web/
    src/
      pages/
        settings/
          notifications.tsx          # Notification preference toggles
        content/
          index.tsx                  # Article list (category/phase filter)
          [articleId].tsx            # Article detail view
        partner/
          share.tsx                  # Generate/manage share codes
          view.tsx                   # Partner read-only cycle view
      components/features/
        content/
          ArticleCard.tsx            # Article preview card
          ContentFeed.tsx            # Phase-based content recommendations
          CategoryFilter.tsx         # Topic + phase filter UI
        partner/
          ShareCodeGenerator.tsx     # Generate and display invite code
          PartnerCalendar.tsx        # Read-only cycle calendar for partners
          PhaseInsight.tsx           # Current phase summary for partner
        notifications/
          NotificationToggle.tsx     # Per-type, per-channel toggle component
      api/
        notifications.ts            # TanStack Query hooks for notification prefs
        content.ts                   # TanStack Query hooks for articles
        partner.ts                   # TanStack Query hooks for partner sharing
```

### Pattern 1: Notification Delivery Pipeline

**What:** Three-stage pipeline: Trigger (cron/event) -> Orchestration (check prefs, select channel) -> Delivery (send via provider). Each stage is a separate BullMQ job for isolation and retry independence.

**When to use:** All notification types (period prediction, logging reminder, fertile window, partner insight).

**Example:**

```typescript
// Stage 1: Daily Reminder Cron (runs at 8:00 AM BST)
// jobs/processors/dailyReminder.processor.ts
import { Worker } from 'bullmq';

const dailyReminderWorker = new Worker('daily-reminder', async (job) => {
  // Find profiles with upcoming predictions
  const profiles = await prisma.profile.findMany({
    where: {
      predictions: {
        some: {
          nextPeriod: {
            gte: new Date(),
            lte: addDays(new Date(), 2),
          },
        },
      },
    },
    include: {
      user: true,
      notificationPref: true,
      predictions: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });

  // Stage 2: Queue individual notification jobs per profile
  for (const profile of profiles) {
    if (!profile.notificationPref?.periodReminder) continue;

    const channels = profile.notificationPref.channels as { sms: boolean; email: boolean };

    if (channels.email) {
      await notificationQueue.add('send-email', {
        profileId: profile.id,
        type: 'period-prediction',
        to: profile.user.email,
        locale: profile.user.locale,
        data: { predictedDate: profile.predictions[0].nextPeriod },
      }, {
        deduplication: { id: `period-pred-${profile.id}-${format(new Date(), 'yyyy-MM-dd')}` },
        attempts: 3,
        backoff: { type: 'exponential', delay: 30000 },
      });
    }

    if (channels.sms) {
      await notificationQueue.add('send-sms', {
        profileId: profile.id,
        type: 'period-prediction',
        phone: profile.user.phone,
        locale: profile.user.locale, // always 'bn' for SMS per BTRC
        data: { predictedDate: profile.predictions[0].nextPeriod },
      }, {
        deduplication: { id: `period-sms-${profile.id}-${format(new Date(), 'yyyy-MM-dd')}` },
        attempts: 3,
        backoff: { type: 'exponential', delay: 30000 },
      });
    }
  }
}, { connection: redisConnection });
```

```typescript
// Schedule the daily reminder cron using Job Schedulers API (BullMQ v5.16+)
// jobs/queues.ts
import { Queue } from 'bullmq';

const reminderQueue = new Queue('daily-reminder', { connection: redisConnection });

// Create a job scheduler that fires daily at 8:00 AM BST (UTC+6 = 2:00 AM UTC)
await reminderQueue.upsertJobScheduler('daily-period-reminder', {
  pattern: '0 2 * * *',  // 2:00 AM UTC = 8:00 AM BST
  tz: 'Asia/Dhaka',      // BullMQ supports timezone in cron
}, {
  name: 'check-period-predictions',
  data: { type: 'period-prediction' },
});
```

### Pattern 2: SSL Wireless SMS Wrapper (Bengali Encoding)

**What:** Thin HTTP wrapper over SSL Wireless REST API with Bengali text encoding (UTF-16 BE hex uppercase) per their API requirements. Provider-agnostic interface for swappable fallback.

**When to use:** All SMS delivery. Never call SSL Wireless directly from service code -- always through the wrapper.

**Example:**

```typescript
// utils/sms.ts
interface SMSProvider {
  send(phone: string, message: string, locale: 'en' | 'bn'): Promise<SMSResult>;
}

interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// Bengali text must be encoded as UTF-16 BE hex uppercase for SSL Wireless
function encodeBengaliToUnicode(text: string): string {
  const buffer = Buffer.from(text, 'utf16le');
  // Swap bytes for Big Endian
  for (let i = 0; i < buffer.length; i += 2) {
    const temp = buffer[i];
    buffer[i] = buffer[i + 1];
    buffer[i + 1] = temp;
  }
  return buffer.toString('hex').toUpperCase();
}

class SSLWirelessProvider implements SMSProvider {
  private readonly apiUrl = 'https://smsplus.sslwireless.com/api/v3/send-sms';

  async send(phone: string, message: string, locale: 'en' | 'bn'): Promise<SMSResult> {
    const isBengali = locale === 'bn';
    const body = {
      api_token: process.env.SSL_WIRELESS_API_TOKEN,
      sid: isBengali ? process.env.SSL_WIRELESS_BENGALI_SID : process.env.SSL_WIRELESS_ENGLISH_SID,
      msisdn: phone,
      sms: isBengali ? encodeBengaliToUnicode(message) : message,
      csms_id: nanoid(16),
    };

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    return {
      success: result.status === 'SUCCESS',
      messageId: result.smsuid,
      error: result.status !== 'SUCCESS' ? result.message : undefined,
    };
  }
}

// Factory for provider swapping (fallback to Alpha Net BD)
function getSMSProvider(primary = true): SMSProvider {
  return primary ? new SSLWirelessProvider() : new AlphaNetProvider();
}
```

### Pattern 3: Partner Sharing with Scoped Access

**What:** Invite-code-based partner access with per-field permissions. Partner endpoints return filtered data -- never raw profile data. Revocation is instant (database flag, no token to expire).

**When to use:** All partner-related features.

**Example:**

```typescript
// Prisma schema additions for PartnerAccess
model PartnerAccess {
  id              String   @id @default(cuid())
  profileId       String
  profile         Profile  @relation(fields: [profileId], references: [id], onDelete: Cascade)
  partnerUserId   String
  partnerUser     User     @relation("PartnerOf", fields: [partnerUserId], references: [id])
  shareCode       String   @unique
  permissions     Json     // { calendar: true, phaseInsight: true, fertileWindow: false, symptoms: false }
  isActive        Boolean  @default(true)
  expiresAt       DateTime?
  createdAt       DateTime @default(now())
  revokedAt       DateTime?

  @@unique([profileId, partnerUserId])
  @@index([shareCode])
  @@index([partnerUserId, isActive])
}
```

```typescript
// middleware/partnerAccess.ts
async function checkPartnerAccess(req: Request, res: Response, next: NextFunction) {
  const { profileId } = req.params;
  const userId = req.user.id;

  const access = await prisma.partnerAccess.findFirst({
    where: {
      profileId,
      partnerUserId: userId,
      isActive: true,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
  });

  if (!access) {
    return res.status(403).json({ error: 'Partner access denied or revoked' });
  }

  // Attach permissions to request for field-level filtering downstream
  req.partnerPermissions = access.permissions as PartnerPermissions;
  next();
}
```

```typescript
// Partner share code generation
// services/partner.service.ts
import { nanoid, customAlphabet } from 'nanoid';

const generateShareCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 8);
// Excludes confusable chars: 0/O, 1/I/L

async function createPartnerShare(profileId: string, userId: string): Promise<string> {
  // Verify user owns the profile
  const profile = await prisma.profile.findFirst({
    where: { id: profileId, userId },
  });
  if (!profile) throw new Error('Profile not found');

  // Revoke any existing active shares for this profile
  // (one active partner per profile at a time)
  await prisma.partnerAccess.updateMany({
    where: { profileId, isActive: true },
    data: { isActive: false, revokedAt: new Date() },
  });

  const code = generateShareCode();
  const defaultPermissions = {
    calendar: true,
    phaseInsight: true,
    fertileWindow: profile.goalType === 'TTC',
    symptoms: false,
    notes: false,
  };

  await prisma.partnerAccess.create({
    data: {
      profileId,
      partnerUserId: '', // Set when partner redeems code
      shareCode: code,
      permissions: defaultPermissions,
      expiresAt: addDays(new Date(), 7), // Code expires in 7 days if not redeemed
    },
  });

  return code;
}
```

### Pattern 4: Bilingual Content Platform (Database-Driven)

**What:** Articles stored in PostgreSQL with dual-language fields (titleEn/titleBn, bodyEn/bodyBn). Categories and cycle phase tags as separate related tables. Content is database-driven (not i18n JSON files) because it's admin-managed CMS content.

**When to use:** All educational content features.

**Example:**

```typescript
// Prisma schema for Content Platform
model Article {
  id            String         @id @default(cuid())
  slug          String         @unique
  titleEn       String
  titleBn       String
  bodyEn        String         @db.Text
  bodyBn        String         @db.Text
  excerptEn     String?
  excerptBn     String?
  coverImage    String?
  status        ArticleStatus  @default(DRAFT)
  authorId      String
  author        User           @relation(fields: [authorId], references: [id])
  categoryId    String
  category      Category       @relation(fields: [categoryId], references: [id])
  phaseTags     ArticlePhaseTag[]
  publishedAt   DateTime?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  @@index([status, publishedAt])
  @@index([categoryId])
}

enum ArticleStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

model Category {
  id        String    @id @default(cuid())
  slug      String    @unique
  nameEn    String
  nameBn    String
  articles  Article[]
}

model ArticlePhaseTag {
  id        String     @id @default(cuid())
  articleId String
  article   Article    @relation(fields: [articleId], references: [id], onDelete: Cascade)
  phase     CyclePhase

  @@unique([articleId, phase])
  @@index([phase])
}

enum CyclePhase {
  MENSTRUAL
  FOLLICULAR
  OVULATORY
  LUTEAL
  ALL // phase-agnostic content
}
```

```typescript
// services/content.service.ts
async function getPhaseRecommendations(profileId: string, locale: 'en' | 'bn', limit = 5) {
  // Get the profile's current cycle phase from prediction data
  const prediction = await prisma.prediction.findFirst({
    where: { profileId },
    orderBy: { createdAt: 'desc' },
  });

  const currentPhase = calculateCurrentPhase(prediction);

  const articles = await prisma.article.findMany({
    where: {
      status: 'PUBLISHED',
      phaseTags: {
        some: {
          phase: { in: [currentPhase, 'ALL'] },
        },
      },
    },
    select: {
      id: true,
      slug: true,
      titleEn: locale === 'en',
      titleBn: locale === 'bn',
      excerptEn: locale === 'en',
      excerptBn: locale === 'bn',
      coverImage: true,
      category: {
        select: {
          nameEn: locale === 'en',
          nameBn: locale === 'bn',
        },
      },
    },
    orderBy: { publishedAt: 'desc' },
    take: limit,
  });

  return articles;
}
```

### Anti-Patterns to Avoid

- **Fire-and-forget notifications:** Never send SMS/email without logging the attempt and status. Every notification must create a NotificationLog record. BullMQ job completion/failure handlers must update the log.

- **Storing content translations in i18n JSON files:** Blog articles are dynamic CMS content, not static UI strings. i18n JSON files are for UI labels ("Dashboard", "Settings", "Log Period"). Article titles, bodies, and excerpts belong in the database where they can be created, edited, searched, and paginated by an admin CMS.

- **Partner access via JWT claims:** Do not encode partner relationships in JWT tokens. Partner access is checked per-request against the PartnerAccess table. Revocation must be instant -- JWT expiry (15 minutes) is unacceptably slow for access revocation.

- **Sending Bengali SMS without encoding:** SSL Wireless requires Bengali text as UTF-16 BE hex uppercase. Sending raw UTF-8 Bengali text will result in garbled messages or delivery failure.

- **Single queue for all notification types:** Use separate BullMQ queues for different priority levels. Period prediction alerts are higher priority than content recommendation notifications. Separate queues allow independent concurrency and rate limiting.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job scheduling | Custom setInterval/cron | BullMQ Job Schedulers (upsertJobScheduler) | Handles persistence across restarts, distributed workers, deduplication, retry, dead letter queues |
| Email delivery + tracking | Direct SMTP via Nodemailer | Resend SDK | Deliverability, bounce handling, compliance, webhook events handled by provider |
| Share code generation | Math.random + base36 | nanoid customAlphabet | Cryptographically secure, collision-resistant, configurable alphabet (exclude confusable chars) |
| Bengali SMS encoding | Manual Buffer manipulation | Port the proven UTF-16 BE hex pattern from ssl-wireless-sms-send source | Edge cases in Bengali conjunct characters, surrogate pairs |
| Notification deduplication | Custom Redis SETNX logic | BullMQ built-in deduplication (job opts deduplication.id) | Race conditions, TTL management, cleanup -- all handled by BullMQ |
| Email templates | Raw HTML strings | @react-email/components | Cross-client compatibility (Outlook, Gmail, Yahoo), responsive design, type-safe props |

**Key insight:** The notification pipeline has many edge cases (duplicate delivery, retry storms, provider failures, timezone handling, deduplication) that are deceptively complex. BullMQ handles most of them natively. The remaining complexity is in the orchestration layer (which profiles get which notifications) -- that is where developer effort should focus.

## Common Pitfalls

### Pitfall 1: BTRC Bengali SMS Compliance Violation

**What goes wrong:** Sending notification SMS in English or in Banglish (Bengali written in English letters). BTRC mandates all bulk SMS in Bengali from March 7, 2022. Violation results in SSL Wireless disconnecting the connection.
**Why it happens:** Developers test with English templates and forget to switch to Bengali for production. Or they assume "bilingual" means English is acceptable.
**How to avoid:** SMS templates MUST be in Bengali by default. Only OTP codes, phone numbers, numeric digits, and URLs can be in English. Store Bengali SMS templates as i18n strings in the backend. Test SMS output with actual Bengali text during development.
**Warning signs:** SMS template strings contain English words that are not OTP/URL/numbers. No Bengali SMS template file exists in the codebase.

### Pitfall 2: Duplicate Notification Delivery

**What goes wrong:** User receives 2-3 period prediction SMS in a row because the BullMQ worker crashed mid-processing and retried, or the daily cron job ran twice due to a deployment restart.
**Why it happens:** Without deduplication, retried jobs re-send already-delivered notifications. Without idempotency in the delivery pipeline, a job that succeeded at the provider but failed to ack in BullMQ will retry and deliver again.
**How to avoid:** Use BullMQ's built-in deduplication with date-scoped IDs: `deduplication: { id: 'period-pred-{profileId}-{date}' }`. Before sending, check NotificationLog for an existing successful delivery for this profile + type + date. Mark jobs as complete even if logging fails (prefer occasional missed log over duplicate delivery).
**Warning signs:** NotificationLog shows multiple entries for the same profile + type + date. Users report receiving the same notification multiple times.

### Pitfall 3: Partner Cache Leakage After Revocation

**What goes wrong:** Primary user revokes partner access, but the partner can still see cycle data because their TanStack Query cache still holds the data, or because the server response is cached in Redis.
**Why it happens:** Revocation updates the database but does not invalidate any caches. The partner's browser still has cached API responses.
**How to avoid:** On revocation, clear any Redis cache entries for the partner's view of this profile. Partner API endpoints should set short cache headers (max-age: 60) or no-cache. TanStack Query on the partner side should use short staleTime (30 seconds). The partner's next API call after revocation returns 403, which triggers an error state in the UI.
**Warning signs:** Partner can still view data for several minutes after revocation. Redis cache TTL for partner data is longer than 60 seconds.

### Pitfall 4: Notification Routing in Multi-Profile Accounts

**What goes wrong:** Notifications for Profile A (wife) are sent to the wrong email/phone because the system looked up the user's contact info without considering which profile triggered the notification. Or all profiles under one account receive the same notification.
**Why it happens:** The two-hop lookup (Profile -> Owner User -> Contact Info) is not well understood. Notification preferences are per-profile, but contact info (email, phone) belongs to the user account.
**How to avoid:** Notification pipeline receives profileId, then: (1) load the profile's notification preferences, (2) if enabled for this type, load the profile's owner user, (3) send to the user's contact info. The NotificationLog stores both profileId and userId. Test with a multi-profile account where one profile has period reminders enabled and another has them disabled -- verify only the enabled one generates a notification.
**Warning signs:** NotificationLog does not include profileId. Notification preferences are stored at user level instead of profile level.

### Pitfall 5: SSL Wireless IP Whitelisting Failure

**What goes wrong:** SMS works in local development but fails in production because Railway's outbound IP is not whitelisted with SSL Wireless. The API silently rejects requests from unknown IPs.
**Why it happens:** SSL Wireless requires IP whitelisting for API access. Railway uses dynamic IPs unless configured with a static outbound IP.
**How to avoid:** Before production deployment: (1) Get Railway's outbound IP (or configure a static IP add-on), (2) Whitelist it with SSL Wireless, (3) Test SMS delivery from the production environment specifically. Budget 2-3 business days for SSL Wireless to process IP whitelisting requests.
**Warning signs:** SMS works locally but not in staging/production. SSL Wireless dashboard shows rejected API calls. No static IP configured on Railway.

## Code Examples

### Notification Preferences Schema and API

```typescript
// packages/shared/src/schemas/notification.ts
import { z } from 'zod';

export const notificationPrefSchema = z.object({
  periodReminder: z.boolean().default(true),
  fertileAlert: z.boolean().default(true),
  loggingReminder: z.boolean().default(true),
  contentRecommendation: z.boolean().default(false),
  partnerDailyInsight: z.boolean().default(true),
  channels: z.object({
    sms: z.boolean().default(true),
    email: z.boolean().default(true),
  }),
});

export type NotificationPref = z.infer<typeof notificationPrefSchema>;
```

```typescript
// routes/notification.routes.ts
router.get(
  '/profiles/:profileId/notifications/preferences',
  verifyJWT,
  checkProfileOwnership,
  async (req, res) => {
    const prefs = await notificationService.getPreferences(req.params.profileId);
    res.json({ data: prefs });
  }
);

router.put(
  '/profiles/:profileId/notifications/preferences',
  verifyJWT,
  checkProfileOwnership,
  validateBody(notificationPrefSchema),
  async (req, res) => {
    const prefs = await notificationService.updatePreferences(
      req.params.profileId,
      req.body
    );
    res.json({ data: prefs });
  }
);
```

### NotificationLog for Delivery Tracking

```typescript
// Prisma schema
model NotificationLog {
  id          String            @id @default(cuid())
  profileId   String
  profile     Profile           @relation(fields: [profileId], references: [id], onDelete: Cascade)
  userId      String
  type        NotificationType
  channel     NotificationChannel
  status      DeliveryStatus    @default(QUEUED)
  messageId   String?           // Provider message ID (Resend ID or SSL Wireless smsuid)
  error       String?
  sentAt      DateTime?
  deliveredAt DateTime?
  createdAt   DateTime          @default(now())

  @@index([profileId, type, createdAt])
  @@index([status])
}

enum NotificationType {
  PERIOD_PREDICTION
  LOGGING_REMINDER
  FERTILE_WINDOW
  PARTNER_INVITE
  PARTNER_DAILY_INSIGHT
  CONTENT_RECOMMENDATION
}

enum NotificationChannel {
  SMS
  EMAIL
}

enum DeliveryStatus {
  QUEUED
  SENT
  DELIVERED
  FAILED
  BOUNCED
}
```

### BullMQ Queue Setup

```typescript
// jobs/queues.ts
import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';

// Separate queues for priority isolation
export const notificationQueue = new Queue('notifications', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 30000 }, // 30s, 60s, 120s
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  },
});

export const reminderQueue = new Queue('reminders', {
  connection: redisConnection,
});

// Initialize Job Schedulers (call on worker startup)
export async function initializeSchedulers() {
  // Daily period prediction check at 8:00 AM BST
  await reminderQueue.upsertJobScheduler('daily-period-check', {
    pattern: '0 2 * * *', // 2:00 AM UTC = 8:00 AM BST
    tz: 'Asia/Dhaka',
  }, {
    name: 'check-period-predictions',
  });

  // Daily fertile window check at 8:00 AM BST
  await reminderQueue.upsertJobScheduler('daily-fertile-check', {
    pattern: '0 2 * * *',
    tz: 'Asia/Dhaka',
  }, {
    name: 'check-fertile-windows',
  });

  // Daily partner insight generation at 7:00 AM BST
  await reminderQueue.upsertJobScheduler('daily-partner-insight', {
    pattern: '0 1 * * *', // 1:00 AM UTC = 7:00 AM BST
    tz: 'Asia/Dhaka',
  }, {
    name: 'generate-partner-insights',
  });

  // Logging reminder at 9:00 PM BST (remind to log today's symptoms)
  await reminderQueue.upsertJobScheduler('evening-logging-reminder', {
    pattern: '0 15 * * *', // 3:00 PM UTC = 9:00 PM BST
    tz: 'Asia/Dhaka',
  }, {
    name: 'check-logging-reminders',
  });
}
```

### Partner View API (Read-Only, Filtered)

```typescript
// routes/partner.routes.ts
router.get(
  '/partner/:profileId/calendar',
  verifyJWT,
  checkPartnerAccess, // NOT checkProfileOwnership -- different auth path
  async (req, res) => {
    const { profileId } = req.params;
    const permissions = req.partnerPermissions;

    const data = await partnerService.getCalendarView(profileId, permissions);
    res.json({ data });
  }
);

// services/partner.service.ts
async function getCalendarView(profileId: string, permissions: PartnerPermissions) {
  const cycles = await prisma.cycleLog.findMany({
    where: { profileId },
    orderBy: { startDate: 'desc' },
    take: 6, // Last 6 cycles only
    select: {
      startDate: true,
      endDate: true,
      flowIntensity: true,
      // symptoms: NEVER included for partner view
    },
  });

  const prediction = await prisma.prediction.findFirst({
    where: { profileId },
    orderBy: { createdAt: 'desc' },
    select: {
      nextPeriod: true,
      ovulation: permissions.fertileWindow ? true : false,
      fertileStart: permissions.fertileWindow ? true : false,
      fertileEnd: permissions.fertileWindow ? true : false,
      tier: true,
      confidence: true,
    },
  });

  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    select: {
      name: true,
      cycleLength: true,
      goalType: true,
    },
  });

  return {
    profile: { name: profile?.name },
    cycles,
    prediction,
    currentPhase: calculateCurrentPhase(prediction),
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BullMQ `queue.add('name', data, { repeat: { cron: '...' } })` | `queue.upsertJobScheduler(id, repeatOpts, template)` | BullMQ v5.16.0 (2024) | Old repeatable jobs API is deprecated. New Job Schedulers are upsertable (no duplicate schedulers on restart), have explicit IDs, and prevent ghost jobs. |
| BullMQ custom deduplication via Redis SETNX | `deduplication: { id: '...', ttl: 60000 }` in job options | BullMQ v5.x (2025) | Built-in deduplication with Simple, Throttle, and Debounce modes. No need for custom Redis logic. |
| Resend SDK v4.x | Resend SDK v6.9.4 | 2025-2026 | Updated SDK with better TypeScript types, scheduledAt for future emails, idempotencyKey support |
| ssl-wireless-sms-send npm package | Custom thin HTTP wrapper | Ongoing | npm package has inadequate docs, GPL-3.0 license, and last updated 2021. Direct HTTP wrapper is simpler and more maintainable. |

**Deprecated/outdated:**
- BullMQ `repeat` option on individual jobs: Use `upsertJobScheduler` instead
- Nodemailer for transactional email: Resend provides better deliverability guarantees and webhook support
- `ssl-wireless-sms-send` npm package: Inadequate docs, write a custom wrapper

## Open Questions

1. **SSL Wireless API endpoint and authentication format**
   - What we know: The API exists at sslwireless.com, requires api_token and SID credentials, supports Bengali via UTF-16 BE hex encoding
   - What's unclear: Exact REST endpoint URL (smsplus.sslwireless.com vs api.sslwireless.com), exact request/response format, delivery receipt webhook format
   - Recommendation: Budget a 2-4 hour research spike at implementation time to test the API with actual credentials. The npm package source code can be reverse-engineered for the endpoint URL.

2. **Railway static IP for SMS whitelisting**
   - What we know: SSL Wireless requires IP whitelisting. Railway uses dynamic outbound IPs by default.
   - What's unclear: Whether Railway offers static IP as an add-on (pricing), or if a proxy service is needed
   - Recommendation: Investigate Railway static IP support during implementation. If unavailable, consider a proxy service or alternative deployment for the SMS worker only.

3. **Content seeding strategy**
   - What we know: The content platform needs bilingual articles on menstrual health, fertility, and Bangladeshi cultural context
   - What's unclear: Who writes the initial content? How many articles are needed for launch?
   - Recommendation: Schema and API should be built regardless. Seed with 10-15 placeholder articles across categories and phases for demo. Actual content is a client responsibility, but provide the structure.

4. **Partner sharing - one partner per profile or multiple?**
   - What we know: Requirements say "partner" (singular) gets read-only access
   - What's unclear: Whether multiple partners should be supported (e.g., husband AND mother-in-law)
   - Recommendation: Build the schema to support multiple partners per profile (PartnerAccess is a separate record per partner), but the UI can limit to one active partner for v1. This avoids a schema migration later.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^3.x |
| Config file | packages/api/vitest.config.ts (or none -- see Wave 0) |
| Quick run command | `pnpm --filter api test --run` |
| Full suite command | `pnpm turbo test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NOTF-01 | Period prediction alert triggers for eligible profiles | integration | `pnpm --filter api test -- --grep "period prediction alert" -x` | Wave 0 |
| NOTF-02 | Logging reminder triggers for profiles with open periods | integration | `pnpm --filter api test -- --grep "logging reminder" -x` | Wave 0 |
| NOTF-03 | Fertile window alert triggers correctly | integration | `pnpm --filter api test -- --grep "fertile window alert" -x` | Wave 0 |
| NOTF-04 | User can toggle notification types on/off | unit | `pnpm --filter api test -- --grep "notification preferences" -x` | Wave 0 |
| NOTF-05 | Notifications route per-profile in multi-profile accounts | integration | `pnpm --filter api test -- --grep "multi-profile notification routing" -x` | Wave 0 |
| NOTF-06 | SMS sends via SSL Wireless with correct encoding | unit | `pnpm --filter api test -- --grep "ssl wireless sms" -x` | Wave 0 |
| NOTF-07 | SMS content is in Bengali | unit | `pnpm --filter api test -- --grep "bengali sms content" -x` | Wave 0 |
| CONT-01 | Articles can be created and retrieved | unit | `pnpm --filter api test -- --grep "article crud" -x` | Wave 0 |
| CONT-02 | Articles have bilingual content | unit | `pnpm --filter api test -- --grep "bilingual article" -x` | Wave 0 |
| CONT-03 | Articles filtered by category and cycle phase | unit | `pnpm --filter api test -- --grep "article filter" -x` | Wave 0 |
| CONT-04 | Phase-specific recommendations return correct articles | integration | `pnpm --filter api test -- --grep "phase recommendations" -x` | Wave 0 |
| CONT-05 | Cultural context category exists and articles tagged | unit | `pnpm --filter api test -- --grep "cultural context" -x` | Wave 0 |
| PRTN-01 | Share code generated with correct format | unit | `pnpm --filter api test -- --grep "share code generation" -x` | Wave 0 |
| PRTN-02 | Partner gets read-only cycle calendar access | integration | `pnpm --filter api test -- --grep "partner read-only" -x` | Wave 0 |
| PRTN-03 | Partner daily insight job generates notifications | integration | `pnpm --filter api test -- --grep "partner daily insight" -x` | Wave 0 |
| PRTN-04 | Fertile window visible only in TTC mode | unit | `pnpm --filter api test -- --grep "partner fertile window ttc" -x` | Wave 0 |
| PRTN-05 | Partner cannot see symptoms or edit data | integration | `pnpm --filter api test -- --grep "partner symptom exclusion" -x` | Wave 0 |
| PRTN-06 | Partner access revocation is immediate | integration | `pnpm --filter api test -- --grep "partner revocation" -x` | Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter api test --run`
- **Per wave merge:** `pnpm turbo test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/api/src/__tests__/notification.service.test.ts` -- covers NOTF-01 through NOTF-07
- [ ] `packages/api/src/__tests__/content.service.test.ts` -- covers CONT-01 through CONT-05
- [ ] `packages/api/src/__tests__/partner.service.test.ts` -- covers PRTN-01 through PRTN-06
- [ ] `packages/api/src/__tests__/sms.test.ts` -- covers Bengali encoding and SSL Wireless wrapper
- [ ] `packages/api/src/__tests__/jobs/dailyReminder.test.ts` -- covers cron job logic
- [ ] BullMQ test utilities (mock queue, mock worker) for testing job processors without Redis
- [ ] Test fixtures: sample profiles with prediction data, notification preferences, partner access records

## Sources

### Primary (HIGH confidence)
- [BullMQ Job Schedulers docs](https://docs.bullmq.io/guide/job-schedulers) - upsertJobScheduler API, cron patterns, timezone support
- [BullMQ Deduplication docs](https://docs.bullmq.io/guide/jobs/deduplication) - Simple, Throttle, and Debounce modes
- [Resend Node.js docs](https://resend.com/docs/send-with-nodejs) - SDK v6.x, send method, React Email integration
- [React Email](https://react.email/docs/integrations/resend) - Component-based email templates
- [nanoid GitHub](https://github.com/ai/nanoid) - v5.1.7, customAlphabet for invite codes
- [BTRC Bengali SMS mandate](https://www.mimsms.com/all-types-of-bulk-sms-have-to-be-sent-in-bengali/) - March 2022, all bulk SMS in Bengali; OTP/URLs can be English

### Secondary (MEDIUM confidence)
- [SSL Wireless npm package](https://github.com/saadnoor/ssl-wireless-sms-send) - v1.0.4, send function signature and Bengali-to-Unicode converter
- [Bengali SMS encoding for SSL Wireless](https://archive.adhikary.net/2019/07/15/encoding-bangla-unicode-sms-for-sslwireless-in-python/) - UTF-16 BE hex uppercase encoding requirement
- [SSL Wireless official](https://sslwireless.com/enterprise-solutions/api-based-sms/) - API-based SMS service description
- [BullMQ Better Stack guide](https://betterstack.com/community/guides/scaling-nodejs/bullmq-scheduled-tasks/) - Practical job scheduling patterns
- [Alpha Net BD SMS API](https://www.alpha.net.bd/SMS/api/) - Fallback SMS provider for Bangladesh

### Tertiary (LOW confidence)
- SSL Wireless exact API endpoint URL (smsplus.sslwireless.com/api/v3/send-sms) - extracted from npm package source, not verified against current API
- Railway static IP availability for SMS whitelisting - needs verification during implementation
- BTRC bulk SMS content pre-approval requirement - mentioned in Dhaka Tribune (2020), may have changed

## Metadata

**Confidence breakdown:**
- Notification infrastructure (BullMQ, Resend): HIGH - well-documented, verified against official docs
- SMS delivery (SSL Wireless): MEDIUM - API exists and works, but documentation is inadequate; Bengali encoding pattern is verified
- Content platform schema: HIGH - standard blog CMS pattern with bilingual columns, well-understood
- Partner sharing pattern: HIGH - straightforward invite-code + permission-scoped access, standard auth pattern
- BTRC compliance: MEDIUM - regulation confirmed by multiple sources but exact enforcement details unclear

**Research date:** 2026-03-26
**Valid until:** 2026-04-25 (30 days -- stable technologies, no fast-moving changes expected)
