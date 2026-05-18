# Flo Health: comprehensive product research for a web app clone

Flo Health is the world's dominant femtech app — **420M+ downloads, 75M monthly active users, and $200M+ in annual gross bookings** — built on a subscription-only model with zero ads and zero data sales. This research covers every layer of the product, from granular feature mechanics to conversion psychology, providing everything needed to write a PRD for a web app clone. The critical insight for a clone builder: **no major competitor offers a web-based core tracking experience**, creating a genuine market gap. Flo's success rests on three pillars — an obsessively personalized onboarding that drives conversion, a daily logging habit loop that drives retention, and a content ecosystem reviewed by 120+ medical experts that drives engagement.

---

## 1. Core features: the complete product anatomy

Flo functions as a reproductive health "super app" spanning the entire lifecycle — menstruation, trying to conceive (TTC), pregnancy, postpartum, and perimenopause. Each mode fundamentally reshapes the UI, content, and predictions.

### Period tracking and cycle predictions

The home screen centers on a **large cycle-day counter** inside a circular hero element, showing current cycle phase (follicular, luteal, etc.) and days until the next predicted period. A horizontal 7-day calendar strip sits above it, color-coded: **red/pink for period days, teal for fertile window, teal-dotted for ovulation day, and dark for low-fertility days**. Users tap "Log Period" to mark start/end, with flow intensity options (light, medium, heavy). The calendar supports retroactive editing.

The prediction engine uses **proprietary neural networks** trained on data from hundreds of millions of users. Inputs include age, past cycle history, logged symptoms, BBT data, ovulation test results, and lifestyle factors. Flo recommends logging at least 3 prior cycles for initial accuracy, with **12 months of data** yielding optimal predictions. The system achieves a **54.2% improvement over calendar-based methods** for irregular cycles and a mean absolute error of **1.29 days** with consistent symptom logging. Predictions recalculate dynamically when users log new data points or edit dates.

### Ovulation and fertility tracking

The fertile window is visualized on the calendar with teal highlighting. Ovulation day is marked with "High chance of getting pregnant." Users in TTC mode get additional tools: **BBT logging** (manual daily entry that feeds directly into the prediction algorithm), **ovulation test (LH) logging** with positive/negative results (a positive test shifts the predicted ovulation to the next day), and daily conception tips from medical experts.

### Pregnancy mode

Switching to pregnancy mode transforms the entire UI — the color scheme shifts to **yellow/warm tones**, the hero display shows gestational age by week, and a **3D fetus visualization** appears. Features include week-by-week developmental milestones, body change tracking, weekly checklists (prenatal appointments, childbirth classes), pregnancy-specific symptom logging (nausea, lochia), safe food guides, exercise recommendations, and multiple calculators (due date, hCG, IVF/FET due date, ultrasound-based dating). Miscarriage/abortion can be logged from day 29 onward.

### Symptom logging system

Flo offers **80+ trackable symptoms across 16 categories**, logged via a floating "+" button. The UX is **tap-based icon selection** — not text-heavy — enabling 2-3 taps to log any symptom. Categories include:

- **Physical**: cramps, headache, breast tenderness, bloating, back pain, fatigue, nausea, acne
- **Mood/emotional**: calm, sad, happy, anxious, mood swings, irritable, energetic, depressed
- **Sex and libido**: high/low sex drive, protected/unprotected sex, masturbation, orgasm
- **Vaginal discharge**: sticky, creamy, watery, egg white, spotting, atypical
- **Lifestyle**: sleep quality/duration, water intake, exercise type/intensity, weight, diet, stress, travel
- **Medical**: contraception intake (pill, ring, patch, injection, IUD, implant), BBT, OPK results, pregnancy test results

Users can customize which categories appear on their logging screen. Each symptom is logged once per day but is editable. Logged data feeds both the prediction engine and content personalization.

### AI health assistant (formerly "Mia," now "Ask Flo")

