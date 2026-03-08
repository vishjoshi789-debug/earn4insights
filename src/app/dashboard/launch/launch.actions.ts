'use server'

import { redirect } from 'next/navigation'
import { Product } from '@/lib/types/product'
import { initializeProductData } from '@/lib/product/initProduct'
import { createProduct } from '@/db/repositories/productRepository'
import { triggerProductLaunchNotifications } from '@/lib/personalization/smartDistributionService'
import { notifyWatchersOnLaunch } from '@/server/watchlistService'

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
      currentStep: 0,
      isComplete: false,
      data: {
        category: 'TECH_SAAS',
        branding: {
          primaryColor: '#6366f1',
        },
        productDetails: {
          description: description || undefined,
          website: domain || undefined,
        },
      },
    },
  }

  await createProduct(product)
  initializeProductData(product.id)

  // Notify ideal consumers about the new product (non-blocking)
  triggerProductLaunchNotifications(product.id).catch((err) => {
    console.error('[LaunchProduct] Smart notification failed (non-blocking):', err)
  })

  // Notify watchlist subscribers about the launch (non-blocking)
  notifyWatchersOnLaunch(product.id).catch((err) => {
    console.error('[LaunchProduct] Watchlist notification failed (non-blocking):', err)
  })

  redirect(`/dashboard/products/${product.id}`)
}
