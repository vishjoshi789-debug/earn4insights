import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { products } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * GET /api/import/products — Fetch products owned by the current brand user.
 * Used by the import column mapper for product assignment.
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if ((session.user as any).role !== 'brand') {
      return NextResponse.json({ error: 'Only brand users can fetch products' }, { status: 403 })
    }

    const brandProducts = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(eq(products.ownerId, session.user.id))

    return NextResponse.json({ products: brandProducts })
  } catch (error) {
    console.error('[Import Products] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}
