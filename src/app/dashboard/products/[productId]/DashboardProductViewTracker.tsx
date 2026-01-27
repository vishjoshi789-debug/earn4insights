'use client'

import { useEffect } from 'react'
import { trackDashboardProductViewAction } from './actions'

export function DashboardProductViewTracker({ productId }: { productId: string }) {
  useEffect(() => {
    trackDashboardProductViewAction(productId).catch(console.error)
  }, [productId])

  return null
}
