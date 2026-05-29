import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin, unauthorizedResponse } from '@/lib/auth'
import {
  countOrphanedAcceptedApplications,
  listOrphanedAcceptedApplications,
} from '@/db/repositories/campaignMarketplaceRepository'

/**
 * GET /api/admin/diagnostics/orphan-marketplace-handshakes
 *
 * Read-only count + sample of orphaned accepted applications:
 *   campaign_applications.status='accepted' AND no matching campaign_influencers row
 *
 * These rows exist because the pre-fix accept path flipped the application
 * status but never inserted the membership row (see Pass 2 C1 / Pass 3 I-C1).
 * Run this BEFORE running the backfill to see scope.
 *
 * Auth: ADMIN_DIAGNOSTICS_ENABLED=true env flag + admin API key.
 * Response is always 200; outcome carried in `body.ok` so PowerShell
 * Invoke-RestMethod doesn't throw on non-2xx and hide the diagnosis.
 */
export async function GET(request: NextRequest) {
  if (process.env.ADMIN_DIAGNOSTICS_ENABLED !== 'true') {
    return new NextResponse(null, { status: 404 })
  }
  if (!authenticateAdmin(request)) return unauthorizedResponse()

  try {
    const count = await countOrphanedAcceptedApplications()
    const sample = count > 0 ? await listOrphanedAcceptedApplications(20) : []

    return NextResponse.json({
      ok: true,
      orphanCount: count,
      sample,
      recommendation:
        count === 0
          ? 'No orphans — no backfill needed.'
          : count < 10
          ? `${count} orphan(s) — fix manually with SQL or run the backfill route.`
          : `${count} orphans — run POST /api/admin/backfill-marketplace-handshake.`,
    })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message ?? String(err) },
      { status: 200 }, // 200 by design — see header comment
    )
  }
}
