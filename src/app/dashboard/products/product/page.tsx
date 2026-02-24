'use server'

import { redirect } from 'next/navigation'
import { Product } from '@/lib/types/product'
import { initializeProductData } from '@/lib/product/initProduct'
import { addProduct } from '@/lib/product/store'

export async function launchProduct(formData: FormData) {
  const product: Product = {
    id: crypto.randomUUID(),
    name: formData.get('name') as string,
    platform: formData.get('platform') as any,
    domain: formData.get('domain') as string,
    description: formData.get('description') as string,
    status: 'launched',
    features: {
      nps: true,
      feedback: true,
      social_listening: true,
    },
    created_at: new Date().toISOString(),
  }

  // 🔒 GUARANTEED persistence
  await addProduct(product)

  initializeProductData(product.id)

  redirect(`/dashboard/products/product?productId=${product.id}`)
}
