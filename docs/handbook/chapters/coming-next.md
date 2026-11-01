# Coming next

## Merged but not yet on production {#cn-notes}

### What it is

A short list of changes that are already merged into the `main` branch but are not yet on the production server (the `production` branch). Production is updated by a deploy; until then Users and Admins see the old behaviour. This is the only place in the handbook that describes something production does not do yet.

### Where to find it

This section has no screen of its own. The list was written on 2 November 2026 by comparing the two branches (`git log origin/production..origin/main`). The release history is in [`docs/ops/10-release-log.md`](https://github.com/adibahsan/cycle-circle/blob/main/docs/ops/10-release-log.md), one entry per production release; the newest entry at the time of writing is 2026-11-01 (tag 2.4.1).

### What is waiting

| Change | Who sees it | What changes |
|---|---|---|
| Admin pagination bar on a phone-width window (issue #236) | Admin | On a window narrower than the `sm` breakpoint (a phone, or a very narrow browser window) the bar with the page buttons at the bottom of a list stuck out 8 pixels past the screen edge. That pushed taps a few pixels off target, so for example the select box of a row in the [User list](#us-list) could not be ticked. The bar now fits the page at each width. Nothing changes on a desktop-width window. |

Nothing else is waiting. The other change merged since the last release (issue #229) fixes an automated test of the SMS send time on the [System page](#sy-sms-time) and does not change what anyone sees.

### Rules and limits

- The screens and rules in this handbook describe production as it is today. The change above is not on any screenshot, and none of the chapters depends on it.
- This list goes stale the moment a new release is deployed or a new change is merged. The handbook is rebuilt with each release, and this section should be rewritten then: compare the branches again, keep only what a User or an Admin can see, and delete the rows that have reached production.
- Changes with no visible effect (tests, build and documentation changes) are left out on purpose.

### What can go wrong

| The reader sees | Cause | Fix |
|---|---|---|
| An Admin or User reports behaviour that matches the list above but production does not show it | The change is merged but the deploy has not run | Wait for the next deploy; nothing is broken. The release log shows what is on production |
| A screen differs from this handbook and the difference is not listed here | The handbook is older than the latest release, or a change was merged after this list was written | Trust the screen, tell the team, and check the release log |

### Related

- Release entries and deploy steps: [Ops runbooks](#rl-ops)
