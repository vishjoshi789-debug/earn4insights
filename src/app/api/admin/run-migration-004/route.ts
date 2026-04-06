import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 004: Influencers Adda
 * POST /api/admin/run-migration-004
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Creates 11 new tables, ALTERs users table, adds indexes.
 * Prerequisite: migrations 001-003 must be applied first.
 * Idempotent: all statements use IF NOT EXISTS.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // ── 0. ALTER users ──────────────────────────────────────────────
    await pgClient.unsafe(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_influencer BOOLEAN NOT NULL DEFAULT false`)

    // ── 1. influencer_profiles ──────────────────────────────────────
    await pgClient.unsafe(`
CREATE TABLE IF NOT EXISTS influencer_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT NOT NULL UNIQUE,
  display_name        TEXT NOT NULL,
  bio                 TEXT,
  niche               TEXT[] NOT NULL DEFAULT '{}',
  location            TEXT,
  instagram_handle    TEXT,
  youtube_handle      TEXT,
  twitter_handle      TEXT,
  linkedin_handle     TEXT,
  base_rate           INTEGER,
  currency            TEXT NOT NULL DEFAULT 'INR',
  verification_status TEXT NOT NULL DEFAULT 'unverified',
  is_active           BOOLEAN NOT NULL DEFAULT true,
  portfolio_urls      JSONB DEFAULT '[]',
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_influencer_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)`)

    // ── 2. influencer_social_stats ──────────────────────────────────
    await pgClient.unsafe(`
