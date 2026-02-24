'use server'

import { redirect } from 'next/navigation'
import { Product } from '@/lib/types/product'
import { initializeProductData } from '@/lib/product/initProduct'

export async function launchProduct(formData: FormData) {
  const product: Product = {
    id: crypto.randomUUID(),
    name: formData.get('name') as string,
    platform: formData.get('platform') as string,
    description: formData.get('description') as string,
    features: {
      nps: true,
      feedback: true,
      social_listening: true,
    },
    profile: { currentStep: 1, isComplete: false, data: {} },
    created_at: new Date().toISOString(),
  }

  ;(globalThis as any).__products ??= []
  ;(globalThis as any).__products.push(product)

  initializeProductData(product.id)

  redirect(`/dashboard/products/product?productId=${product.id}`)
}
