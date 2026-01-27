'use client'

import { useEffect } from 'react'
import { trackCommunityFeatureAction } from './actions'

export function CommunityFeatureTracker({ feature }: { feature: string }) {
  useEffect(() => {
    trackCommunityFeatureAction(feature).catch(console.error)
  }, [feature])

  return null
}
