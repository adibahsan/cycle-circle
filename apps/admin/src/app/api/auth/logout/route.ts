import { NextResponse } from 'next/server'
import { logoutAndBlacklist } from '@vesta/shared/server/auth'

export async function POST() {
  await logoutAndBlacklist()
  return NextResponse.json({ success: true })
}
