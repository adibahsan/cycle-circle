# The Pro price is set by an admin, not read from BDApps

BDApps does the charging (ADR 0002) but tells us neither the price nor what it actually charged, and the code had drifted to three different prices (৳99/month, ৳5/day, 2 BDT). So an admin sets the **Pro price**: an amount and a period (daily, weekly or monthly). It is the single source for what the customer app shows (the subscription page, the upgrade confirmation, the Terms, in English and Bangla) and for estimated revenue. Every change is kept with the day it took effect, so a past period is counted at the price in effect then, and every change writes an audit row. Changing it does **not** change what BDApps charges; the edit screen says so, and keeping the two equal is the admin's job. Decided 2026-10-31.

## Considered Options

- **Hard-code the price in the translations**: rejected; that is how three prices came about, and a price change would need a deploy.
- **Record real charges from BDApps notifications**: preferred if BDApps ever sends charge amounts; not available today, so revenue is labelled "estimated" until then.
