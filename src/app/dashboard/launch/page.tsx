import Link from 'next/link'
import { formatInTimeZone } from 'date-fns-tz'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { auth } from '@/lib/auth/auth.config'
import { getScheduledProductsByOwner } from '@/db/repositories/productRepository'
import LaunchForm from './LaunchForm'

// The brand's scheduled launches list. This component is server-rendered,
// so toLocaleString runs on the Vercel server (UTC) — we can't render
// the brand's wall-clock here without their per-request timezone.
// We explicitly append "(UTC)" so the displayed value is honest.
//
// Follow-up (logged for master fix list): convert to a small client
// component so each brand sees their own wall-clock without needing
// to store a per-product tz column.
function formatScheduledUtc(iso?: string | null): string {
  if (!iso) return 'Not set'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return 'Not set'
  return d.toLocaleString('en-US', {
    timeZone: 'UTC',
    dateStyle: 'medium',
    timeStyle: 'short',
  }) + ' UTC'
}

// Success-banner formatter — receives the saved UTC ISO + the brand's
// captured IANA tz (passed back via query string from the server action).
// formatInTimeZone renders the wall-clock the brand actually picked,
// removing any doubt that the conversion happened correctly.
// Stripe/Calendly pattern.
function formatScheduledInTz(utcIso: string, tz: string): string {
  try {
    return formatInTimeZone(new Date(utcIso), tz, 'MMM d, yyyy, h:mm a')
  } catch {
    // Bad query string — degrade gracefully to the UTC display.
    return formatScheduledUtc(utcIso)
  }
}

export default async function LaunchProductPage({
  searchParams,
}: {
  searchParams: Promise<{ scheduled?: string; at?: string; tz?: string }>
}) {
  const session = await auth()
  const userId = session?.user?.id
  const scheduled = userId ? await getScheduledProductsByOwner(userId) : []
  const params = await searchParams
  const justScheduled = params?.scheduled === '1'
  // Carried by the server action's redirect — see launch.actions.ts.
  // Both are URL-encoded by encodeURIComponent; Next.js auto-decodes
  // searchParams here.
  const scheduledAtIso = params?.at ?? null
  const scheduledTz = params?.tz ?? null

  return (
    <div className="min-h-screen bg-muted/30 py-10">
      <div className="max-w-lg mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Launch a Product</h1>
          <p className="text-muted-foreground">
            Add a new product to start collecting feedback, NPS, and social insights.
          </p>
        </div>

        {justScheduled && (
          <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
            {scheduledAtIso && scheduledTz ? (
              <>
                <div className="font-medium">Scheduled</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Your product will go live at{' '}
                  <span className="font-semibold text-foreground">
                    {formatScheduledInTz(scheduledAtIso, scheduledTz)}
                  </span>{' '}
                  in <span className="font-semibold text-foreground">{scheduledTz}</span>.
                  Brands and consumers won&apos;t see it until then. Cron
                  pickup runs every 15 minutes after this time.
                </div>
              </>
            ) : (
              <>
                Scheduled — your product will go live at the time you picked.
                Brands and consumers won&apos;t see it until then.
              </>
            )}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Product Basics</CardTitle>
          </CardHeader>

          <CardContent>
            <LaunchForm />
          </CardContent>
        </Card>

        {scheduled.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your scheduled launches</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {scheduled.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-foreground truncate">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      Goes live {formatScheduledUtc(p.scheduledLaunchAt)}
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/products/${p.id}`}
                    className="text-xs text-primary hover:underline shrink-0 ml-3"
                  >
                    Manage
                  </Link>
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-1">
                Scheduled products are hidden from consumers, rankings, and search
                until launch time. The publisher runs every 15 minutes, so the
                actual go-live happens within ~15 min of the scheduled time.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
