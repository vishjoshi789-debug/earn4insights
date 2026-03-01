import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
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
  title: 'Earn4Insights — Real Voices. Measurable Intelligence.',
  description: 'Where consumer voice powers better products. Multimodal and multilingual feedback transformed into real-time product intelligence — helping brands build smarter and consumers shape the products they use.',
  openGraph: {
    title: 'Earn4Insights — Real Voices. Measurable Intelligence.',
    description: 'Where consumer voice powers better products. Multimodal feedback, multilingual intelligence, real-time analytics and personalized recommendations.',
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
        <SessionProvider>
          <div className="relative flex min-h-dvh flex-col bg-background">
            <SiteHeader />
            <main className="flex-1">{children}</main>
          </div>
          <Toaster />
          <AnalyticsTracker />
        </SessionProvider>
      </body>
    </html>
  )
}