'use server'

import { redirect } from 'next/navigation'
import { fromZonedTime } from 'date-fns-tz'
import { Product } from '@/lib/types/product'
import { initializeProductData } from '@/lib/product/initProduct'
import { createProduct } from '@/db/repositories/productRepository'
import { triggerProductLaunchNotifications } from '@/lib/personalization/smartDistributionService'
import { notifyWatchersOnLaunch } from '@/server/watchlistService'
import { auth } from '@/lib/auth/auth.config'
import { sendProductLaunchedEmail } from '@/server/productNotifications'

// Returns true when `tz` is a real IANA zone the runtime can use.
// Invalid zones make Intl.DateTimeFormat throw RangeError.
function isValidIanaTimezone(tz: string): boolean {
  if (!tz) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date())
    return true
  } catch {
    return false
  }
}

export async function launchProduct(formData: FormData) {
  // Auth guard — must be a logged-in brand. Without a session we can't
  // assign ownership, which leaves the product orphaned and unfindable
  // in the brand's own dashboard.
  const session = await auth()
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/dashboard/launch')
  }
  // Defense in depth — middleware already gates the page, but server actions
  // can be invoked via direct form POST. Refuse any non-brand session here
  // so consumers / admins can't create products by tampering with the form.
  const role = (session.user as any).role
  if (role !== 'brand') {
    throw new Error('Only brand accounts can launch products')
  }
  const userId = session.user.id
  const userEmail = session.user.email
  const userName = session.user.name

  const productName = formData.get('name') as string
  const platform = formData.get('platform') as string
  const domain = formData.get('domain') as string
  const description = formData.get('description') as string
  const launchType = (formData.get('launchType') as string) || 'instant'
  const scheduledAtRaw = formData.get('scheduledAt') as string | null
  const scheduledAtTzRaw = (formData.get('scheduledAtTz') as string | null)?.trim() ?? ''

  // Parse and validate the scheduled time before we touch the DB.
  //
  // The form value is a naive yyyy-MM-ddTHH:mm string from
  // <input type="datetime-local"> — no zone info. The brand picks
  // "May 31, 09:00" in their head meaning their wall-clock; we must
  // interpret it in their IANA timezone, NOT the server's (which is
  // UTC on Vercel, so the old new Date(naiveStr) was 5h30 off for IST).
  //
  // scheduledAtTz comes from a hidden field captured at form-mount via
  // Intl.DateTimeFormat().resolvedOptions().timeZone. fromZonedTime
  // (date-fns-tz) handles DST and other edges correctly.
  //
  // Fallback: if scheduledAtTz is missing/invalid (rare — JS off,
  // stale cached page), interpret as UTC and log a [LaunchTZ] warning
  // so we can see how often the fallback fires.
  //
  // Audit ref: Pass 2 C2 / A5.
  let scheduledAt: Date | null = null
  let resolvedTz: string = ''
  let launchStatus: 'live' | 'scheduled' = 'live'
  if (launchType === 'scheduled') {
    if (!scheduledAtRaw) {
      throw new Error('Scheduled launch requires a date and time')
    }

    let parsed: Date
    if (scheduledAtTzRaw && isValidIanaTimezone(scheduledAtTzRaw)) {
      // Happy path — interpret the wall-clock string in the brand's TZ.
      parsed = fromZonedTime(scheduledAtRaw, scheduledAtTzRaw)
      resolvedTz = scheduledAtTzRaw
      console.log(`[LaunchTZ] tz=${scheduledAtTzRaw} local=${scheduledAtRaw} utc=${parsed.toISOString()}`)
    } else {
      // Fallback — server-local (UTC on Vercel) interpretation.
      parsed = new Date(scheduledAtRaw)
      resolvedTz = 'UTC'
      console.warn(`[LaunchTZ] no/invalid tz="${scheduledAtTzRaw}" — falling back to UTC interpretation of local="${scheduledAtRaw}"`)
    }

    if (isNaN(parsed.getTime())) {
      throw new Error('Invalid scheduled launch date')
    }
    if (parsed.getTime() <= Date.now() - 30_000) {
      throw new Error('Scheduled launch time must be in the future')
    }
    scheduledAt = parsed
    launchStatus = 'scheduled'
  }

  const product: Product = {
    id: crypto.randomUUID(),
    name: productName,
    description: description || undefined,
    platform: platform || undefined,
    // Set ownership so the product shows up in the brand's own queries
    // (getProductsByOwner, my-products endpoints, ICP/feature dropdowns).
    // Previously omitted, leaving products as orphans.
    ownerId: userId,
    createdBy: userId,
    created_at: new Date().toISOString(),
    launchStatus,
    scheduledLaunchAt: scheduledAt?.toISOString(),
    features: {
      nps: true,
      feedback: true,
      social_listening: true,
    },
    profile: {
      currentStep: 1,
      isComplete: false,
      data: {
        category: 'TECH_SAAS',
        branding: {
          primaryColor: '#6366f1',
        },
        productDetails: {
          description: description || undefined,
          website: domain || undefined,
        },
      },
    },
  }

  await createProduct(product)
  initializeProductData(product.id)

  // SCHEDULED branch — do NOT send launch notifications, email, or watcher
  // pings yet. The publish-scheduled-launches cron fires those once
  // scheduledLaunchAt arrives so the product is actually visible.
  //
  // Pass `at` (utc iso) + `tz` (iana) in the query string so the success
  // banner can format the resolved time back into the brand's wall-clock
  // ("Scheduled to launch at May 31, 9:00 AM IST") — removes any doubt
  // that the conversion happened correctly. Stripe/Calendly pattern.
  if (launchStatus === 'scheduled' && scheduledAt) {
    const at = encodeURIComponent(scheduledAt.toISOString())
    const tz = encodeURIComponent(resolvedTz)
    redirect(`/dashboard/launch?scheduled=1&at=${at}&tz=${tz}`)
  }

  // INSTANT branch — original behaviour: brand confirmation + smart
  // distribution + watchlist fan-out, then route into the product dashboard.

  // Send brand confirmation email — awaited (Vercel serverless will kill
  // the lambda after redirect, so unawaited fire-and-forget would die
  // mid-Resend-call). Errors are caught so a Resend hiccup doesn't block
  // the redirect to the product dashboard.
  if (userEmail) {
    try {
      await sendProductLaunchedEmail({
        brandEmail: userEmail,
        brandName: userName,
        productId: product.id,
        productName,
      })
    } catch (err) {
      console.error('[LaunchProduct] Brand confirmation email failed (non-blocking):', err)
    }
  }

  // Notify ideal consumers about the new product (non-blocking — queued
  // via notification_queue, processed by /api/cron/process-notifications).
  triggerProductLaunchNotifications(product.id).catch((err) => {
    console.error('[LaunchProduct] Smart notification failed (non-blocking):', err)
  })

  // Notify watchlist subscribers about the launch (non-blocking — queued).
  notifyWatchersOnLaunch(product.id).catch((err) => {
    console.error('[LaunchProduct] Watchlist notification failed (non-blocking):', err)
  })

  redirect(`/dashboard/products/${product.id}`)
}
