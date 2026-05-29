import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import { Providers } from '@/components/Providers';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Vesta Admin',
  description: 'Admin panel for the Vesta reproductive health platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={manrope.variable} suppressHydrationWarning>
      <body className="min-h-screen font-[var(--font-display)] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
