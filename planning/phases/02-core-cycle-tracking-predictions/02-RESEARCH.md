# Phase 2: Core Cycle Tracking and Predictions - Research

**Researched:** 2026-03-26
**Domain:** Cycle tracking, calendar UI, symptom logging, multi-tier prediction engine (Simple/ARIMA/LSTM)
**Confidence:** HIGH (core tracking/calendar/symptoms), MEDIUM (ARIMA integration), LOW (LSTM/Tier 3)

## Summary

Phase 2 is the product's core value delivery -- everything Phase 1 built (auth, multi-profile, i18n, encryption) now serves actual cycle tracking, calendar visualization, symptom logging, and predictions. The current codebase has a functional prototype with localStorage-backed cycle/symptom tracking, a calendar with color-coded days, and a basic weighted-average prediction. Phase 2 must rebuild these features properly: server-side data persistence via Prisma/PostgreSQL, profile-scoped API endpoints, shared Zod validation, TanStack Query for data fetching, and a proper three-tier prediction engine behind a Strategy Pattern interface.

The biggest technical risks are: (1) the ARIMA npm package (v0.2.8) works but has sparse real-world usage for menstrual cycle data -- AutoARIMA may produce inaccurate results and manual p,d,q tuning may be needed; (2) TensorFlow.js LSTM (Tier 3) requires 12+ cycles of accumulated data making it non-functional at launch -- this tier should be architecturally prepared but implementation deferred; (3) the calendar UI must handle both logged (historical) and predicted (future) periods in the same view with correct color-coding, which requires clear separation of "actual" vs "predicted" data in the schema.

**Primary recommendation:** Build Tier 1 (simple average) and Tier 2 (ARIMA) fully functional with proper backend persistence. Architect Tier 3 (LSTM) behind the same Strategy Pattern interface but stub the implementation -- it cannot be meaningfully tested without 12+ cycles of real user data. Focus developer effort on the Flo-style dashboard UI (cycle day hero, phase display) and the calendar (color-coded month view) as these are the user-facing value.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CYCL-01 | Log period start with flow intensity in 2-3 taps | Zod schema validation, POST /profiles/:pid/cycles endpoint, icon-based flow selector component |
| CYCL-02 | Log period end date | PATCH /profiles/:pid/cycles/:id endpoint, endDate field on CycleLog model |
| CYCL-03 | See current cycle day, phase name, days until next period | Derived calculation from CycleLog data + prediction; client-side computation using date-fns |
| CYCL-04 | Dashboard shows cycle day as largest UI element | Flo-style cycle ring pattern documented; existing prototype has this pattern |
| CYCL-05 | Predictions recalculate immediately on new data | Tier 1 runs synchronously (<10ms); Tier 2/3 queued via BullMQ; TanStack Query cache invalidation |
| CYCL-06 | Edit/correct past period dates retroactively | PUT endpoint for CycleLog; triggers prediction recalculation job |
| CALR-01 | Month calendar with color-coded markers | Custom calendar grid using date-fns (eachDayOfInterval); existing prototype exists |
| CALR-02 | Calendar shows predicted future periods and fertile windows | Prediction data overlaid on calendar; distinguish predicted vs logged data |
| CALR-03 | Tap any date to view/edit logged data | Date selection state + slide-over panel or modal with day detail |
| CALR-04 | Navigate past and future months | Month navigation already prototyped; extend with server data fetching |
| FERT-01 | Fertile window (5 days before ovulation + ovulation day) displayed | Standard medical formula: ovulation = cycleLength - 14; fertile = ovDay-5 to ovDay |
| FERT-02 | Ovulation day clearly marked | Distinct accent color/icon on calendar and dashboard |
| FERT-03 | TTC mode shows daily conception tips | Conditional content rendering based on profile.goalType === 'ttc' |
| SYMP-01 | Icon-based tap selection for symptoms | Existing prototype has this pattern fully built |
| SYMP-02 | Physical symptoms: cramps, headache, breast tenderness, bloating, back pain, fatigue, nausea, acne | Symptom constant definitions in shared package |
| SYMP-03 | Mood symptoms: calm, sad, happy, anxious, mood swings, irritable, energetic, depressed | Symptom constant definitions in shared package |
| SYMP-04 | Vaginal discharge tracking types | Symptom constant definitions in shared package |
| SYMP-05 | Lifestyle factors: sleep quality, water intake, exercise, weight, stress | Symptom constant definitions in shared package |
| SYMP-06 | Customize which symptom categories appear | Per-profile preference stored in Profile.symptomPreferences JSON column |
| SYMP-07 | Edit symptom log for current day | PUT endpoint for SymptomLog; upsert pattern (one log per category per day per profile) |
| SYMP-08 | Logged symptoms feed into prediction engine | SymptomLog data passed as exogenous variables to ARIMA (SARIMAX) and LSTM inputs |
| PRED-01 | Tier 1: Rolling average of last 3-6 cycles | Pure TypeScript math; no dependencies; works from cycle 1 |
| PRED-02 | Tier 2: ARIMA time-series model; 6+ cycles | arima npm v0.2.8 (WebAssembly-based, zero deps); needs manual p,d,q tuning |
| PRED-03 | Tier 3: LSTM neural network; 12+ cycles | @tensorflow/tfjs-node v4.22; requires pre-trained model or sufficient user data |
| PRED-04 | Auto-escalate prediction tier as data accumulates | Strategy Pattern factory: getPredictionEngine(dataPointCount, maxTier) |
| PRED-05 | Prediction confidence percentage visible to user | Tier 1: 1/stddev heuristic; Tier 2: ARIMA MSE from predict(); Tier 3: model loss metric |
</phase_requirements>

