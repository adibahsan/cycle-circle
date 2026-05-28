import { NextResponse } from 'next/server';
import {
  callbackUrls,
  checkUrl,
  defaultPayloads,
  disabledResponse,
  isSimulatorCheckerEnabled,
  simulatorConfig,
} from '@vesta/shared/server/simulator/checker';

export async function GET(request: Request) {
  if (!isSimulatorCheckerEnabled()) return disabledResponse();

  const config = simulatorConfig(request);
  const [ui, rest] = await Promise.all([
    checkUrl(config.uiUrl),
    checkUrl(config.restBaseUrl),
  ]);

  return NextResponse.json({
    config,
    callbacks: callbackUrls(request),
    defaults: defaultPayloads(),
    checks: {
      ui,
      rest,
    },
  });
}
