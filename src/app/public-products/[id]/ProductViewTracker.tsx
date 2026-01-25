'use client'

import { useEffect } from 'react'
import { trackProductViewAction } from './actions'

export function ProductViewTracker({ productId }: { productId: string }) {
  useEffect(() => {
    // Track product view when component mounts
    trackProductViewAction(productId).catch(console.error)
  }, [productId])

  return null // This component doesn't render anything
}
