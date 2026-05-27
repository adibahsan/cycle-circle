import type { Metadata } from 'next';
import { Providers } from '@/components/Providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vesta - Cycle Intelligence Platform',
  description: 'Bilingual reproductive health & cycle intelligence platform for Bangladesh',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@300..800&family=Noto+Sans+Bengali:wght@300..800&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen font-[var(--font-display)] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
