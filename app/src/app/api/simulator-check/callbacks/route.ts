import { NextResponse } from 'next/server';
import {
  clearSimulatorEvents,
  disabledResponse,
  isSimulatorCheckerEnabled,
  listSimulatorEvents,
} from '@/server/simulator/checker';

export async function GET() {
  if (!isSimulatorCheckerEnabled()) return disabledResponse();

  return NextResponse.json({ events: listSimulatorEvents() });
}

export async function DELETE() {
  if (!isSimulatorCheckerEnabled()) return disabledResponse();

  clearSimulatorEvents();
  return NextResponse.json({ events: [] });
}
