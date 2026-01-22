import ProfileClient from './ProfileClient'
import { fetchProduct } from '@/server/products/productService'

export const dynamic = 'force-dynamic'

export default async function ProductProfilePage({
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
    <ProfileClient
      productId={product.id}
      profile={product.profile}
    />
  )
}