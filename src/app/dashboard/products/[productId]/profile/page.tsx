import ProfileClient from './ProfileClient'
import { fetchProduct } from '@/server/products/productService'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth.config'
import { isAdminSession } from '@/lib/auth/roles'

export const dynamic = 'force-dynamic'

export default async function ProductProfilePage({
  params,
}: {
  params: Promise<{ productId: string }>
}) {
  const { productId } = await params

  // SECURITY: ownership gate. This page exposes the brand's product profile
  // (audience, channels, goals, branding, testimonials) and is the UI for the
  // write actions in ./actions.ts, which are separately guarded. notFound()
  // rather than the inline "Product not found" so an unowned product is
  // indistinguishable from a missing one. Denies on a null owner_id like the
  // rest of the batch (products.owner_id is nullable by design — schema.ts:72).
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const product = await fetchProduct(productId)

  if (!product) notFound()

  // Admin bypass — platform-wide policy, see lib/auth/roles.ts.
  if (!isAdminSession(session)) {
    if (!product.ownerId || product.ownerId !== session.user.id) {
      notFound()
    }
  }

  const profile = product.profile ?? { currentStep: 1, data: {} }

  return (
    <ProfileClient
      productId={product.id}
      profile={profile as any}
    />
  )
}