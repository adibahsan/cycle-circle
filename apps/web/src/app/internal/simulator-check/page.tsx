import { notFound } from 'next/navigation';
import { SimulatorCheckClient } from './SimulatorCheckClient';

export const metadata = {
  title: 'BDApps Simulator Checker - Vesta',
};

export default function SimulatorCheckPage() {
  if (process.env.NODE_ENV === 'production' && process.env.ENABLE_BDAPPS_SIMULATOR_CHECKER !== 'true') {
    notFound();
  }

  return <SimulatorCheckClient />;
}
