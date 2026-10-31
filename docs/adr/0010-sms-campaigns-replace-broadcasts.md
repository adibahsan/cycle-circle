# SMS campaigns replace broadcasts, one message per day across all of them

Admins plan SMS as series (for example "Monsoon hygiene, 5 days"), so the unit is a **campaign**: a named series of campaign messages, one per Bangladesh day, with gaps allowed. A one-off SMS is a one-day campaign, and every existing broadcast is migrated into one, so there is a single model and a single history. Every message goes to all subscribers (`tel:all`), so at most one campaign message goes out per Bangladesh day across all campaigns. A clash is refused when the message is planned, not discovered at send time. All messages go out at one daily send time set on the System page; a message has a day, never a time of day. A message has one body in whatever language the admin writes (Bangla, English or mixed), replacing the separate English and Bangla texts. A failed day is marked failed and skipped, never pushing later days back on its own. Decided 2026-10-31.

## Considered Options

- **Keep broadcasts and add a "campaign" label as a rename**: rejected; it gives no per-series results and no way to plan or cancel a series as one thing.
- **A send time on each message, with a cron every few minutes**: rejected; with the one-SMS-a-day rule it buys nothing, and the existing time picker was silently ignored, which misled admins.
- **Separate English and Bangla texts with a send-language switch**: rejected; admins write one message, and the switch made the parts count and preview harder to trust.
