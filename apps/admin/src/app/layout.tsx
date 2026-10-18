import type { Metadata } from 'next';
import { Manrope, Noto_Sans_Bengali } from 'next/font/google';
import { Providers } from '@/components/Providers';
import { themeBootScript } from '@vesta/shared/utils/theme';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const notoBengali = Noto_Sans_Bengali({
  subsets: ['bengali'],
  variable: '--font-bengali',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
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
    <html lang="en" className={`${manrope.variable} ${notoBengali.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript('vesta-admin-store') }} />
      </head>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
