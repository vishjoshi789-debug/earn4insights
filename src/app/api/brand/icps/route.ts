/**
 * Brand ICP Collection API
 *
 * GET  /api/brand/icps
 *   List all ICPs for the authenticated brand.
 *   Query: ?activeOnly=true (default true)
 *
 * POST /api/brand/icps
 *   Create a new ICP.
 *   Body: { name, description?, productId?, matchThreshold?, attributes }
 *
 *   attributes shape:
 *   {
 *     version: "1.0",
 *     totalWeight: 100,
 *     criteria: {
 *       [criterionKey]: {
 *         values: string[],
 *         weight: number,       // all weights must sum to 100
 *         required: boolean,
 *         requiresConsentCategory?: string   // e.g. "psychographic"
 *       }
 *     }
 *   }
 *
 * Access: brand role only.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { ensureUserProfile } from '@/lib/auth/ensureUserProfile'
import {
  createIcp,
  getIcpsByBrand,
} from '@/db/repositories/icpRepository'

// ── Auth helper ───────────────────────────────────────────────────

async function getBrandUserId(
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
  return { userId }
}

// ── GET — list ICPs ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const auth = await getBrandUserId()
    if (auth instanceof NextResponse) return auth
    const { userId } = auth

    const activeOnly = req.nextUrl.searchParams.get('activeOnly') !== 'false'
    const icps = await getIcpsByBrand(userId, { activeOnly })

    return NextResponse.json({ icps, total: icps.length })
  } catch (error) {
    console.error('[BrandICPs GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── POST — create ICP ─────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const auth = await getBrandUserId()
    if (auth instanceof NextResponse) return auth
    const { userId } = auth

    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { name, description, productId, matchThreshold, attributes } = body

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Missing required field: name' }, { status: 400 })
    }

    if (!attributes || typeof attributes !== 'object') {
      return NextResponse.json({ error: 'Missing required field: attributes' }, { status: 400 })
    }

    if (!attributes.criteria || typeof attributes.criteria !== 'object') {
      return NextResponse.json(
        { error: 'attributes.criteria is required and must be an object' },
        { status: 400 }
      )
    }

    // Empty-criteria drafts are allowed; once criteria exist, weights must sum to 100.
    const criteriaCount = Object.keys(attributes.criteria).length
    if (criteriaCount === 0) {
      if (attributes.totalWeight !== 0) {
        return NextResponse.json(
          { error: 'attributes.totalWeight must be 0 when no criteria are set yet' },
          { status: 400 }
        )
      }
    } else if (attributes.totalWeight !== 100) {
      return NextResponse.json(
        { error: 'attributes.totalWeight must be 100 when criteria are set' },
        { status: 400 }
      )
    }

    // brand_icps.brand_id has an FK to user_profiles.id. Ensure the brand has
    // a profile row before insert — idempotent for brands that already have
    // one. Catches the legacy case where a brand signed up before the
    // auth-callback fix was deployed.
    const session = await auth()
    if (session?.user?.email) {
      try {
        await ensureUserProfile(userId, session.user.email)
      } catch (err) {
        console.error('[BrandICPs POST] ensureUserProfile failed', err)
      }
    }

    // createIcp does hard weight validation (throws if weights don't sum to 100)
    let icp
    try {
      icp = await createIcp(userId, {
        name,
        description,
        productId,
        matchThreshold: typeof matchThreshold === 'number' ? matchThreshold : 60,
        attributes,
      })
    } catch (err: any) {
      if (err.message?.includes('ICP weight validation failed')) {
        return NextResponse.json({ error: err.message }, { status: 400 })
      }
      throw err
    }

    return NextResponse.json({ icp }, { status: 201 })
  } catch (error) {
    console.error('[BrandICPs POST] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
