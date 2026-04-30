import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

import { SiteHeader } from '@/components/site-header'
import { SessionProvider } from '@/components/session-provider'
import { Toaster } from 'sonner'
import AnalyticsTracker from '@/components/analytics-tracker'

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  title: 'Earn4Insights — Intelligence OS for Brands, Consumers & Influencers',
  description: 'The Intelligence Operating System for Brands, Consumers and Influencers.',
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
  },
  openGraph: {
    title: 'Earn4Insights — Intelligence OS for Brands, Consumers & Influencers',
    description: 'The Intelligence Operating System for Brands, Consumers and Influencers.',
    images: [{ url: '/logo.png', width: 512, height: 512, alt: 'Earn4Insights' }],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
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
          <div className="relative flex min-h-dvh flex-col bg-background">
            <SiteHeader />
            <main id="main-content" className="flex-1">{children}</main>
          </div>
          <Toaster />
          <AnalyticsTracker />
        </SessionProvider>
      </body>
    </html>
  )
}