import { NextResponse } from 'next/server';
import {
  disabledResponse,
  forwardToSimulator,
  isSimulatorCheckerEnabled,
  readJsonBody,
} from '@/lib/simulator-checker';

export async function POST(request: Request) {
  if (!isSimulatorCheckerEnabled()) return disabledResponse();

  try {
    const payload = await readJsonBody(request);
    const result = await forwardToSimulator('/caas/direct/debit', payload);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid CAAS direct debit request.' },
      { status: 400 }
    );
  }
}
