import { getProductById } from '@/lib/product/store'
import { redirect } from 'next/navigation'

export default function ProductPage({
  searchParams,
}: {
  searchParams: { productId?: string }
}) {
  const productId = searchParams.productId

  if (!productId) {
    return <div className="p-6">Invalid product</div>
  }

  const product = getProductById(productId)

  if (!product) {
    return <div className="p-6">Product not found</div>
  }

  redirect(`/dashboard/products/${productId}/feedback`)
}
