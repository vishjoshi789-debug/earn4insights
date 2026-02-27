import { redirect } from 'next/navigation'

export default async function ProductPage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string }>
}) {
  const { productId } = await searchParams

  if (!productId) {
    return <div className="p-6">Invalid product</div>
  }

  redirect(`/dashboard/products/${productId}/feedback`)
}
