import type { Metadata } from 'next'
import './globals.css'

import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { SessionProvider } from '@/components/session-provider'

export const metadata: Metadata = {
  title: 'Earn4Insights - Consumer Intelligence Platform',
  description: 'Get paid for your feedback. Help brands improve while earning rewards.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen font-body antialiased">
        <SessionProvider>
          <div className="relative flex min-h-dvh flex-col bg-background">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </SessionProvider>
      </body>
    </html>
  )
}