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
    default: 'Vesta Admin',
    template: '%s | Vesta Admin',
  },
  description: 'Admin panel for the Vesta reproductive health platform',
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={manrope.variable} suppressHydrationWarning>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
