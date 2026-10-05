import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { brandQualityFeedback, contributionEvents, products } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { isAdminSession } from '@/lib/auth/roles'

/**
 * POST /api/contribution/brand-feedback
 *
 * Brand users can rate a contribution as useful/not_useful/insightful.
 * This data feeds back into the AI scoring model's continuous learning loop.
 *
 * Body: { contributionEventId, rating, comment? }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Admin bypasses the role gate. Checking `role !== 'brand'` alone is the
    // §5 trap that made the media proxy admin-inaccessible: an admin is not a
    // brand, so a bare role check rejects them BEFORE the ownership check below
    // can grant access, and the uniform admin-bypass policy never applies.
    const role = (session.user as any).role
    const isAdmin = isAdminSession(session)
    if (role !== 'brand' && !isAdmin) {
      return NextResponse.json({ error: 'Brand access only' }, { status: 403 })
    }

    const body = await req.json()
    const { contributionEventId, rating, comment } = body

    if (!contributionEventId || !rating) {
      return NextResponse.json({ error: 'contributionEventId and rating are required' }, { status: 400 })
    }

    const validRatings = ['useful', 'not_useful', 'insightful']
    if (!validRatings.includes(rating)) {
      return NextResponse.json({ error: `rating must be one of: ${validRatings.join(', ')}` }, { status: 400 })
    }

    // Verify the contribution event exists and is for a product owned by this brand
    const [event] = await db
      .select({
        id: contributionEvents.id,
        productId: contributionEvents.productId,
        brandId: contributionEvents.brandId,
      })
      .from(contributionEvents)
      .where(eq(contributionEvents.id, contributionEventId))
      .limit(1)

    if (!event) {
      return NextResponse.json({ error: 'Contribution not found' }, { status: 404 })
    }

    // ⚠️ FAIL CLOSED ON A NULL `brandId`. This was
    // `if (event.brandId && event.brandId !== session.user.id)`, which PASSES
    // when `brandId` is NULL — so any brand account could rate a contribution
    // belonging to nobody, feeding the AI scoring model on someone else's data.
    //
    // NULL is not rare and not theoretical: `recordContribution` resolves
    // `brandId` from `products.owner_id` at write time, so EVERY contribution
    // on an unowned product is stored with a NULL brand. There are 8 such
    // products today accumulating exactly these rows. A contribution that
    // belongs to nobody belongs to NOBODY — not to whoever asks first.
    //
    // Same shape as the null-`owner_id` holes closed in v15 and the
    // `if (cronSecret && …)` cron family: `&&` reads as "if we know the owner,
    // check it" when the requirement is "we must know the owner".
    if (!isAdmin && (!event.brandId || event.brandId !== session.user.id)) {
      return NextResponse.json({ error: 'You can only rate contributions related to your products' }, { status: 403 })
    }

    // Check for existing feedback to prevent duplicates
    const existing = await db
      .select()
      .from(brandQualityFeedback)
      .where(
        and(
          eq(brandQualityFeedback.contributionEventId, contributionEventId),
          eq(brandQualityFeedback.brandUserId, session.user.id),
        ),
      )
      .limit(1)

    if (existing.length > 0) {
      return NextResponse.json({ error: 'You have already rated this contribution' }, { status: 409 })
    }

    const [feedback] = await db
      .insert(brandQualityFeedback)
      .values({
        contributionEventId,
        brandUserId: session.user.id,
        rating,
        comment: comment?.slice(0, 500) || null,
      })
      .returning()

    return NextResponse.json({ feedback }, { status: 201 })
  } catch (error) {
    console.error('[Brand Feedback POST] Error:', error)
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 })
  }
}