## Standard Stack

### Core (Phase 2 specific -- builds on Phase 1 foundation)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| date-fns | ^4.1.0 | All cycle date calculations | Already in project. Tree-shakeable, immutable. Essential for cycle day counting, fertile window calculation, calendar grid generation. Bengali locale support via date-fns/locale/bn. |
| @tanstack/react-query | ^5.95 | Server state management | Caching, background refetch, optimistic updates for cycle/symptom data. Profile-scoped query keys. |
| zustand | ^5.0 | Client UI state | Active profile, calendar view month, selected date. NOT for cycle data (that is server state). |
| react-hook-form | ^7.72 | Form handling | Symptom logging forms, period logging form, settings forms. Uncontrolled = minimal re-renders. |
| zod | ^4.3 | Schema validation | Shared between frontend forms and backend API. Single source of truth for CycleLog, SymptomLog schemas. |
| recharts | ^3.8 | Cycle analytics charts | Cycle length variation chart, symptom frequency chart. SVG-based React components. |
| arima | ^0.2.8 | Tier 2 ARIMA prediction | WebAssembly-based ARIMA/SARIMA. Zero npm dependencies. Runs in Node.js. Published recently (active maintenance). |
| @tensorflow/tfjs-node | ^4.22 | Tier 3 LSTM prediction | LSTM neural network in Node.js. Install only when Tier 3 implementation begins. Heavy dependency (~200MB). |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| clsx | ^2.1 | Conditional CSS classes | Calendar day styling (period/fertile/current/selected states) |
| tailwind-merge | ^3.5 | Tailwind class dedup | Component variant merging |
| lucide-react | ^0.546 | Icons | Symptom category icons, phase indicators, calendar navigation |
| motion | ^12.23 | Animations | Calendar transitions, symptom selection feedback, phase ring animation |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom calendar grid | react-calendar / react-day-picker | Custom grid gives full control over color-coding, dot placement, and period phase visualization. Third-party calendars fight against cycle-specific styling. Existing prototype already has a working custom grid. |
| arima (npm) | Python statsmodels ARIMA | Python adds operational complexity (separate microservice). The npm arima package runs ARIMA in pure WebAssembly within Node.js. Sufficient for cycle length prediction with 6-30 data points. |
| @tensorflow/tfjs-node | Python TensorFlow/PyTorch | Same tradeoff as above. Keep everything in Node.js unless LSTM model complexity demands Python. |
| Custom cycle calculations | External cycle calc library | No reputable cycle calculation npm library exists. The math is straightforward (ovulation = cycleLength - 14, fertile window = 5 days before ovulation). Custom TypeScript is correct. |

**Installation (Phase 2 additions to existing project):**

```bash
# Frontend (packages/web)
pnpm add @tanstack/react-query zustand react-hook-form @hookform/resolvers zod recharts

# Backend (packages/api)
pnpm add zod arima

# Backend (deferred until Tier 3 work)
# pnpm add @tensorflow/tfjs-node
```

**Version verification (2026-03-26):**
- date-fns: 4.1.0 (already installed)
- @tanstack/react-query: 5.95.2
- zustand: 5.0.12
- react-hook-form: 7.72.0
- zod: 4.3.6
- recharts: 3.8.1
- arima: 0.2.8 (published ~1 month ago, actively maintained)
- @tensorflow/tfjs-node: 4.22.0

## Architecture Patterns

### Recommended Project Structure (Phase 2 additions)

