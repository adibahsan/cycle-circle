import {
  disabledResponse,
  isSimulatorCheckerEnabled,
  readJsonBody,
  recordSimulatorEvent,
  successWebhookResponse,
} from '@/lib/simulator-checker';

export async function POST(request: Request) {
  if (!isSimulatorCheckerEnabled()) return disabledResponse();

  const payload = await readJsonBody(request);
  const event = recordSimulatorEvent('sms.report', payload, request);
  return successWebhookResponse(event);
}
