import { cookies } from 'next/headers';
import { MainShell } from '@/components/shell/MainShell';
import { getShellInitial } from '@/app/queries/shell-queries';

// Passed unawaited: the shell and the page's loading.tsx stream immediately, and the
// account/logging/completion data resolves into the shell without extra client round trips.
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  // e2e only: the browser-side API mocks (e2e/guards/helpers.ts mockApi) need the shell to fetch client-side.
  const clientShell =
    process.env.NODE_ENV !== 'production' && (await cookies()).has('vesta_e2e_client_shell');
  return <MainShell initial={clientShell ? undefined : getShellInitial()}>{children}</MainShell>;
}