The assistant lives in a **chat-bubble conversational interface**. Pre-2025, it ran on **rule-based scripted conversation trees** designed by conversation designers with medical/legal review. Each flow has branching logic, conditions, and visual elements. Starting in 2025, Flo is transitioning to **generative AI using fine-tuned LLMs via Databricks Mosaic AI** for context-aware, personalized responses. Conversations are triggered by cycle phase transitions, logged symptoms, cycle start events, or user-initiated queries. Topics span late periods, PMS/PMDD, discharge explanations, fertility guidance, disorder signs, skin/fitness/mood by cycle phase, and general reproductive health Q&A. Free users get limited access; Premium unlocks unlimited interactions.

### Community: Secret Chats

An anonymous forum with **7M monthly users** and 1,000+ threads. Users are assigned random avatars (no photos required). **All posts are pre-moderated** by a dedicated human team before appearing. Content is organized by categories (PCOS, pregnancy symptoms, sex, relationships, parenting, perimenopause) with feed personalization based on engagement patterns. A critical safety feature: **under-18 and over-18 users see completely different content with no cross-interaction**. An "Ask an Expert" archive provides doctor-verified Q&A.

### Health reports and symptom checker

Premium users can generate a **Doctor's Report** — a 6-month summary of cycle lengths, symptom patterns, and frequency charts, exportable as PDF. The **Symptom Checker** (not available in UK/EU) runs chatbot-style self-assessments for PCOS, endometriosis, uterine fibroids, and perimenopause, producing match-percentage reports designed for physician follow-up. These are built on clinical guidelines from Monash, ESHRE, and AAFP.

### Flo for Partners

Launched October 2023 (most-requested feature of 2022), now **1M+ MAU**. The primary user generates a sharing code; the partner installs Flo and enters it. Partners get **read-only access** to the cycle calendar (current data only, not historical), tailored daily insights about how their partner might be feeling, symptom explanations in accessible language, educational content, and couples quizzes. Partners **cannot** see personally logged symptoms or edit any data. In pregnancy mode, partners receive weekly baby development updates. The primary user can revoke access instantly.

### Anonymous Mode

Launched September 2022 (fast-tracked after Roe v. Wade), this feature **decouples health data from all personal identifiers** — name, email, Google/Apple account ID, payment info, IP address, and device advertising ID. It uses **Cloudflare's Oblivious HTTP (OHTTP) protocol** ensuring no single party processing data has both the user's identity and their health activity. **Post-quantum cryptography** was added in 2023. The technology was **open-sourced on GitHub** for other companies to adopt. Flo holds **dual ISO certification** (ISO 27001 + ISO 27701) — the only period tracker with both. Anonymous Mode won TIME Best Inventions 2023 and the IAPP Privacy Innovation Award.

---

## 2. UX patterns, onboarding, and design system

### The onboarding engine

Flo's onboarding is among the longest in consumer apps: **~70 screens in the primary flow, up to 400 across all branches**, taking approximately 7 minutes. It's built on a **server-driven architecture via Contentful CMS**, enabling real-time updates without app releases. Flo tests ~5 hypotheses per 2-week sprint on onboarding alone.

The flow follows a deliberate psychological arc:

1. **Trust-building first** — screens emphasizing "Your data is protected" and "We work with 100+ medical experts"
2. **Goal selection** (the primary fork) — Track my period / Try to conceive / Track pregnancy / Perimenopause
3. **Personal data collection** — date of birth, last period date, cycle length, period length, height, weight
4. **Lifestyle/health questions** — diet, exercise, sleep, previous pregnancies, contraception, health concerns, content interests
5. **Signup** — positioned *after* data collection (unusual — shows value before requiring commitment)
6. **Paywall** — with 14-day free trial toggle

Two critical UX patterns drive conversion. First, **reassurance on every answer**: selecting a response expands it with a message like "This is totally normal" plus a relevant Flo benefit — no answer makes users feel abnormal. Second, **15+ social proof statistics** interspersed throughout: "90% of users say Flo accurately predicts their period," "89% say Flo helped them feel more informed," "3.5M+ 5-star ratings." The pacing alternates between question screens and trust/value screens like a symphony building to a crescendo.

If the user declines the paywall, a **"gift box" appears with a heavily discounted annual plan** (77% off framing). If rejected again, a second offer with a 7-day trial at reduced price appears. One onboarding experiment alone **increased trial conversions 8x**.

### Navigation and information architecture

The bottom navigation has four primary tabs:

