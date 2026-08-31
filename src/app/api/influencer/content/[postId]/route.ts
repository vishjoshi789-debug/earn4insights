/**
 * Influencer Content Post Detail API
 *
 * GET    /api/influencer/content/[postId] — Get post details
 * PATCH  /api/influencer/content/[postId] — Update post
 * DELETE /api/influencer/content/[postId] — Delete post
 *
 * Access: authenticated influencer (own posts only)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import {
  getPostById,
  updatePost,
  updatePostStatus,
  deletePost,
} from '@/db/repositories/influencerContentPostRepository'
import { isCampaignParticipant } from '@/db/repositories/influencerCampaignRepository'

type RouteParams = { params: Promise<{ postId: string }> }

/**
 * Status transitions a CREATOR may perform directly on their own post.
 *
 * ⚠️ This is deliberately tiny, and smaller than it first looks like it should
 * be. Before this existed the route accepted ANY status and passed it straight
 * to updatePostStatus — ownership was checked, the transition was not. A
 * creator could set 'published', 'approved', 'archived', 'removed', or flip a
 * REJECTED post back to 'published'.
 *
 * Every legitimate creator transition already has a DEDICATED route that also
 * performs the side effects this one would skip:
 *
 *   draft/rejected → pending_review   POST /api/influencer/posts/[id]/submit-review
 *       (emits BRAND_CONTENT_PENDING_REVIEW — a PATCH straight to
 *        pending_review submits work the brand is never told about)
 *
 *   rejected → pending_review         POST /api/influencer/posts/[id]/resubmit
 *       (increments resubmission_count AND clears reviewed_at / reviewed_by /
 *        rejection_reason — which is what stops a resubmitted post still
 *        counting as payment authorisation)
 *
 * So those are NOT listed here. Routing them through the PATCH would duplicate
 * the state machine and let the side effects be bypassed. Only draft ↔ archived
 * remains, because it has no dedicated route and no side effects.
 *
 * ⚠️ 'published' is BRAND-ONLY here even though a creator can legitimately
 * reach it for standalone content — that happens via submitForReview, which
 * publishes directly only when the post has no campaignId and no brandId. A
 * creator-set 'published' through this route would be indistinguishable from
 * brand approval by status alone.
 */
const ALLOWED_INFLUENCER_TRANSITIONS: Record<string, string[]> = {
  draft: ['archived'],
  archived: ['draft'],
}

/** Points the caller at the route that DOES perform the transition. */
const TRANSITION_HINTS: Record<string, string> = {
  pending_review:
    'Use POST /api/influencer/posts/[id]/submit-review (or /resubmit after a rejection) — ' +
    'those notify the brand and maintain the resubmission count.',
  published: 'Only a brand can publish campaign work, by approving it.',
  approved: 'Only a brand can approve content.',
  rejected: 'Only a brand can reject content.',
  removed: 'Removal is a moderation action.',
}

async function getInfluencerUser(): Promise<{ userId: string } | NextResponse> {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return { userId: (session.user as any).id }
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getInfluencerUser()
    if (authResult instanceof NextResponse) return authResult

    const { postId } = await params
    const post = await getPostById(postId)
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    if (post.influencerId !== authResult.userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    return NextResponse.json({ post })
  } catch (error) {
    console.error('[ContentDetail GET]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getInfluencerUser()
    if (authResult instanceof NextResponse) return authResult

    const { postId } = await params
    const existing = await getPostById(postId)
    if (!existing) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    if (existing.influencerId !== authResult.userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    // Handle status change separately
    if (body.status && body.status !== existing.status) {
      const allowed = ALLOWED_INFLUENCER_TRANSITIONS[existing.status] ?? []
      if (!allowed.includes(body.status)) {
        return NextResponse.json(
          {
            error:
              `A creator cannot move a post from "${existing.status}" to "${body.status}". ` +
              (TRANSITION_HINTS[body.status] ?? 'This transition is brand-only.'),
            code: 'transition_not_allowed',
          },
          { status: 400 }
        )
      }
      const post = await updatePostStatus(postId, body.status)
      return NextResponse.json({ post })
    }

    const allowed = ['title', 'body', 'mediaType', 'mediaUrls', 'thumbnailUrl', 'platformsCrossPosted', 'productId', 'brandId', 'campaignId', 'tags', 'externalPostUrls']
    const updates: Record<string, any> = {}
    for (const key of allowed) {
      if (body[key] !== undefined) updates[key] = body[key]
    }

    // ⚠️ THE QUIETER HOLE. campaignId is in the allow-list above, so a creator
    // can ATTACH a campaign to an existing post after creating it — bypassing
    // any check that only guards creation. Same control as POST, and it has to
    // be here too or the POST check is decorative: create standalone, then
    // PATCH the campaign on.
    //
    // Only validated when the value actually CHANGES, so unrelated edits to a
    // post already on a campaign are not re-gated (and a campaign the creator
    // was removed from does not lock them out of fixing a typo).
    if (
      updates.campaignId !== undefined &&
      updates.campaignId !== null &&
      updates.campaignId !== existing.campaignId
    ) {
      if (typeof updates.campaignId !== 'string') {
        return NextResponse.json({ error: 'campaignId must be a string' }, { status: 400 })
      }
      const isMember = await isCampaignParticipant(updates.campaignId, authResult.userId)
      if (!isMember) {
        return NextResponse.json(
          {
            error:
              'You are not a participant on that campaign, so you cannot attach content to it. ' +
              'Accept the campaign invitation first.',
            code: 'not_campaign_participant',
          },
          { status: 403 }
        )
      }
    }

    const post = await updatePost(postId, updates)
    return NextResponse.json({ post })
  } catch (error) {
    console.error('[ContentDetail PATCH]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await getInfluencerUser()
    if (authResult instanceof NextResponse) return authResult

    const { postId } = await params
    const existing = await getPostById(postId)
    if (!existing) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    if (existing.influencerId !== authResult.userId) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    await deletePost(postId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[ContentDetail DELETE]', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
