import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import {
  claimProduct,
  getProductById,
  getClaimableProducts,
  getProductsByOwner,
} from '@/db/repositories/productRepository'

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
 * POST /api/dashboard/products/claim
 * 
 * Claim a product (brand takes ownership)
 * 
 * Body: { productId: string }
 * 
 * Flow:
 * 1. Verify user is authenticated
 * 2. Verify product exists and is claimable
 * 3. Assign ownership to brand
 * 4. Mark product as verified
 */
/**
 * 🔴🔴 HOTFIX — THIS HANDLER TRANSFERRED PRODUCT OWNERSHIP TO ANY LOGGED-IN USER.
 *
 * It is disabled, not deleted, so the exploit path is visible rather than quietly
 * absent. Phase 2 replaces the body with `requestClaim()` — creating a request for
 * admin approval instead of taking ownership.
 *
 * ── WHAT WAS WRONG ───────────────────────────────────────────────────────────
 * The only check was `if (!session?.user?.id)`. **No role check, no ownership
 * proof, no approval.** Any authenticated account — consumer, influencer, brand —
 * could call `claimProduct()` on any of the 10 claimable products and become its
 * owner.
 *
 * Reachability was traced, not assumed: the path is not in `PUBLIC_PREFIXES` so a
 * session is required, but any role satisfies that; CSRF applies but a logged-in
 * browser already holds the cookie AND `CsrfFetchProvider` patches `window.fetch`,
 * so one `fetch()` from devtools carries a valid token; and product ids are
 * enumerable from `/dashboard/products` by design (§11).
 *
 * ── WHY IT WAS WORSE THAN AN OWNERSHIP BUG ───────────────────────────────────
 * 1. Once `owner_id` is yours, `canManage` on `/dashboard/products/[productId]`
 *    is true, which unhides `<RecentFeedback>` — consumer **names, emails and
 *    media**. A PII exposure, not only a data-integrity defect.
 * 2. `claimProduct` also writes `lifecycle_status = 'verified'`, and that renders
 *    a **consumer-visible "Verified" badge** (`api/products/search/route.ts:59`
 *    → `product-search.tsx:219`) on the feedback-submission surfaces. The exploit
 *    forged a trust signal shown to other consumers while they chose what to give
 *    feedback on.
 *
 * ── WHY DISABLING BREAKS NOTHING (measured, not assumed) ─────────────────────
 * `grep -rn "products/claim" src` → the only runtime callers are
 * `dashboard/analytics/consumer-intelligence/page.tsx:97` and
 * `feature-insights/page.tsx:34`, and **both call `GET ?action=my-products`**.
 * **POST has zero callers.** The GET handler above is therefore left untouched.
 *
 * ⚠️ Fingerprint for whether it was ever USED: `products.claimed_by IS NOT NULL`.
 * Only `claimProduct` writes that column — the launch and seed paths never do — so
 * any non-null row means this ran. The owner's `users.role` then says by whom.
 */
export async function POST(_request: Request) {
  return NextResponse.json(
    {
      error:
        'Product claiming now requires admin approval. This endpoint is disabled; ' +
        'the approval queue replaces it.',
    },
    { status: 503 },
  )
}

/** Preserved verbatim for Phase 2, which rewrites it to call `requestClaim()`. */
async function POST_DISABLED_pendingApprovalQueue(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { productId } = body

    if (!productId || typeof productId !== 'string') {
      return NextResponse.json(
        { error: 'productId is required' },
        { status: 400 }
      )
    }

    // Check product exists
    const product = await getProductById(productId)
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Check product is claimable
    if (!product.claimable) {
      return NextResponse.json(
        { error: 'This product is not available for claiming' },
        { status: 409 }
      )
    }

    if (product.lifecycleStatus === 'merged') {
      return NextResponse.json(
        { error: 'This product has been merged into another product' },
        { status: 409 }
      )
    }

    // Claim the product
    const claimed = await claimProduct(productId, session.user.id)

    if (!claimed) {
      return NextResponse.json(
        { error: 'Failed to claim product' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      product: {
        id: claimed.id,
        name: claimed.name,
        lifecycleStatus: claimed.lifecycleStatus,
        ownerId: claimed.ownerId,
        claimedAt: claimed.claimedAt,
      },
      message: `Successfully claimed "${claimed.name}". You can now manage this product.`,
    })
  } catch (error) {
    console.error('Claim product error:', error)
    return NextResponse.json(
      { error: 'Failed to claim product' },
      { status: 500 }
    )
  }
}
