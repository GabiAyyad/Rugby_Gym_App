import type { Metadata, Viewport } from 'next';
import { ServiceWorkerRegistrar } from '@/components/shared/ServiceWorkerRegistrar';
import './globals.css';

export const metadata: Metadata = {
  title: 'Rugby Strength',
  description: 'Gym training programs and session logging for the Palestine and Cyprus squads.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Rugby Strength' },
};

export const viewport: Viewport = {
  themeColor: '#08090c',
  width: 'device-width',
  initialScale: 1,
  // The logging screen is full of number inputs; letting iOS zoom on focus makes
  // it unusable one-handed.
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
