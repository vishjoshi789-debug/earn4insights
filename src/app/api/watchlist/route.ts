/**
 * Watchlist API — Phase 1A
 *
 * POST  /api/watchlist          — Add product to watchlist
 * GET   /api/watchlist          — Get consumer's watchlist
 * DELETE /api/watchlist?id=xxx  — Remove from watchlist
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { addToWatchlist, getWatchlist, removeFromWatchlist, isWatching } from '@/server/watchlistService'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    if (!userId) {
      return NextResponse.json({ error: 'User ID not found' }, { status: 401 })
    }

    // Check if watching a specific product
    const productId = req.nextUrl.searchParams.get('productId')
    if (productId) {
      const watching = await isWatching(userId, productId)
      return NextResponse.json({ watching: !!watching, entries: watching || [] })
    }

    const entries = await getWatchlist(userId)
    return NextResponse.json({ entries })
  } catch (error) {
    console.error('[Watchlist GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const role = (session.user as any).role
    if (!userId || role !== 'consumer') {
      return NextResponse.json({ error: 'Only consumers can watch products' }, { status: 403 })
    }

    const body = await req.json()
    const { productId, watchType, desiredFeature, notifyChannels } = body

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 })
    }

    const result = await addToWatchlist({
      userId,
      productId,
      watchType: watchType || 'any',
      desiredFeature,
      notifyChannels,
    })

    if (result.alreadyExists) {
      return NextResponse.json({ message: 'Already watching', entry: result.entry }, { status: 200 })
    }

    return NextResponse.json({ message: 'Added to watchlist', entry: result.entry }, { status: 201 })
  } catch (error) {
    console.error('[Watchlist POST] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const id = req.nextUrl.searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Watchlist entry id is required' }, { status: 400 })
    }

    const removed = await removeFromWatchlist(id, userId)
    if (!removed) {
      return NextResponse.json({ error: 'Not found or not yours' }, { status: 404 })
    }

    return NextResponse.json({ message: 'Removed from watchlist' })
  } catch (error) {
    console.error('[Watchlist DELETE] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
