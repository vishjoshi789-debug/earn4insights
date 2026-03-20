import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { communityPosts, users, products } from '@/db/schema'
import { desc, eq, ilike, and, sql } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { awardPoints, POINT_VALUES } from '@/server/pointsService'

// GET /api/community/posts — list posts with filters
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = req.nextUrl.searchParams
    const page = Math.max(1, parseInt(params.get('page') || '1'))
    const limit = Math.min(50, Math.max(1, parseInt(params.get('limit') || '20')))
    const offset = (page - 1) * limit
    const postType = params.get('type') // 'discussion' | 'ama' | 'announcement' | etc.
    const productId = params.get('productId')
    const search = params.get('search')

    // Build where conditions
    const conditions = []
    if (postType) conditions.push(eq(communityPosts.postType, postType))
    if (productId) conditions.push(eq(communityPosts.productId, productId))
    if (search) conditions.push(ilike(communityPosts.title, `%${search}%`))

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined

    // Fetch posts
    const postsResult = await db
      .select({
        id: communityPosts.id,
        authorId: communityPosts.authorId,
        productId: communityPosts.productId,
        title: communityPosts.title,
        body: communityPosts.body,
        postType: communityPosts.postType,
        isPinned: communityPosts.isPinned,
        isLocked: communityPosts.isLocked,
        upvotes: communityPosts.upvotes,
        downvotes: communityPosts.downvotes,
        replyCount: communityPosts.replyCount,
        viewCount: communityPosts.viewCount,
        tags: communityPosts.tags,
        pollOptions: communityPosts.pollOptions,
        createdAt: communityPosts.createdAt,
        updatedAt: communityPosts.updatedAt,
        authorName: users.name,
        authorRole: users.role,
        productName: products.name,
      })
      .from(communityPosts)
      .leftJoin(users, eq(communityPosts.authorId, users.id))
      .leftJoin(products, eq(communityPosts.productId, products.id))
      .where(whereClause)
      .orderBy(desc(communityPosts.isPinned), desc(communityPosts.createdAt))
      .limit(limit)
      .offset(offset)

    // Count total
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(communityPosts)
      .where(whereClause)

    const total = Number(countResult[0]?.count || 0)

    return NextResponse.json({
      posts: postsResult,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (error) {
    console.error('[Community Posts GET] Error:', error)
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 })
  }
}

// POST /api/community/posts — create a new post
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { title, content, postType, productId, tags, pollOptions } = body

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
    }

    if (title.trim().length > 200) {
      return NextResponse.json({ error: 'Title must be under 200 characters' }, { status: 400 })
    }

    if (content.trim().length > 10000) {
      return NextResponse.json({ error: 'Content must be under 10,000 characters' }, { status: 400 })
    }

    const validTypes = ['discussion', 'ama', 'announcement', 'feature_request', 'tips', 'poll']
    const type = validTypes.includes(postType) ? postType : 'discussion'

    // Brands can post announcements/AMAs; consumers can post discussions/feature_requests/tips
    const userRole = (session.user as any).role
    if ((type === 'announcement' || type === 'ama') && userRole !== 'brand') {
      return NextResponse.json({ error: 'Only brands can create announcements and AMAs' }, { status: 403 })
    }

    // Validate poll options if type is poll
    let validatedPollOptions = null
    if (type === 'poll') {
      if (!pollOptions || !Array.isArray(pollOptions) || pollOptions.length < 2 || pollOptions.length > 10) {
        return NextResponse.json({ error: 'Polls need 2-10 options' }, { status: 400 })
      }
      validatedPollOptions = pollOptions.map((opt: string) => ({
        id: randomUUID().slice(0, 8),
        text: String(opt).slice(0, 200),
        votes: 0,
      }))
    }

    // Validate productId if provided
    if (productId) {
      const product = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1)
      if (product.length === 0) {
        return NextResponse.json({ error: 'Product not found' }, { status: 404 })
      }
    }

    const [newPost] = await db
      .insert(communityPosts)
      .values({
        authorId: session.user.id,
        title: title.trim(),
        body: content.trim(),
        postType: type,
        productId: productId || null,
        tags: Array.isArray(tags) ? tags.slice(0, 5).map((t: string) => String(t).slice(0, 30)) : [],
        pollOptions: validatedPollOptions,
      })
      .returning()

    // Award points for creating a post
    await awardPoints(
      session.user.id,
      POINT_VALUES.community_post,
      'community_post',
      newPost.id,
      `Created community post: ${title.trim().slice(0, 50)}`,
    )

    return NextResponse.json({ post: newPost }, { status: 201 })
  } catch (error) {
    console.error('[Community Posts POST] Error:', error)
    return NextResponse.json({ error: 'Failed to create post' }, { status: 500 })
  }
}
