import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import {
  updateFeedbackStatus,
  getFeedbackById,
  claimResolutionNotification,
} from '@/db/repositories/feedbackRepository'
import { getProductById } from '@/db/repositories/productRepository'
import { isAdminSession } from '@/lib/auth/roles'
import { emit, PLATFORM_EVENTS } from '@/server/eventBus'

const VALID_STATUSES = ['new', 'reviewed', 'addressed'] as const
type ValidStatus = (typeof VALID_STATUSES)[number]

/** Longest excerpt of the consumer's own words quoted back in the email. */
const EXCERPT_MAX = 280

/**
 * Notify the consumer that a brand addressed their feedback — the fourth and
 * final step of the "three-way connection".
 *
 * Every early return here is a DELIBERATE SILENT SKIP, not an error. A brand
 * marking imported feedback addressed is doing something completely normal;
 * there is simply nobody on our side of it to tell.
 *
 * Never throws: a notification problem must not fail the brand's status update.
 */
async function maybeNotifyConsumerOfResolution(args: {
  feedbackId: string
  previousStatus: string
  newStatus: string
  consumerId: string | null
  feedbackText: string
  productId: string
  productName: string | null
  productOwnerId: string | null
  actorId: string
}): Promise<void> {
  try {
    // 1. Only the TRANSITION into 'addressed' is news. Re-saving 'addressed'
    //    (or any other status) is not. 'reviewed' deliberately does not
    //    notify: it means someone read it, which is not an outcome, and the
    //    consumer's My Feedback page already shows that badge passively.
    if (args.newStatus !== 'addressed') return
    if (args.previousStatus === 'addressed') return

    // 2. Recipient comes from feedback.user_id and NOTHING ELSE. Imported and
    //    webhook rows are permanently NULL — their respondents are not
    //    platform users. Falling back to user_email would be actively harmful:
    //    every imported row carries the IMPORTING BRAND's address, so an email
    //    match would tell a brand that its own feedback had been addressed.
    if (!args.consumerId) return

    // 3. Don't notify a brand about its own product's feedback. Brands can and
    //    do submit feedback on their own products; that self-ping is noise.
    if (args.productOwnerId && args.consumerId === args.productOwnerId) return

    // 4. Claim the notification. Returns true exactly once per feedback row,
    //    ever — so addressed -> new -> addressed sends one notification, and
    //    two concurrent tabs send one between them. See the repository fn.
    const claimed = await claimResolutionNotification(args.feedbackId)
    if (!claimed) return

    const excerpt = args.feedbackText.length > EXCERPT_MAX
      ? `${args.feedbackText.slice(0, EXCERPT_MAX).trimEnd()}…`
      : args.feedbackText

    await emit(PLATFORM_EVENTS.CONSUMER_FEEDBACK_ADDRESSED, {
      feedbackId:      args.feedbackId,
      consumerId:      args.consumerId,
      productId:       args.productId,
      productName:     args.productName ?? undefined,
      brandId:         args.productOwnerId ?? undefined,
      feedbackExcerpt: excerpt,
      actorId:         args.actorId,
      actorRole:       'brand',
      // resolutionNote is the Phase-2 slot (migration 034) — never set in v1.
    })
  } catch (err) {
    console.error('[Feedback] Resolution notification failed (non-blocking):', err)
  }
}

/**
 * PATCH /api/dashboard/feedback/[id]/status
 * 
 * Update the review status of a feedback entry.
 * Brand workflow: new → reviewed → addressed
 * 
 * Body: { status: 'new' | 'reviewed' | 'addressed' }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { status } = body

    if (!status || !VALID_STATUSES.includes(status as ValidStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    // SECURITY: a session only proves the caller is *someone*. Without this,
    // any authenticated user could mark any brand's feedback as addressed by
    // id — a write-side IDOR of the same class as the batch closed in
    // 61b31af/e939199 (this route was outside that audit's scope).
    // Resolve feedback -> product -> owner and fail closed on a null owner_id
    // (products.owner_id is nullable by design — schema.ts:72). 404 rather
    // than 403 so feedback ids can't be enumerated. Admins bypass per
    // lib/auth/roles.ts.
    const feedbackRow = await getFeedbackById(id)
    if (!feedbackRow) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })
    }

    // Fetched unconditionally, not inside the ownership branch below: the
    // resolution notification needs the product name, and an admin marking
    // feedback addressed skips that branch entirely.
    const product = await getProductById(feedbackRow.productId)

    if (!isAdminSession(session)) {
      if (!product?.ownerId || product.ownerId !== session.user.id) {
        return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })
      }
    }

    const updated = await updateFeedbackStatus(id, status as ValidStatus)

    if (!updated) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })
    }

    // ── The resolution loop ────────────────────────────────────────────────
    // Closes the three-way connection: the consumer who wrote this finally
    // hears that a brand acted on it.
    //
    // AWAITED deliberately, not fired-and-forgotten: on Vercel serverless a
    // dangling promise is killed the moment the response is returned, so a
    // detached emit() would deliver only intermittently. Safe to await because
    // it swallows everything internally — a notification failure must never
    // fail the status update the brand just made.
    await maybeNotifyConsumerOfResolution({
      feedbackId:   id,
      previousStatus: feedbackRow.status,
      newStatus:    updated.status,
      consumerId:   feedbackRow.userId,
      feedbackText: feedbackRow.feedbackText,
      productId:    feedbackRow.productId,
      productName:  product?.name ?? null,
      productOwnerId: product?.ownerId ?? null,
      actorId:      session.user.id,
    })

    return NextResponse.json({
      success: true,
      feedbackId: id,
      status: updated.status,
    })
  } catch (error) {
    console.error('Feedback status update error:', error)
    return NextResponse.json(
      { error: 'Failed to update feedback status' },
      { status: 500 }
    )
  }
}
