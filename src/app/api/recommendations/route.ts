import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getPersonalizedRecommendations, getTrendingProducts } from '@/server/personalizationEngine'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)

    let recommendations
    try {
      recommendations = await getPersonalizedRecommendations(session.user.id, limit)
    } catch (error: any) {
      // If consent denied or profile not found, fall back to trending
      if (error.message?.includes('consent') || error.message?.includes('profile')) {
        recommendations = await getTrendingProducts(limit)
      } else {
        throw error
      }
    }

    // If personalization returned nothing, fall back to trending
    if (!recommendations || recommendations.length === 0) {
      recommendations = await getTrendingProducts(limit)
    }

    return NextResponse.json({
      recommendations,
      meta: {
        count: recommendations.length,
        personalized: recommendations.some(r => r.score >= 50),
      }
    }, {
      headers: {
        'Cache-Control': 'private, s-maxage=120, stale-while-revalidate=300',
      },
    })
  } catch (error) {
    console.error('[Recommendations API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate recommendations' },
      { status: 500 }
    )
  }
}
