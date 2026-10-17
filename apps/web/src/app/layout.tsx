import type { Metadata, Viewport } from 'next';
import { Manrope, Noto_Sans_Bengali } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Providers } from '@/components/Providers';
import { cookies } from 'next/headers';
import { themeBootScript } from '@vesta/shared/utils/theme';
import { LANG_COOKIE, langBootScript, parseLang } from '@/lib/language';
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
  weight: ['400', '500', '600', '700', '800'],
});

const siteUrl = 'https://test-vesta.velirasolutions.com';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Cycle Circle — Cycle Intelligence Platform',
    template: '%s | Cycle Circle',
  },
  description:
    'Bilingual reproductive health & cycle intelligence for Bangladesh. Track periods, symptoms, and predictions across family profiles.',
  keywords: [
    'cycle tracking',
    'period tracker',
    'reproductive health',
    'Bangladesh',
    'Bengali',
  ],
  authors: [{ name: 'Cycle Circle' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: 'bn_BD',
    url: siteUrl,
    siteName: 'Cycle Circle',
    title: 'Cycle Circle — Cycle Intelligence Platform',
    description:
      'Bilingual reproductive health & cycle intelligence for Bangladesh.',
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'Cycle Circle',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Cycle Circle — Cycle Intelligence Platform',
    description:
      'Bilingual reproductive health & cycle intelligence for Bangladesh.',
    images: ['/opengraph-image.png'],
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = parseLang((await cookies()).get(LANG_COOKIE)?.value);
  return (
    <html lang={lang} className={`${manrope.variable} ${notoBengali.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript('vesta-store') }} />
        <script dangerouslySetInnerHTML={{ __html: langBootScript('vesta-store') }} />
      </head>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <Providers initialLanguage={lang}>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
