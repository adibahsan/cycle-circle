/**
 * The 11-digit local form (`01XXXXXXXXX`) that phone fields show and the OTP routes
 * accept. Stored numbers are `+8801…`; BDApps uses `tel:8801…`. Stripping non-digits
 * alone would keep the `88` and cut the number short (`+8801805718862` → `88018057188`).
 */
export function toLocalPhone(raw: string | null | undefined): string {
  const digits = (raw ?? '').replace(/\D/g, '')
  const local = digits.startsWith('880') ? `0${digits.slice(3)}` : digits
  return local.slice(0, 11)
}
