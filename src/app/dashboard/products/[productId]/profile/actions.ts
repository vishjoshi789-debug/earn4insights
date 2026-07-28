'use server'

import { revalidatePath } from 'next/cache'
import type { ProductProfile } from '@/lib/types/product'
import { auth } from '@/lib/auth/auth.config'
import { isAdminSession } from '@/lib/auth/roles'
import { getProductById } from '@/db/repositories/productRepository'
import {
  saveStep1ProductType as saveStep1,
  saveStep2Audience as saveStep2,
  saveStep3Channels as saveStep3,
  saveStep4Goal as saveStep4,
  saveStep5Branding as saveStep5,
  saveStep6Details as saveStep6,
  completeProfile as completeProfileService
} from '@/server/products/productService'

/**
 * Assert the current session owns `productId`.
 *
 * SECURITY: every export below is a 'use server' action — a directly invokable
 * endpoint, not merely `ProfileClient`'s callback — and every one is a WRITE
 * that takes productId as its first argument. Without this guard any
 * authenticated user could overwrite another brand's product profile
 * (positioning, audience, channels, goal, branding, testimonials).
 *
 * Fails closed and stays silent: no session, unknown product, product with no
 * owner_id, and owner mismatch all raise the SAME generic error, so a caller
 * cannot probe which product ids exist. Denying on a null owner_id is
 * deliberate — products.owner_id is nullable by design (schema.ts:72, "null
 * for unclaimed placeholders"), and an unclaimed product must not be writable
 * by every logged-in user. Mirrors assertSurveyOwnedByCaller in
 * src/server/surveys/responseService.ts.
 *
 * This actions file is the SOLE entry point to the underlying productService
 * step/profile writes (ProfileClient imports from './actions'), so guarding
 * here covers the whole surface.
 */
async function assertProductOwnedByCaller(productId: string): Promise<void> {
  const denied = () => new Error('Product not found or access denied')

  const session = await auth()
  const userId = session?.user?.id
  if (!userId) throw denied()

  // Admin bypass — platform-wide policy, see lib/auth/roles.ts. NOTE these are
  // WRITE actions, so this grants admins edit rights over any brand's product
  // profile. That follows the stated platform-wide rule; narrow it here if
  // admin access should ever be read-only.
  if (isAdminSession(session)) return

  const product = await getProductById(productId)
  if (!product?.ownerId || product.ownerId !== userId) throw denied()
}

// Re-export service functions as actions with revalidation

export async function saveStep1ProductType(
  productId: string,
  productType: string
) {
  await assertProductOwnedByCaller(productId)
  await saveStep1(productId, productType)
  revalidatePath(`/dashboard/products/${productId}`)
  revalidatePath(`/dashboard/products/${productId}/profile`)
}

export async function saveStep2Audience(
  productId: string,
  audienceType: string,
  targetDescription?: string
) {
  await assertProductOwnedByCaller(productId)
  await saveStep2(productId, audienceType, targetDescription)
  revalidatePath(`/dashboard/products/${productId}`)
  revalidatePath(`/dashboard/products/${productId}/profile`)
}

export async function saveStep3Channels(
  productId: string,
  feedbackChannels: string[]
) {
  await assertProductOwnedByCaller(productId)
  await saveStep3(productId, feedbackChannels)
  revalidatePath(`/dashboard/products/${productId}`)
  revalidatePath(`/dashboard/products/${productId}/profile`)
}

export async function saveStep4Goal(
  productId: string,
  primaryGoal: string
) {
  await assertProductOwnedByCaller(productId)
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
  await assertProductOwnedByCaller(productId)
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
  await assertProductOwnedByCaller(productId)
  await saveStep6(productId, website, tagline, description, keyFeatures)
  revalidatePath(`/dashboard/products/${productId}`)
  revalidatePath(`/dashboard/products/${productId}/profile`)
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
  await assertProductOwnedByCaller(productId)
  await completeProfileService(productId, productStage, userBase, twitter, linkedin, testimonials)
  revalidatePath(`/dashboard/products/${productId}`)
  revalidatePath(`/dashboard/products/${productId}/profile`)
}