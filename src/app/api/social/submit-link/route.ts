import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { products } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { processSubmittedLink } from '@/server/social/socialIngestionService'

/**
 * POST /api/social/submit-link — brand submits a URL to be analysed
 *
 * Body: { url: string, productId: string, notes?: string }
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { url, productId, notes } = body

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }
  if (!productId || typeof productId !== 'string') {
    return NextResponse.json({ error: 'productId is required' }, { status: 400 })
  }

  // Validate URL format
  try {
    new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
  }

  // Verify product belongs to this brand
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.ownerId, session.user.id)))

  if (!product) {
    return NextResponse.json({ error: 'Product not found or not owned by you' }, { status: 404 })
  }

  const result = await processSubmittedLink(url, productId, notes)

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  return NextResponse.json({ success: true, postId: result.postId })
}
