'use client'

import { useEffect } from 'react'
import { trackRankingsViewAction } from './actions'

export function RankingsViewTracker({ category }: { category?: string }) {
  useEffect(() => {
    trackRankingsViewAction(category).catch(console.error)
  }, [category])

  return null
}
