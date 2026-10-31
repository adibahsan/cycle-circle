import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Providers } from '@/components/Providers';
import { themeBootScript } from '@vesta/shared/utils/theme';
import './globals.css';

// Bundled locally (see ./fonts/README.md) so the build never calls Google Fonts.
const manrope = localFont({
  src: './fonts/manrope-latin-wght.woff2',
  weight: '200 800',
  variable: '--font-display',
  display: 'swap',
});

const notoBengali = localFont({
  src: './fonts/noto-sans-bengali-bengali-wght.woff2',
  weight: '100 900',
  variable: '--font-bengali',
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
