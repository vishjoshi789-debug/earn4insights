import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { generateWeeklyDigest } from '@/lib/analytics/weeklyDigest'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Brand owners see digest for their products
    const userId = session.user.id
    if (!userId) {
      return NextResponse.json({ error: 'User ID not found' }, { status: 400 })
    }

    const digest = await generateWeeklyDigest(userId)

    return NextResponse.json(digest, {
      headers: {
        'Cache-Control': 'private, s-maxage=300, stale-while-revalidate=600',
      },
    })
  } catch (error) {
    console.error('[WeeklyDigest API] Error:', error)
    return NextResponse.json({ error: 'Failed to generate weekly digest' }, { status: 500 })
  }
}
