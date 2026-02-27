import { redirect } from 'next/navigation'

export default async function ProductPage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string }>
}) {
  const { productId } = await searchParams

  if (!productId) {
    redirect('/dashboard/products')
  }

  redirect(`/dashboard/products/${productId}`)
}
