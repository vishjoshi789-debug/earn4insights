import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { isAdminSession } from '@/lib/auth/roles'
import { getProductById } from '@/db/repositories/productRepository'
import { generatePublicSummary, type SummaryViewerScope } from '@/lib/analytics/publicSummary'

/**
 * GET /api/analytics/public-summary/[productId]
 *
 * Feedback summary for a product, SCOPED TO THE CALLER.
 *
 * ⚠️ This route was previously unauthenticated ("Public route — no auth
 * required") and returned the same payload to everyone, including verbatim
 * excerpts of real consumer feedback. Any logged-in user could read another
 * brand's customers' complaints, quoted, for any product id — and
 * /dashboard/products lists every product, so ids are enumerable. It broke
 * three explicit sentences in the published privacy policy. See the header of
 * lib/analytics/publicSummary.ts for the leaked strings and the full split.
 *
 * Now:
 *   • auth required (was relying only on middleware's default-deny)
 *   • owner/admin → 'owner' scope: aggregates + verbatim quotes
 *   • everyone else → 'public' scope: aggregates ONLY, MIN_COHORT_SIZE applied
 *   • Cache-Control: private — the response varies per caller, so a shared
 *     cache could hand an owner-scoped body (with quotes) to a non-owner.
 *
 * NOTE: unlike the ownership gates on /dashboard/products/[id]/feedback and
 * /themes, a non-owner is NOT 404'd here. That is deliberate: the aggregate
 * view is legitimately public-facing product information (it sits on the
 * shared catalog page every role browses). We degrade the payload rather than
 * deny the request. The security property is in the SCOPE, not the status code.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { productId } = await params
    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    // Resolve scope. Fails closed on a null owner_id: products.owner_id is
    // nullable by design (schema.ts:72 — unclaimed placeholders), and an
    // unclaimed product has no owner to be, so nobody gets quote access.
    const product = await getProductById(productId)
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const isOwner = Boolean(product.ownerId && product.ownerId === session.user.id)
    const scope: SummaryViewerScope =
      isOwner || isAdminSession(session) ? 'owner' : 'public'

    const summary = await generatePublicSummary(productId, scope)

    return NextResponse.json(summary, {
      headers: {
        // MUST be private: the body differs by caller. The previous
        // `public, s-maxage=600` let a CDN cache one caller's response and
        // serve it to the next — which, with owner-scoped bodies now carrying
        // quotes, would defeat the gate entirely.
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('[PublicSummary API] Error:', error)
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 })
  }
}
