ALTER TABLE "feedback_media"
  ADD COLUMN IF NOT EXISTS "moderation_status" text,
  ADD COLUMN IF NOT EXISTS "moderation_note" text,
  ADD COLUMN IF NOT EXISTS "moderated_at" timestamp;

