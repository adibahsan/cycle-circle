# Pitfalls Research

**Domain:** Reproductive Health & Cycle Intelligence Platform (Web-based, Bangladesh-first)
**Researched:** 2026-03-26
**Confidence:** HIGH

---

## Critical Pitfalls

Mistakes that cause rewrites, data breaches, regulatory action, or project failure.

### Pitfall 1: Multi-Profile Authorization Bypass (Data Leak Between Users)

**What goes wrong:**
A user with multiple profiles can access another user's profiles by manipulating `profileId` in API requests. Or a partner sharing link exposes more data than intended (sex life logs, medical notes). In the worst case, a horizontal privilege escalation exposes intimate health data of unrelated users.

**Why it happens:**
Multi-profile architecture is unusual -- standard auth tutorials assume 1 user = 1 data scope. Developers build auth (verify JWT) but forget profile ownership checks on every route. The pattern "user is authenticated, therefore they can access this profile" is wrong when multiple users exist. Partner sharing adds a second layer of complexity: the partner should see cycle calendar but not sex life data, creating field-level access rules that are easy to get wrong.

**How to avoid:**
- Middleware-first approach: every profile-scoped route passes through `checkProfileOwnership(req.user.id, req.params.profileId)` BEFORE any data access. This middleware queries the `UserProfile` junction table and rejects with 403 if the user does not own the profile.
- Never trust `profileId` from the client without server-side verification.
- Partner sharing: create a separate `PartnerAccess` model with explicit field-level permissions (`canViewCalendar: true`, `canViewSexLife: false`, `canViewMedNotes: false`). Never grant blanket read access.
- PostgreSQL Row-Level Security (RLS) as a defense-in-depth layer -- even if the application layer fails, the database refuses to return rows the user should not see. But beware: Prisma connects as a superuser by default, which bypasses ALL RLS policies. You must create a separate database role with limited privileges and use `SET LOCAL` in transactions to set the tenant context.
- Automated security test suite: write tests that attempt cross-user profile access and verify 403 responses. Run these in CI on every PR.

**Warning signs:**
- No middleware between JWT verification and data access
- Profile ID passed only as a URL parameter with no ownership check
- Partner endpoints return full profile objects instead of scoped projections
- No 403 test cases in the test suite

**Phase to address:**
Phase 1 (Foundation & Auth). This is the FIRST thing to get right. Every subsequent feature inherits this architecture. Getting it wrong means retrofitting auth checks across hundreds of endpoints later.

---

### Pitfall 2: Prisma Version Lock -- Field Encryption Compatibility

**What goes wrong:**
Upgrading Prisma to v7 (or even late v6 beyond 6.13) breaks the `prisma-field-encryption` extension. Encrypted sex life data and medical notes become inaccessible, silently stored unencrypted, or cause runtime crashes.

**Why it happens:**
Prisma 7 rewrote the client engine from Rust to TypeScript, changing the extension API surface. The `prisma-field-encryption` package officially supports Prisma 4.7.0 to 6.13.0. The project stack recommends Prisma 6.19, which has NOT been verified as compatible. This is a real risk.

