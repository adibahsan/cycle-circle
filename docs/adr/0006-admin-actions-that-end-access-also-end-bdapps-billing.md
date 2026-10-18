# Admin actions that end access also end BDApps billing

Under ADR 0002 a user is billed by BDApps for as long as their number is subscribed, whatever our database says. So the three admin actions that take something away from a user — Revoke (Pro → Free), Suspend (no login) and Delete (account hidden) — each also unsubscribe the number on BDApps (`/subscription/send`, action `0`), so we never charge someone for access we have removed. The reverse actions do not re-subscribe: Reactivate and Restore lift only our block, and the user logs in by phone to become a subscriber again. An admin override (Free or Pro) wins over BDApps only until BDApps reports a new subscription for that number; then it ends and the number's real status applies, so a revoked user who pays again gets Pro. A deleted account can be restored for 30 days; after that a nightly job purges the user, their profiles and logs, leaving one translog line. Decided 2026-10-19.

## Considered Options

- **Override only, leave BDApps alone**: rejected; the user keeps paying for Pro they no longer get, which means complaints and carrier disputes.
- **Sticky Free override that survives re-subscription**: rejected for the same reason; Suspend is the tool for keeping someone out.
- **Keep deleted health data forever, hidden**: rejected; it is a privacy liability with no use once the user is gone.
