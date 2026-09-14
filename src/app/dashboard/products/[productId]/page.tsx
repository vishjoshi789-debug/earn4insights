import ProductOverview from './ProductOverview'
import RecentFeedback from './RecentFeedback'
import { fetchProduct } from '@/server/products/productService'
import { DashboardProductViewTracker } from './DashboardProductViewTracker'
import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth/auth.config'
import { isAdminSession } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

export default async function ProductPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const { productId } = await params

  const session = await auth()
  const product = await fetchProduct(productId)

  if (!product) notFound()

  // SECURITY: this page is SHARED, not brand-only — /dashboard/products is a
  // shared catalog and its "View details" button is rendered for every role,
  // so consumers legitimately browse other brands' products here before giving
  // feedback. An owner-only gate on the whole page would break that flow.
  //
  // So gate the sensitive part instead: <RecentFeedback> renders consumer
  // feedback with names, emails and media, and must only be shown to the
  // owning brand. Fails closed on a null owner_id like the rest of the batch
  // (products.owner_id is nullable by design — schema.ts:72), so an unclaimed
  // product never renders feedback to anyone.
  //
  // `canManage` also drives ProductOverview's brand-management CTAs (View All
  // Feedback / AI Themes / Edit product profile / Unified Analytics). Those
  // used to render for every role, so a browsing consumer saw buttons that now
  // lead to gated routes; hiding them keeps the CTA set honest.
  const isOwner = Boolean(
    session?.user?.id && product.ownerId && product.ownerId === session.user.id
  )
  const canManage = isOwner || isAdminSession(session)

  // ⚠️ WATCH BUTTON IS CONSUMER-ONLY, AND THE GATE MIRRORS THE API EXACTLY.
  //
  // `POST /api/watchlist` rejects anything but `role === 'consumer'` with a 403
  // ("Only consumers can watch products"). WatchButton itself has no role
  // awareness — it takes a productId and posts. So rendering it unconditionally
  // on this SHARED catalog page would show every brand and admin a button that
  // always fails: a false affordance of the same class this codebase keeps
  // removing.
  //
  // Matched on `role`, not the `isConsumer` capability flag, because `role` is
  // what the API actually tests. A dual-capability account (role 'consumer',
  // is_influencer true) passes both; a pure influencer is refused by both.
  // Gating on the capability flag instead would render the button for accounts
  // the API then rejects.
  const canWatch = (session?.user as any)?.role === 'consumer'

  return (
    <>
      <DashboardProductViewTracker productId={productId} />
      <ProductOverview product={product} canManage={canManage} canWatch={canWatch} />
      {/* Recent feedback with full media (audio/video/images) — owner/admin only */}
      {canManage && (
        <div className="max-w-6xl mx-auto py-6 px-0">
          <RecentFeedback productId={productId} productName={product.name} />
        </div>
      )}
    </>
  )
}