import {
  disabledResponse,
  isSimulatorCheckerEnabled,
  readJsonBody,
  recordSimulatorEvent,
  successWebhookResponse,
} from '@vesta/shared/server/simulator/checker';

export async function POST(request: Request) {
  if (!isSimulatorCheckerEnabled()) return disabledResponse();

  const payload = await readJsonBody(request);
  const event = recordSimulatorEvent('subscription.notify', payload, request);
  return successWebhookResponse(event);
}
