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

export async function saveStep4Goal(
  productId: string,
  primaryGoal: string
) {
  if (!primaryGoal || primaryGoal.trim().length === 0) return

  await updateProductProfile(productId, (prev: ProductProfile) => ({
    ...prev,
    currentStep: 5,
    data: {
      ...prev.data,
      primaryGoal,
    },
  }))
}

export async function saveStep5Branding(
  productId: string,
  primaryColor: string
) {
  await updateProductProfile(productId, (prev: ProductProfile) => ({
    ...prev,
    currentStep: 6,
    data: {
      ...prev.data,
      branding: {
        ...prev.data.branding,
        primaryColor,
      },
    },
  }))
}

export async function saveStep6Details(
  productId: string,
  website: string,
  tagline: string,
  description: string,
  keyFeatures: string[]
) {
  await updateProductProfile(productId, (prev: ProductProfile) => ({
    ...prev,
    currentStep: 7,
    data: {
      ...prev.data,
      productDetails: {
        website: website || undefined,
        tagline: tagline || undefined,
        description: description || undefined,
        keyFeatures: keyFeatures.length > 0 ? keyFeatures : undefined,
      },
    },
  }))
}

export async function completeProfile(
  productId: string,
  productStage: string,
  userBase?: string | null,
  twitter?: string,
  linkedin?: string
) {
  if (!productStage) return

  await updateProductProfile(productId, (prev: ProductProfile) => ({
    ...prev,
    currentStep: 7,
    isComplete: true,
    data: {
      ...prev.data,
      context: {
        productStage: productStage as ProductProfile['data']['context']['productStage'],
        userBase: (userBase || undefined) as ProductProfile['data']['context']['userBase'],
        socialMedia: {
          twitter: twitter || undefined,
          linkedin: linkedin || undefined,
        },
      },
    },
  }))
}
