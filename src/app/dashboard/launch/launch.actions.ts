'use server'

import { redirect } from 'next/navigation'
import { Product } from '@/lib/types/product'
import { initializeProductData } from '@/lib/product/initProduct'
import { addProduct } from '@/lib/product/store'

export async function launchProduct(formData: FormData) {
  const productName = formData.get('name') as string
  const platform = formData.get('platform') as string
  const domain = formData.get('domain') as string
  const description = formData.get('description') as string

  const product: Product = {
    id: crypto.randomUUID(),
    name: productName,
    description: description || undefined,
    platform: platform || undefined,
    created_at: new Date().toISOString(),
    features: {
      nps: true,
      feedback: true,
      social_listening: true,
    },
    profile: {
      isComplete: false,
      data: {
        branding: {
          name: productName,
          tagline: '',
          logo: '',
          primaryColor: '#6366f1',
        },
        productDetails: {
          description: description || '',
          category: 'SOFTWARE',
          website: domain || '',
          keyFeatures: [],
        },
        context: {
          targetAudience: '',
          useCases: [],
          competitiveAdvantages: [],
        },
      },
    },
  }

  await addProduct(product)
  initializeProductData(product.id)

  redirect(`/dashboard/products/${product.id}`)
}
