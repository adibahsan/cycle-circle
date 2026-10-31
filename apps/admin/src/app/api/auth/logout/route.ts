import { NextResponse } from 'next/server'
import { ADMIN_AUDIENCE, logoutAndBlacklist } from '@vesta/shared/server/auth'

export async function POST() {
  await logoutAndBlacklist(new Date(), ADMIN_AUDIENCE)
  return NextResponse.json({ success: true })
}
