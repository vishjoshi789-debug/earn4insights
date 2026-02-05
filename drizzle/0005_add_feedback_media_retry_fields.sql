-- Phase 1.5: feedback_media retry/attempt tracking

ALTER TABLE "feedback_media"
  ADD COLUMN IF NOT EXISTS "retry_count" integer DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "last_attempt_at" timestamp,
  ADD COLUMN IF NOT EXISTS "last_error_at" timestamp;

