'use server'

import { revalidatePath } from 'next/cache'
import { 
  saveStep1ProductType as saveStep1,
  saveStep2Audience as saveStep2,
  saveStep3Channels as saveStep3,
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

export async function completeProfile(
  productId: string,
  primaryGoal: string
) {
  await completeProfileService(productId, primaryGoal)
  revalidatePath(`/dashboard/products/${productId}`)
  revalidatePath(`/dashboard/products/${productId}/profile`)
}