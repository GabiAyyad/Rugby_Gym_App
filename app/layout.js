// Root layout — wraps every page in the app (both /admin and /player trees,
// plus /login and the error/offline screens). Pulls in the two global
// stylesheets and mounts the service-worker registrar once, app-wide.
import { ServiceWorkerRegistrar } from '@/components/shared/ServiceWorkerRegistrar';
import './globals.css';
import '@/styles/components.css';

// PWA metadata: page title, description, and the manifest link that lets a
// phone install this as a standalone app via "Add to Home Screen".
export const metadata = {
  title: 'Rugby Strength',
  description: 'Gym training programs and session logging for the Palestine and Cyprus squads.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Rugby Strength' },
};

export const viewport = {
  themeColor: '#08090c',
  width: 'device-width',
  initialScale: 1,
  // The logging screen is full of number inputs; letting iOS zoom on focus makes
  // it unusable one-handed.
  maximumScale: 1,
  viewportFit: 'cover',
};

// Every route renders inside this <html>/<body> shell. `children` is whatever
// page or nested layout matched the current URL.
export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ minHeight: '100dvh' }}>
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
