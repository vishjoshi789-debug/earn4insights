-- Phase 1.5: feedback_media retention/cost controls

ALTER TABLE "feedback_media"
  ADD COLUMN IF NOT EXISTS "deleted_at" timestamp,
  ADD COLUMN IF NOT EXISTS "retention_reason" text;

