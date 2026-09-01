import type { Serialized } from './serialized'
// ⚠️ `import type`, not a value import. It is fully erased at compile time, so
// no server module is pulled into the client bundle and `'server-only'` is not
// tripped. If this ever becomes a value import, a client page importing this
// file will fail at build — which is the point of keeping these types in a
// neutral directory rather than in src/server/*: the temptation is removed
// structurally instead of relying on everyone remembering.
import type { getCampaignPaymentSummary } from '@/server/campaignPaymentService'

/**
 * GET /api/brand/campaigns/[campaignId]/payments
 *
 * The route returns the service result verbatim
 * (`NextResponse.json(summary)`), so the response shape IS the service's
 * return type — after JSON serialisation. Derived rather than hand-written so
 * a field added to the service appears here automatically, and a field removed
 * breaks the page at compile time instead of at runtime.
 *
 * Before this, the page held `useState<any>` and `const payments: any[]`. That
 * is the quieter half of the problem the Content Review crash exposed: not a
 * contradiction between page and route, but no check at all. Nothing was
 * wrong — nothing was verified either.
 */
export type CampaignPaymentSummaryResponse = Serialized<
  Awaited<ReturnType<typeof getCampaignPaymentSummary>>
>

/** One row of the ledger as the client receives it. */
export type CampaignPaymentRow = CampaignPaymentSummaryResponse['payments'][number]
