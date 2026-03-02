import ProductOverview from './ProductOverview'
import RecentFeedback from './RecentFeedback'
import { fetchProduct } from '@/server/products/productService'
import { DashboardProductViewTracker } from './DashboardProductViewTracker'

export const dynamic = 'force-dynamic'

export default async function ProductPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const { productId } = await params

  const product = await fetchProduct(productId)

  if (!product) {
    return <div className="p-6">Product not found</div>
  }

  return (
    <>
      <DashboardProductViewTracker productId={productId} />
      <ProductOverview product={product} />
      {/* Recent feedback with full media (audio/video/images) directly on the product page */}
      <div className="max-w-6xl mx-auto py-6 px-0">
        <RecentFeedback productId={productId} productName={product.name} />
      </div>
    </>
  )
}