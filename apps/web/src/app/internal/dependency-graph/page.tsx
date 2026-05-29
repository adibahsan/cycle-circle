import { notFound } from 'next/navigation';
import DependencyGraphClient from './DependencyGraphClient';

export const dynamic = 'force-dynamic';

export default function DependencyGraphPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return <DependencyGraphClient />;
}
