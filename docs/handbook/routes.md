# Handbook route coverage

Read by `pnpm handbook:check`. Every page of the User app (`apps/web/src/app/**/page.tsx`) and the Admin app (`apps/admin/src/app/**/page.tsx`) must appear in exactly one of the two tables below. A page is "referenced by the handbook" when it is listed under Covered with the anchor of the section that explains it (the anchor must exist in a chapter). API routes (`route.ts`) are not pages and are not checked.

- Route: the URL path; route groups like `(main)` are dropped and dynamic segments stay as `[id]`.
- App: `user` (apps/web) or `admin` (apps/admin).
- Add a row when you add a page. The check also fails when a row names a page that no longer exists.

## Covered

| Route | App | Section |
|---|---|---|
| `/` | user | `gs-welcome` |
| `/welcome` | user | `gs-welcome` |
| `/get-started` | user | `gs-get-started` |
| `/terms` | user | `gs-terms` |
| `/privacy` | user | `gs-privacy` |
| `/login` | user | `gs-phone-login` |
| `/verify-otp` | user | `gs-phone-login` |
| `/email-login` | user | `gs-email-login` |
| `/onboarding` | user | `gs-onboarding` |
| `/dashboard` | user | `db-hero` |
| `/calendar` | user | `lc-calendar` |
| `/symptoms` | user | `sc-symptoms` |
| `/insights` | user | `in-overview` |
| `/profiles` | user | `pf-list` |
| `/content` | user | `ct-learn` |
| `/content/[id]` | user | `ct-reader` |
| `/subscription` | user | `sb-status` |
| `/settings` | user | `st-overview` |
| `/feedback` | user | `fb-send` |
| `/login` | admin | `aa-sign-in` |
| `/forbidden` | admin | `aa-forbidden` |
| `/` | admin | `ov-kpis` |
| `/users` | admin | `us-list` |
| `/users/[id]` | admin | `us-detail` |
| `/subscriptions` | admin | `su-list` |
| `/content` | admin | `ac-list` |
| `/content/new` | admin | `ac-editor` |
| `/content/[id]` | admin | `ac-editor` |
| `/analytics` | admin | `an-ranges` |
| `/engagement` | admin | `en-panels` |
| `/sms` | admin | `sm-list` |
| `/sms/[id]` | admin | `sm-messages` |
| `/emails` | admin | `em-log` |
| `/emails/[id]` | admin | `em-detail` |
| `/emails/preview` | admin | `em-preview` |
| `/feedback` | admin | `af-inbox` |
| `/feedback/[id]` | admin | `af-detail` |
| `/audit-logs` | admin | `au-search` |
| `/logs` | admin | `lg-viewer` |
| `/system` | admin | `sy-jobs` |
| `/system/runs/[id]` | admin | `sy-run-detail` |
| `/api-docs` | admin | `rl-api-docs` |

## Excluded

Internal or developer-only pages that Users and Admins never see. The dev "sign in as admin" button is part of the Admin login page, not a page, and is explained in `aa-sign-in`.

| Route | App | Why |
|---|---|---|
| `/internal/backend-checklist` | user | Developer-only backend checklist |
| `/internal/dependency-graph` | user | Developer-only dependency graph |
| `/internal/simulator-check` | user | Developer-only BDApps simulator check |
