import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { isAdminSession } from '@/lib/auth/roles'
import {
  listClaimRequests,
  countOpenClaimRequests,
  OPEN_CLAIM_STATUSES,
  type ClaimStatus,
} from '@/db/repositories/productClaimRepository'

/**
 * GET /api/admin/product-claims?status=pending,approved&countOnly=1
 *
 * The admin review queue. Defaults to open requests — the ones needing a decision.
 *
 * ⚠️ NOT in `PUBLIC_API_ADMIN_PATHS`, and must never be added. That set feeds
 * `isPublic()` in middleware — it marks paths that are PUBLIC despite looking
 * like admin paths, and exists only for migration routes that self-authenticate
 * with `x-api-key` and carry no session. Adding a session-gated route there
 * strips its auth. The two-file rule applies to migration routes only.
 *
 * Gated twice on purpose: here, and again inside the service, because a route is
 * not the only way to reach a service (§5).
 */
export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'Admin access only' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)

    // Cheap path for the sidebar badge — no joins, no row payload.
    if (searchParams.get('countOnly')) {
      return NextResponse.json({ count: await countOpenClaimRequests() })
    }

    const raw = searchParams.get('status')
    const VALID: readonly ClaimStatus[] = ['pending', 'approved', 'rejected', 'info_requested']
    // ⚠️ Validate against the real vocabulary rather than casting. Casting an
    // arbitrary string to the union is the bug that shipped in the notification
    // preferences POST — it wrote rows no reader could ever match.
    const requested = raw
      ? raw.split(',').map((s) => s.trim()).filter((s): s is ClaimStatus => (VALID as string[]).includes(s))
      : undefined

    const statuses = requested && requested.length > 0 ? requested : OPEN_CLAIM_STATUSES

    const requests = await listClaimRequests(statuses)

    return NextResponse.json({
      requests: requests.map((r) => ({
        id: r.id,
        productId: r.productId,
        productName: r.productName,
        requesterId: r.requesterId,
        // Admin-only. The reviewer cannot judge "is this plausibly Samsung?" from
        // a user id — and this must never reach the brand-facing list.
        requesterEmail: r.requesterEmail,
        requesterName: r.requesterName,
        evidence: r.evidence,
        status: r.status,
        reviewedBy: r.reviewedBy,
        reviewedAt: r.reviewedAt,
        reviewNote: r.reviewNote,
        createdAt: r.createdAt,
      })),
      statuses,
    })
  } catch (error) {
    console.error('[Admin ProductClaims GET] Error:', error)
    return NextResponse.json({ error: 'Failed to load claim requests' }, { status: 500 })
  }
}
