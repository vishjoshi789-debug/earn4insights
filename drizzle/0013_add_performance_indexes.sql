-- Production performance indexes
-- Safe to run on existing tables — CREATE INDEX IF NOT EXISTS prevents errors on re-runs.

-- ── feedback table ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_feedback_product_id ON feedback (product_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_email ON feedback (user_email);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback (created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_sentiment ON feedback (sentiment);

-- ── survey_responses table ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey_id ON survey_responses (survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_product_id ON survey_responses (product_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_submitted_at ON survey_responses (submitted_at);

-- ── user_events table ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON user_events (user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_event_type ON user_events (event_type);
CREATE INDEX IF NOT EXISTS idx_user_events_created_at ON user_events (created_at);
CREATE INDEX IF NOT EXISTS idx_user_events_product_id ON user_events (product_id);

-- ── analytics_events table (high volume) ────────────────────
CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events (created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events (user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_event_type ON analytics_events (event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session_id ON analytics_events (session_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_page_path ON analytics_events (page_path);

-- ── notification_queue table ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_notification_queue_user_id ON notification_queue (user_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_status ON notification_queue (status);
CREATE INDEX IF NOT EXISTS idx_notification_queue_scheduled_for ON notification_queue (scheduled_for);

-- ── weekly_rankings table ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_weekly_rankings_category ON weekly_rankings (category);
CREATE INDEX IF NOT EXISTS idx_weekly_rankings_week_start ON weekly_rankings (week_start);

-- ── ranking_history table ───────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ranking_history_product_id ON ranking_history (product_id);
CREATE INDEX IF NOT EXISTS idx_ranking_history_category ON ranking_history (category);

-- ── feedback_media table ────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_feedback_media_owner ON feedback_media (owner_type, owner_id);
CREATE INDEX IF NOT EXISTS idx_feedback_media_status ON feedback_media (status);

-- ── products table ──────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_owner_id ON products (owner_id);
CREATE INDEX IF NOT EXISTS idx_products_lifecycle_status ON products (lifecycle_status);
