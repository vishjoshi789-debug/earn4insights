'use server'

import 'server-only'
import { 
  getProductById as getProductByIdFromDB, 
  updateProductProfile,
  getAllProducts as getAllProductsFromDB,
  createProduct as createProductInDB,
  updateProduct as updateProductInDB,
} from '@/db/repositories/productRepository'
import type { Product, ProductProfile } from '@/lib/types/product'
import type { ProductCategory } from '@/lib/categories'

export { getProductByIdFromDB as getProductById, getAllProductsFromDB as getProducts }

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
  const product = await getProductByIdFromDB(productId)
  if (!product) return undefined

  return ensureProfile(product)
}

export async function saveStep1ProductType(
  productId: string,
  productType: ProductProfile['data']['productType'],
  category?: ProductCategory
) {
  if (!productType) return

  await updateProductProfile(productId, (prev: ProductProfile) => ({
    ...prev,
    currentStep: 2,
    data: {
      ...prev.data,
      productType,
      category: category || prev.data.category,
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
  primaryColor: string,
  logo: { url: string; filename: string; size: number } | null,
  productImages: Array<{ url: string; filename: string; alt?: string }>
) {
  await updateProductProfile(productId, (prev: ProductProfile) => ({
    ...prev,
    currentStep: 6,
    data: {
      ...prev.data,
      branding: {
        primaryColor,
        logo: logo || undefined,
        productImages: productImages.length > 0 ? productImages : undefined,
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
  productStage: NonNullable<ProductProfile['data']['context']>['productStage'],
  userBase?: NonNullable<ProductProfile['data']['context']>['userBase'] | null,
  twitter?: string,
  linkedin?: string,
  testimonials?: Array<{
    quote: string
    author: string
    role?: string
    company?: string
  }>
) {
  if (!productStage) return

  // Filter testimonials to only include those with quote and author
  const validTestimonials = testimonials?.filter(t => t.quote && t.author) || []

  await updateProductProfile(productId, (prev: ProductProfile) => ({
    ...prev,
    currentStep: 7,
    isComplete: true,
    data: {
      ...prev.data,
      context: {
        productStage,
        userBase: userBase || undefined,
        testimonials: validTestimonials.length > 0 ? validTestimonials : undefined,
        socialMedia: {
          twitter: twitter || undefined,
          linkedin: linkedin || undefined,
        },
      },
    },
  }))
}
