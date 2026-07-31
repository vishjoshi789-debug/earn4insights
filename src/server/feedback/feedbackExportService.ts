'use server'

import 'server-only'
import { auth } from '@/lib/auth/auth.config'
import { isAdminSession } from '@/lib/auth/roles'
import { getProductById } from '@/db/repositories/productRepository'
import {
  getFeedbackByProduct,
  getMediaForFeedbackIds,
} from '@/db/repositories/feedbackRepository'
import {
  parseFeedbackFilters,
  type FeedbackSearchParams,
} from '@/lib/feedback/filterParams'
import { buildFeedbackCsv } from '@/lib/feedback/feedbackCsv'

/**
 * Hard cap on rows per export. Vercel functions time out at 60s and the whole
 * CSV is built in memory, so this bounds both. Well above any realistic
 * per-product volume today; revisit with streaming if a product nears it.
 */
const MAX_EXPORT_ROWS = 10000

/**
 * Assert the session owns `productId`. Admins bypass per lib/auth/roles.ts.
 *
 * SECURITY: this is a 'use server' action — a directly invokable endpoint, not
 * merely the export button's callback. Without this any authenticated caller
 * could POST an arbitrary productId and receive every consumer's name, email
 * and feedback text. Exactly the hole the survey export had before 61b31af.
 *
 * Fails closed and stays silent: no session, unknown product, product with no
 * owner_id, and owner mismatch all raise the SAME generic error, so a caller
 * cannot probe which product ids exist.
 */
async function assertProductOwnedByCaller(productId: string): Promise<void> {
  const denied = () => new Error('Product not found or access denied')

  const session = await auth()
  if (!session?.user?.id) throw denied()
  if (isAdminSession(session)) return

  const product = await getProductById(productId)
  if (!product?.ownerId || product.ownerId !== session.user.id) throw denied()
}

/**
 * Export a product's direct feedback as CSV, honouring the same filters as the
 * dashboard list.
 *
 * Filters are applied in SQL by the repository, so the export reflects EVERY
 * matching row — not just the page's first 100.
 */
export async function exportFeedbackToCSV(
  productId: string,
  searchParams?: FeedbackSearchParams
): Promise<string> {
  await assertProductOwnedByCaller(productId)

  // Takes RAW query params and parses them here rather than accepting
  // pre-parsed filters from the client: the client can't be trusted to have
  // validated them, and it guarantees the export runs the exact same
  // parseFeedbackFilters the page does — so "what I see" and "what I get"
  // cannot drift. (That drift is precisely what broke the survey export's
  // single-day date range.)
  const filters = parseFeedbackFilters(searchParams ?? {})

  const items = await getFeedbackByProduct(productId, {
    ...filters,
    limit: MAX_EXPORT_ROWS,
  })

  if (items.length === 0) return 'No feedback matches the current filters'

  // Media presence only — never URLs. See the note in feedbackCsv.ts.
  const mediaMap = await getMediaForFeedbackIds(items.map((i) => i.id))

  return buildFeedbackCsv(items, mediaMap)
}
