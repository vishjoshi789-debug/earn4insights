-- Migration 006: Content Approval System
-- Adds content review workflow, SLA tracking, and reminder records.
-- Idempotent: all statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- Prerequisites: migrations 001–005 applied.

-- 1. ALTER influencer_content_posts — add review workflow columns
ALTER TABLE influencer_content_posts ADD COLUMN IF NOT EXISTS review_submitted_at TIMESTAMP;
ALTER TABLE influencer_content_posts ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP;
ALTER TABLE influencer_content_posts ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE influencer_content_posts ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE influencer_content_posts ADD COLUMN IF NOT EXISTS resubmission_count INTEGER DEFAULT 0;
ALTER TABLE influencer_content_posts ADD COLUMN IF NOT EXISTS previous_post_id UUID;

-- 2. ALTER influencer_campaigns — add SLA settings
ALTER TABLE influencer_campaigns ADD COLUMN IF NOT EXISTS review_sla_hours INTEGER;
ALTER TABLE influencer_campaigns ADD COLUMN IF NOT EXISTS auto_approve_enabled BOOLEAN DEFAULT false;

-- 3. CREATE content_review_reminders table
CREATE TABLE IF NOT EXISTS content_review_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL,
  campaign_id UUID NOT NULL,
  brand_id TEXT NOT NULL,
  reminder_type TEXT NOT NULL,
  scheduled_at TIMESTAMP NOT NULL,
  sent_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Prevent duplicate reminders per post per type
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_reminders_post_type
  ON content_review_reminders (post_id, reminder_type);

-- Cron efficiency: find unsent reminders due before a given time
CREATE INDEX IF NOT EXISTS idx_review_reminders_pending
  ON content_review_reminders (scheduled_at)
  WHERE sent_at IS NULL;
