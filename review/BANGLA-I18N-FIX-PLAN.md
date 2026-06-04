# Bangla i18n Fix Plan — Class A (UI strings & label maps)

**Date:** 2026-06-04
**Scope:** `apps/web` UI strings only. Data/content layer (ArticleCategory bilingual, seed bn, locale-aware content-service) and SMS bilingual are **explicitly deferred** (Class B/C — separate effort).

## Context

The Bangla audit found that `packages/shared/src/utils/i18n.ts` already has **complete en↔bn key parity (221 keys)** — the visible "Bangla names missing" is NOT missing translations. The root cause is **hardcoded English strings and English-only label maps that bypass i18n**; with `fallbackLng: 'en'` they render in English even in Bangla mode. This was an inconsistency: phases/relations/goals/symptom-categories were done correctly via `t()`, but flow-intensity, theme labels, and assorted UI text were inlined as English.

**Goal:** add the missing en+bn keys and replace every Class-A hardcoded string with a `t()` call, so Bangla mode shows Bangla everywhere in scope. No schema changes.

## The inventory (what to fix, by file)

| File | Hardcoded strings to localize |
|---|---|
| `components/PeriodLogModal.tsx:19` | `FLOW_LABELS` (Light/Medium/Heavy) |
| `app/(main)/calendar/CalendarClient.tsx:398,441,446,475,501,512` | `FLOW_STYLES.label`, "Recent Periods", "No period logs yet", "day/days", "Prev", "Next" |
| `app/onboarding/OnboardingClient.tsx:44` | `FLOW_LABELS` |
| `app/(main)/profiles/ProfilesClient.tsx:190,204,490` | "ACTIVE" badge, `{X}d cycle · {X}d period`, flow ternary |
| `app/(main)/settings/SettingsClient.tsx:405–759` | ~27 strings: section headers (Language & Appearance, Account, About), notif descriptions, theme labels (☀️ Light / 🌙 Dark), button/labels/placeholders, logout confirm |
| `app/(main)/layout.tsx:93,100,125,151,155,181` | "Menu", "More", "Profile" fallback, theme text + aria-labels |
| `app/(main)/terms/page.tsx:46–99` | section titles + body copy |

> Already-correct (do NOT touch): phase names, relation names, goals, symptom categories, main nav labels, email templates, most of dashboard.

## Strategy & key conventions

**Reuse before adding.** Several strings likely already have keys (e.g. `common.save`, `common.cancel`). Always reuse an existing key; only add genuinely new ones.

**New keys — naming (add to BOTH `en` and `bn` in `i18n.ts`):**
- **Flow intensity (cross-cutting, used in 4 files):** `common.flowLight` / `common.flowMedium` / `common.flowHeavy` → হালকা / মাঝারি / ভারী.
- **Generic UI:** `common.previous` (পূর্ববর্তী), `common.next` (পরবর্তী), `common.day` (দিন), `common.days` (দিন), `common.active` (সক্রিয়), `common.profile` (প্রোফাইল). Use i18next count-based plural for day/days if the existing file uses plurals; otherwise two keys.
- **Theme:** `settings.lightMode`, `settings.darkMode`, `settings.switchToLight`, `settings.switchToDark`.
- **Settings:** `settings.languageAppearanceTitle`, `settings.appDisplayLanguage`, `settings.visualAppearance`, `settings.accountTitle`, `settings.aboutTitle`, `settings.periodAlertDescription`, `settings.fertileAlertDescription`, `settings.reminderAlertDescription`, `settings.exportDescription`, `settings.securityNotice`, `settings.manageProfiles`, `settings.giveFeedback`, `settings.addEmail`, `settings.addPhone`, `settings.enterEmail`, `settings.logoutConfirm`, `settings.loggingOut`, plus `settings.phone`/`settings.email`/`settings.plan`/`settings.appVersion` if not already in `common`.
- **Calendar:** `calendar.recentPeriods`, `calendar.noPeriodLogsYet`.
- **Nav:** `nav.menu`, `nav.more` (reuse `nav.*` for the Profile fallback if a suitable key exists, else `common.profile`).
- **Terms:** add a `terms.*` sub-namespace for section titles + body bullets (8+ keys).

**Bengali quality:** match the tone/register of the EXISTING bn strings in `i18n.ts` (formal, natural Bangla). Use the audit's suggested translations as a baseline; the key-adding agent owns producing accurate bn.

## Execution (Opus orchestrator + Sonnet writers)

**Wave 1 — keys first (ONE agent, single file):** add all missing en+bn keys to `packages/shared/src/utils/i18n.ts`, reusing existing keys where present. This agent returns the **definitive key map** (key path → en → bn → which file/string it serves). i18n.ts is edited by exactly one agent to avoid conflicts and to fix the canonical key names.

**Wave 2 — swap strings (parallel, file-disjoint):** each agent owns distinct files and replaces hardcoded strings with `t('<key>')` using the exact keys from Wave 1. Grouping:
- Agent A: `SettingsClient.tsx` + `layout.tsx`
- Agent B: `CalendarClient.tsx` + `PeriodLogModal.tsx`
- Agent C: `OnboardingClient.tsx` + `ProfilesClient.tsx`
- Agent D: `terms/page.tsx`

For label maps (`FLOW_LABELS`, `FLOW_STYLES`), convert the map to store a `labelKey` and resolve via `t(labelKey)` at render (so the map stays static but the displayed text is localized). Preserve all logic, styling, colors, and the design-amplify animations just added.

## Guardrails
- Reuse existing keys; never duplicate. Keep en+bn parity for every new key (the file must stay 1:1).
- Don't touch already-correct translated strings or business logic; this is a string→`t()` swap only.
- Keep `aria-label`s localized too (theme toggle).
- No regressions to the recently-added motion/illustration work in these files.

## Verification
- `cd apps/web && pnpm typecheck` clean (ignore pre-existing `.next/types/validator.ts` route errors).
- Grep the 7 files for the specific English literals (e.g. `'Light'`, `'Recent Periods'`, `'Menu'`, `'ACTIVE'`) → confirm none remain outside comments/keys.
- Confirm i18n.ts `en` and `bn` trees still have equal key counts (parity check).
- Runtime: `just w`, toggle language to বাংলা, visit settings / calendar / onboarding / profiles / period-log modal / terms → verify Bangla renders (no English leakage). Optionally the `ui-review-playwright` skill in bn mode.
```
```
