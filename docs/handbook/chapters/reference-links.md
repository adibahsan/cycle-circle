# Links

Links go to the repository on GitHub (branch `main`); each row also names the file path, so the file can be found in a local copy. The documents are written for the team that runs the server and the code. They are English and plain Markdown, and some are more technical than this handbook.

## Ops runbooks {#rl-ops}

### What it is

The server operations documents. Use them when a problem in [Troubleshooting](#ts-index) says "ask the server owner": they describe the server, the deploys, the environment settings, the host crontab and the incident checklists.

### Where to find it

In the repository folder `docs/ops/`, starting with `docs/ops/README.md` (the server inventory and a table of the documents). This section has no screen of its own.

### Links

| Document | Covers |
|---|---|
| [`docs/ops/README.md`](https://github.com/adibahsan/cycle-circle/blob/main/docs/ops/README.md) | Start here: server inventory and the index of the documents below |
| [`docs/ops/01-access.md`](https://github.com/adibahsan/cycle-circle/blob/main/docs/ops/01-access.md) | SSH, users and keys, the Contabo portal, lockout recovery, credential rotation |
| [`docs/ops/02-server-setup.md`](https://github.com/adibahsan/cycle-circle/blob/main/docs/ops/02-server-setup.md) | Server bootstrap and hardening runbook |
| [`docs/ops/03-deployment.md`](https://github.com/adibahsan/cycle-circle/blob/main/docs/ops/03-deployment.md) | How a deploy to the server works (Docker Compose), including the routine deploy |
| [`docs/ops/04-env-reference.md`](https://github.com/adibahsan/cycle-circle/blob/main/docs/ops/04-env-reference.md) | Every environment variable, what it does and which app needs it |
| [`docs/ops/05-operations.md`](https://github.com/adibahsan/cycle-circle/blob/main/docs/ops/05-operations.md) | Day-to-day runbook: health check, logs, restarts, backups and restore, updates, the host crontab, incident checklists |
| [`docs/ops/06-merge-to-main-runbook.md`](https://github.com/adibahsan/cycle-circle/blob/main/docs/ops/06-merge-to-main-runbook.md) | Merging the deploy stack into `main` |
| [`docs/ops/07-dns-and-env-runbook.md`](https://github.com/adibahsan/cycle-circle/blob/main/docs/ops/07-dns-and-env-runbook.md) | Public DNS checks and the environment files on the server |
| [`docs/ops/08-logging.md`](https://github.com/adibahsan/cycle-circle/blob/main/docs/ops/08-logging.md) | Log channels, file layout, retention, how to read logs on the server |
| [`docs/ops/09-bdapps-subscriptions.md`](https://github.com/adibahsan/cycle-circle/blob/main/docs/ops/09-bdapps-subscriptions.md) | How a User's plan is decided, masked subscriber ids, checking or changing a subscription by hand, BDApps error codes |
| [`docs/ops/10-release-log.md`](https://github.com/adibahsan/cycle-circle/blob/main/docs/ops/10-release-log.md) | One entry per production release: what shipped and how it was verified |

The documents above are the ones to read first. The folder also holds deploy and monitoring file checklists and the BDApps API test reports.

### Rules and limits

- The runbooks describe the server as it was when each document was last edited. When a runbook and the code disagree, the code is right; the chapters of this handbook say so where they found a difference (for example the host crontab in [Scheduled jobs](#sj-overview)).
- Server credentials are not in these documents or in this handbook. Ask the server owner.

### Related

- Reading logs on the server: [Troubleshooting index](#ts-index)
- BDApps error codes: [BDApps health](#ts-login)
- The host crontab: [Jobs at a glance](#sj-overview)

## Decision records {#rl-adr}

### What it is

Architecture decision records (ADRs): short notes that explain why the product works the way it does. Each chapter of this handbook that depends on one names it, for example ADR 0006 in [Plans and access](#pa-admin-overrides).

### Where to find it

In the repository folder `docs/adr/`. This section has no screen of its own.

### Links

| ADR | What it decides |
|---|---|
| [ADR 0001](https://github.com/adibahsan/cycle-circle/blob/main/docs/adr/0001-cycle-circle-rename-is-user-facing-only.md) | The rename to Cycle Circle changed only what Users see; internal names stay "vesta" |
| [ADR 0002](https://github.com/adibahsan/cycle-circle/blob/main/docs/adr/0002-phone-login-is-the-bdapps-subscription.md) | Logging in by phone subscribes the number; Pro means "registered on BDApps"; masked ids; App OTP for existing Subscribers |
| [ADR 0003](https://github.com/adibahsan/cycle-circle/blob/main/docs/adr/0003-ui-language-lives-in-a-cookie.md) | The language choice is a cookie, so the server can render it |
| [ADR 0004](https://github.com/adibahsan/cycle-circle/blob/main/docs/adr/0004-server-logs-are-dated-files-per-channel.md) | Six log channels, one dated file per Bangladesh day, retention |
| [ADR 0005](https://github.com/adibahsan/cycle-circle/blob/main/docs/adr/0005-portal-redesign-borrows-the-look-not-the-data.md) | The look of the portal redesign, not the reference data |
| [ADR 0006](https://github.com/adibahsan/cycle-circle/blob/main/docs/adr/0006-admin-actions-that-end-access-also-end-bdapps-billing.md) | Revoke, Suspend and Delete also unsubscribe the number on BDApps |
| [ADR 0007](https://github.com/adibahsan/cycle-circle/blob/main/docs/adr/0007-auth-tokens-scoped-per-app-and-environment.md) | Why a web session cannot open the Admin panel and the other way round |
| [ADR 0008](https://github.com/adibahsan/cycle-circle/blob/main/docs/adr/0008-dates-are-bangladesh-days-not-device-days.md) | Every date is a Bangladesh day |
| [ADR 0009](https://github.com/adibahsan/cycle-circle/blob/main/docs/adr/0009-services-take-now-only-the-edge-reads-the-clock.md) | Developer rule: only the edge reads the clock |
| [ADR 0010](https://github.com/adibahsan/cycle-circle/blob/main/docs/adr/0010-sms-campaigns-replace-broadcasts.md) | SMS campaigns: one message per Bangladesh day across all campaigns |
| [ADR 0011](https://github.com/adibahsan/cycle-circle/blob/main/docs/adr/0011-pro-price-is-admin-set-not-read-from-bdapps.md) | The Pro price is set by an Admin; revenue is an estimate |

### Rules and limits

- An ADR records a decision and its reasons at the time. Several have dated amendments at the end (ADR 0002 and ADR 0008 do); read those too.
- The glossary terms in this handbook come from `GLOSSARY.md` ([Glossary](#gl-terms)); a new term goes into the glossary first.

### Related

- [Glossary](#gl-terms)
- [Suspend and reactivate](#us-suspend)

## Local development {#rl-local-dev}

### What it is

The guide for running Cycle Circle on a developer's own computer: Docker for the database, mail catcher and the BDApps simulator, and the web and Admin apps on the machine itself.

### Where to find it

[`docs/LOCAL-DEVELOPMENT.md`](https://github.com/adibahsan/cycle-circle/blob/main/docs/LOCAL-DEVELOPMENT.md). This section has no screen of its own.

### Rules and limits

- It is for developers. Support staff and Admins never need it to use the product.
- The local setup never talks to the real BDApps: it uses the simulator, and OTPs and emails stay on the machine. A problem that appears locally does not show that production is affected, and the other way round.

### Related

- [`docs/EMAIL-TESTING-GUIDE.md`](https://github.com/adibahsan/cycle-circle/blob/main/docs/EMAIL-TESTING-GUIDE.md): trying the emails locally ([Emails catalogue](#ec-overview))
- [Handbook README](https://github.com/adibahsan/cycle-circle/blob/main/docs/handbook/README.md): how to change this handbook and rebuild it

## Admin API docs {#rl-api-docs}

### What it is

The Admin app has its own reference page for the Admin API (Swagger UI). It is for developers and integrators; the Admin pages in this handbook cover everything an Admin does by hand.

### Where to find it

**API Docs** in the Admin sidebar, or `/api-docs` on the Admin address ([Admin navigation](#aa-navigation)). An Admin has to be signed in. The page lists the endpoints and shows the formats; its "Try it out" mode is not switched on by default. The specification itself is the file `apps/admin/public/openapi.yaml`. This section has no screen of its own.

### Related

- [Signing in](#aa-sign-in)
