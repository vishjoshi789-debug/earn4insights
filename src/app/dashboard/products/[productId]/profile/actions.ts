'use server'

import { revalidatePath } from 'next/cache'
import { 
  saveStep1ProductType as saveStep1,
  saveStep2Audience as saveStep2,
  saveStep3Channels as saveStep3,
  saveStep4Goal as saveStep4,
  saveStep5Branding as saveStep5,
  saveStep6Details as saveStep6,
  completeProfile as completeProfileService
} from '@/server/products/productService'

// Re-export service functions as actions with revalidation

export async function saveStep1ProductType(
  productId: string,
  productType: string
) {
  await saveStep1(productId, productType)
  revalidatePath(`/dashboard/products/${productId}`)
  revalidatePath(`/dashboard/products/${productId}/profile`)
}

export async function saveStep2Audience(
  productId: string,
  audienceType: string,
  targetDescription?: string
) {
  await saveStep2(productId, audienceType, targetDescription)
  revalidatePath(`/dashboard/products/${productId}`)
  revalidatePath(`/dashboard/products/${productId}/profile`)
}

export async function saveStep3Channels(
  productId: string,
  feedbackChannels: string[]
) {
  await saveStep3(productId, feedbackChannels)
  revalidatePath(`/dashboard/products/${productId}`)
  revalidatePath(`/dashboard/products/${productId}/profile`)
}

export async function saveStep4Goal(
  productId: string,
  primaryGoal: string
) {
  await saveStep4(productId, primaryGoal)
  revalidatePath(`/dashboard/products/${productId}`)
  revalidatePath(`/dashboard/products/${productId}/profile`)
}

export async function saveStep5Branding(
  productId: string,
  primaryColor: string,
  logo: { url: string; filename: string; size: number } | null,
  productImages: Array<{ url: string; filename: string; alt?: string }>
) {
  await saveStep5(productId, primaryColor, logo, productImages)
  revalidatePath(`/dashboard/products/${productId}`)
  revalidatePath(`/dashboard/products/${productId}/profile`)
}

export async function saveStep6Details(
  productId: string,
  website: string,
  tagline: string,
  description: string,
  keyFeatures: string[]
) {
  await saveStep6(productId, website, tagline, description, keyFeatures)
  revalidatePath(`/dashboard/products/${productId}`)
  revalidatePath(`/dashboard/products/${productId}/profile`)
}

export async function completeProfile(
  productId: string,
  productStage: string,
  userBase?: string | null,
  twitter?: string,
  linkedin?: string,
  testimonials?: Array<{
    quote: string
    author: string
    role?: string
    company?: string
  }>
) {
  await completeProfileService(productId, productStage, userBase, twitter, linkedin, testimonials)
  revalidatePath(`/dashboard/products/${productId}`)
  revalidatePath(`/dashboard/products/${productId}/profile`)
}