**How to avoid:**
- Pin Prisma to `^6.13.0` (the last verified-compatible version) initially. Only bump to 6.19 after running integration tests that prove encrypt/store/retrieve/decrypt works correctly.
- Write an integration test that encrypts a test record with sensitive fields, stores it, retrieves it, and asserts the decrypted value matches. Run this test in CI.
- Have a fallback plan: if prisma-field-encryption breaks, implement application-level encryption (encrypt in the service layer before Prisma writes, decrypt after reads). This is more code but removes the ORM dependency.
- Track the [prisma-field-encryption GitHub repo](https://github.com/47ng/prisma-field-encryption) for v7 compatibility announcements.
- NEVER upgrade Prisma without running the encryption integration test first.

**Warning signs:**
- Encrypted fields return raw ciphertext (Base64 strings) instead of plaintext
- `prisma generate` throws warnings about incompatible client extensions
- New Prisma features in the changelog mention "client extension API changes"
- Team members casually run `pnpm update prisma` without testing encryption

**Phase to address:**
Phase 1 (Foundation). Database schema and encryption setup happen first. This constraint must be documented in `package.json` with a comment explaining WHY the version is pinned.

---

### Pitfall 3: Third-Party Health Data Sharing (Regulatory and Trust Catastrophe)

**What goes wrong:**
Analytics SDKs, error tracking tools, or logging services inadvertently capture and transmit sensitive health data to third parties. This has destroyed real companies in this exact domain:

- **Flo Health** (2021): FTC settlement for sharing users' pregnancy status, period dates, and fertility data with Facebook and Google analytics SDKs. The app transmitted "App Events" with the word "pregnancy" in the title to Facebook's analytics division.
- **Premom** (2023): $200,000 FTC fine for sharing fertility data with Google and two Chinese analytics firms (Jiguang/Aurora Mobile, Umeng). Violated the Health Breach Notification Rule.

**Why it happens:**
Developers install analytics (Google Analytics, Mixpanel, Amplitude) and error tracking (Sentry, LogRocket) early in development without considering what data flows through these SDKs. Event names like `symptom_logged`, `period_started`, `sex_life_entry_created` are transmitted with user identifiers. Even Sentry breadcrumbs can capture URL paths containing health-relevant information (e.g., `/profiles/123/pregnancy/week-12`).

**How to avoid:**
- Data classification audit: before launch, enumerate every outbound data flow. Which services receive data? What data? Can it be linked to a user?
- Sentry configuration: strip PII from breadcrumbs. Use `beforeSend` callback to redact sensitive fields. Never include `profileId` or health-related data in Sentry context/tags.
- No client-side analytics that transmits health events to third parties. If analytics are needed, build a first-party analytics pipeline: log events to YOUR PostgreSQL database, not Google's servers.
- URL path design: avoid health-specific terms in URLs that could be captured by analytics. Use `/profiles/:id/tracking` not `/profiles/:id/fertility/ovulation-day`.
- Terms of Service and Privacy Policy must accurately describe what data is collected and shared. "We do not share your health data with third parties" means ZERO analytics SDKs touching health events.
- Bangladesh's draft Data Protection Act (2023 cabinet-approved, pending enactment) classifies health data as "sensitive" and requires a Data Protection Board notification within 72 hours of any breach.

**Warning signs:**
- Google Analytics or Mixpanel installed with default event tracking
- Error reports in Sentry containing health-related data in breadcrumbs
- Network tab shows outbound requests to analytics domains with health event payloads
- Privacy policy says "we don't share" but code includes third-party SDK initialization

**Phase to address:**
Phase 1 (Foundation). Establish data flow policies before any analytics/monitoring integration. Create a `PRIVACY_ARCHITECTURE.md` document listing every outbound data flow and what data it carries.

---

### Pitfall 4: Bengali Text Rendering, Input, and Localization Failures

**What goes wrong:**
Bengali script has complex conjunct characters (juktakshar), vowel signs that attach to consonants (e.g., the "i" vowel sign appears BEFORE the consonant it modifies), different numeral systems, and different calendar systems (Bangla calendar, Hijri calendar for Muslim holidays). Standard web fonts render poorly, input methods (Avro, Probhat) may not work in all browsers, and date formatting in Bengali is non-trivial.

**Why it happens:**
Developers test primarily in English and add Bengali as a "translation pass" at the end. By then, the entire UI has been designed for English string lengths (Bengali text is typically 20-40% longer), English date formats, and Western numerals. Bengali is treated as "just strings in a JSON file" when it requires font loading, numeral conversion, calendar adaptation, and input method testing.

**How to avoid:**
- Include Bengali web fonts from day one: Noto Sans Bengali (Google Fonts) is the safest choice -- broad character coverage, free, well-maintained.
- Use `date-fns` with the `bn` locale for Bengali date formatting. Test that "28 days" renders correctly as either Bengali digits or Western digits -- get client sign-off on which to use.
- Test EVERY page in Bengali mode during development, not as an afterthought. Set up a Playwright test suite that screenshots every page in both locales.
- Bengali numerals: decide early. Options are Bengali digits ("28 din"), Western digits with Bengali text ("28 din"), or mixed. Most Bangladeshi apps use Western digits even in Bengali text -- confirm with client.
- Input fields: test Bengali input methods (Avro phonetic keyboard, Probhat fixed layout) in Chrome, Firefox, and Safari. Complex conjuncts may not form correctly in certain font/browser combinations.
- String overflow: Bengali text is 20-40% longer than English equivalents. UI components must accommodate this -- use flexible layouts, not fixed-width containers.

**Warning signs:**
- Bengali font not loaded until a late phase
- No Bengali-locale Playwright screenshots in CI
- String lengths in translation JSON files are uniformly short (probably still placeholders)
- Date fields display "March 2026" instead of "মার্চ ২০২৬" in Bengali mode
- No one on the team reads Bengali and reviews the Bengali UI regularly

**Phase to address:**
Phase 2 (Core Tracking). Every UI component built from this phase onward must be tested in both locales. Font loading and i18n infrastructure must exist in Phase 1.

---

### Pitfall 5: Prediction Accuracy Expectations vs. Reality (Client Disillusionment)

**What goes wrong:**
Client expects "AI-powered prediction" to be dramatically more accurate than simple averages. They pay for Tier 3 (LSTM) expecting near-perfect predictions. Reality: menstrual cycle prediction accuracy depends primarily on data quantity and cycle regularity, not algorithm sophistication.

Research data:
- Regular cycles: ~85% accuracy achievable with simple methods; LSTM improves to ~87%
- Irregular cycles: accuracy drops to ~72% regardless of algorithm (50.8% for 3-day-in-advance prediction in one study)
- New users (fewer than 3 cycles): ALL algorithms perform poorly -- there is no way around the cold-start problem
- ARIMA outperforms LSTM in 5/7 studied time-series forecasting tasks (general research, not menstrual-specific)
- Flo's neural network achieves 1.29-day mean absolute error WITH 12+ months of multi-factor data from hundreds of millions of users. A new app with zero population data cannot match this.

**Why it happens:**
The three-tier pricing model (Simple / ARIMA / LSTM) implies a linear progression in accuracy. Clients reasonably assume "more expensive algorithm = much better predictions." In reality, the biggest accuracy gain comes from Tier 1 to Tier 2 (incorporating trend data), not from Tier 2 to Tier 3 (which primarily helps with multi-factor irregular cycles after 12+ cycles of data).

**How to avoid:**
- Set expectations in the scope document: ALL tiers need 3-6 cycles minimum for baseline accuracy. Tier 3 needs 12+ cycles with symptom/sleep/exercise data to outperform Tier 2.
- Auto-escalate tiers based on data availability: start users on Tier 1, auto-promote to Tier 2 at 6 cycles, Tier 3 at 12 cycles. No user should be on Tier 3 with 2 cycles of data.
- Show prediction confidence levels to users: "Based on 4 cycles, estimated accuracy: ~70%." This sets expectations and incentivizes continued logging.
- Show prediction accuracy metrics in the admin panel (predicted vs. actual period start dates) so improvement is measurable per tier and per user cohort.
- Document the cold-start problem: for new users, use population averages (28-day cycle) as the initial baseline, then personalize as data arrives.
- Frame tier pricing around CAPABILITY (multi-factor analysis, anomaly detection) not just accuracy numbers.

**Warning signs:**
- Client asks "how accurate will Tier 3 be?" without specifying data quantity
- Estimation document promises specific accuracy percentages
- No plan for what to show users during the first 3 cycles
- Prediction engine has no confidence/accuracy output alongside its predictions

**Phase to address:**
Phase 3 (Prediction Engine). But set expectations in Phase 0 (Scope Document). Include accuracy benchmarks from published research in the estimation document.

---

### Pitfall 6: Admin Panel Scope Explosion (26 Sections = 26 Mini-Applications)

**What goes wrong:**
The client requires an admin panel with 26 sections in Phase 1. If each section is treated as a full feature with custom UI, custom API endpoints, custom data models, and custom business logic, the admin panel alone becomes larger than the user-facing application. This is the single biggest scope risk for the estimation.

The 26 sections include: dashboard, user management, profile monitoring, health data analytics, prediction accuracy reports, content management system, notification management, moderation system, security & access control, data export, community management, and more. Many of these (health data analytics, prediction accuracy reports, community management) depend on features that may not exist in Phase 1.

**Why it happens:**
Clients often describe the admin panel as "just a backend dashboard" without realizing each section requires: API endpoints, database queries (often complex aggregations), UI components, role-based access control, and testing. A 26-section admin panel can easily consume 60-70% of total development hours.

**How to avoid:**
- Tier the admin sections by dependency and necessity:
  - **Launch-critical** (need for Day 1 operations): user management, security/access control, basic dashboard, data export
  - **Feature-dependent** (need the user feature first): prediction accuracy reports (need prediction engine), community management (need community feature), content CMS (need content platform)
  - **Nice-to-have** (operational improvements): health data analytics (population insights), notification management (granular controls)
- Estimate each admin section separately with clear dev-hour costs. Do NOT lump them into a single "Admin Panel" line item.
- Use a table-based admin framework (like a data table component from shadcn/ui) to standardize CRUD operations. Most admin sections follow the same pattern: list, filter, view detail, edit, delete.
- Propose phased admin delivery: 10-12 sections in Phase 1, remaining sections as the features they monitor become available.

**Warning signs:**
- Single line item "Admin Panel: 200 hours" in the estimation
- Admin sections reference features not in Phase 1 scope (community, ML pipeline)
- No dependency mapping between admin sections and user-facing features
- Client expects all 26 sections at the same time regardless of feature readiness

**Phase to address:**
Phase 0 (Scope Document). This must be addressed in the estimation before development starts. Each admin section needs its own dev-hour estimate and dependency annotation.

---

### Pitfall 7: Ovulation Prediction Medical Liability

**What goes wrong:**
A user relies on Vesta's fertile window prediction for family planning (either to conceive or to avoid pregnancy). The prediction is wrong. User blames the app. In a conservative society like Bangladesh, unintended pregnancy caused by a tech product has severe social consequences.

**Why it happens:**
Calendar-based ovulation prediction has a 7.2-8.3% failure rate for pregnancy prevention (comparable to condoms with typical use). Apps often present ovulation predictions as definitive ("Your fertile window is March 15-19") when they should present ranges with confidence levels. Users may treat app predictions as medical advice.

**How to avoid:**
- Display clear medical disclaimers on EVERY prediction screen: "This is an estimate based on your logged data, not medical advice. Do not use as a contraceptive method."
- Show prediction ranges, not single-point predictions: "Estimated period: March 28-31" instead of "Next period: March 29"
- Show confidence levels: "Based on 4 cycles, estimated accuracy: approximately 70%"
- Never market the app as a contraceptive or fertility treatment tool
- Include a comprehensive medical disclaimer in the Terms of Service and a separate acknowledgment during onboarding
- For TTC (trying to conceive) users, recommend confirming ovulation with BBT readings or OPK tests alongside app predictions
- Consult a legal advisor familiar with Bangladeshi medical device regulations

**Warning signs:**
- Predictions displayed as definitive dates without ranges or confidence intervals
- No medical disclaimers visible on prediction screens
- Marketing materials use phrases like "know exactly when you're fertile"
- Terms of Service does not include medical disclaimer language

**Phase to address:**
Phase 3 (Prediction Engine). Legal disclaimers should be drafted in Phase 0 (Scope Document) and reviewed by a legal advisor before launch.

---

## Moderate Pitfalls

### Pitfall 8: SMS Provider Reliability in Bangladesh

**What goes wrong:**
SSL Wireless API has inconsistent uptime, delayed delivery (up to 30 minutes for SMS), or fails silently. Period reminders arrive late or not at all. IP blacklisting can occur if the API is called from a non-whitelisted server IP. The npm package `ssl-wireless-sms-send` has "inadequate documentation for Node.js" per its own README.

**How to avoid:**
- Write a thin HTTP wrapper around SSL Wireless REST API directly rather than relying on the npm package. The API itself is simpler than the package suggests.
- Implement SMS delivery tracking: store send status (`queued`, `sent`, `delivered`, `failed`) and check for delivery receipts.
- Set up a fallback SMS provider (Alpha Net BD as secondary). Implement a provider-agnostic SMS service interface: `SMSService.send(phone, message)` that can swap providers.
- BullMQ retry with exponential backoff on send failures (max 3 retries over 15 minutes).
- Rate limit outbound SMS to provider limits (avoid getting blocked).
- Whitelist Railway's outbound IP addresses with SSL Wireless upfront -- IP blacklisting is the most common integration failure.
- Log every SMS attempt with timestamps for debugging delivery issues.

**Warning signs:**
- SMS integration tested only in development (different IP from production)
- No fallback provider configured
- SMS send function is fire-and-forget with no delivery status tracking
- Provider's dashboard shows high bounce rates that the application is not aware of

**Phase to address:**
Phase 5 (Notifications & Engagement). Budget extra integration testing time -- at least 2x the normal estimate for SMS.

---

### Pitfall 9: Encrypted Field Query Limitations (Silent Data Access Failures)

**What goes wrong:**
A developer adds a search feature for medical notes, a filter for sex life entries by date, or an admin aggregation query across encrypted fields. Because fields are encrypted with non-deterministic AES-256-GCM, PostgreSQL cannot query them. `WHERE`, `ORDER BY`, `GROUP BY`, and aggregate functions (`COUNT`, `AVG`) all return incorrect results or nothing.

Additionally, encrypted fields can only be `String` type -- you cannot encrypt integers, dates, or JSON fields directly. This means an encrypted `intercourseDate` must be stored as an ISO string, not a `DateTime`, losing PostgreSQL's native date operations.

**How to avoid:**
- Document which fields are encrypted and publish a "what you CANNOT do" list for developers. Tape it to the wall. Example: "You CANNOT search medical notes. You CANNOT filter sex life entries by content. You CANNOT aggregate encrypted fields."
- Use companion hash fields (generated by prisma-field-encryption) for exact-match lookups when needed (e.g., hash of a medicine name for deduplication). But even hashes do not support range queries, ordering, or partial matching.
- For admin analytics on sensitive data: maintain separate, aggregated, de-identified counters. Example: instead of querying individual sex life records, increment a counter `sex_life_entries_this_month` per profile. The counter is not encrypted; the individual records are.
- Never put encrypted fields in `WHERE`, `ORDER BY`, or `GROUP BY` clauses.
- Accept that encrypted data is not searchable. This is a fundamental tradeoff of field-level encryption.

**Warning signs:**
- API endpoint returns empty results when database has data (query on encrypted field)
- Developer writes a Prisma `findMany` with a `where` clause on an encrypted field and gets no errors but no results
- Admin panel shows "0 sex life entries" when users have logged data
- Search feature works in development (where encryption might be disabled for convenience) but fails in production

**Phase to address:**
Phase 1 (Foundation). Document encrypted fields and query restrictions before any feature code is written. Phase 4 (Extended Health Modules) when sex life tracking and medical notes are implemented.

---

### Pitfall 10: Cultural Sensitivity Failures (Alienating the Target Market)

**What goes wrong:**
App uses terminology, imagery, or design patterns that are inappropriate for a conservative Muslim-majority society. Examples:
- Sex life tracking feature prominently displayed in the main navigation (should be deeply nested and optional)
- Western-centric health imagery (exposed bodies, clinical photographs)
- Language that assumes a partner is a boyfriend/husband without considering widows, divorced women, or unmarried women
- No consideration of Islamic calendar events (Ramadan affects cycle regularity due to fasting)
- Assuming all users are literate in English or standard Bengali

**Why it happens:**
Developers copy UX patterns from Flo/Clue (designed for Western audiences) without cultural adaptation. The multi-profile system ("one account manages wife, sister, mother") is culturally appropriate but the individual features within each profile may not be.

**How to avoid:**
- Sex life tracking: opt-in only, hidden by default, accessible through settings. Never displayed in the main dashboard or primary navigation. When enabled, use a separate PIN/biometric lock for this section.
- Partner sharing: be neutral about relationship status. "Share with a trusted person" not "Share with your partner/husband."
- Content platform: partner with local health organizations (e.g., Aponjon Bangladesh, which already provides maternal health content via mobile). Have content reviewed by someone familiar with Bangladeshi cultural norms.
- Ramadan consideration: add a "fasting mode" that notes cycle predictions may shift during extended fasting periods. This is a genuine medical consideration AND a cultural sensitivity feature.
- Language register: Bengali has formal (sadhu bhasha) and colloquial (cholito bhasha) registers, plus regional variations. Use cholito bhasha (standard colloquial) for the app UI, as sadhu bhasha would feel overly formal and alienating.

**Warning signs:**
- Sex life tracking visible in main navigation or onboarding flow
- No cultural review by someone from the target market
- Health content is translated from English sources without cultural adaptation
- No consideration of Islamic calendar or fasting periods in the cycle prediction model

**Phase to address:**
Phase 0 (Scope Document) for cultural guidelines. Phase 2 (Core Tracking) for implementation. Phase 4 (Extended Health Modules) for sex life tracking UI design.

---

### Pitfall 11: TanStack Query Cache Staleness with Multi-Profile Switching

**What goes wrong:**
User switches from Profile A (wife) to Profile B (sister). TanStack Query cache still shows Profile A's cycle data for a moment because the cache key did not include `profileId`. Worse, if the query key is correct but the cache is not invalidated, the user sees stale data from the previous profile -- which in a health app means seeing someone else's period dates, pregnancy status, or medical notes on screen.

**How to avoid:**
- ALWAYS include `profileId` in query keys: `["cycles", profileId]` not `["cycles"]`
- Use `queryClient.removeQueries({ queryKey: ["cycles", previousProfileId] })` on profile switch to free memory AND prevent stale data
- Consider using a `queryClient.clear()` on profile switch as a safety net (removes all cached data, forces refetch)
- Create a custom `useProfileQuery` hook that wraps `useQuery` and automatically prepends the active profileId to all query keys
- Test the profile switch flow specifically for cache leakage

**Warning signs:**
- Query keys do not include `profileId`
- Profile switch does not trigger cache invalidation
- Brief flash of old profile data visible during switch
- No `useProfileQuery` abstraction (developers manually managing profile context in every query)

**Phase to address:**
Phase 1 (Foundation & Auth). The profile-aware query pattern must be established before any data-fetching features are built.

---

### Pitfall 12: CORS Misconfiguration (Vercel + Railway Split Architecture)

**What goes wrong:**
Frontend on Vercel (`https://vesta.vercel.app`) cannot reach API on Railway (`https://vesta-api.up.railway.app`) because CORS is misconfigured. Or worse, CORS is set to `*` in production, allowing any website to make authenticated API calls to the health data backend.

**How to avoid:**
- Whitelist exact Vercel domains in Express CORS config. Include both production domain AND Vercel preview deployment pattern: `https://vesta-*.vercel.app`
- Use environment variables for CORS origins: `CORS_ORIGIN=https://vesta-health.com` in production, `http://localhost:5173` in development
- Credentials mode: when using HttpOnly cookies for JWT refresh tokens, CORS must be configured with `credentials: true` AND the origin must be an explicit domain (not `*`). This is a common gotcha -- `credentials: true` with `origin: "*"` is rejected by browsers.
- Test CORS with `curl -H "Origin: https://evil.com"` to verify that unauthorized origins are rejected

**Warning signs:**
- `cors({ origin: "*" })` in production code
- API calls fail in Vercel preview deployments but work locally
- Browser console shows "Access-Control-Allow-Origin" errors
- HttpOnly cookies not being sent because credentials mode is misconfigured

**Phase to address:**
Phase 1 (Foundation). CORS config is part of the Express server bootstrap.

---

### Pitfall 13: Bangladesh Low-Bandwidth and Infrastructure Constraints

**What goes wrong:**
The app is built and tested on fast urban connections, then fails for rural Bangladeshi users. Key statistics:
- Only 44.5% internet penetration in Bangladesh (2025)
- Rural internet usage: 36.5% vs. urban 71.4%
- Median mobile download: 28.26 Mbps (lower than global average)
- Recent decline of ~6 million mobile subscribers and 13.2 million mobile internet users

A heavy SPA with large JavaScript bundles, unoptimized images, and no offline support will fail for a significant portion of the target audience.

**How to avoid:**
- Code splitting: use React Router `lazy()` for all major page sections. The initial bundle should only contain the login/onboarding flow.
- Image optimization: compress all images, use WebP format, implement lazy loading.
- Bundle size budget: set a maximum of 200KB gzipped for the initial JavaScript bundle. Measure with `vite build --analyze`.
- Consider PWA features: service worker for offline access to cached cycle data. Users should be able to view their cycle calendar without an internet connection.
- API response size: paginate all list endpoints. Never return all cycles/symptoms in a single response.
- SMS as primary notification channel (not push notifications) because SMS works without data connectivity.

**Warning signs:**
- No bundle size monitoring in CI
- Images served at full resolution without compression
- No code splitting (single large bundle)
- App requires internet to display any cached data
- No performance testing on throttled connections

**Phase to address:**
Phase 1 (Foundation) for build configuration. Phase 2 (Core Tracking) for code splitting and lazy loading.

---

## Minor Pitfalls

### Pitfall 14: Calendar Off-by-One Errors (Timezone Mishandling)

**What goes wrong:**
Cycle start/end dates are off by one day due to timezone handling. User logs period on March 15 (Bangladesh Standard Time, UTC+6), but the server stores it as March 14 (UTC). This destroys prediction accuracy and makes the calendar show incorrect period dates.

**How to avoid:**
- Store all cycle dates as `DATE` type (not `TIMESTAMP`) in PostgreSQL. The day matters, not the exact time.
- Convention: all dates sent from frontend are in `YYYY-MM-DD` format (no timezone component). Parse with `date-fns parseISO`.
- Never use `new Date()` without explicitly handling timezone. Use `date-fns` throughout.
- Server timezone: set `TZ=UTC` in Railway environment. But dates should be timezone-agnostic since they're stored as DATE.

**Warning signs:**
- Cycle dates stored as `TIMESTAMP WITH TIME ZONE` instead of `DATE`
- Frontend sends `new Date().toISOString()` (includes time and timezone) for date-only fields
- Period shows on the wrong day in the calendar view
- Tests pass in one timezone but fail in another

**Phase to address:**
Phase 2 (Core Tracking). Establish the date convention in Phase 1 database schema design.

---

### Pitfall 15: i18n Key Typos and Missing Translations

**What goes wrong:**
Translation key in code does not match the JSON file key. English displays the raw key string like `cycle.prediction.nextPeriod`. Bengali page is completely broken because nobody noticed the missing key.

**How to avoid:**
- Use typed i18n keys from the shared package (TypeScript constants, not raw strings)
- Set `i18next` with `debug: true` and `saveMissing: true` in development to log missing keys
- CI lint step that validates all keys used in code exist in both EN and BN JSON files
- Consider `i18next-parser` to extract keys from code and detect unused/missing keys

**Warning signs:**
- Raw key strings visible in the UI during QA
- Bengali JSON file is significantly shorter than English JSON file (missing translations)
- No CI check for translation completeness

**Phase to address:**
Phase 1 (Foundation) for i18n infrastructure. Ongoing for all phases.

---

### Pitfall 16: JWT Refresh Token Race Condition

**What goes wrong:**
Multiple concurrent API calls with an expired access token all try to refresh simultaneously, creating multiple new refresh tokens and invalidating the valid one. User gets logged out randomly during normal app usage.

**How to avoid:**
- Implement a request queue/lock in the TanStack Query auth interceptor. The first request that gets a 401 triggers the refresh; all other pending requests wait for the new token.
- Use a token refresh mutex pattern in the API client (single `refreshPromise` variable that all concurrent 401 handlers await).
- Alternatively, use refresh token rotation with a grace period: allow the previous refresh token to remain valid for 30 seconds after rotation.

**Warning signs:**
- Users report random logouts, especially on pages with multiple concurrent API calls
- Refresh token endpoint receives multiple calls within milliseconds
- Auth error logs show "refresh token already used" errors

**Phase to address:**
Phase 1 (Foundation & Auth).

---

### Pitfall 17: Admin Re-identification of De-identified Health Data

**What goes wrong:**
Admin panel shows "aggregated" health data that is insufficiently aggregated. In small communities or early user cohorts, aggregated data can re-identify individuals. Example: "1 user in [small town] is in week 12 of pregnancy" effectively identifies that person if the admin knows the community.

Research shows 87% of the U.S. population can be uniquely identified with just ZIP code + gender + birth date. In small Bangladeshi communities, the risk is higher.

**How to avoid:**
- Set minimum aggregation thresholds: never display statistics for groups smaller than 10-20 users. Show "insufficient data" instead.
- Admin panel should show aggregated population-level insights, never individual health records (especially not encrypted fields).
- Role-based admin access: Content Admins should NOT have access to health data analytics. Only Super Admins with explicit audit logging.
- Audit log all admin data access with timestamp, admin user ID, and what data was viewed.

**Warning signs:**
- Admin panel shows per-user health details instead of aggregated statistics
- No minimum group size threshold for statistical displays
- No audit logging of admin data access
- Single "admin" role with access to everything

**Phase to address:**
Phase 6 (Admin Panel). Design the aggregation thresholds before building admin analytics views.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip encryption for dev environment | Faster local development, easier debugging | Developers write queries on encrypted fields that break in production. Tests pass locally but fail in staging. | Never. Use encryption in all environments with a dev encryption key. |
| Hardcode English strings instead of using i18n keys | Faster initial development | Complete rewrite when adding Bengali. Every hardcoded string is a bug in the Bengali UI. | Never. This is a bilingual app from day one. |
| Single "admin" role instead of RBAC | Simpler auth logic | Content admins can see user health data. Security audit failure. | Only in the first 2 weeks of admin panel development. Add RBAC before any beta users. |
| Store dates as TIMESTAMP instead of DATE | Seems more precise | Timezone bugs in every date calculation. Off-by-one errors in cycle predictions. | Never for cycle/health dates. TIMESTAMP is fine for audit logs and created_at fields. |
| Skip SMS delivery tracking | Faster SMS integration | Cannot debug why reminders are not arriving. Users silently lose trust. | Never. Delivery tracking is a core requirement for health reminders. |
| Fire-and-forget notification jobs | Simpler BullMQ setup | Duplicate notifications sent on worker crash/restart. Users get 3 period reminders in a row. | Never. Always check the NotificationLog before sending. |
| Use `origin: "*"` for CORS during development | No CORS errors during dev | Accidentally deployed to production, exposing health API to any website | Acceptable locally, but use environment-specific CORS config from day one. |

---

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| SSL Wireless SMS | Using the npm package as-is without testing IP whitelisting | Write a thin HTTP wrapper. Whitelist Railway's outbound IPs with SSL Wireless before deploying. Test from the production IP. |
| Prisma + PostgreSQL RLS | Connecting as superuser/table owner (bypasses ALL RLS policies) | Create a separate database role (`vesta_app`) with limited privileges. Use `ALTER TABLE ... FORCE ROW LEVEL SECURITY`. Set tenant context via `SET LOCAL` in transactions. |
| Resend email | Not handling bounce/complaint webhooks | Configure Resend webhooks to mark bounced email addresses. Do not retry sending to hard-bounced addresses (damages sender reputation). |
| AWS S3 ultrasound uploads | Direct upload from browser without presigned URLs | Generate short-lived presigned URLs on the server. Client uploads directly to S3 with the presigned URL. Set bucket policy to block all public access. |
| Vercel preview deployments | CORS rejects preview deployment URLs | Use a CORS origin pattern that matches Vercel preview URLs: `https://vesta-*.vercel.app` |
| TanStack Query + profile switching | Cache keys without profileId | Always prefix query keys with active profileId. Invalidate/remove queries on profile switch. |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading all cycle history on dashboard | Dashboard loads slowly as users accumulate months of data | Paginate cycle history API. Dashboard shows last 3 months; load more on scroll. | 12+ months of data per profile (~365 daily symptom logs) |
| Unindexed `profileId` foreign keys | Queries slow down as user count grows | Add database indexes on all `profileId` columns and any column used in RLS policies | 10,000+ profiles (with multiple records each) |
| Full-table aggregation for admin analytics | Admin dashboard query takes 30+ seconds | Use materialized views or pre-computed aggregation tables. Refresh on a schedule (hourly), not per request. | 50,000+ records in cycle/symptom tables |
| BullMQ repeatable jobs without cleanup | Redis memory grows unbounded | Set `removeOnComplete: 100` and `removeOnFail: 50` on all job options. Archive old job data to PostgreSQL if needed. | 100,000+ completed jobs in Redis |
| Single prediction calculation per request | API response time increases as prediction algorithm complexity grows (especially Tier 3 LSTM) | Pre-compute predictions when new data is logged. Store predicted dates in a `predictions` table. API reads precomputed values. | Tier 3 LSTM inference takes 500ms+ per prediction |
| Bengali font file loaded synchronously | First contentful paint delayed by 200-500KB font download | Use `font-display: swap` and preload the Bengali font file. Subset the font to only include required Bengali characters. | All Bengali-locale page loads |

---

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Sex life data stored without encryption | Catastrophic privacy breach if database is compromised. In Bangladesh's conservative society, exposure of sex life data could endanger users. | Use `prisma-field-encryption` with AES-256-GCM. Mark all sex life fields with `/// @encrypted` in Prisma schema. |
| Partner sharing without field-level permissions | Partner sees sex life logs, medical notes, or other sensitive data not intended for sharing | Create a `PartnerAccess` model with per-field boolean permissions. Default: calendar and reminders only. User explicitly enables additional fields. |
| Admin can view individual encrypted health records | Admin abuse or breach exposes individual user data | Admin panel shows aggregated statistics only. Individual encrypted records are never decrypted for admin views. |
| Profile access without ownership check | Horizontal privilege escalation: User A accesses User B's profiles | `checkProfileOwnership` middleware on EVERY profile-scoped route. No exceptions. |
| Encryption key stored in code or Git | Key compromise means all encrypted data is readable | Store `FIELD_ENCRYPTION_KEY` in environment variables only. Use different keys per environment. Never commit to Git. Use Railway's secret management. |
| No rate limiting on auth endpoints | Brute-force password attacks | `express-rate-limit` with strict limits on login (5 attempts / 15 min), password reset (3 / hour), and account creation (10 / hour). Use Redis store for distributed rate limiting. |
| Predictable profile IDs (sequential integers) | Enumeration attacks: attacker increments profileId to find valid profiles | Use UUIDs (cuid2 or nanoid) for profile IDs instead of sequential integers. UUIDs are not enumerable. |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Overwhelming onboarding (70+ screens like Flo) | Users abandon before completing setup. Flo can afford this because of massive brand recognition; a new app cannot. | 10-15 screen onboarding maximum. Collect: goal, last period date, typical cycle length, language preference. Collect additional data progressively over the first week. |
| Sex life tracking visible in main navigation | Users in conservative households feel uncomfortable opening the app if family members can see the feature. | Opt-in feature, hidden by default, accessible through settings. Optional PIN/biometric lock on the section. |
| Symptom logging requires too many taps | Users stop logging after the first week, destroying prediction accuracy | Flo's pattern: tap-based icon selection, 2-3 taps to log. Prioritize the top 15-20 most common symptoms, not 80+. Allow custom symptom categories. |
| Predictions displayed without confidence levels | Users treat low-confidence predictions as certainties | Always show: "Based on X cycles" and a confidence indicator (low/medium/high). Show date ranges, not single dates. |
| No offline access to cycle calendar | Users in low-connectivity areas cannot check their cycle | Service worker caches the last viewed profile's cycle data. Display "Last updated: [date]" badge when offline. |
| Profile switching is confusing or slow | Users managing multiple profiles (wife, sister, mother) find it tedious | Persistent profile switcher in the top navigation bar. One-tap switch. Clear visual indicator of which profile is active (avatar, name, color). |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Multi-profile auth:** Often missing profile ownership check on UPDATE/DELETE endpoints -- verify all CRUD operations, not just READ
- [ ] **Cycle tracking:** Often missing retroactive date editing -- verify users can edit past period start/end dates and that predictions recalculate
- [ ] **Bengali translation:** Often missing dynamic content (date formats, number formats, error messages) -- verify ALL text, not just static labels
- [ ] **Encryption:** Often missing in development/staging environments -- verify encrypted fields contain ciphertext (not plaintext) in ALL environments
- [ ] **Partner sharing:** Often missing revocation flow -- verify that revoking partner access immediately stops data exposure (cache invalidation)
- [ ] **SMS reminders:** Often missing delivery confirmation -- verify that failed SMS deliveries are tracked, retried, and reported in admin
- [ ] **Prediction engine:** Often missing confidence output -- verify predictions include accuracy estimate and cycle count used
- [ ] **Admin panel:** Often missing audit logging -- verify all admin actions (view user, export data, suspend account) are logged with timestamps
- [ ] **CORS configuration:** Often works in development but fails in Vercel preview deployments -- verify with actual Vercel preview URLs
- [ ] **Data export:** Often exports decrypted sensitive data -- verify CSV exports respect encryption (aggregated, not individual encrypted records)

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Profile authorization bypass discovered | HIGH | 1. Emergency patch: add profile ownership middleware. 2. Audit logs: identify which profiles were accessed by unauthorized users. 3. Notify affected users per Bangladesh draft PDPA (72-hour window). 4. Security audit of all endpoints. |
| Prisma upgrade breaks encryption | HIGH | 1. Rollback to previous Prisma version immediately. 2. If data was written unencrypted during the window, identify affected records. 3. Encrypt those records with the correct version. 4. Add Prisma version to CI lockfile checks. |
| Third-party analytics leaked health data | HIGH | 1. Remove the analytics SDK immediately. 2. Contact the third party to request data deletion. 3. Notify users. 4. Legal review for Bangladesh PDPA compliance. 5. Implement first-party analytics. |
| Bengali UI broken in production | MEDIUM | 1. Hotfix: identify broken components. 2. Add Bengali font fallbacks. 3. Create Playwright visual regression tests for Bengali locale. 4. Block future deploys without Bengali screenshot approval. |
| Prediction accuracy far below expectations | LOW | 1. Review algorithm inputs (are users logging enough data?). 2. Adjust tier escalation thresholds. 3. Show more transparent accuracy metrics. 4. Communicate with client that accuracy improves over time. |
| Admin panel scope exceeds estimate | MEDIUM | 1. Re-prioritize admin sections by launch necessity. 2. Deliver launch-critical sections first. 3. Defer feature-dependent sections to later phases. 4. Use a generic CRUD table pattern to accelerate remaining sections. |
| SMS delivery failures in production | MEDIUM | 1. Switch to fallback provider (Alpha Net BD). 2. Investigate IP blacklisting with SSL Wireless. 3. Implement dual-provider sending for critical reminders (period prediction). |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Multi-profile auth bypass (#1) | Phase 1: Foundation & Auth | Security test suite with cross-profile access attempts. All return 403. |
| Prisma encryption lock (#2) | Phase 1: Foundation | Integration test: encrypt, store, retrieve, decrypt a test record. Runs in CI. |
| Third-party data sharing (#3) | Phase 1: Foundation | Data flow audit document. No analytics SDK initializations with health event data. |
| Bengali rendering (#4) | Phase 1 (font/i18n infra) + Phase 2 (testing) | Playwright screenshots of every page in Bengali locale. CI blocks deploy if screenshots are missing. |
| Prediction expectations (#5) | Phase 0 (Scope Doc) + Phase 3 (Prediction) | Scope document includes accuracy benchmarks from research. Admin panel shows predicted vs. actual. |
| Admin scope explosion (#6) | Phase 0: Scope Document | Each admin section has a separate dev-hour estimate with dependency annotation. |
| Medical liability (#7) | Phase 0 (legal) + Phase 3 (UI) | Disclaimer visible on every prediction screen. Terms of Service includes medical disclaimer. |
| SMS reliability (#8) | Phase 5: Notifications | Delivery tracking shows >95% success rate. Fallback provider tested and configured. |
| Encrypted field queries (#9) | Phase 1 (docs) + Phase 4 (implementation) | Developer guide lists encrypted fields and prohibited query patterns. No WHERE on encrypted fields in codebase. |
| Cultural sensitivity (#10) | Phase 0 (guidelines) + Phase 2-4 (implementation) | Sex life feature is opt-in and hidden. Content reviewed by someone from target market. |
| Cache staleness on profile switch (#11) | Phase 1: Foundation & Auth | Profile switch test verifies no stale data from previous profile is visible. |
| CORS misconfiguration (#12) | Phase 1: Foundation | Automated test from a Vercel preview URL confirms API access. Test from unauthorized origin confirms rejection. |
| Bangladesh low bandwidth (#13) | Phase 1 (build config) + Phase 2 (code splitting) | Bundle size under 200KB gzipped. Performance audit on throttled (3G) connection. |
| Calendar timezone bugs (#14) | Phase 1 (schema) + Phase 2 (tracking) | All cycle dates stored as DATE type. Test passes in UTC, UTC+6, and UTC-5 environments. |
| i18n key typos (#15) | Phase 1: Foundation | CI check validates all i18n keys exist in both EN and BN JSON files. |
| JWT refresh race condition (#16) | Phase 1: Foundation & Auth | Test: fire 5 concurrent API calls with expired token. All succeed without logout. |
| Admin re-identification (#17) | Phase 6: Admin Panel | No aggregated view for groups smaller than 10 users. Audit log for all admin data access. |

---

## Sources

### Regulatory and Legal
- [Bangladesh Draft Personal Data Protection Act 2023](https://www.dataguidance.com/opinion/bangladesh-overview-data-protection-act-2023) -- Cabinet-approved, pending enactment. Health data classified as sensitive. 72-hour breach notification.
- [Bangladesh Cyber Security Act 2023](https://www.tbsnews.net/bangladesh/digital-security-act-be-scrapped-replaced-new-cyber-law-678282) -- Replaced Digital Security Act 2018. General cybersecurity framework.
- [FTC vs Flo Health (2021)](https://www.ftc.gov/news-events/news/press-releases/2021/06/ftc-finalizes-order-flo-health-fertility-tracking-app-shared-sensitive-health-data-facebook-google) -- Settlement for sharing health data with Facebook/Google.
- [FTC vs Premom (2023)](https://www.ftc.gov/news-events/news/press-releases/2023/05/ovulation-tracking-app-premom-will-be-barred-sharing-health-data-advertising-under-proposed-ftc) -- $200K fine for sharing fertility data with Chinese analytics firms.
- [Reproductive Health App Privacy Risks (2025)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11923453/) -- Qualitative analysis of data privacy policy violations.

### Prediction Accuracy Research
- [Predictive model for menstrual cycle (JAMIA)](https://academic.oup.com/jamia/article/29/1/3/6371799) -- Hierarchical modeling, median absolute error 1.5 days for regular cycles.
- [Wrist temperature ovulation prediction](https://pmc.ncbi.nlm.nih.gov/articles/PMC11879225/) -- 85.47% accuracy for regular cycles, 61.2% for irregular.
- [Menstrual cycle prediction accuracy](https://pubmed.ncbi.nlm.nih.gov/35964035/) -- 87% accuracy for regular cycles, 72% for irregular.
- [ARIMA vs LSTM performance](https://machinelearningmastery.com/mastering-time-series-forecasting-from-arima-to-lstm/) -- ARIMA outperforms LSTM in 5/7 studied cases.

### Technical
- [prisma-field-encryption](https://github.com/47ng/prisma-field-encryption) -- Supports Prisma 4.7.0 to 6.13.0. Non-deterministic encryption. String fields only.
- [PostgreSQL RLS footguns](https://www.bytebase.com/blog/postgres-row-level-security-footguns/) -- 16 common mistakes including superuser bypass, FORCE RLS, timing attacks.
- [Prisma RLS implementation](https://github.com/prisma/prisma-client-extensions/tree/main/row-level-security) -- Official Prisma client extension for RLS with transaction-based context setting.
- [Express security best practices](https://expressjs.com/en/advanced/best-practice-security.html) -- Helmet, CORS, rate limiting baseline.
- [HIPAA encryption requirements](https://censinet.com/perspectives/hipaa-encryption-protocols-2025-updates) -- AES-256 at rest, TLS 1.3 in transit.

### Bangladesh Infrastructure
- [Digital 2025: Bangladesh (DataReportal)](https://datareportal.com/reports/digital-2025-bangladesh) -- 44.5% internet penetration, 28.26 Mbps median mobile speed.
- [Bangladesh Internet Penetration 2025](https://ngital.com/bangladesh-internet-penetration-2025-data-insights/) -- 36.5% rural vs 71.4% urban internet usage.
- [SSL Wireless npm package](https://github.com/saadnoor/ssl-wireless-sms-send) -- "Inadequate documentation for Node.js."
- [Bangladesh SMS gateway ecosystem](https://github.com/topics/bangladeshi-sms-gateway) -- Multiple providers: SSL Wireless, Alpha Net, BulkSMSBD.

### Cultural Context
- [Taahirah -- Reproductive health for Muslim women](https://healthinnovationnetwork.com/resources/pioneering-platform-taahirah-is-empowering-muslim-women-to-manage-their-reproductive-health/) -- Design principles for culturally sensitive health apps.
- [Aponjon Bangladesh](https://www.sciencedirect.com/science/article/pii/S1521693415001558) -- Mobile maternal health platform as a model for discreet health technology.
- [Menstrual tracking app failures (UW study)](https://www.washington.edu/news/2017/05/02/period-tracking-apps-failing-users-in-basic-ways-study-finds/) -- Inaccuracy, lack of inclusivity, over-emphasis on pink aesthetics.

---
*Pitfalls research for: Vesta -- Reproductive Health & Cycle Intelligence Platform*
*Researched: 2026-03-26*