1. **Home/Today** — cycle dashboard, daily content, logging
2. **Insights** — articles, stories, video courses, educational content
3. **Secret Chats** — community forums
4. **Calendar** — full month view with color-coded markers

A **profile avatar** (top-left) opens the settings menu with goal switching, cycle/ovulation settings, reminders configuration, graphs and reports, and account/privacy management. The "+" floating action button provides quick symptom logging from any screen.

### Visual design system

The design is built around **mode-dependent color palettes** — the entire UI shifts based on the user's goal. Period tracking uses pink/magenta primaries with teal for fertility elements. Pregnancy mode shifts to yellow/warm tones. The design feels **calming, friendly, and empowering — not clinical**. Custom iconography for all 80+ symptoms uses illustrative (not abstract) visuals. Illustrations are soft, hand-drawn feeling. Typography uses clean sans-serif with aggressive hierarchy: the cycle day number is the largest element on screen. The tone of voice follows three pillars: **Head** (clear, straightforward), **Heart** (warm, inclusive), **Hands** (actionable, tangible benefits).

### Notification strategy

Notifications run on an **infinite loop system with rate limiting**, configured by scheduling horizon and ping interval. Types include period start predictions, period logging prompts, fertile window alerts, ovulation day markers, contraceptive pill reminders (customizable time), water/sleep reminders, symptom logging nudges, delay notifications, content engagement prompts, and Secret Chats reply alerts. The tone is described as **"quirky"** — brand personality delivered through push notifications. All notification types have individual toggles.

---

## 3. Business model and monetization

### Freemium structure

**Free tier** includes: period and ovulation predictions, basic symptom tracking (all 80+ symptoms), cycle history and calendar, Anonymous Mode, basic Partner Mode, Secret Chats access, limited Health Assistant interactions, and basic daily insights. **Premium** adds: detailed cycle pattern analysis, daily personalized insights by phase, forward-looking symptom predictions, unlimited Health Assistant, Symptom Checker (PCOS/endometriosis/fibroids), Doctor's Report export, expert-led video courses, full educational content library, full Partner features, in-depth pregnancy tracking, and Perimenopause Score tools.

The free version is genuinely useful for core tracking but **strategically limited** — many tappable content areas and insights surface paywalls. Flo has progressively moved features from free to premium (notably pregnancy tracking details), maintaining the daily habit loop in the free tier while gating the insights that make the data meaningful.

### Pricing

| Plan | US Price |
|------|----------|
| Monthly | $9.99/month |
| 3 Months | $19.99 ($6.66/mo) |
| 6 Months | $39.99 ($6.67/mo) |
| Annual | $49.99 ($4.17/mo) |

Flo uses **dynamic regional pricing**. Promotional lifetime discounts appear when users reject the free trial. Since October 2024, Flo Premium is **FSA/HSA eligible** in the US, with direct FSA/HSA card payment accepted — a powerful conversion lever that legitimizes the app as a healthcare expense.

### Revenue and growth

| Metric | Value |
|--------|-------|
| Total downloads | 430M+ |
| Monthly active users | 75M+ (mid-2025) |
| Paid subscribers | ~6M (late 2025) |
| Gross bookings | $200M+ (2024) |
| Monthly subscription revenue | ~$9M |
| Monthly downloads | ~2M |

MAU growth trajectory: **43M (2021) → 48M (2022) → 50M (2023) → 62M (Jan 2024) → 70M (mid-2024) → 75M+ (mid-2025)**. Retention is exceptional: **60% of MAUs have used Flo for over a year**. Flo reached **unicorn status ($1B+ valuation)** in July 2024 after a $200M Series C led by General Atlantic, making it the **first European femtech unicorn**. Total funding: ~$275M across seed through Series C. The company employs ~700 people across London (HQ), Amsterdam, and Vilnius.

### Conversion mechanics

Flo runs **300+ experiments simultaneously and 400+ per quarter** using a server-driven onboarding system and internal A/B testing infrastructure. The conversion funnel is carefully engineered:

