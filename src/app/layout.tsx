import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import { headers, cookies } from 'next/headers'
import './globals.css'

import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { SessionProvider } from '@/components/session-provider'
import { Toaster } from 'sonner'
import AnalyticsTracker from '@/components/analytics-tracker'
import { CookieConsent } from '@/components/CookieConsent'
import { CsrfFetchProvider } from '@/components/CsrfFetchProvider'
import { CSRF_HEADER_NAME, CSRF_COOKIE_NAME } from '@/lib/csrf'

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Brand indigo — colours the mobile-Chrome address bar + PWA splash.
  // (Next.js 15 moved themeColor from metadata → viewport export.)
  themeColor: '#4F46E5',
}

export const metadata: Metadata = {
  // Absolute base so relative OG/Twitter image URLs resolve for link scrapers.
  metadataBase: new URL('https://www.earn4insights.com'),
  title: 'Earn4Insights — Consumer Intelligence Infrastructure',
  description: 'The consumer intelligence infrastructure where brands, consumers, and influencers meet — feedback, rewards, and campaigns.',
  icons: {
    // SVG first (any size, sharp). PNG fallbacks for browsers that
    // don't accept SVG favicons (Safari < 14, some embedded webviews).
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-16.png', type: 'image/png', sizes: '16x16' },
    ],
    apple: '/icon-app-192.png',
  },
  openGraph: {
    type: 'website',
    siteName: 'Earn4Insights',
    url: 'https://www.earn4insights.com',
    title: 'Earn4Insights — Consumer Intelligence Infrastructure',
    description: 'The consumer intelligence infrastructure where brands, consumers, and influencers meet — feedback, rewards, and campaigns.',
    // og:image is supplied by app/opengraph-image.tsx (1200×630 card).
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Earn4Insights — Consumer Intelligence Infrastructure',
    description: 'The consumer intelligence infrastructure where brands, consumers, and influencers meet — feedback, rewards, and campaigns.',
    // twitter:image is supplied by app/twitter-image.tsx.
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const hdrs = await headers()
  // Primary source: x-csrf-token request header set by middleware.
  // Fallback source: the e4i-csrf cookie itself (in case middleware
  // didn't set the request header on this render but the cookie was
  // set on a previous request).
  let csrfToken = hdrs.get(CSRF_HEADER_NAME) ?? ''
  if (!csrfToken) {
    const cookieStore = await cookies()
    csrfToken = cookieStore.get(CSRF_COOKIE_NAME)?.value ?? ''
  }
  if (!csrfToken) {
    const path = hdrs.get('x-pathname') ?? hdrs.get('x-invoke-path') ?? hdrs.get('referer') ?? 'unknown'
    console.warn(`[CSRF_META_EMPTY] both header AND cookie missing in layout — path=${path}`)
  }

  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <head>
        <meta name="csrf-token" content={csrfToken} />
      </head>
      {GA_MEASUREMENT_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}', {
                page_path: window.location.pathname,
              });
            `}
          </Script>
        </>
      )}
      <body className="min-h-screen font-body antialiased">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none"
        >
          Skip to main content
        </a>
        <SessionProvider>
          <CsrfFetchProvider />
          <div className="relative flex min-h-dvh flex-col bg-background">
            <SiteHeader />
            <main id="main-content" className="flex-1">{children}</main>
            <SiteFooter />
          </div>
          <Toaster />
          <AnalyticsTracker />
          <CookieConsent />
        </SessionProvider>
      </body>
    </html>
  )
}