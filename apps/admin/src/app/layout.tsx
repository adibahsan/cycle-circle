import type { Metadata } from 'next';
import { Geist } from 'next/font/google';
import './globals.css';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
});

export const metadata: Metadata = {
  title: 'Vesta Admin',
  description: 'Admin panel for the Vesta reproductive health platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable}>
      <body className="min-h-screen bg-gray-50 font-[var(--font-geist)] antialiased">
        {children}
      </body>
    </html>
  );
}
