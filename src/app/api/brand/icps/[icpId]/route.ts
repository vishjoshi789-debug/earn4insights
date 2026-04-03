/**
 * Brand ICP Item API
 *
 * GET    /api/brand/icps/[icpId]   — Get a single ICP with match stats summary
 * PATCH  /api/brand/icps/[icpId]   — Update ICP name/description/attributes/threshold
 * DELETE /api/brand/icps/[icpId]   — Deactivate ICP (soft-delete, audit-safe)
 *
 * Access: brand role only. Brands can only access their own ICPs.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import {
  getIcpById,
  updateIcp,
  deactivateIcp,
  getTopMatchesForIcp,
} from '@/db/repositories/icpRepository'

// ── Auth + ownership check ────────────────────────────────────────

async function getBrandAndVerifyOwnership(
  icpId: string
): Promise<{ userId: string } | NextResponse> {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id
  const role = (session.user as any).role
  if (!userId || role !== 'brand') {
    return NextResponse.json({ error: 'Brand access only' }, { status: 403 })
  }

  const icp = await getIcpById(icpId)
  if (!icp) {
    return NextResponse.json({ error: 'ICP not found' }, { status: 404 })
  }
  if (icp.brandId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return { userId }
}

// ── GET — single ICP ──────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ icpId: string }> }
) {
  try {
    const { icpId } = await params
    const authResult = await getBrandAndVerifyOwnership(icpId)
    if (authResult instanceof NextResponse) return authResult

    const icp = await getIcpById(icpId)
    if (!icp) return NextResponse.json({ error: 'ICP not found' }, { status: 404 })

    // Include a lightweight match stats summary
    const topMatches = await getTopMatchesForIcp(icpId, {
      minScore: icp.matchThreshold,
      limit: 5,
    })

    return NextResponse.json({
      icp,
      matchStats: {
        aboveThreshold: topMatches.length,
        topScore: topMatches[0]?.matchScore ?? null,
      },
    })
  } catch (error) {
    console.error('[BrandICPs GET single] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── PATCH — update ICP ────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ icpId: string }> }
) {
  try {
    const { icpId } = await params
    const authResult = await getBrandAndVerifyOwnership(icpId)
    if (authResult instanceof NextResponse) return authResult

    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { name, description, attributes, matchThreshold } = body

    // Only pass defined fields — updateIcp handles partial updates
    const updates: Parameters<typeof updateIcp>[1] = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description
    if (attributes !== undefined) updates.attributes = attributes
    if (matchThreshold !== undefined) updates.matchThreshold = matchThreshold

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
    }

    let updated
    try {
      updated = await updateIcp(icpId, updates)
    } catch (err: any) {
      if (err.message?.includes('ICP weight validation failed')) {
        return NextResponse.json({ error: err.message }, { status: 400 })
      }
      if (err.message?.includes('ICP not found')) {
        return NextResponse.json({ error: 'ICP not found' }, { status: 404 })
      }
      throw err
    }

    return NextResponse.json({ icp: updated })
  } catch (error) {
    console.error('[BrandICPs PATCH] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── DELETE — deactivate ICP ───────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ icpId: string }> }
) {
  try {
    const { icpId } = await params
    const authResult = await getBrandAndVerifyOwnership(icpId)
    if (authResult instanceof NextResponse) return authResult

    await deactivateIcp(icpId)

    return NextResponse.json({ success: true, message: 'ICP deactivated.' })
  } catch (error) {
    console.error('[BrandICPs DELETE] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
