# Web App Test Suite Review

This document provides a detailed breakdown of the test files in the web application (`apps/web`) and explains how they cover the platform's requirements and test cases.

---

## 1. Server Action Tests (`__tests__/actions/`)

These tests validate the Next.js Server Actions. They use Vitest to mock user authentication (`requireAuth`, `getAuthUser`), the core service layer (`@vesta/shared/server/services`), and cache revalidation (`next/cache`).

### 1.1 [feedback-actions.test.ts](file:///Volumes/KingstonFURYRenegade/Github/React/cycle-circle/apps/web/__tests__/actions/feedback-actions.test.ts)
* **submitFeedback:**
  * **Correct Fields:** Verifies that submitting feedback calls `createFeedback` with the currently authenticated user's ID, the correct category, message, and rating. It also checks that it returns the newly created feedback object and triggers `revalidatePath('/')`.
  * **Validation Guards:** Asserts that providing an invalid category throws a validation error and prevents the underlying database service from being called.

### 1.2 [profile-actions.test.ts](file:///Volumes/KingstonFURYRenegade/Github/React/cycle-circle/apps/web/__tests__/actions/profile-actions.test.ts)
* **createProfile:**
  * **Success Path:** Verifies creation of a profile (name, relation, cycle length, period length) for the authenticated user and triggers cache revalidation.
  * **Profile Limit:** Ensures that attempting to create a profile when the user already has the maximum of 6 profiles throws the correct business exception (`Maximum of 6 profiles allowed`).
  * **Initial Period Seeding:** Tests that providing a `lastPeriodStart` successfully registers and seeds the initial period log.
* **renameProfile:**
  * **Success Path:** Verifies that renaming a profile updates the profile name in the database and revalidates the path.
  * **Ownership Check:** Ensures that renaming a profile owned by another user fails.
* **deleteProfile:**
  * **Success Path:** Verifies deleting a profile.
  * **Business Rules:** Confirms that trying to delete the last profile or a profile not owned by the current user fails with appropriate errors.

### 1.3 [settings-actions.test.ts](file:///Volumes/KingstonFURYRenegade/Github/React/cycle-circle/apps/web/__tests__/actions/settings-actions.test.ts)
* **updateNotificationPrefs:**
  * **Success Path:** Verifies that updating alert preferences (period alerts, fertile window, logging reminders) invokes `upsertNotificationPrefs` for the specified profile and user, and triggers path revalidation.
  * **Security Check:** Verifies that trying to update preferences on a profile not owned by the current user throws an error.

### 1.4 [tracking-actions.test.ts](file:///Volumes/KingstonFURYRenegade/Github/React/cycle-circle/apps/web/__tests__/actions/tracking-actions.test.ts)
* **createPeriodLog:**
  * **Success Path:** Verifies that logging a period registers the start/end dates and flow intensity, triggers a background prediction recalculation job (`PREDICTION_RECALC`), and revalidates the cache.
  * **Validation Check:** Confirms that if `endDate` is before `startDate`, it throws an error and does not trigger prediction recalculation.
  * **Ownership Check:** Verifies that trying to log a period for a profile not owned by the current user throws an error.
* **updatePeriodLog & deletePeriodLog:**
  * **Success Paths:** Validates updating/deleting logs and ensures they successfully enqueue a new `PREDICTION_RECALC` job.
* **toggleSymptom:**
  * **Creation/Deletion Toggle:** Tests toggling a symptom (e.g., physical cramps). If no log exists for the date, it creates one; if it already exists, it deletes it.

### 1.5 [user-actions.test.ts](file:///Volumes/KingstonFURYRenegade/Github/React/cycle-circle/apps/web/__tests__/actions/user-actions.test.ts)
* **completeProfile:**
  * **Success Path:** Verifies that saving the onboarding form (full name and phone number) updates the user details, marks `profileCompleted: true`, and revalidates the cache.
  * **Validation Guards:** Ensures that submitting an empty name rejects the action.

