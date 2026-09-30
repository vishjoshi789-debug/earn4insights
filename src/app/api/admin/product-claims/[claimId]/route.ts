import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { isAdminSession } from '@/lib/auth/roles'
import { approveClaim, rejectClaim } from '@/server/productClaimService'

/**
 * PATCH /api/admin/product-claims/[claimId]
 *
 * Body: { action: 'approve' | 'reject', reviewNote?: string }
 *
 * ⚠️ APPROVAL IS WHAT MOVES OWNERSHIP. The request itself moves nothing — see
 * `productClaimService`. The service owns the transaction; this route only maps
 * results to status codes.
 *
 * Admin-only. Gated here AND re-derived in the service, because a route is not
 * the only way to reach a service and §5 requires every path to re-authorize.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ claimId: string }> },
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'Admin access only' }, { status: 403 })
    }

    const { claimId } = await params
    const body = await request.json().catch(() => ({}))
    const action = body?.action
    const reviewNote = typeof body?.reviewNote === 'string' ? body.reviewNote.slice(0, 1000) : null

    if (action !== 'approve' && action !== 'reject') {
      return NextResponse.json(
        { error: "action must be 'approve' or 'reject'" },
        { status: 400 },
      )
    }

    const result =
      action === 'approve'
        ? await approveClaim(session, claimId, reviewNote)
        : await rejectClaim(session, claimId, reviewNote)

    if (!result.ok) {
      // Each reason is a distinct, actionable outcome — deliberately not
      // collapsed into one message. `product_taken` in particular means the
      // approval ROLLED BACK and the request is still open, which the admin
      // needs to know rather than assuming their click was applied.
      const status =
        result.reason === 'not_found' ? 404
        : result.reason === 'already_decided' ? 409
        : 409
      const message =
        result.reason === 'not_found' ? 'Claim request not found'
        : result.reason === 'already_decided' ? 'This request was already decided'
        : 'The product was claimed or assigned by another path — this approval was rolled back and the request is still open'
      return NextResponse.json({ error: message, reason: result.reason }, { status })
    }

    return NextResponse.json({
      ok: true,
      request: {
        id: result.request.id,
        productId: result.request.productId,
        status: result.request.status,
        reviewedAt: result.request.reviewedAt,
      },
      product: result.product ? { id: result.product.id, ownerId: result.product.ownerId } : null,
    })
  } catch (error) {
    console.error('[Admin ProductClaims PATCH] Error:', error)
    return NextResponse.json({ error: 'Failed to decide claim' }, { status: 500 })
  }
}
