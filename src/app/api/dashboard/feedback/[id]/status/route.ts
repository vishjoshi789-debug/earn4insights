import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { updateFeedbackStatus, getFeedbackById } from '@/db/repositories/feedbackRepository'
import { getProductById } from '@/db/repositories/productRepository'
import { isAdminSession } from '@/lib/auth/roles'

const VALID_STATUSES = ['new', 'reviewed', 'addressed'] as const
type ValidStatus = (typeof VALID_STATUSES)[number]

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

    if (!isAdminSession(session)) {
      const product = await getProductById(feedbackRow.productId)
      if (!product?.ownerId || product.ownerId !== session.user.id) {
        return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })
      }
    }

    const updated = await updateFeedbackStatus(id, status as ValidStatus)

    if (!updated) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })
    }

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
