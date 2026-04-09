-- Migration 005: Real-Time Connection Layer
-- Prerequisites: migrations 001-004 must be applied first.
-- Idempotent: all statements use IF NOT EXISTS / CREATE INDEX IF NOT EXISTS.

-- ── 1. realtime_events — audit log of all platform events ─────────────────
CREATE TABLE IF NOT EXISTS realtime_events (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type           TEXT NOT NULL,
  actor_id             TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_role           TEXT,
  target_entity_type   TEXT,
  target_entity_id     TEXT,
  payload              JSONB,
  icp_filter_applied   BOOLEAN NOT NULL DEFAULT false,
  processed_at         TIMESTAMP,
  created_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_realtime_events_actor        ON realtime_events(actor_id);
CREATE INDEX IF NOT EXISTS idx_realtime_events_type_created ON realtime_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_realtime_events_target       ON realtime_events(target_entity_type, target_entity_id);

-- ── 2. notification_inbox — per-user notification store ───────────────────
CREATE TABLE IF NOT EXISTS notification_inbox (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id    UUID REFERENCES realtime_events(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  cta_url     TEXT,
  type        TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  read_at     TIMESTAMP,
  expires_at  TIMESTAMP NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_inbox_user_unread ON notification_inbox(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notification_inbox_expires     ON notification_inbox(expires_at);
CREATE INDEX IF NOT EXISTS idx_notification_inbox_user_created ON notification_inbox(user_id, created_at DESC);

-- ── 3. notification_preferences — per-user, per-event-type controls ───────
CREATE TABLE IF NOT EXISTS notification_preferences (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL,
  in_app_enabled  BOOLEAN NOT NULL DEFAULT true,
  email_enabled   BOOLEAN NOT NULL DEFAULT true,
  sms_enabled     BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_notification_prefs_user ON notification_preferences(user_id);

-- ── 4. activity_feed_items — persistent activity stream per user ──────────
CREATE TABLE IF NOT EXISTS activity_feed_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL,
  actor_id      TEXT,
  actor_role    TEXT,
  title         TEXT NOT NULL,
  description   TEXT,
  entity_type   TEXT,
  entity_id     TEXT,
  metadata      JSONB,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_feed_user_created ON activity_feed_items(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_feed_entity       ON activity_feed_items(entity_type, entity_id);

-- ── 5. social_mentions — external mention tracking ────────────────────────
CREATE TABLE IF NOT EXISTS social_mentions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform               TEXT NOT NULL,
  mention_url            TEXT,
  mention_text           TEXT NOT NULL,
  mentioned_entity_type  TEXT NOT NULL,
  mentioned_entity_id    TEXT NOT NULL,
  author_handle          TEXT,
  author_follower_count  INTEGER,
  sentiment_score        DECIMAL(5,4),
  relevance_score        DECIMAL(5,4),
  detected_at            TIMESTAMP NOT NULL DEFAULT NOW(),
  processed_at           TIMESTAMP,
  notifications_sent     BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_social_mentions_entity    ON social_mentions(mentioned_entity_type, mentioned_entity_id);
CREATE INDEX IF NOT EXISTS idx_social_mentions_platform  ON social_mentions(platform, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_mentions_pending   ON social_mentions(notifications_sent) WHERE notifications_sent = false;

-- ── 6. social_listening_rules — what keywords/platforms to monitor ────────
CREATE TABLE IF NOT EXISTS social_listening_rules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  keywords     TEXT[] NOT NULL DEFAULT '{}',
  platforms    TEXT[] NOT NULL DEFAULT '{}',
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_listening_rules_entity ON social_listening_rules(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_social_listening_rules_active ON social_listening_rules(is_active) WHERE is_active = true;
