import { NextRequest, NextResponse } from 'next/server'
import { generateWeeklyRankings } from '@/server/rankings/rankingService'
import { withAdminAuth } from '@/lib/auth'

/**
 * POST /api/admin/generate-rankings
 * 
 * Manually trigger weekly ranking generation
 * Requires admin authentication
 */
async function generateRankingsHandler(request: NextRequest) {
  try {
    console.log('📊 Manual ranking generation triggered')

    const result = await generateWeeklyRankings()

    console.log('Result:', JSON.stringify(result, null, 2))

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Successfully generated rankings for ${result.rankings.length} categories`,
        categoriesProcessed: result.rankings.length,
        rankings: result.rankings.map(r => ({
          category: r.categoryName,
          topProductsCount: r.rankings?.length || 0,
          totalEvaluated: r.totalProductsEvaluated,
          weekStart: r.weekStart,
        })),
      }, { status: 200 })
    } else {
      return NextResponse.json({
        success: false,
        message: 'Ranking generation completed with errors',
        errors: result.errors,
        categoriesProcessed: result.rankings.length,
        rankings: result.rankings.map(r => ({
          category: r.categoryName,
          topProductsCount: r.rankings?.length || 0,
        })),
      }, { status: 500 })
    }
  } catch (error) {
    console.error('❌ Ranking generation failed:', error)
    
    // Log the full error for debugging
    if (error instanceof Error) {
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    
    return NextResponse.json({
      success: false,
      message: 'Failed to generate rankings',
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}

export const POST = withAdminAuth(generateRankingsHandler)

/**
 * GET /api/admin/generate-rankings
 * 
 * Get status of current rankings
 */
export async function GET(request: NextRequest) {
  try {
    const { getRankingsSummary } = await import('@/server/rankings/rankingService')
    const summary = await getRankingsSummary()

    return NextResponse.json({
      success: true,
      summary,
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
