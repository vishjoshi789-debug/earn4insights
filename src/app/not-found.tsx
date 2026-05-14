import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/logo'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12 bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-background dark:to-violet-950/30">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <div className="flex flex-col items-center gap-1">
          <Logo size={56} />
          <span className="font-headline font-bold text-lg">Earn4Insights</span>
          <span className="text-[10px] text-muted-foreground max-w-[16rem] leading-tight">
            The Intelligence Operating System for Brands, Consumers and Influencers
          </span>
        </div>
        <div className="space-y-2">
          <p className="text-7xl font-bold tracking-tight text-primary md:text-8xl">404</p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Page not found
          </h1>
          <p className="text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild className="w-full sm:w-auto">
            <Link href="/">Go to Homepage</Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
