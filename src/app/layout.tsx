import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { SessionProvider } from '@/components/session-provider'
import { Toaster } from 'sonner'

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Earn4Insights - Customer Intelligence Platform',
  description: 'Turn customer feedback into product success. Launch products with confidence through real-time insights and rankings.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen font-body antialiased">
        <SessionProvider>
          <div className="relative flex min-h-dvh flex-col bg-background">
            <SiteHeader />
            <main className="flex-1">{children}</main>
          </div>
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  )
}