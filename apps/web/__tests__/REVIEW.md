# Reviewing DB-backed unit tests

Judgement rules for tests that hit the test database (`helpers/test-db`). Every test file runs in
parallel against **one** database, so a test that leans on anything it didn't create fails at
random. `helpers/unique-test-phones.test.ts` already enforces unique literal phones; check the rest here.

1. **Own your rows.** Create the users, admins, articles and settings the test needs, with ids
   prefixed per file (`test-<file>-…`), and delete only those in cleanup. Never borrow an
   existing row (`findFirst({ where: { role: 'ADMIN' } })`): another file may delete it mid-test.
2. **Assert on this file's data.** A service that scans everything (every subscriber, every
   planned message, "the latest run") sees other files' rows. Filter the result to this file's
   ids before asserting, and never assert a global count, "first", or "latest".
3. **Stubs touch only this file's ids.** A fake BDApps or status stub answers for this file's
   subscribers and fails loudly for any other id, so a global job run here leaves other files'
   data alone.
4. **Order is explicit.** When a test relies on the order of a list (including a relation loaded
   with `include`), the service query states its `orderBy`. Postgres returns unordered rows in
   any order.
5. **Global settings rows are restored.** A test that flips a shared setting (a cron switch, the
   Pro price) restores it in `finally`, and the assertion doesn't depend on another file's value.
6. **Whole-table services run serial.** When the service under test needs every row of a table
   (reorder demanding the full category set, a global count), rule 2 can't hold. List the file in
   `SERIAL` in `apps/web/vitest.config.ts` so no other file writes that table while it runs.
7. **One clock per test.** Every instant the test writes or passes is either fixed (a literal
   date) or derived from one `now`; never seed with `new Date()` and then act at fixed dates.
   A view recorded at a fixed 2026 instant on an article published at the real clock went red
   the day the real clock passed that instant (article-views, 2026-11-01).
