import type { Metadata } from 'next';
import { Manrope, Noto_Sans_Bengali } from 'next/font/google';
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

export const metadata: Metadata = {
  title: 'Vesta - Cycle Intelligence Platform',
  description: 'Bilingual reproductive health & cycle intelligence platform for Bangladesh',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${notoBengali.variable}`} suppressHydrationWarning>
      <body className="min-h-screen font-[var(--font-display)] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
