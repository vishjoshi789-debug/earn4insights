'use server'

import 'server-only'
import { getProductById, updateProductProfile } from '@/lib/product/store'
import type { Product, ProductProfile } from '@/lib/types/product'

function ensureProfile(product: Product): Product {
  if (product.profile) return product

  return {
    ...product,
    profile: {
      currentStep: 1,
      isComplete: false,
      data: {},
    },
  }
}

export async function fetchProduct(productId: string) {
  const product = await getProductById(productId)
  if (!product) return undefined

  return ensureProfile(product)
}

export async function saveStep1ProductType(
  productId: string,
  productType: ProductProfile['data']['productType']
) {
  if (!productType) return

  await updateProductProfile(productId, (prev: ProductProfile) => ({
    ...prev,
    currentStep: 2,
    data: {
      ...prev.data,
      productType,
    },
  }))
}

export async function saveStep2Audience(
  productId: string,
  audienceType: ProductProfile['data']['audienceType'],
  targetDescription?: string
) {
  if (!audienceType) return

  await updateProductProfile(productId, (prev: ProductProfile) => ({
    ...prev,
    currentStep: 3,
    data: {
      ...prev.data,
      audienceType,
      targetDescription: targetDescription || prev.data.targetDescription,
    },
  }))
}

export async function saveStep3Channels(
  productId: string,
  feedbackChannels: string[]
) {
  if (!feedbackChannels || feedbackChannels.length === 0) return

  await updateProductProfile(productId, (prev: ProductProfile) => ({
    ...prev,
    currentStep: 4,
    data: {
      ...prev.data,
      feedbackChannels,
    },
  }))
}

export async function completeProfile(
  productId: string,
  primaryGoal: string
) {
  if (!primaryGoal || primaryGoal.trim().length === 0) return

  await updateProductProfile(productId, (prev: ProductProfile) => ({
    ...prev,
    currentStep: 4,
    isComplete: true,
    data: {
      ...prev.data,
      primaryGoal,
    },
  }))
}
