'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[ErrorBoundary]', error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-background dark:to-violet-950/30">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <div className="flex flex-col items-center gap-2">
          {/* Stacked lockup includes the wordmark. */}
          <Logo variant="stacked" width={160} height={120} priority />
          <span className="text-xs text-muted-foreground max-w-[18rem] leading-relaxed">
            The Intelligence Operating System for Brands, Consumers and Influencers
          </span>
        </div>
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
            Something went wrong
          </h1>
          <p className="text-muted-foreground">
            We&apos;re working on fixing this. Please try again.
          </p>
          {error?.digest && (
            <p className="text-xs text-muted-foreground/70 font-mono">
              Error ref: {error.digest}
            </p>
          )}
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={() => reset()} className="w-full sm:w-auto">
            Try Again
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/">Go to Homepage</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