CREATE TABLE IF NOT EXISTS influencer_social_stats (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id       TEXT NOT NULL,
  platform            TEXT NOT NULL,
  follower_count      INTEGER DEFAULT 0,
  engagement_rate     NUMERIC(5,2),
  avg_views           INTEGER,
  avg_likes           INTEGER,
  avg_comments        INTEGER,
  verified_at         TIMESTAMP,
  verification_method TEXT NOT NULL DEFAULT 'self_declared',
  raw_api_response    JSONB,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_influencer_social_stats_user FOREIGN KEY (influencer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_influencer_social_stats UNIQUE (influencer_id, platform)
)`)

    // ── 3. influencer_content_posts ─────────────────────────────────
    // NOTE: campaign_id FK is added later after influencer_campaigns exists
    await pgClient.unsafe(`
CREATE TABLE IF NOT EXISTS influencer_content_posts (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id          TEXT NOT NULL,
  title                  TEXT NOT NULL,
  body                   TEXT,
  media_type             TEXT NOT NULL DEFAULT 'image',
  media_urls             TEXT[] DEFAULT '{}',
  thumbnail_url          TEXT,
  platforms_cross_posted TEXT[] DEFAULT '{}',
  product_id             TEXT,
  brand_id               TEXT,
  campaign_id            UUID,
  tags                   TEXT[] DEFAULT '{}',
  status                 TEXT NOT NULL DEFAULT 'draft',
  published_at           TIMESTAMP,
  external_post_urls     JSONB DEFAULT '{}',
  created_at             TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_influencer_content_posts_user FOREIGN KEY (influencer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_influencer_content_posts_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT fk_influencer_content_posts_brand FOREIGN KEY (brand_id) REFERENCES users(id) ON DELETE SET NULL
)`)

    // ── 4. influencer_campaigns ─────────────────────────────────────
    await pgClient.unsafe(`
CREATE TABLE IF NOT EXISTS influencer_campaigns (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id          TEXT NOT NULL,
  product_id        TEXT,
  icp_id            UUID,
  title             TEXT NOT NULL,
  brief             TEXT,
  requirements      TEXT,
  deliverables      TEXT[] DEFAULT '{}',
  target_geography  TEXT[] DEFAULT '{}',
  target_platforms  TEXT[] DEFAULT '{}',
  budget_total      INTEGER NOT NULL,
  budget_currency   TEXT NOT NULL DEFAULT 'INR',
  payment_type      TEXT NOT NULL DEFAULT 'escrow',
  status            TEXT NOT NULL DEFAULT 'draft',
  start_date        DATE,
  end_date          DATE,
  platform_fee_pct  NUMERIC(4,2) NOT NULL DEFAULT 10.00,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_influencer_campaigns_brand FOREIGN KEY (brand_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_influencer_campaigns_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  CONSTRAINT fk_influencer_campaigns_icp FOREIGN KEY (icp_id) REFERENCES brand_icps(id) ON DELETE SET NULL
)`)

    // ── 4b. Deferred FK: content_posts.campaign_id → campaigns.id ──
    try {
      await pgClient.unsafe(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_influencer_content_posts_campaign'
      AND table_name = 'influencer_content_posts'
  ) THEN
    ALTER TABLE influencer_content_posts
      ADD CONSTRAINT fk_influencer_content_posts_campaign
      FOREIGN KEY (campaign_id) REFERENCES influencer_campaigns(id) ON DELETE SET NULL;
  END IF;
END$$`)
    } catch (e: any) {
      if (e?.code !== '42710') throw e // ignore duplicate_object
    }

    // ── 5. campaign_influencers ─────────────────────────────────────
    await pgClient.unsafe(`
CREATE TABLE IF NOT EXISTS campaign_influencers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID NOT NULL,
  influencer_id   TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'invited',
  deliverables    TEXT[] DEFAULT '{}',
  agreed_rate     INTEGER,
  invited_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  accepted_at     TIMESTAMP,
  completed_at    TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_campaign_influencers_campaign FOREIGN KEY (campaign_id) REFERENCES influencer_campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_campaign_influencers_user FOREIGN KEY (influencer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_campaign_influencer UNIQUE (campaign_id, influencer_id)
)`)

    // ── 6. campaign_milestones ──────────────────────────────────────
    await pgClient.unsafe(`
CREATE TABLE IF NOT EXISTS campaign_milestones (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  due_date        DATE,
  payment_amount  INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',
  completed_at    TIMESTAMP,
  approved_at     TIMESTAMP,
  approved_by     TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_campaign_milestones_campaign FOREIGN KEY (campaign_id) REFERENCES influencer_campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_campaign_milestones_approver FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
)`)

    // ── 7. campaign_payments ────────────────────────────────────────
    await pgClient.unsafe(`
CREATE TABLE IF NOT EXISTS campaign_payments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id           UUID NOT NULL,
  milestone_id          UUID,
  amount                INTEGER NOT NULL,
  currency              TEXT NOT NULL DEFAULT 'INR',
  payment_type          TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'pending',
  razorpay_order_id     TEXT,
  razorpay_payment_id   TEXT,
  razorpay_transfer_id  TEXT,
  platform_fee          INTEGER NOT NULL DEFAULT 0,
  escrowed_at           TIMESTAMP,
  released_at           TIMESTAMP,
  refunded_at           TIMESTAMP,
  failure_reason        TEXT,
  created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_campaign_payments_campaign FOREIGN KEY (campaign_id) REFERENCES influencer_campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_campaign_payments_milestone FOREIGN KEY (milestone_id) REFERENCES campaign_milestones(id) ON DELETE SET NULL
)`)

    // ── 8. campaign_performance ─────────────────────────────────────
    await pgClient.unsafe(`
CREATE TABLE IF NOT EXISTS campaign_performance (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         UUID NOT NULL,
  post_id             UUID,
  platform            TEXT NOT NULL,
  metric_date         DATE NOT NULL,
  views               INTEGER DEFAULT 0,
  likes               INTEGER DEFAULT 0,
  comments            INTEGER DEFAULT 0,
  shares              INTEGER DEFAULT 0,
  saves               INTEGER DEFAULT 0,
  clicks              INTEGER DEFAULT 0,
  reach               INTEGER DEFAULT 0,
  impressions         INTEGER DEFAULT 0,
  icp_matched_viewers INTEGER DEFAULT 0,
  data_source         TEXT NOT NULL DEFAULT 'manual',
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_campaign_performance_campaign FOREIGN KEY (campaign_id) REFERENCES influencer_campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_campaign_performance_post FOREIGN KEY (post_id) REFERENCES influencer_content_posts(id) ON DELETE SET NULL,
  CONSTRAINT uq_campaign_performance UNIQUE (post_id, platform, metric_date)
)`)

    // ── 9. influencer_follows ───────────────────────────────────────
    await pgClient.unsafe(`
CREATE TABLE IF NOT EXISTS influencer_follows (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_id     TEXT NOT NULL,
  influencer_id   TEXT NOT NULL,
  followed_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_influencer_follows_consumer FOREIGN KEY (consumer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_influencer_follows_influencer FOREIGN KEY (influencer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_influencer_follow UNIQUE (consumer_id, influencer_id)
)`)

    // ── 10. influencer_reviews ──────────────────────────────────────
    await pgClient.unsafe(`
CREATE TABLE IF NOT EXISTS influencer_reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID NOT NULL,
  reviewer_id     TEXT NOT NULL,
  reviewee_id     TEXT NOT NULL,
  rating          INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review          TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_influencer_reviews_campaign FOREIGN KEY (campaign_id) REFERENCES influencer_campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_influencer_reviews_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_influencer_reviews_reviewee FOREIGN KEY (reviewee_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT uq_influencer_review UNIQUE (campaign_id, reviewer_id)
)`)

    // ── 11. campaign_disputes ───────────────────────────────────────
    await pgClient.unsafe(`
CREATE TABLE IF NOT EXISTS campaign_disputes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id     UUID NOT NULL,
  raised_by       TEXT NOT NULL,
  reason          TEXT NOT NULL,
  evidence        JSONB DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'open',
  resolved_by     TEXT,
  resolved_at     TIMESTAMP,
  resolution      TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_campaign_disputes_campaign FOREIGN KEY (campaign_id) REFERENCES influencer_campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_campaign_disputes_raised_by FOREIGN KEY (raised_by) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_campaign_disputes_resolved_by FOREIGN KEY (resolved_by) REFERENCES users(id) ON DELETE SET NULL
)`)

    // ── Indexes ─────────────────────────────────────────────────────
    await pgClient.unsafe(`
CREATE INDEX IF NOT EXISTS idx_influencer_profiles_niche ON influencer_profiles USING GIN (niche);
CREATE INDEX IF NOT EXISTS idx_influencer_profiles_active ON influencer_profiles (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_influencer_content_posts_influencer ON influencer_content_posts (influencer_id, status);
CREATE INDEX IF NOT EXISTS idx_influencer_content_posts_product ON influencer_content_posts (product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_influencer_content_posts_campaign ON influencer_content_posts (campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_influencer_campaigns_brand ON influencer_campaigns (brand_id, status);
CREATE INDEX IF NOT EXISTS idx_influencer_campaigns_status ON influencer_campaigns (status);
CREATE INDEX IF NOT EXISTS idx_campaign_influencers_influencer ON campaign_influencers (influencer_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_milestones_campaign ON campaign_milestones (campaign_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_campaign_payments_campaign ON campaign_payments (campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_campaign_performance_campaign ON campaign_performance (campaign_id, metric_date);
CREATE INDEX IF NOT EXISTS idx_influencer_follows_influencer ON influencer_follows (influencer_id);
CREATE INDEX IF NOT EXISTS idx_influencer_follows_consumer ON influencer_follows (consumer_id);
CREATE INDEX IF NOT EXISTS idx_influencer_reviews_reviewee ON influencer_reviews (reviewee_id);
CREATE INDEX IF NOT EXISTS idx_campaign_disputes_campaign ON campaign_disputes (campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_users_is_influencer ON users (is_influencer) WHERE is_influencer = true`)

    return NextResponse.json({
      success: true,
      message: 'Migration 004 (Influencers Adda) applied successfully. 11 tables created, users table altered, 16 indexes added.',
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    const detail = {
      message: error?.message,
      code: error?.code,
      hint: error?.hint,
      detail: error?.detail,
      severity: error?.severity,
      str: String(error),
    }
    return NextResponse.json(
      { success: false, error: detail },
      { status: 500 }
    )
  }
}
