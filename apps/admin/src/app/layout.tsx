import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import { Providers } from '@/components/Providers';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const siteUrl = 'https://test-vesta-admin.velirasolutions.com';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Cycle Circle Admin',
    template: '%s | Cycle Circle Admin',
  },
  description: 'Admin panel for the Cycle Circle reproductive health platform',
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={manrope.variable} suppressHydrationWarning>
      <body className="min-h-screen font-[var(--font-display)] antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
