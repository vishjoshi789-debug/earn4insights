import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { calculateProductHealthScore } from '@/lib/analytics/productHealthScore'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ productId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { productId } = await params
    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }

    const result = await calculateProductHealthScore(productId)

    return NextResponse.json(result, {
      headers: {
        // Authenticated response — must not sit in a shared/CDN cache.
        // The body is aggregate-only (score, grade, trend, weighted
        // breakdown, counts) and carries no verbatim consumer text, so this
        // is defence in depth rather than a fix for a known leak. Matched to
        // the public-summary route so the two can't drift.
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('[HealthScore API] Error:', error)
    return NextResponse.json({ error: 'Failed to compute health score' }, { status: 500 })
  }
}