---

## 2. Prediction & Cycle Logic Tests (`__tests__/prediction/`)

These tests cover the core mathematical algorithms, calendar rendering utilities, and the prediction engine logic.

### 2.1 [cycle-utils.test.ts](file:///Volumes/KingstonFURYRenegade/Github/React/cycle-circle/apps/web/__tests__/prediction/cycle-utils.test.ts) (Unit Tests)
* **predictCycleLength:**
  * Verifies weighted averages: more recent cycles are assigned higher weights so they influence cycle length prediction more strongly than older logs.
* **getPredictionTier:**
  * Confirms the transition rule: 0-5 cycles use the `average` tier, while 6+ cycles transition to the advanced `arima` tier.
* **getConfidence:**
  * Validates the client-side confidence formula capping (capped at 75% for average tier, 92% for arima tier).
* **getCurrentCycleDay:**
  * Tests cycle boundary wrap-arounds (e.g., day calculation wraps back to day 1 when a new cycle starts).
* **getCurrentPhase:**
  * Evaluates mapping days to phases (`menstrual`, `follicular`, `ovulation`, `luteal`) across different cycle lengths (short 21d, normal 28d, long 35d).
* **computePrediction:**
  * Tests that overall predictions (tier, next period, ovulation day, fertile window, confidence) compute correctly for empty, partially filled, and full cycle histories.

### 2.2 [period-log-sync.test.ts](file:///Volumes/KingstonFURYRenegade/Github/React/cycle-circle/apps/web/__tests__/prediction/period-log-sync.test.ts) (DB Integration)
* **addPeriodDatesInRange:**
  * Pure logic testing of dates: checks that periods spanning multiple months are correctly clipped to the calendar month start/end boundaries when queried.
* **ensurePeriodLogFromProfile:**
  * Verifies that if `lastPeriodStart` is provided on profile creation, it automatically generates the first database `PeriodLog`, calculates an `AVERAGE` prediction record, and enqueues a prediction job.
  * Ensures that if the profile does not have a `lastPeriodStart`, no logs or predictions are created.
  * Confirms it returns the existing log if one already exists (idempotency check).

### 2.3 [prediction-integration.test.ts](file:///Volumes/KingstonFURYRenegade/Github/React/cycle-circle/apps/web/__tests__/prediction/prediction-integration.test.ts) (DB Integration)
* **Progressive History Accumulation:**
  * Simulates a user logging cycles over time and checks predictions at each stage (e.g. 1 log, 3 logs, 7 logs with transition to ARIMA, up to 10 logs).
* **Confidence Monotonicity:**
  * Confirms confidence levels increase monotonically or stay flat as data builds up.
* **Tier Transition Boundary:**
  * Confirms deleting a middle log reduces the valid cycle count and drops the tier back to `AVERAGE`, and re-adding it recovers `ARIMA`.
* **ARIMA Weighting vs Simple Mean:**
  * Demonstrates how recent longer cycles pull the weighted average up compared to a simple mean.
* **Date Edge Cases:**
  * Verifies arithmetic for short/long cycles and month-end boundary conditions (e.g., Dec 31 -> Jan 31 -> Mar 3).

### 2.4 [worker-prediction.test.ts](file:///Volumes/KingstonFURYRenegade/Github/React/cycle-circle/apps/web/__tests__/prediction/worker-prediction.test.ts) (DB Integration)
* **Zero & Single Log fallbacks:**
  * Verifies the worker produces no prediction with 0 logs, and falls back to default profile settings with 1 log.
* **Anomalous Cycle Filtering:**
  * Confirms the prediction engine ignores invalid data:
    * 0-day gaps (logs on the same day).
    * Gaps of 90+ days (anomalous cycles due to missing logging).
* **Date Calculations Verification:**
  * Verifies that target dates (`nextPeriodStart`, `ovulationDay`, `fertileStart`, `fertileEnd`) are calculated with precise day math.
