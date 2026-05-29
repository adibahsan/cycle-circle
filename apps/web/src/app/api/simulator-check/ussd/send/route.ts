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
    const result = await forwardToSimulator('/ussd/send', payload);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Invalid USSD send request.' },
      { status: 400 }
    );
  }
}
