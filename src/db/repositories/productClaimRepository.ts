import 'server-only'

import { and, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import type { DbTx } from '@/db/tx'
import { productClaimRequests, products, users } from '@/db/schema'

/**
 * Brand claim requests on unowned products (migration 044).
 *
 * Queries only — no auth, no business logic (§4 layering). Authorization and
 * the approve/reject rules live in `src/server/productClaimService.ts`.
 *
 * ⚠️ Nothing here calls `claimProduct()`. Ownership moves on APPROVAL, in the
 * service, inside a transaction the service owns.
 */

/** Statuses that block a second request on the same product (044's partial UNIQUE). */
export const OPEN_CLAIM_STATUSES = ['pending', 'info_requested'] as const

export type ClaimStatus = 'pending' | 'approved' | 'rejected' | 'info_requested'

export type ProductClaimRequest = typeof productClaimRequests.$inferSelect

/** A queue row joined to the names an admin needs to decide. */
export type ClaimRequestWithContext = ProductClaimRequest & {
  productName: string | null
  requesterEmail: string | null
  requesterName: string | null
}

/**
 * Create a request. Accepts a transaction so the caller can make it atomic with
 * something else if it ever needs to.
 *
 * ⚠️ Relies on 044's partial unique index to reject a second open request on
 * the same product. That is deliberate: checking first and inserting after is a
 * race, and the database can simply refuse. Callers must expect a unique
 * violation and translate it, rather than pre-checking and trusting the gap.
 */
export async function createClaimRequest(
  data: { productId: string; requesterId: string; evidence?: string | null },
  tx?: DbTx,
): Promise<ProductClaimRequest> {
  const [row] = await (tx ?? db)
    .insert(productClaimRequests)
    .values({
      productId: data.productId,
      requesterId: data.requesterId,
      evidence: data.evidence ?? null,
      status: 'pending',
    })
    .returning()
  return row
}

export async function getClaimRequestById(
  id: string,
  tx?: DbTx,
): Promise<ProductClaimRequest | null> {
  const rows = await (tx ?? db)
    .select()
    .from(productClaimRequests)
    .where(eq(productClaimRequests.id, id))
    .limit(1)
  return rows[0] ?? null
}

/** The open request for a product, if any. Used to explain a rejected duplicate. */
export async function getOpenClaimRequestForProduct(
  productId: string,
): Promise<ProductClaimRequest | null> {
  const rows = await db
    .select()
    .from(productClaimRequests)
    .where(
      and(
        eq(productClaimRequests.productId, productId),
        inArray(productClaimRequests.status, [...OPEN_CLAIM_STATUSES]),
      ),
    )
    .limit(1)
  return rows[0] ?? null
}

/** Every request a brand has made, newest first. */
export async function getClaimRequestsByRequester(
  requesterId: string,
): Promise<ProductClaimRequest[]> {
  return db
    .select()
    .from(productClaimRequests)
    .where(eq(productClaimRequests.requesterId, requesterId))
    .orderBy(desc(productClaimRequests.createdAt))
}

/**
 * The admin queue. Defaults to open requests — the ones needing a decision.
 *
 * ⚠️ Joins `users` for the requester's email because an admin cannot decide
 * "is this brand plausibly Samsung?" from a user id. That is admin-only data
 * and must never reach the brand-facing list.
 */
export async function listClaimRequests(
  statuses: readonly ClaimStatus[] = OPEN_CLAIM_STATUSES,
): Promise<ClaimRequestWithContext[]> {
  const rows = await db
    .select({
      request: productClaimRequests,
      productName: products.name,
      requesterEmail: users.email,
      requesterName: users.name,
    })
    .from(productClaimRequests)
    .leftJoin(products, eq(products.id, productClaimRequests.productId))
    .leftJoin(users, eq(users.id, productClaimRequests.requesterId))
    .where(inArray(productClaimRequests.status, [...statuses]))
    .orderBy(desc(productClaimRequests.createdAt))

  return rows.map((r) => ({
    ...r.request,
    productName: r.productName ?? null,
    requesterEmail: r.requesterEmail ?? null,
    requesterName: r.requesterName ?? null,
  }))
}

/** Count of open requests — for the admin sidebar badge. */
export async function countOpenClaimRequests(): Promise<number> {
  const rows = await db
    .select({ id: productClaimRequests.id })
    .from(productClaimRequests)
    .where(inArray(productClaimRequests.status, [...OPEN_CLAIM_STATUSES]))
  return rows.length
}

/**
 * Move a request to a decided state.
 *
 * ⚠️ **CONDITIONAL CLAIM, not a status read.** The `WHERE` includes the
 * expected current status and the update returns the row only if it matched, so
 * two admins clicking Approve on the same request cannot both succeed. Reading
 * the status in app code and then writing races a second tab, a double-click,
 * and a retry — the same shape as `claimResolutionNotification()` (v16) and the
 * scheduled-launch cron guard.
 *
 * Returns `null` when the row was already decided. A caller that gets `null`
 * must NOT proceed to move ownership.
 */
export async function claimRequestTransition(
  id: string,
  from: readonly ClaimStatus[],
  to: ClaimStatus,
  review: { reviewedBy: string; reviewNote?: string | null },
  tx?: DbTx,
): Promise<ProductClaimRequest | null> {
  const [row] = await (tx ?? db)
    .update(productClaimRequests)
    .set({
      status: to,
      reviewedBy: review.reviewedBy,
      reviewedAt: new Date(),
      reviewNote: review.reviewNote ?? null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(productClaimRequests.id, id),
        inArray(productClaimRequests.status, [...from]),
      ),
    )
    .returning()

  return row ?? null
}
