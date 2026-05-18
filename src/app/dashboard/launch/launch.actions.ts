'use server'

import { redirect } from 'next/navigation'
import { Product } from '@/lib/types/product'
import { initializeProductData } from '@/lib/product/initProduct'
import { createProduct } from '@/db/repositories/productRepository'
import { triggerProductLaunchNotifications } from '@/lib/personalization/smartDistributionService'
import { notifyWatchersOnLaunch } from '@/server/watchlistService'
import { auth } from '@/lib/auth/auth.config'
import { sendProductLaunchedEmail } from '@/server/productNotifications'

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

  // Parse and validate the scheduled time before we touch the DB. The form
  // value comes from <input type="datetime-local"> — a naive ISO string with
  // no zone, interpreted as local. We require strictly future, with a small
  // 30s skew so a fast-clicking brand whose clock is a hair ahead doesn't
  // get rejected.
  let scheduledAt: Date | null = null
  let launchStatus: 'live' | 'scheduled' = 'live'
  if (launchType === 'scheduled') {
    if (!scheduledAtRaw) {
      throw new Error('Scheduled launch requires a date and time')
    }
    const parsed = new Date(scheduledAtRaw)
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
  if (launchStatus === 'scheduled') {
    redirect('/dashboard/launch?scheduled=1')
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
