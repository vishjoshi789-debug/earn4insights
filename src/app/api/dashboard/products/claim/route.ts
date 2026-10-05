import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
// ⚠️ `claimProduct` is deliberately NOT imported here. This route never moves
// ownership — it creates a request. `approveClaim()` is the only caller of
// `claimProduct`, and it runs inside a transaction it owns.
import {
  getClaimableProducts,
  getProductsByOwner,
} from '@/db/repositories/productRepository'
import { isAdminSession } from '@/lib/auth/roles'
import { requestClaim } from '@/server/productClaimService'

/**
 * Minimum `evidence` length enforced at the API boundary.
 *
 * ⚠️ Deliberately NOT a database constraint: migration 044 keeps the column
 * nullable so a future admin-created claim (no claimant to ask) remains legal.
 * The requirement belongs where the claimant is, not in the schema.
 */
const MIN_EVIDENCE_LENGTH = 20

/**
 * GET /api/dashboard/products/claim
 * 
 * List claimable products (pending verification, unclaimed)
 * Brand owners can browse these and claim their products
 */
export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    
    if (action === 'my-products') {
      // Get products owned by this brand
      const owned = await getProductsByOwner(session.user.id)
      return NextResponse.json({
        products: owned.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          lifecycleStatus: p.lifecycleStatus,
          claimedAt: p.claimedAt,
          creationSource: p.creationSource,
        })),
      })
    }
    
    // Default: list claimable products
    const claimable = await getClaimableProducts()
    
    return NextResponse.json({
      products: claimable.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        lifecycleStatus: p.lifecycleStatus,
        creationSource: p.creationSource,
        created_at: p.created_at,
      })),
      totalClaimable: claimable.length,
    })
  } catch (error) {
    console.error('Claim list error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch claimable products' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/dashboard/products/claim — REQUEST a claim. Does NOT grant ownership.
 *
 * Body: { productId: string, evidence: string }
 *
 * ── WHAT THIS HANDLER USED TO DO, AND WHY IT WAS A HOTFIX ───────────────────
 * Until `fa02109` it called `claimProduct()` behind one check —
 * `if (!session?.user?.id)`. **No role check, no ownership proof, no approval.**
 * Any authenticated account, including a consumer or influencer, could take
 * ownership of any claimable product. Two consequences, in severity order:
 *
 *   1. `owner_id` makes `canManage` true on `/dashboard/products/[productId]`,
 *      which unhides `<RecentFeedback>` — consumer names, emails and media. A
 *      PII exposure, not only a data-integrity defect.
 *   2. Unauthorised ownership transfer of a product carrying real feedback.
 *
 * ⚠️ An earlier version of this comment also claimed the exploit "forged a trust
 * signal" via `lifecycle_status = 'verified'`. **That escalation was WRONG and is
 * retracted:** `'verified'` is the column DEFAULT (`schema.ts:70`), no
 * verification step has ever existed, so the badge never carried information. It
 * is being removed rather than defended. See §5.
 *
 * Evidenced on 2026-10-01 via `products.claimed_by IS NOT NULL` (the only writer
 * is `claimProduct`): rows existed, all brand-role. So the exploit was
 * **POSSIBLE, never used by a non-brand account.** Precaution, not incident.
 *
 * ── WHAT IT DOES NOW ────────────────────────────────────────────────────────
 * Creates a `product_claim_requests` row for admin review. Ownership moves in
 * `approveClaim()`, inside a transaction, and nowhere else.
 */
export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // ⚠️ BRAND-OR-ADMIN. The missing role check is half of what made the old
    // handler exploitable, and the sidebar capability filter does not protect a
    // route — UI gating is not API gating.
    const role = (session.user as any).role
    if (role !== 'brand' && !isAdminSession(session)) {
      return NextResponse.json({ error: 'Brand access only' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const productId = typeof body?.productId === 'string' ? body.productId : ''
    const evidence = typeof body?.evidence === 'string' ? body.evidence.trim() : ''

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 })
    }

    // ⚠️ EVIDENCE IS REQUIRED HERE, THOUGH THE COLUMN IS NULLABLE.
    // Migration 044 leaves `evidence` nullable on purpose — a future
    // admin-created claim has no claimant to supply it. But a request arriving
    // empty gives the reviewer nothing to judge, which turns the approval queue
    // into a rubber stamp. The boundary is the right place for the requirement;
    // the column is not.
    if (evidence.length < MIN_EVIDENCE_LENGTH) {
      return NextResponse.json(
        {
          error:
            `Tell us why this product is yours (at least ${MIN_EVIDENCE_LENGTH} characters). ` +
            `An admin reviews every claim and needs something to go on.`,
        },
        { status: 400 },
      )
    }

    const result = await requestClaim(session, productId, evidence.slice(0, 2000))

    if (!result.ok) {
      const status =
        result.reason === 'not_found' ? 404
        : result.reason === 'not_claimable' ? 409
        : 409
      const message =
        result.reason === 'not_found' ? 'Product not found'
        : result.reason === 'not_claimable'
          ? 'This product is not available to claim'
          : 'Someone already has an open claim request on this product'
      return NextResponse.json(
        { error: message, reason: result.reason, openRequestId: (result as any).openRequestId },
        { status },
      )
    }

    return NextResponse.json(
      {
        ok: true,
        request: {
          id: result.request.id,
          productId: result.request.productId,
          status: result.request.status,
          createdAt: result.request.createdAt,
        },
        message: 'Claim submitted. An admin will review it.',
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('[Claim POST] Error:', error)
    return NextResponse.json({ error: 'Failed to submit claim' }, { status: 500 })
  }
}