```
packages/
  shared/src/
    schemas/
      cycle.ts          # createCycleSchema, updateCycleSchema, periodLogSchema
      symptom.ts         # logSymptomSchema, symptomCategorySchema
      prediction.ts      # predictionResponseSchema
    types/
      cycle.ts           # CycleLog, CyclePhase, FlowIntensity
      symptom.ts         # SymptomCategory, SymptomEntry, SymptomLog
      prediction.ts      # PredictionResult, PredictionTier, FertileWindow
    constants/
      symptoms.ts        # PHYSICAL_SYMPTOMS, MOOD_SYMPTOMS, DISCHARGE_TYPES, LIFESTYLE_FACTORS
      phases.ts          # CyclePhase enum, phase calculation helpers
  api/src/
    routes/
      cycle.routes.ts    # POST/GET/PUT /profiles/:pid/cycles
      symptom.routes.ts  # POST/GET/PUT /profiles/:pid/symptoms
      prediction.routes.ts # GET /profiles/:pid/predictions
    services/
      cycle.service.ts   # Business logic for period logging, cycle history
      symptom.service.ts # Business logic for symptom CRUD
    prediction/
      types.ts           # PredictionEngine interface
      factory.ts         # getPredictionEngine(dataPointCount, maxTier)
      tier1/
        simple.ts        # SimpleAveragePrediction (rolling avg last 3-6 cycles)
      tier2/
        arima.ts         # ARIMAPrediction (ARIMA time-series)
      tier3/
        lstm.ts          # LSTMPrediction (stub until 12+ cycles available)
    jobs/
      recalcPrediction.job.ts  # BullMQ job triggered on new cycle data
  web/src/
    components/features/
      cycle/
        CycleRing.tsx          # Central cycle day ring (hero element)
        PhaseDisplay.tsx       # Current phase name + description
        PeriodLogger.tsx       # 2-3 tap period start/end logging
        DayStrip.tsx           # 7-day horizontal strip (Flo-style)
      calendar/
        CalendarGrid.tsx       # Full month calendar with color-coded days
        CalendarNav.tsx        # Month navigation (prev/next)
        DayCell.tsx            # Individual day with period/fertile/ovulation markers
        DayDetail.tsx          # Slide-over panel for tapped date
      symptoms/
        SymptomLogger.tsx      # Main symptom logging page
        SymptomGrid.tsx        # Icon-based category grid
        SymptomChip.tsx        # Individual symptom toggle button
        CategoryConfig.tsx     # Customize visible categories
      prediction/
        ConfidenceBadge.tsx    # Tier indicator + confidence percentage
        TierExplainer.tsx      # Explain which tier is active and why
    pages/
      dashboard/
        DashboardPage.tsx      # Cycle day hero + phase + predictions + stats
      calendar/
        CalendarPage.tsx       # Full calendar view with sidebar
      symptoms/
        SymptomsPage.tsx       # Symptom logging interface
    api/
      cycles.ts                # TanStack Query hooks: useCycles, useLogPeriod, etc.
      symptoms.ts              # TanStack Query hooks: useSymptoms, useLogSymptom, etc.
      predictions.ts           # TanStack Query hooks: usePredictions
    hooks/
      useCycleDay.ts           # Derived: current cycle day, phase, days until next
      useFertileWindow.ts      # Derived: fertile window dates for current cycle
```

### Pattern 1: Prediction Engine Strategy Pattern

**What:** All three prediction tiers implement the same `PredictionEngine` interface. A factory selects the tier based on available data points.

**When to use:** Every prediction request.

**Example:**

```typescript
// packages/api/src/prediction/types.ts
export interface CyclePrediction {
  nextPeriodStart: Date;
  nextPeriodEnd: Date;
  ovulationDate: Date;
  fertileWindowStart: Date;
  fertileWindowEnd: Date;
  confidence: number; // 0-100
  tier: 1 | 2 | 3;
}

export interface PredictionEngine {
  predict(cycleLengths: number[], metadata?: PredictionMetadata): Promise<CyclePrediction>;
  readonly requiredDataPoints: number;
  readonly tier: 1 | 2 | 3;
}

// packages/api/src/prediction/factory.ts
export function getPredictionEngine(dataPointCount: number): PredictionEngine {
  if (dataPointCount >= 12) return new LSTMPrediction();   // Tier 3
  if (dataPointCount >= 6)  return new ARIMAPrediction();   // Tier 2
  return new SimpleAveragePrediction();                     // Tier 1
}
```

### Pattern 2: Profile-Scoped Cycle Data Flow

**What:** Every cycle/symptom/prediction operation is scoped to a profileId. The frontend sends profileId with every request via TanStack Query keys. The backend verifies ownership via middleware.

**When to use:** Every data operation in Phase 2.

**Example:**

```typescript
// Frontend: TanStack Query hook
export function useCycles(profileId: string) {
  return useQuery({
    queryKey: ['cycles', profileId],
    queryFn: () => api.get(`/profiles/${profileId}/cycles`),
    enabled: !!profileId,
  });
}

// Frontend: Mutation with cache invalidation
export function useLogPeriod(profileId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: PeriodLogInput) =>
      api.post(`/profiles/${profileId}/cycles`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycles', profileId] });
      queryClient.invalidateQueries({ queryKey: ['predictions', profileId] });
    },
  });
}

// Backend: Route with ownership middleware
router.post('/profiles/:profileId/cycles',
  verifyJWT,
  checkProfileOwnership,
  validateBody(createCycleSchema),
  cycleController.logPeriod
);
```

### Pattern 3: Cycle Phase Calculation (Pure Functions)

**What:** Cycle phase determination is pure computation based on cycle day number. No server call needed.

**When to use:** Dashboard phase display, calendar color-coding, content recommendations.

**Example:**

```typescript
// packages/shared/src/constants/phases.ts
export type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal';

export function getCyclePhase(
  cycleDay: number,
  periodLength: number,
  cycleLength: number
): CyclePhase {
  const ovulationDay = cycleLength - 14;
  if (cycleDay <= periodLength) return 'menstrual';
  if (cycleDay >= ovulationDay - 2 && cycleDay <= ovulationDay + 1) return 'ovulatory';
  if (cycleDay < ovulationDay - 2) return 'follicular';
  return 'luteal';
}

export function getFertileWindow(cycleLength: number): { start: number; end: number } {
  const ovulationDay = cycleLength - 14;
  return { start: ovulationDay - 5, end: ovulationDay };
}
```

