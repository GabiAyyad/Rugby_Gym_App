'use client';

import { useEffect } from 'react';

/**
 * Registers the app-shell service worker so the training screens open with no
 * signal. Silent by design: a failed registration must never break the app.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    // Skip in dev: registering the service worker while iterating locally
    // would cache stale JS/CSS between reloads.
    if (process.env.NODE_ENV !== 'production') return;
    // Older/locked-down browsers may not support service workers at all.
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* offline shell is a bonus, not a requirement */
      });
    };

    // Registering during page load can compete with the page's own network
    // requests, so wait for load to finish first (or register immediately if
    // the page already finished loading before this effect ran).
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);

  return null; // renders nothing — it only has a side effect
}
