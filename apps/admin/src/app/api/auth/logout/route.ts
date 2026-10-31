import { NextResponse } from 'next/server'
import { logoutAdmin } from '@vesta/shared/server/auth'
import { requestIp } from '@vesta/shared/server/request-ip'

export async function POST(request: Request) {
  await logoutAdmin(new Date(), requestIp(request))
  return NextResponse.json({ success: true })
}
