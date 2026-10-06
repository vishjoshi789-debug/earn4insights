import { NextResponse } from 'next/server'
import { count, inArray } from 'drizzle-orm'
import { auth } from '@/lib/auth/auth.config'
import { isAdminSession } from '@/lib/auth/roles'
import { db } from '@/db'
import { feedback } from '@/db/schema'
import { listClaimableProducts } from '@/db/repositories/productRepository'
import { getOwnRequestsForProducts } from '@/db/repositories/productClaimRepository'
import { MIN_COHORT_SIZE } from '@/lib/privacy/cohort'

/**
 * GET /api/dashboard/products/claimable?q=<search>
 *
 * The brand-facing claimable list. SEARCH-AND-CONFIRM, not a discovery feed: a
 * brand arrives looking for THEIR OWN product. An empty `q` returns everything,
 * because the set is small and an empty box that reveals nothing reads as broken.
 *
 * ⚠️ Eligibility is NOT decided here. `listClaimableProducts()` applies
 * `claimableProductCondition()` — the same predicate the approval UPDATE uses —
 * so a product this route lists is a product the approval will accept. Writing
 * the condition again here is what produces a false affordance.
 *
 * ── THE FEEDBACK COUNT IS FLOORED, INCLUDING ON THE CONFIRM STEP ─────────────
 * A bare count reveals nothing any individual said, but at low N it stops being
 * aggregate: 1 item on an obscure product is close to identifying, and a
 * claimant who knows they are the only person who ever mentioned it learns
 * something about a specific person.
 *
 * ⚠️ The claimant is UNVERIFIED at this moment — that is the whole reason the
 * approval queue exists — so the floor applies here AND at the confirm step, not
 * just in the list. An earlier draft of this feature showed a raw count on
 * confirm ("Apple — 2 pieces of feedback"), which contradicted its own rule:
 * Apple has 2 and MIN_COHORT_SIZE is 5.
 *
 * Below the floor the response carries `feedbackCountBelowFloor: true` and NO
 * number. Content, excerpts, dates, sentiment, reviewer names and media
 * indicators are never included at any N — approval does not transfer the
 * consumer's consent, it verifies the recipient is who they meant.
 */
export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Brand-or-admin. A consumer has no reason to browse claimable products, and
    // UI gating is not API gating — the sidebar filter does not protect a route.
    const role = (session.user as any).role
    if (role !== 'brand' && !isAdminSession(session)) {
      return NextResponse.json({ error: 'Brand access only' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim() || undefined

    const products = await listClaimableProducts(q)

    // ⚠️ ONE GROUPED QUERY, NOT A LOOP.
    //
    // This was a per-product `count()` in a `for` loop — N round trips to Neon
    // for N products. Asked "at what product count does it become a GROUP BY?",
    // the honest answer is that the threshold is unknowable without measuring
    // (it depends on pooler latency, not on row counts), and a threshold nobody
    // can check is a condition that never gets checked — it gets rediscovered
    // under load. The rewrite is six lines, so the rewrite happened instead.
    //
    // For the record, the number I would have written: **50 products**. At
    // ~20ms round-trip each that is ~1s of pure latency, which is where a list
    // page starts feeling broken. It is now irrelevant — this is O(1) queries.
    //
    // Products with zero feedback simply do not appear in `rows`; the `?? 0`
    // below covers them.
    const productIds = products.map((p) => p.id)

    const counts = new Map<string, number>()
    if (productIds.length > 0) {
      const rows = await db
        .select({ productId: feedback.productId, n: count() })
        .from(feedback)
        .where(inArray(feedback.productId, productIds))
        .groupBy(feedback.productId)
      for (const r of rows) counts.set(r.productId, Number(r.n))
    }

    // ── THIS brand's own request state, so the page stops guessing ──────────
    //
    // The page previously derived its state only from what happened in the
    // current browser session: submit a claim, refresh, and the button was
    // enabled again as though nothing had been sent. The brand then re-submits
    // and the server refuses — correctly, but after they have retyped their
    // evidence. A brand sits in `pending` for hours or days, so that is the
    // state they meet most.
    //
    // ⚠️ `getOwnRequestsForProducts` is scoped to the session user. The payload
    // carries NOTHING about another brand's request — a brand must not be able
    // to enumerate the catalogue and read off what competitors are pursuing.
    // (Finding 2 — products with someone else's open request still appear here
    // with an enabled control. The agreed direction is to EXCLUDE them, not to
    // badge them, and that is deliberately NOT built yet.)
    const ownRequests = new Map<string, { status: string; createdAt: Date }>()
    for (const r of await getOwnRequestsForProducts(session.user.id, productIds)) {
      ownRequests.set(r.productId, { status: r.status, createdAt: r.createdAt })
    }

    return NextResponse.json({
      products: products.map((p) => {
        const n = counts.get(p.id) ?? 0
        const belowFloor = n < MIN_COHORT_SIZE
        const own = ownRequests.get(p.id)
        return {
          id: p.id,
          name: p.name,
          description: p.description ?? null,
          created_at: p.created_at,
          // ⚠️ Exactly one of these two is meaningful. No raw sub-floor number.
          feedbackCount: belowFloor ? null : n,
          feedbackCountBelowFloor: belowFloor,
          // null = this brand has never requested this product.
          // ⚠️ Always THIS brand's request. Never anyone else's.
          ownRequest: own
            ? { status: own.status, createdAt: own.createdAt.toISOString() }
            : null,
        }
      }),
      minCohortSize: MIN_COHORT_SIZE,
    })
  } catch (error) {
    console.error('[Claimable GET] Error:', error)
    return NextResponse.json(
      { error: 'Failed to load claimable products' },
      { status: 500 },
    )
  }
}