### Pattern 4: Calendar Data Merge (Logged + Predicted)

**What:** Calendar must distinguish between actual logged data (confirmed period days) and predicted future data (estimated period/fertile days). Both appear on the same calendar but with different visual treatments.

**When to use:** Calendar rendering.

**Example:**

```typescript
// Calendar day status computation
interface DayStatus {
  isLogged: boolean;       // Has actual CycleLog data
  isPredicted: boolean;    // From prediction engine
  isPeriod: boolean;       // Menstrual phase (logged or predicted)
  isFertile: boolean;      // Fertile window
  isOvulation: boolean;    // Ovulation day
  hasSymptoms: boolean;    // Has SymptomLog entries
  flowIntensity?: 'light' | 'medium' | 'heavy' | 'spotting';
}

// Visual treatment:
// Logged period days: solid red/pink background
// Predicted period days: dashed red/pink border (distinguishable from logged)
// Fertile window: teal/green markers
// Ovulation day: distinct accent dot/icon
// Symptom indicator: small dot below date
```

### Anti-Patterns to Avoid

- **Storing derived data in the database:** Cycle phase, days until next period, and fertile window are all derived from CycleLog + Prediction data. Do NOT store these as separate database columns -- compute them on read.
- **Coupling prediction tier to route:** The API endpoint `/profiles/:pid/predictions` should NOT expose which tier was used in the URL. The factory selects the tier internally. The response includes the tier as metadata.
- **Client-side prediction calculation:** Predictions must run server-side because Tier 2/3 need libraries not available in the browser. Even Tier 1 should run server-side for consistency, though the client may cache and display the result.
- **Global symptom state:** Symptoms are per-profile, per-date. Never store in a global store. Always scope to profileId in TanStack Query keys.
- **Ignoring timezone for cycle dates:** Period start/end dates must be stored as DATE (not TIMESTAMP) in PostgreSQL. A period that started "on March 15" is March 15 regardless of timezone. Use date-fns `startOfDay` and store ISO date strings (YYYY-MM-DD).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| ARIMA time-series prediction | Custom ARIMA implementation | `arima` npm package v0.2.8 | ARIMA parameter estimation requires solving complex optimization problems. The npm package uses WebAssembly compiled from C, handling edge cases (non-stationary series, seasonal decomposition) that take months to implement correctly. |
| Calendar date grid generation | Custom date arithmetic for month grids | `date-fns` eachDayOfInterval, startOfMonth, endOfMonth, getDay | Edge cases: months starting on different days, February 29th, timezone boundaries. date-fns handles all of these. Already used in existing prototype. |
| Form validation with type inference | Manual validation + separate TypeScript types | Zod schemas with `zodResolver` for React Hook Form | Zod infers TypeScript types from schemas. One definition serves: frontend form validation, backend request validation, and TypeScript type. Eliminating drift between these three is critical for a health app. |
| Server state caching/invalidation | Custom fetch + useState for API data | TanStack Query | Profile switching requires invalidating all profile-scoped queries. Mutation callbacks need to invalidate related queries (logging a period must refresh predictions). TanStack Query handles this declaratively. |
| Bengali date/number formatting | Custom locale formatting | date-fns locale/bn + Intl.NumberFormat('bn-BD') | Bengali numerals, month names, date ordering -- all handled by built-in locale support. |

**Key insight:** The prediction engine is where custom code is justified (Tier 1 is simple math, Tier 2 wraps the arima package, Tier 3 wraps TensorFlow.js). Everything else -- dates, forms, validation, data fetching, calendar grids -- has battle-tested solutions.

## Common Pitfalls

### Pitfall 1: Period Overlap / Duplicate Logging
**What goes wrong:** User logs period start, then accidentally logs another period start before ending the first one. Or they log period end before start.
**Why it happens:** No validation that a cycle is "open" (started but not ended).
**How to avoid:** The API must enforce: only one open cycle per profile at a time. If a CycleLog exists with endDate=null for this profile, the next POST must either set endDate on the existing record or reject.
**Warning signs:** Two CycleLog rows for the same profile with overlapping date ranges.

### Pitfall 2: ARIMA with Too Few Data Points
**What goes wrong:** ARIMA is initialized with <10 data points and either crashes or produces wildly inaccurate predictions.
**Why it happens:** The factory escalates to Tier 2 at 6 cycles, but the arima package documentation says "provide at least 10 observations for simple ARIMA."
**How to avoid:** Keep the Tier 2 threshold at 6 cycles BUT use conservative ARIMA parameters (p=1, d=0, q=0 or p=1, d=1, q=0). Do NOT use AutoARIMA with sparse data -- the package explicitly warns it "may produce inaccurate results." Alternatively, raise the threshold to 8 or 10 for safety.
**Warning signs:** ARIMA predictions that are >7 days off from actual period dates.

