/**
 * Normalize an email for storage and uniqueness comparison: trim whitespace and
 * lowercase. Postgres text columns are case-sensitive, so without this
 * `User@x.com` and `user@x.com` would both satisfy the `@unique` constraint and
 * create duplicate accounts.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}
