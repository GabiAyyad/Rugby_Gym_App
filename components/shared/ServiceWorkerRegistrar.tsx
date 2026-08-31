'use client';

import { useEffect } from 'react';

/**
 * Registers the app-shell service worker so the training screens open with no
 * signal. Silent by design: a failed registration must never break the app.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* offline shell is a bonus, not a requirement */
      });
    };

    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null;
}