### Pitfall 3: Prediction Confidence Displayed as Certainty
**What goes wrong:** Showing "85% confident your period starts March 28" makes users treat it as fact. When it's wrong, trust erodes.
**Why it happens:** Confidence is a statistical measure (related to prediction interval width), not a probability that the prediction is exactly correct.
**How to avoid:** Display confidence as a range: "Your period is expected between March 26-30" rather than a single date with a percentage. Show the tier: "Based on your last 4 cycles" (Tier 1) vs "Based on time-series analysis of 8 cycles" (Tier 2).
**Warning signs:** User complaints about "wrong predictions" when the actual date was within the confidence interval.

### Pitfall 4: Calendar Color-Coding Ambiguity (Logged vs Predicted)
**What goes wrong:** Users cannot distinguish between confirmed past period days and predicted future period days. They think predicted days are confirmed.
**Why it happens:** Same visual treatment (solid red) for both.
**How to avoid:** Use distinct visual markers: solid fill for logged/confirmed data, dashed border or lighter opacity for predicted data. Include a legend. Flo uses this distinction.
**Warning signs:** Users editing predicted days thinking they are logged data.

### Pitfall 5: Symptom Data Not Feeding Predictions
**What goes wrong:** SYMP-08 requires symptoms to feed into the prediction engine, but they are stored in a completely separate data silo with no integration.
**Why it happens:** Symptoms and cycles are built as independent features. Integration is deferred and forgotten.
**How to avoid:** Design the PredictionEngine interface with a `metadata` parameter from day one that accepts symptom data. Even if Tier 1 ignores it, Tier 2 (SARIMAX) can use symptoms as exogenous variables, and Tier 3 (LSTM) uses them as input features. The integration point must exist in the interface.
**Warning signs:** The prediction endpoint never queries the SymptomLog table.

### Pitfall 6: Forgetting Profile Scoping on Every Query
**What goes wrong:** A query fetches cycle data without filtering by profileId. In a multi-profile system, this returns mixed data from different profiles.
**Why it happens:** Developer forgets to add the profileId WHERE clause.
**How to avoid:** The Prisma query helper should ALWAYS require profileId. Create a helper: `cycleService.findMany(profileId, filters)` that internally always includes `WHERE profileId = ?`. Never expose a "find all cycles" method without profileId.
**Warning signs:** Dashboard showing data from the wrong profile after switching.

## Code Examples

### Tier 1 Prediction: Simple Rolling Average

```typescript
// packages/api/src/prediction/tier1/simple.ts
import { addDays } from 'date-fns';
import type { PredictionEngine, CyclePrediction } from '../types';

export class SimpleAveragePrediction implements PredictionEngine {
  readonly requiredDataPoints = 1;
  readonly tier = 1 as const;

  async predict(
    cycleLengths: number[],
    lastPeriodStart: Date,
    periodLength: number
  ): Promise<CyclePrediction> {
    // Rolling average of last 3-6 cycles (or all if fewer)
    const recentCycles = cycleLengths.slice(-6);
    const avgLength = Math.round(
      recentCycles.reduce((sum, len) => sum + len, 0) / recentCycles.length
    );

    // Standard deviation for confidence
    const variance = recentCycles.reduce(
      (sum, len) => sum + Math.pow(len - avgLength, 2), 0
    ) / recentCycles.length;
    const stdDev = Math.sqrt(variance);

    // Confidence: lower std dev = higher confidence (capped at 90% for Tier 1)
    const confidence = Math.min(90, Math.max(40, Math.round(100 - stdDev * 10)));

    const ovulationDay = avgLength - 14;
    const nextPeriodStart = addDays(lastPeriodStart, avgLength);

    return {
      nextPeriodStart,
      nextPeriodEnd: addDays(nextPeriodStart, periodLength - 1),
      ovulationDate: addDays(lastPeriodStart, ovulationDay),
      fertileWindowStart: addDays(lastPeriodStart, ovulationDay - 5),
      fertileWindowEnd: addDays(lastPeriodStart, ovulationDay),
      confidence,
      tier: 1,
    };
  }
}
```

### Tier 2 Prediction: ARIMA Wrapper

```typescript
// packages/api/src/prediction/tier2/arima.ts
import ARIMA from 'arima';
import { addDays } from 'date-fns';
import type { PredictionEngine, CyclePrediction } from '../types';

export class ARIMAPrediction implements PredictionEngine {
  readonly requiredDataPoints = 6;
  readonly tier = 2 as const;

  async predict(
    cycleLengths: number[],
    lastPeriodStart: Date,
    periodLength: number
  ): Promise<CyclePrediction> {
    // Use manual parameters -- AutoARIMA is unreliable with small datasets
    // p=1 (one autoregressive term), d=1 (first difference for stationarity),
    // q=0 (no moving average -- insufficient data for MA estimation)
    const arima = new ARIMA({
      p: 1,
      d: 1,
      q: 0,
      verbose: false,
    }).train(cycleLengths);

    const [forecast, errors] = arima.predict(1);
    arima.destroy(); // Free WebAssembly memory

    const predictedLength = Math.round(forecast[0]);
    const mse = errors[0]; // Mean squared error

    // Confidence from MSE: lower error = higher confidence (capped at 95% for Tier 2)
    const confidence = Math.min(95, Math.max(50, Math.round(100 - Math.sqrt(mse) * 5)));

    const ovulationDay = predictedLength - 14;
    const nextPeriodStart = addDays(lastPeriodStart, predictedLength);

    return {
      nextPeriodStart,
      nextPeriodEnd: addDays(nextPeriodStart, periodLength - 1),
      ovulationDate: addDays(lastPeriodStart, ovulationDay),
      fertileWindowStart: addDays(lastPeriodStart, ovulationDay - 5),
      fertileWindowEnd: addDays(lastPeriodStart, ovulationDay),
      confidence,
      tier: 2,
    };
  }
}
```

