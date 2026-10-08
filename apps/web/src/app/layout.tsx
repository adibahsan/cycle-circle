import type { Metadata } from 'next';
import { Manrope, Noto_Sans_Bengali } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Providers } from '@/components/Providers';
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
  weight: ['300', '400', '500', '600', '700', '800'],
});

const siteUrl = 'https://test-vesta.velirasolutions.com';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: 'Vesta — Cycle Intelligence Platform',
    template: '%s | Vesta',
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
  authors: [{ name: 'Vesta Health' }],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    alternateLocale: 'bn_BD',
    url: siteUrl,
    siteName: 'Vesta',
    title: 'Vesta — Cycle Intelligence Platform',
    description:
      'Bilingual reproductive health & cycle intelligence for Bangladesh.',
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: 'Vesta',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vesta — Cycle Intelligence Platform',
    description:
      'Bilingual reproductive health & cycle intelligence for Bangladesh.',
    images: ['/opengraph-image.png'],
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${notoBengali.variable}`} suppressHydrationWarning>
      <body className="min-h-screen antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
