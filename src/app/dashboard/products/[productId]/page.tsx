import ProductOverview from './ProductOverview'
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
    </>
  )
}