### Shared Zod Schemas

```typescript
// packages/shared/src/schemas/cycle.ts
import { z } from 'zod';

export const flowIntensityEnum = z.enum(['light', 'medium', 'heavy', 'spotting']);

export const createCycleSchema = z.object({
  startDate: z.string().date(), // YYYY-MM-DD format
  flowIntensity: flowIntensityEnum,
});

export const endCycleSchema = z.object({
  endDate: z.string().date(),
});

export const updateCycleSchema = z.object({
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  flowIntensity: flowIntensityEnum.optional(),
});

// packages/shared/src/schemas/symptom.ts
export const symptomCategoryEnum = z.enum([
  'physical', 'mood', 'discharge', 'lifestyle'
]);

export const logSymptomSchema = z.object({
  date: z.string().date(),
  category: symptomCategoryEnum,
  symptoms: z.array(z.string()).min(1),
  notes: z.string().max(500).optional(),
});
```

### Prisma Schema Additions (Phase 2)

```prisma
// packages/api/prisma/schema.prisma (additions for Phase 2)

model CycleLog {
  id            String        @id @default(uuid())
  profileId     String
  profile       Profile       @relation(fields: [profileId], references: [id], onDelete: Cascade)
  startDate     DateTime      @db.Date
  endDate       DateTime?     @db.Date
  flowIntensity FlowIntensity
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  @@index([profileId, startDate(sort: Desc)])
  @@map("cycle_logs")
}

model SymptomLog {
  id        String          @id @default(uuid())
  profileId String
  profile   Profile         @relation(fields: [profileId], references: [id], onDelete: Cascade)
  date      DateTime        @db.Date
  category  SymptomCategory
  symptoms  String[]        // Array of symptom IDs
  notes     String?         /// @encrypted
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt

  @@unique([profileId, date, category]) // One log per category per day per profile
  @@index([profileId, date(sort: Desc)])
  @@map("symptom_logs")
}

model Prediction {
  id               String   @id @default(uuid())
  profileId        String
  profile          Profile  @relation(fields: [profileId], references: [id], onDelete: Cascade)
  nextPeriodStart  DateTime @db.Date
  nextPeriodEnd    DateTime @db.Date
  ovulationDate    DateTime @db.Date
  fertileStart     DateTime @db.Date
  fertileEnd       DateTime @db.Date
  tier             Int
  confidence       Float
  cycleLengthUsed  Int      // The predicted cycle length
  createdAt        DateTime @default(now())

  @@index([profileId, createdAt(sort: Desc)])
  @@map("predictions")
}

enum FlowIntensity {
  light
  medium
  heavy
  spotting
}

enum SymptomCategory {
  physical
  mood
  discharge
  lifestyle
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| localStorage-based cycle data (current prototype) | PostgreSQL via Prisma with profile-scoped queries | Phase 2 transition | All cycle data becomes persistent, server-side, multi-device accessible |
| React Context for all state (current prototype) | TanStack Query (server state) + Zustand (UI state) | Phase 2 transition | Proper separation of concerns; cache invalidation on profile switch |
| Single weighted average prediction (current) | Three-tier Strategy Pattern (Avg/ARIMA/LSTM) | Phase 2 implementation | Progressively more accurate predictions as data accumulates |
| Hardcoded symptom categories (current) | Shared constants + customizable per-profile | Phase 2 implementation | Users can show/hide categories; symptoms feed prediction engine |

**Deprecated/outdated (in current codebase):**
- `AppContext.tsx`: The entire React Context provider must be replaced. It mixes auth state, cycle data, symptom data, UI state, and predictions into one massive context. Phase 2 separates these into TanStack Query hooks (server data) and Zustand stores (UI state).
- `data/profiles.ts`: Demo profiles with hardcoded data. Replace with actual Profile model from Phase 1's database.
- `predictCycleLength()` function in AppContext: Replace with server-side prediction engine.

## Existing Prototype Analysis

The current codebase has a functional prototype that informs Phase 2 implementation:

**What exists and can be preserved (UI patterns):**
- `Home.tsx`: Cycle ring visualization with current day, days until period, phase display. The UI pattern is sound -- rebuild with real data from TanStack Query.
- `Calendar.tsx`: Month grid with color-coded period/fertile days, navigation. Grid logic using date-fns is correct -- rebuild connected to server data.
- `LogSymptoms.tsx`: Icon-based symptom selection with 6 categories, collapsible sections, auto-save. The UX pattern is excellent -- rebuild with React Hook Form + Zod + server persistence.

**What must be replaced (data layer):**
- localStorage-based persistence -> PostgreSQL via Prisma
- AppContext -> TanStack Query + Zustand
- Client-side prediction -> Server-side prediction engine
- Hardcoded demo profiles -> Phase 1's Profile model

**What must be added (new in Phase 2):**
- Period start/end logging flow (CYCL-01, CYCL-02)
- Retroactive date editing (CYCL-06)
- Date tap -> day detail panel (CALR-03)
- Symptom category customization (SYMP-06)
- Prediction confidence display (PRED-05)
- TTC mode daily tips (FERT-03)
- All API endpoints and services
- Prediction engine (all 3 tiers)

## Open Questions

1. **ARIMA threshold: 6 cycles or 10?**
   - What we know: The arima npm package docs say "at least 10 observations" for reliable ARIMA. The REQUIREMENTS.md specifies Tier 2 activates at "6+ logged cycles."
   - What's unclear: Whether ARIMA with p=1,d=1,q=0 (simplest configuration) works reliably with only 6 data points.
   - Recommendation: Start with the requirement (6 cycles) but use conservative ARIMA parameters (p=1,d=1,q=0). Add a fallback: if ARIMA prediction is >7 days away from Tier 1's prediction, fall back to Tier 1 and log the anomaly. This can be tuned after real data is available.

2. **Tier 3 LSTM: Build or stub?**
   - What we know: LSTM needs 12+ cycles (12+ months of real user data). The app will not have this data at launch. TensorFlow.js adds ~200MB to the backend.
   - What's unclear: Whether to install @tensorflow/tfjs-node now and build the training pipeline, or just create the interface stub.
   - Recommendation: Stub Tier 3. Define the `LSTMPrediction` class implementing `PredictionEngine` interface but have `predict()` fall back to Tier 2. Do NOT install @tensorflow/tfjs-node in Phase 2. Saves ~200MB dependency and avoids native build issues. Implement when there is actual training data.

3. **Symptom data structure: Fixed IDs or freeform?**
   - What we know: Requirements define specific symptoms per category (SYMP-02 through SYMP-05). The existing prototype uses string IDs.
   - What's unclear: Whether symptoms should be an enum in the database or a string array (more flexible but less type-safe).
   - Recommendation: Use string IDs from a constants file in the shared package. Store as `String[]` in Prisma (PostgreSQL array column). This allows adding new symptoms without a database migration while keeping a canonical list for display and analytics. Validate against the known list at the API level but don't reject unknown IDs (forward compatibility).

4. **How many future cycles to predict?**
   - What we know: Calendar needs to show predicted future periods (CALR-02). But how far ahead?
   - What's unclear: Whether to predict 1 cycle ahead or 3-6 cycles ahead.
   - Recommendation: Predict 3 cycles ahead. This covers 3 months of calendar navigation (CALR-04). Tier 1 can extrapolate the average indefinitely. Tier 2 ARIMA should predict 3 steps (each step = one cycle length). Store the nearest prediction and compute further ones on demand.

## Estimation Considerations

For the planning phase, these factors affect developer-hour estimates:

**Backend (API + database):**
- Prisma schema additions (CycleLog, SymptomLog, Prediction models): 2-4 hours
- Cycle routes + service (CRUD + validation): 4-6 hours
- Symptom routes + service (CRUD + category management): 4-6 hours
- Prediction engine: Tier 1 (2-3 hours), Tier 2 ARIMA wrapper (4-6 hours), Tier 3 stub (1 hour)
- Prediction factory + auto-escalation logic: 2-3 hours
- BullMQ job for prediction recalculation: 2-3 hours

**Frontend (UI):**
- Dashboard rebuild (cycle ring, phase display, stats): 4-6 hours (existing UI can be adapted)
- Calendar rebuild (connected to server data, logged vs predicted distinction): 6-8 hours
- Period logging flow (2-3 tap start + end): 3-4 hours
- Symptom logging rebuild (server persistence, category customization): 6-8 hours
- Day detail panel (tap date to view/edit): 3-4 hours
- TTC mode content: 2-3 hours
- Prediction confidence display: 2-3 hours

**Integration:**
- TanStack Query hooks for all endpoints: 3-4 hours
- Zustand stores (calendar state, selected date): 1-2 hours
- Profile-scoped cache invalidation: 2-3 hours
- i18n strings for all new UI (English + Bengali): 3-4 hours

**Total estimated range: 48-68 developer hours (~6-8 working days)**

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^3.x |
| Config file | vitest.config.ts (needs creation if not existing) |
| Quick run command | `pnpm vitest run --reporter=verbose` |
| Full suite command | `pnpm vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CYCL-01 | Log period start with flow | unit | `vitest run tests/services/cycle.test.ts -t "log period start"` | Wave 0 |
| CYCL-02 | Log period end | unit | `vitest run tests/services/cycle.test.ts -t "log period end"` | Wave 0 |
| CYCL-03 | Cycle day + phase calculation | unit | `vitest run tests/shared/phases.test.ts` | Wave 0 |
| CYCL-05 | Prediction recalculates on new data | integration | `vitest run tests/services/prediction.test.ts -t "recalculate"` | Wave 0 |
| CYCL-06 | Edit past period dates | unit | `vitest run tests/services/cycle.test.ts -t "edit retroactive"` | Wave 0 |
| CALR-01 | Calendar color-coded markers | unit | `vitest run tests/components/calendar.test.ts` | Wave 0 |
| FERT-01 | Fertile window calculation | unit | `vitest run tests/shared/phases.test.ts -t "fertile window"` | Wave 0 |
| SYMP-01 | Icon-based symptom logging | unit | `vitest run tests/services/symptom.test.ts -t "log symptom"` | Wave 0 |
| SYMP-06 | Customize visible categories | unit | `vitest run tests/services/symptom.test.ts -t "customize categories"` | Wave 0 |
| SYMP-07 | Edit same-day symptom log | unit | `vitest run tests/services/symptom.test.ts -t "edit symptom"` | Wave 0 |
| PRED-01 | Tier 1 rolling average prediction | unit | `vitest run tests/prediction/tier1.test.ts` | Wave 0 |
| PRED-02 | Tier 2 ARIMA prediction | unit | `vitest run tests/prediction/tier2.test.ts` | Wave 0 |
| PRED-04 | Auto-escalate tier | unit | `vitest run tests/prediction/factory.test.ts` | Wave 0 |
| PRED-05 | Confidence percentage | unit | `vitest run tests/prediction/tier1.test.ts -t "confidence"` | Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm vitest run --reporter=verbose`
- **Per wave merge:** `pnpm vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/services/cycle.test.ts` -- covers CYCL-01, CYCL-02, CYCL-05, CYCL-06
- [ ] `tests/services/symptom.test.ts` -- covers SYMP-01, SYMP-06, SYMP-07
- [ ] `tests/shared/phases.test.ts` -- covers CYCL-03, FERT-01
- [ ] `tests/prediction/tier1.test.ts` -- covers PRED-01, PRED-05
- [ ] `tests/prediction/tier2.test.ts` -- covers PRED-02
- [ ] `tests/prediction/factory.test.ts` -- covers PRED-04
- [ ] `tests/components/calendar.test.ts` -- covers CALR-01
- [ ] `vitest.config.ts` -- framework config if not existing
- [ ] Framework install: `pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom`

## Sources

### Primary (HIGH confidence)
- [arima npm package](https://www.npmjs.com/package/arima) - v0.2.8, API usage, limitations (10+ observations minimum, AutoARIMA warning)
- [arima GitHub](https://github.com/zemlyansky/arima) - Full API docs, constructor params, train/predict/destroy lifecycle
- [date-fns npm](https://www.npmjs.com/package/date-fns) - v4.1.0, Bengali locale support confirmed
- [TanStack Query docs](https://tanstack.com/query/latest) - v5 stable, mutation/invalidation patterns
- [Johns Hopkins Medicine - Fertility Window](https://www.hopkinsmedicine.org/health/wellness-and-prevention/calculating-your-monthly-fertility-window) - Standard ovulation formula: cycle_length - 14
- [Office on Women's Health - Ovulation Calculator](https://womenshealth.gov/ovulation-calculator) - Fertile window = 5 days before ovulation + ovulation day
- npm registry (2026-03-26) - Verified versions: arima 0.2.8, @tensorflow/tfjs-node 4.22.0, date-fns 4.1.0, react-hook-form 7.72.0, zod 4.3.6, recharts 3.8.1, @tanstack/react-query 5.95.2, zustand 5.0.12

### Secondary (MEDIUM confidence)
- [Predictive Modeling of Menstrual Cycle Length (arXiv 2308.07927)](https://arxiv.org/abs/2308.07927) - Research validating ARIMA and LSTM for menstrual cycle prediction
- [TensorFlow.js LSTM Time Series (GitHub)](https://github.com/jinglescode/time-series-forecasting-tensorflowjs) - LSTM implementation pattern for TensorFlow.js
- [JAMIA - Predictive model for next cycle start date](https://academic.oup.com/jamia/article/29/1/3/6371799) - Adherence-aware prediction model for menstrual self-tracking

### Tertiary (LOW confidence)
- ARIMA npm package with menstrual cycle data specifically -- no verified real-world menstrual cycle implementations found. The package is validated for general time-series but cycle-specific tuning (p,d,q parameters) will need empirical testing with actual user data.
- TensorFlow.js LSTM performance claims (38% faster than Python) -- single source, not independently verified.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified, versions confirmed against npm registry, existing prototype validates patterns
- Architecture: HIGH - Multi-profile pattern well-documented in project architecture research, Strategy Pattern for prediction is standard
- Prediction engine (Tier 1): HIGH - Simple rolling average is straightforward math
- Prediction engine (Tier 2): MEDIUM - arima npm package exists and works, but cycle-specific parameter tuning is unvalidated
- Prediction engine (Tier 3): LOW - LSTM architecture is sound but cannot be meaningfully implemented/tested without 12+ months of user data
- Pitfalls: HIGH - Common issues documented from architecture research and prototype code analysis
- Calendar/UI: HIGH - Existing prototype validates the approach; date-fns patterns are well-established

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable domain, standard libraries)