- **Post-onboarding paywall** appears after ~20+ personalization questions, creating psychological sunk cost
- **Multiple in-app paywall touchpoints**: locked insights, articles, health reports, and Health Assistant chats each surface Premium prompts
- **Pricing anchoring**: high monthly price ($9.99) makes annual ($4.17/mo) appear as a bargain, reinforced with "Best Deal" tags
- **Trial rejection cascade**: first paywall offers 14-day trial → rejection triggers discounted annual offer → second rejection triggers lower-price 7-day trial
- **Social proof on paywall**: "6.6 million members already signed up for Premium" and testimonials

### Revenue streams

**Subscriptions are the sole stated revenue source** — "Our only source of revenue is the money you pay for your subscription." Flo is explicitly ad-free. After the 2021 FTC settlement for sharing user health data with Facebook and Google analytics (2016-2019), Flo completely ceased third-party data sharing. Emerging streams include **Flo for Business** (employer-sponsored Premium access as a corporate wellness benefit) and **healthcare provider partnerships** via med.flo.health. The **Pass It On Project** donates 20M+ free Premium subscriptions across 66 underserved countries — a social impact initiative, not a revenue stream.

---

## 4. How Flo outpaces every competitor

Flo dominates a **$1.7-3.5B menstrual health apps market** projected to reach $5-7B by 2030. Its closest competitors each have significant gaps:

**Clue** (~10M MAU, ~$600K/month revenue) offers stronger scientific credibility and a CE-marked medical device classification, but lacks pregnancy mode, community features, AI chatbot, and partner sharing. It targets privacy-conscious, science-first users. **Natural Cycles** (~$950K/month revenue) is the only FDA-cleared digital contraceptive, but requires daily BBT measurement (high friction), costs ~$100/year, and has a much narrower use case. **Ovia Health** operates on an employer-sponsored B2B model offering free user access, but splits functionality across multiple apps and has weaker consumer brand recognition. **Apple Health Cycle Tracking** provides best-in-class privacy (on-device, E2E encrypted) at zero cost, but offers only basic tracking with no community, educational content, pregnancy mode, or AI features.

Flo differentiates through **scale (largest training dataset = best predictions), lifecycle comprehensiveness (menstruation through menopause in one app), content depth (120+ medical experts), community engagement (7M monthly Secret Chats users), and privacy innovation (Anonymous Mode with OHTTP + post-quantum crypto)**. The network effect is its deepest moat: more users → more data → better predictions → more users.

---

## 5. Technical architecture and AI/ML implementation

### Known tech stack

Flo is **native mobile** — Swift for iOS, Kotlin for Android — a deliberate choice over cross-platform for performance. The backend runs **Python on AWS** using Amazon ECS for containers, PostgreSQL for data, SageMaker for ML model training, and Amazon Bedrock for generative AI content review. Content management uses **Contentful as a headless CMS** with Phrase TMS for localization. Cloudflare handles CDN delivery and the OHTTP privacy relay.

### Prediction algorithm

The cycle prediction model is a **two-step neural network**: individual-level ML models first recognize unique user patterns, then those patterns are transformed into features fed to the neural network that combines population-level statistics with personal history. Training data exceeds **450GB**, with ~1.4M new data points logged daily. The model reduces prediction error from 5.6 days (calendar method) to **2.6 days**, improving further with consistent logging. Flo was the first period tracker to use AI for predictions (~2017), developed with external partner InData Labs.

### Web presence gap

Critically for a clone builder: **flo.health is a marketing/content site, not a web app**. Core tracking and logging is mobile-only. The web offers educational articles, calculators (ovulation, due date, hCG), subscription management, and a clinician portal. This means **a web-based cycle tracking experience would fill an unserved market position** — valuable for desktop-preferring users, workplace wellness integrations, clinician dashboards, and users in regions with browser access but limited smartphone capability.

---

## 6. PRD preparation: MVP scope, personas, and user stories

### Recommended MVP feature set

A web app clone should prioritize the core habit loop before expanding into content and community. **Phase 1 (MVP)** should include: period logging with flow intensity, cycle calendar with color-coded predictions (using a simpler algorithm initially — ARIMA or decision trees on published research datasets), basic symptom logging (top 20 most-logged symptoms across mood, physical, and discharge categories), a dashboard showing cycle day and phase, fertile window visualization, basic insights showing cycle length trends, and account management with strong privacy defaults. **Phase 2** should add: TTC mode with BBT and OPK logging, pregnancy mode with week-by-week tracking, AI health assistant (start with rule-based, migrate to LLM), push notifications via service worker, partner sharing, and premium paywall. **Phase 3** adds: community forums, symptom checker, doctor's report export, wearable integrations via Web Bluetooth or manual import, and educational content library.

