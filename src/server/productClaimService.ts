import 'server-only'

import { db } from '@/db'
import { isAdminSession } from '@/lib/auth/roles'
import {
  claimProduct,
  getClaimableProductById,
  getProductById,
  ProductAlreadyOwnedError,
} from '@/db/repositories/productRepository'
import {
  claimRequestTransition,
  createClaimRequest,
  getClaimRequestById,
  getOpenClaimRequestForProduct,
  OPEN_CLAIM_STATUSES,
  type ProductClaimRequest,
} from '@/db/repositories/productClaimRepository'
import type { Product } from '@/lib/types/product'

/**
 * Brand claim requests on unowned products — business logic and authorization.
 *
 * ⚠️ **OWNERSHIP MOVES ON APPROVAL, NEVER ON REQUEST.** `requestClaim` writes a
 * row and nothing else: no `owner_id`, no `brand_id`, no `lifecycle_status`.
 * `POST /api/dashboard/products/claim` used to call `claimProduct()` directly
 * with no ownership proof at all, which made it a land-grab primitive over rows
 * named `Apple`, `Samsung` and `Walmart`.
 *
 * ── Results are RETURNED, not thrown, for expected outcomes ───────────────
 * Every reachable "no" is a discriminated result so routes can map it to a
 * status code and a sentence a user can act on. Throwing would collapse
 * "someone already claimed this" into a 500. Genuine faults still throw.
 */

export type RequestClaimResult =
  | { ok: true; request: ProductClaimRequest }
  | { ok: false; reason: 'not_found' | 'not_claimable' | 'already_open'; openRequestId?: string }

export type DecideClaimResult =
  | { ok: true; request: ProductClaimRequest; product: Product | null }
  | { ok: false; reason: 'not_found' | 'already_decided' | 'product_taken' }

type SessionLike = { user?: { id?: string; role?: unknown } | null } | null | undefined

/** Postgres unique-violation. 044's partial index raises this on a second open request. */
const UNIQUE_VIOLATION = '23505'

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === UNIQUE_VIOLATION
}

/**
 * A brand asks to own a consumer-created product. Creates a request for review.
 *
 * ⚠️ Does NOT pre-check for a duplicate open request and then insert — that is
 * check-then-act and races a second tab. It lets 044's partial unique index
 * refuse the insert and translates the violation. The `getOpenClaimRequestForProduct`
 * lookup happens only AFTER a failure, to explain it.
 */
export async function requestClaim(
  session: SessionLike,
  productId: string,
  evidence?: string | null,
): Promise<RequestClaimResult> {
  const requesterId = session?.user?.id
  if (!requesterId) throw new Error('requestClaim: unauthenticated')

  // ✅ ONE DEFINITION. `getClaimableProductById` applies
  // `claimableProductCondition()` — the same predicate the brand-facing search
  // lists by and the ownership UPDATE accepts. This function does NOT restate
  // the rule; an earlier version checked
  // `!product.claimable || product.ownerId || lifecycleStatus !== …` inline,
  // which is how the search and the approval drift apart and start producing a
  // false affordance for a prospective paying brand.
  const claimable = await getClaimableProductById(productId)
  if (!claimable) {
    // Not eligible. The extra read below exists ONLY to say which sentence the
    // user sees — it is a message concern and must never re-decide eligibility.
    const exists = await getProductById(productId)
    return { ok: false, reason: exists ? 'not_claimable' : 'not_found' }
  }

  try {
    const request = await createClaimRequest({
      productId,
      requesterId,
      evidence: evidence?.trim() || null,
    })
    return { ok: true, request }
  } catch (err) {
    if (isUniqueViolation(err)) {
      // Someone already has an open request. Fetch it only now, to say so.
      const open = await getOpenClaimRequestForProduct(productId)
      return { ok: false, reason: 'already_open', openRequestId: open?.id }
    }
    throw err
  }
}

/**
 * Approve a claim: mark the request approved AND move ownership, together.
 *
 * ⚠️⚠️ **THIS FUNCTION OWNS THE TRANSACTION BOUNDARY.**
 *
 * `claimProduct` accepts the handle and joins it (`existingTx ? run(existingTx)
 * : db.transaction(run)`), so it must be passed `tx` here. Wrapping another
 * `db.transaction()` anywhere inside would turn into a SAVEPOINT — which does
 * not error, and is therefore worse than a crash: the nesting silently becomes
 * something nobody reasoned about and the inner "commit" is not one.
 *
 * Rollback on the pooled endpoint is **verified on preview** (2026-09-30,
 * `scripts/probe-transaction-rollback.ts`: a marked row inserted inside a
 * thrown transaction was gone afterwards) and **inferred for production** —
 * they are different Neon branches. The whole design rests on it: if any step
 * below fails, nothing may persist.
 */
export async function approveClaim(
  session: SessionLike,
  claimId: string,
  reviewNote?: string | null,
): Promise<DecideClaimResult> {
  const adminId = session?.user?.id
  if (!adminId || !isAdminSession(session)) {
    throw new Error('approveClaim: admin only')
  }

  const existing = await getClaimRequestById(claimId)
  if (!existing) return { ok: false, reason: 'not_found' }

  try {
    return await db.transaction(async (tx) => {
      // ── Guard 1: the conditional claim on the REQUEST ──────────────────
      // `claimRequestTransition` returns null when the row was already decided
      // — two admins clicking Approve, a double-click, a retry. That contract
      // is enforced HERE, not merely documented: on null we return without
      // touching ownership.
      const request = await claimRequestTransition(
        claimId,
        OPEN_CLAIM_STATUSES,
        'approved',
        { reviewedBy: adminId, reviewNote: reviewNote ?? null },
        tx,
      )
      if (!request) {
        return { ok: false as const, reason: 'already_decided' as const }
      }

      // ── Guard 2: the conditional claim on the PRODUCT ──────────────────
      // `claimProduct` updates only WHERE owner_id IS NULL AND claimable, and
      // throws ProductAlreadyOwnedError if that misses. The throw propagates
      // out of this transaction, so the 'approved' write above is rolled back
      // too — the request does not end up approved for a product it never got.
      const product = await claimProduct(request.productId, request.requesterId, tx)

      return { ok: true as const, request, product }
    })
  } catch (err) {
    if (err instanceof ProductAlreadyOwnedError) {
      // Expected race, not a fault. The transaction already rolled back, so the
      // request is still open and can be rejected or retried deliberately.
      console.warn(`[approveClaim] lost the ownership race for claim ${claimId}:`, err.message)
      return { ok: false, reason: 'product_taken' }
    }
    throw err
  }
}

/**
 * Reject a claim. No ownership change, so no transaction is needed — the
 * conditional transition is itself atomic.
 */
export async function rejectClaim(
  session: SessionLike,
  claimId: string,
  reviewNote?: string | null,
): Promise<DecideClaimResult> {
  const adminId = session?.user?.id
  if (!adminId || !isAdminSession(session)) {
    throw new Error('rejectClaim: admin only')
  }

  const existing = await getClaimRequestById(claimId)
  if (!existing) return { ok: false, reason: 'not_found' }

  const request = await claimRequestTransition(
    claimId,
    OPEN_CLAIM_STATUSES,
    'rejected',
    { reviewedBy: adminId, reviewNote: reviewNote ?? null },
  )
  if (!request) return { ok: false, reason: 'already_decided' }

  return { ok: true, request, product: null }
}
