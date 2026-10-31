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
