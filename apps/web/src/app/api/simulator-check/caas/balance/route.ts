import { NextResponse } from 'next/server';
import {
  disabledResponse,
  forwardToSimulator,
  isSimulatorCheckerEnabled,
  readJsonBody,
} from '@vesta/shared/server/simulator/checker';

export async function POST(request: Request) {
  if (!isSimulatorCheckerEnabled()) return disabledResponse();

  try {
    const payload = await readJsonBody(request);
    const result = await forwardToSimulator('/caas/balance/query', payload);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid CAAS balance request.' },
      { status: 400 }
    );
  }
}
