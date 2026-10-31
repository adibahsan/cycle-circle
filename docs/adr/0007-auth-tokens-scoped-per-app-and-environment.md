# Auth tokens are scoped per app and per environment

Web and admin used to share one `JWT_SECRET` and sign the same untyped HS256 token (no `aud`, no `iss`). Anyone holding a token, or the public local default secret, could present it to the other app or to another environment that had the same secret. A token from a local or staging install was valid on production if the secret matched, and an ADMIN-role token was accepted by web API routes because `verifyAuth()` never checked who the token was for. Decided 2026-10-25.

Every token now carries an audience and an issuer, and both are checked on every verification (the web and admin proxies, `verifyAuth`, `requireAuth`, `requireAdminAuth`, logout):

- **Audience per app:** `vesta-web` or `vesta-admin`. The app that signs a token decides it in code (web login routes use web, the admin login uses admin), never from env. Each app accepts only its own, so an admin token is rejected by web and a web token, even for an ADMIN user, is rejected by admin.
- **Issuer per environment:** `vesta:<APP_ENV>`, where `APP_ENV` is `local`, `staging` or `production` (default `local`). A token minted anywhere else is rejected.
- **Separate secrets:** web and admin each have their own `JWT_SECRET` in every environment. Nothing needs them shared; admin reaches web only with `CRON_SECRET`, never with a JWT.
- **Prod guard:** env validation fails at start-up when `APP_ENV` is `production` or `staging` and `JWT_SECRET` starts with `local-dev`. `AUTH_COOKIE_NAME` has no default any more, so admin cannot fall back to the web cookie name.

Logout (`jti` blacklist) and `sessionsValidAfter` revocation are unchanged.

## Consequences

- Every existing session, web and admin, is invalidated once on deploy: old tokens have no `aud`/`iss`. Users log in again.
- The VPS needs `APP_ENV=production` in both app env files and a new, distinct admin `JWT_SECRET` (`openssl rand -hex 32`). Both apps refuse to start without `AUTH_COOKIE_NAME`.
- Local `.env.local` files need `AUTH_COOKIE_NAME` and, for admin, a `JWT_SECRET` different from web's.
- `APP_ENV` is separate from `NODE_ENV`: a production build with `APP_ENV` unset still runs as `local`, so the deploy check (`ops/deploy/scripts/check-prod-env.sh`) requires it.

## Considered Options

- **Keep one shared secret, add only `aud`:** rejected; one leaked secret still signs tokens for both apps and every environment that reuses it.
- **Audience from an env var:** rejected; a mis-set env var would reopen the hole the audience closes.
- **Check `role` instead of `aud` in web:** rejected; it only blocks ADMIN tokens, not tokens from another environment, and relies on every route remembering to check.
