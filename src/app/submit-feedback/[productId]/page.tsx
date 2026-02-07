import { getProductById } from '@/db/repositories/productRepository'
import { redirect } from 'next/navigation'
import DirectFeedbackForm from './DirectFeedbackForm'

/**
 * /submit-feedback/[productId]
 * 
 * Pre-selected product feedback page.
 * Brands can share this link with consumers:
 *   https://earn4insights.com/submit-feedback/abc123
 * 
 * The product is pre-selected and the consumer can immediately start
 * leaving feedback without needing to search for the product.
 */
export default async function ProductFeedbackPage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const { productId } = await params
  
  const product = await getProductById(productId)
  
  if (!product) {
    // Product not found, redirect to generic feedback page
    redirect('/submit-feedback')
  }

  return (
    <DirectFeedbackForm
      preselectedProduct={{
        id: product.id,
        name: product.name,
        description: product.description || undefined,
      }}
    />
  )
}
