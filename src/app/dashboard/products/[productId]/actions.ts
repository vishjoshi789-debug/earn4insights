'use server'

import { auth } from '@/lib/auth/auth.config'
import { ensureUserProfile } from '@/lib/auth/ensureUserProfile'
import { trackProductView } from '@/server/eventTrackingService'
import { getOrCreateSessionId } from '@/lib/sessionManager'
import { getProductById } from '@/server/products/productRepository'

export async function trackDashboardProductViewAction(productId: string) {
  try {
    const session = await auth()
    if (!session?.user?.id || !session?.user?.email) {
      return { success: false }
    }

    await ensureUserProfile(session.user.id, session.user.email)
    const sessionId = await getOrCreateSessionId()
    
    // Get product category for metadata
    const product = await getProductById(productId)
    const category = product?.profile?.category
    
    await trackProductView(session.user.id, productId, sessionId, category)
    return { success: true }
  } catch (error) {
    console.error('Error tracking dashboard product view:', error)
    return { success: false }
  }
}
