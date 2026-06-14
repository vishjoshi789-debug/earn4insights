import type { MetadataRoute } from 'next'

/**
 * PWA web app manifest.
 *
 * Next.js 15 generates `/manifest.webmanifest` from this file
 * automatically — no need to also create `public/manifest.json`.
 *
 * Brand colours per `public/branding/brand-spec.md` §3:
 *   theme_color  = #4F46E5 (Indigo start) — colours the mobile-Chrome
 *                  address bar + PWA splash header
 *   background_color = #0F0F1A (Near-black) — splash background while
 *                  the app shell loads
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Earn4Insights',
    short_name: 'Earn4Insights',
    description:
      'Consumer intelligence infrastructure connecting brands, their consumers, and influencers.',
    start_url: '/',
    display: 'standalone',
    theme_color: '#4F46E5',
    background_color: '#0F0F1A',
    icons: [
      { src: '/icon-app-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-app-512.png', sizes: '512x512', type: 'image/png' },
      {
        src: '/icon-app-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
