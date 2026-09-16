/**
 * GET /api/brand/products
 *
 * The authenticated brand's OWN products — id and name only — for pickers.
 *
 * Exists because the brand deal form had no way to attach a deal to a product:
 * the API accepted productId, the schema had the column, the watcher notifier
 * read it, and the form never collected it. Every deal created through the UI
 * was born with product_id = NULL, so notifyWatchersOnDeal's null guard fired
 * on every one — an emitter no brand could reach. Sixth ignition-key instance
 * of the 2026-09 session, and the one that was built without checking the
 * form. Same defect class as the survey product picker (3eefa3a).
 *
 * Owner-scoped by construction: getProductsByOwner filters on ownerId, so a
 * brand cannot enumerate another brand's products here. Admin gets the same
 * owner-scoped list — this is a picker for "my products", not a catalogue.
 *
 * Auth: brand session.
 */
import 'server-only'

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { getProductsByOwner } from '@/db/repositories/productRepository'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const role = (session.user as any).role
    if (role !== 'brand' && role !== 'admin') {
      return NextResponse.json({ error: 'Brand access only' }, { status: 403 })
    }

    const owned = await getProductsByOwner(session.user.id)

    // Minimal projection — a picker needs a label and a value, nothing else.
    return NextResponse.json({
      products: owned.map((p) => ({
        id: p.id,
        name: p.name,
        launchStatus: p.launchStatus,
      })),
    })
  } catch (error) {
    console.error('[BrandProducts GET]', error)
    return NextResponse.json({ error: 'Failed to load products' }, { status: 500 })
  }
}
