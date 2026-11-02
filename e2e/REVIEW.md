# Reviewing E2E diffs

Judgement rules only. The linter already enforces: no `waitForTimeout`, no raw/CSS locators
without a reasoned disable, no `force`, no `.only`/unexplained skips, and an issue URL on every
`test.fail` / `test.fixme`. Check the rest here.

1. **Negative assertions follow a settled positive signal.** `not.toBeVisible()`, `toHaveCount(0)`
   or "no email arrived" only after something that proves the page or system finished (the
   success toast, the row that must be there, a polled call that did arrive). Otherwise it passes
   before the thing it guards against could have happened. Its locator must also be one this
   spec shows matching when the element is there (same role and name, e.g. a `/^Add/` button
   clicked elsewhere): a locator that never matches passes forever.
2. **Assert on this test's own data.** Put a unique marker (run id, per-test phone/email) in what
   the test creates, and filter recorded fake-BDApps calls and Mailpit emails by this user. Never
   assert a global count, "the latest email", or "the only row": parallel workers share the slot.
3. **UI after reload beats the DB.** Prove a result by reloading and reading the screen. Query the
   DB only for outcomes with no screen (audit rows, soft-delete flags, stored hashes), and say so
   in a comment.
4. **Setup dates come from the days helper.** Use `days.dateOf(...)` / `days.daysAgo(...)`. No
   `new Date()` day arithmetic: the server runs at UTC but the product counts Bangladesh days (ADR 0007).
   A seeded instant the app compares with its own clock (`publishedAt`, a schedule) sits clearly in
   the past or future, never "now": a parallel worker's request takes its `now` first and the row
   reads as not yet live (and a 60 s list cache keeps that answer).
5. **Scripted fake-BDApps failures carry a scoped `match`.** A bare "fail the next call" hits
   whichever test calls first. Scope it to this test's phone/endpoint.
6. **Expected failures are deterministic and linked.** `test.fail(cond, url)` where `cond` is
   constant `true` or a real guard such as `days.serverDayLags`; if the bug is a race no
   condition predicts, use `test.fixme` instead (an expected-fail would pass at random). The
   linked issue must be open, and the test's comment must say what the correct behaviour is.
7. **Global-state specs run in the serial `cron` project.** Anything that touches every Pro user,
   every soft-deleted user, the fake `/health` queue or broadcast dispatch goes in
   `CRON_SERIAL_SPECS`, not a parallel project.
8. **A disable comment must say why no role/name exists**, with an issue number when one tracks
   adding an accessible name. "Easier" is not a reason.
