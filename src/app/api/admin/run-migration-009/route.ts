import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 009: Deals Discovery + Community
 * POST /api/admin/run-migration-009
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Creates 9 new tables:
 *   - deals (brand deal listings)
 *   - community_deals_posts (Reddit-style community posts)
 *   - community_deals_post_votes (upvote/downvote)
 *   - community_deals_post_saves (bookmarks)
 *   - community_deals_comments (threaded comments)
 *   - community_deals_comment_votes (comment votes)
 *   - deal_saves (deal bookmarks)
 *   - deal_redemptions (promo code copies / redirect clicks)
 *   - community_deals_flags (content flagging)
 *
 * Also creates full-text search triggers for deals + community_deals_posts.
 *
 * Prerequisites: migrations 001-008 must be applied first.
 * Idempotent: all statements use IF NOT EXISTS.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { name: string; status: string }[] = []

  try {
    // ── 1. CREATE deals ──────────────────────────────────────────────
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS deals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        brand_id TEXT NOT NULL,
        product_id TEXT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        deal_type TEXT NOT NULL,
        discount_value NUMERIC(10,2),
        discount_currency TEXT DEFAULT 'INR',
        promo_code TEXT,
        redirect_url TEXT,
        original_price INTEGER,
        discounted_price INTEGER,
        max_redemptions INTEGER,
        redemption_count INTEGER NOT NULL DEFAULT 0,
        valid_from TIMESTAMP NOT NULL DEFAULT NOW(),
        valid_until TIMESTAMP,
        category TEXT,
        tags TEXT[] DEFAULT '{}',
        icp_target_data JSONB,
        status TEXT NOT NULL DEFAULT 'draft',
        is_featured BOOLEAN NOT NULL DEFAULT false,
        is_verified BOOLEAN NOT NULL DEFAULT true,
        verification_note TEXT,
        view_count INTEGER NOT NULL DEFAULT 0,
        save_count INTEGER NOT NULL DEFAULT 0,
        search_vector tsvector,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_deals_brand_status ON deals(brand_id, status)`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_deals_product_status ON deals(product_id, status)`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_deals_category_status ON deals(category, status)`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_deals_valid_until ON deals(valid_until) WHERE status = 'active'`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_deals_featured_status ON deals(is_featured, status)`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_deals_search ON deals USING GIN(search_vector)`)

    // deals full-text search trigger
    await pgClient.unsafe(`
      CREATE OR REPLACE FUNCTION update_deals_search() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector := to_tsvector('english',
          COALESCE(NEW.title,'') || ' ' ||
          COALESCE(NEW.description,'') || ' ' ||
          COALESCE(array_to_string(NEW.tags,' '),'')
        );
        NEW.updated_at := NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `)
    await pgClient.unsafe(`DROP TRIGGER IF EXISTS deals_search_trigger ON deals`)
    await pgClient.unsafe(`
      CREATE TRIGGER deals_search_trigger
        BEFORE INSERT OR UPDATE ON deals
        FOR EACH ROW EXECUTE FUNCTION update_deals_search()
    `)
    results.push({ name: 'deals', status: 'created' })

    // ── 2. CREATE community_deals_posts ──────────────────────────────
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS community_deals_posts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        author_id TEXT NOT NULL,
        author_role TEXT NOT NULL,
        post_type TEXT NOT NULL DEFAULT 'deal',
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        image_urls TEXT[] DEFAULT '{}',
        product_id TEXT,
        brand_id TEXT,
        deal_id UUID,
        external_url TEXT,
        promo_code TEXT,
        discount_details TEXT,
        category TEXT,
        tags TEXT[] DEFAULT '{}',
        upvote_count INTEGER NOT NULL DEFAULT 0,
        downvote_count INTEGER NOT NULL DEFAULT 0,
        comment_count INTEGER NOT NULL DEFAULT 0,
        save_count INTEGER NOT NULL DEFAULT 0,
        is_brand_verified BOOLEAN NOT NULL DEFAULT false,
        verified_by TEXT,
        verified_at TIMESTAMP,
        is_sponsored BOOLEAN NOT NULL DEFAULT false,
        sponsored_by TEXT,
        is_featured BOOLEAN NOT NULL DEFAULT false,
        status TEXT NOT NULL DEFAULT 'pending',
        rejection_reason TEXT,
        auto_approved_at TIMESTAMP,
        moderation_note TEXT,
        points_awarded INTEGER NOT NULL DEFAULT 0,
        search_vector tsvector,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_cdposts_author_status ON community_deals_posts(author_id, status)`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_cdposts_brand_status ON community_deals_posts(brand_id, status)`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_cdposts_product_status ON community_deals_posts(product_id, status)`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_cdposts_status_created ON community_deals_posts(status, created_at DESC)`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_cdposts_featured_status ON community_deals_posts(is_featured, status)`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_cdposts_upvotes ON community_deals_posts(upvote_count DESC) WHERE status = 'approved'`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_cdposts_search ON community_deals_posts USING GIN(search_vector)`)

    // community posts full-text search trigger
    await pgClient.unsafe(`
      CREATE OR REPLACE FUNCTION update_cdposts_search() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector := to_tsvector('english',
          COALESCE(NEW.title,'') || ' ' ||
          COALESCE(NEW.body,'')
        );
        NEW.updated_at := NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `)
    await pgClient.unsafe(`DROP TRIGGER IF EXISTS cdposts_search_trigger ON community_deals_posts`)
    await pgClient.unsafe(`
      CREATE TRIGGER cdposts_search_trigger
        BEFORE INSERT OR UPDATE ON community_deals_posts
        FOR EACH ROW EXECUTE FUNCTION update_cdposts_search()
    `)
    results.push({ name: 'community_deals_posts', status: 'created' })

    // ── 3. CREATE community_deals_post_votes ─────────────────────────
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS community_deals_post_votes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID NOT NULL,
        user_id TEXT NOT NULL,
        vote_type TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(post_id, user_id)
      )
    `)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_cdpvotes_post_type ON community_deals_post_votes(post_id, vote_type)`)
    results.push({ name: 'community_deals_post_votes', status: 'created' })

    // ── 4. CREATE community_deals_post_saves ─────────────────────────
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS community_deals_post_saves (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID NOT NULL,
        user_id TEXT NOT NULL,
        saved_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(post_id, user_id)
      )
    `)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_cdpsaves_user ON community_deals_post_saves(user_id, saved_at DESC)`)
    results.push({ name: 'community_deals_post_saves', status: 'created' })

    // ── 5. CREATE community_deals_comments ───────────────────────────
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS community_deals_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        post_id UUID NOT NULL,
        author_id TEXT NOT NULL,
        author_role TEXT NOT NULL,
        parent_comment_id UUID,
        body TEXT NOT NULL,
        is_brand_verified BOOLEAN NOT NULL DEFAULT false,
        upvote_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_cdcomments_post ON community_deals_comments(post_id, created_at ASC)`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_cdcomments_parent ON community_deals_comments(parent_comment_id)`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_cdcomments_author ON community_deals_comments(author_id)`)
    results.push({ name: 'community_deals_comments', status: 'created' })

    // ── 6. CREATE community_deals_comment_votes ──────────────────────
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS community_deals_comment_votes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        comment_id UUID NOT NULL,
        user_id TEXT NOT NULL,
        vote_type TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(comment_id, user_id)
      )
    `)
    results.push({ name: 'community_deals_comment_votes', status: 'created' })

    // ── 7. CREATE deal_saves ─────────────────────────────────────────
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS deal_saves (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        deal_id UUID NOT NULL,
        user_id TEXT NOT NULL,
        saved_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(deal_id, user_id)
      )
    `)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_dsaves_user ON deal_saves(user_id, saved_at DESC)`)
    results.push({ name: 'deal_saves', status: 'created' })

    // ── 8. CREATE deal_redemptions ───────────────────────────────────
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS deal_redemptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        deal_id UUID NOT NULL,
        consumer_id TEXT NOT NULL,
        redemption_type TEXT NOT NULL,
        redeemed_at TIMESTAMP NOT NULL DEFAULT NOW(),
        points_awarded INTEGER NOT NULL DEFAULT 10
      )
    `)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_dredemptions_deal_consumer ON deal_redemptions(deal_id, consumer_id)`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_dredemptions_consumer ON deal_redemptions(consumer_id, redeemed_at DESC)`)
    results.push({ name: 'deal_redemptions', status: 'created' })

    // ── 9. CREATE community_deals_flags ──────────────────────────────
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS community_deals_flags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content_type TEXT NOT NULL,
        content_id UUID NOT NULL,
        flagged_by TEXT NOT NULL,
        reason TEXT NOT NULL,
        details TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        reviewed_by TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_cdflags_content ON community_deals_flags(content_type, content_id)`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_cdflags_status ON community_deals_flags(status, created_at)`)
    results.push({ name: 'community_deals_flags', status: 'created' })

    return NextResponse.json({
      success: true,
      message: 'Migration 009 completed: Deals Discovery + Community (9 tables, 2 search triggers)',
      results,
    })
  } catch (error) {
    console.error('[Migration 009] Error:', error)
    return NextResponse.json(
      {
        error: 'Migration 009 failed',
        details: error instanceof Error ? error.message : String(error),
        completedSteps: results,
      },
      { status: 500 }
    )
  }
}