### Recommended tech stack

- **Frontend**: Next.js + TypeScript + TailwindCSS, with Chart.js or Recharts for cycle visualization, built as a PWA for offline support and push notifications
- **Backend**: Python/FastAPI (enables ML pipeline natively) + PostgreSQL + Redis
- **Auth**: Supabase Auth or Auth0 with anonymous account support
- **ML**: Start with scikit-learn (ARIMA, decision trees); graduate to TensorFlow/PyTorch neural networks as data grows
- **Infrastructure**: Vercel (frontend) + Supabase or AWS (backend) + Cloudflare (CDN/privacy)

### Suggested user personas

**Persona 1 — "Cycle Tracker Casey" (18-25)**: First-time tracker wanting to understand their body. Needs simple, non-intimidating period logging and basic predictions. Primarily uses free tier. Values privacy and anonymity. Entry point to the funnel.

**Persona 2 — "Fertility-Focused Farah" (28-35)**: Actively trying to conceive. Needs accurate ovulation predictions, BBT/OPK tracking, fertile window alerts, and conception tips. Willing to pay for Premium for better predictions and partner sharing. Highest conversion potential.

**Persona 3 — "Pregnant Priya" (25-38)**: Currently pregnant, wants week-by-week tracking, developmental milestones, symptom management, and birth preparation checklists. High engagement with educational content. Strong Premium subscriber.

**Persona 4 — "Perimenopause Patricia" (40-55)**: Experiencing cycle changes and wants to understand what's happening. Needs symptom tracking, pattern analysis, and perimenopause-specific educational content. Underserved by most competitors — growing market segment.

### Core user stories

1. *As a new user*, I want to complete a personalized onboarding quiz so the app adapts to my specific health goal (period tracking, TTC, pregnancy, or perimenopause).
2. *As a cycle tracker*, I want to log my period start/end and flow intensity in under 3 taps so tracking becomes a daily habit.
3. *As a cycle tracker*, I want to see my predicted next period date, current cycle day, and cycle phase at a glance on my dashboard.
4. *As a cycle tracker*, I want to log symptoms (mood, physical, discharge) quickly via tap-based icon selection so I can build a comprehensive health record.
5. *As someone trying to conceive*, I want to see my fertile window and predicted ovulation day clearly on the calendar so I can optimize timing.
6. *As someone trying to conceive*, I want to log BBT readings and ovulation test results so the app can improve its predictions.
7. *As a pregnant user*, I want to see my current gestational week with baby development milestones and body change information.
8. *As a long-term user*, I want to view cycle length trends, symptom pattern analysis, and generate a health report I can share with my doctor.
9. *As a privacy-conscious user*, I want to use the app without providing my real name or email, with my health data decoupled from my identity.
10. *As a partner*, I want read-only access to my partner's cycle/pregnancy data with daily insights about how they might be feeling, so I can be supportive.
11. *As a free user*, I want the core tracking experience to be fully functional while being exposed to Premium features (insights, reports, unlimited AI assistant) that motivate me to upgrade.

### Key technical risks for the clone

The **cold-start problem** is the most significant challenge: Flo's predictions are trained on 450GB+ of data from hundreds of millions of users. A clone starts at zero. Mitigation: use published research datasets (several exist on GitHub and Kaggle) and open-source prediction libraries (iurteaga/menstrual_cycle_analysis for Hidden semi-Markov models, cilab-ufersa/period_cycle_prediction for ARIMA/LSTM approaches) for initial models. A web app also **cannot directly access Apple HealthKit** (iOS-only SDK) — wearable data import would need to work through manual CSV upload, Web Bluetooth, or Health Connect on Android browsers. Finally, medical content requires expert review to avoid liability — consider AI-assisted content generation with physician sign-off rather than building a 120-person medical advisory team from day one.