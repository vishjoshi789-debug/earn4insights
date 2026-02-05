-- Phase 0: Multimodal + Multilingual foundations
-- Adds optional columns to existing tables (backwards compatible)
-- Adds a generic media attachments table for survey responses + feedback

-- -----------------------------
-- survey_responses additions
-- -----------------------------
ALTER TABLE "survey_responses"
  ADD COLUMN IF NOT EXISTS "modality_primary" text DEFAULT 'text' NOT NULL,
  ADD COLUMN IF NOT EXISTS "processing_status" text DEFAULT 'ready' NOT NULL,
  ADD COLUMN IF NOT EXISTS "original_language" text,
  ADD COLUMN IF NOT EXISTS "language_confidence" real,
  ADD COLUMN IF NOT EXISTS "normalized_text" text,
  ADD COLUMN IF NOT EXISTS "normalized_language" text,
  ADD COLUMN IF NOT EXISTS "transcript_text" text,
  ADD COLUMN IF NOT EXISTS "transcript_confidence" real,
  ADD COLUMN IF NOT EXISTS "consent_audio" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "consent_video" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "consent_captured_at" timestamp,
  ADD COLUMN IF NOT EXISTS "multimodal_metadata" jsonb;

-- -----------------------------
-- feedback additions
-- -----------------------------
ALTER TABLE "feedback"
  ADD COLUMN IF NOT EXISTS "modality_primary" text DEFAULT 'text' NOT NULL,
  ADD COLUMN IF NOT EXISTS "processing_status" text DEFAULT 'ready' NOT NULL,
  ADD COLUMN IF NOT EXISTS "original_language" text,
  ADD COLUMN IF NOT EXISTS "language_confidence" real,
  ADD COLUMN IF NOT EXISTS "normalized_text" text,
  ADD COLUMN IF NOT EXISTS "normalized_language" text,
  ADD COLUMN IF NOT EXISTS "transcript_text" text,
  ADD COLUMN IF NOT EXISTS "transcript_confidence" real,
  ADD COLUMN IF NOT EXISTS "consent_audio" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "consent_video" boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS "consent_captured_at" timestamp,
  ADD COLUMN IF NOT EXISTS "multimodal_metadata" jsonb;

-- -----------------------------
-- feedback_media (generic attachments)
-- -----------------------------
CREATE TABLE IF NOT EXISTS "feedback_media" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,

  "owner_type" text NOT NULL, -- 'survey_response' | 'feedback'
  "owner_id" text NOT NULL,

  "media_type" text NOT NULL, -- 'audio' | 'video'
  "storage_provider" text NOT NULL, -- 'vercel_blob' | 's3' | ...
  "storage_key" text NOT NULL,
  "mime_type" text,
  "size_bytes" integer,
  "duration_ms" integer,

  "status" text DEFAULT 'uploaded' NOT NULL, -- 'uploaded' | 'processing' | 'ready' | 'failed' | 'deleted'
  "transcript_text" text,
  "transcript_confidence" real,
  "original_language" text,
  "language_confidence" real,

  "error_code" text,
  "error_detail" text,

  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_feedback_media_owner" ON "feedback_media"("owner_type", "owner_id");
CREATE INDEX IF NOT EXISTS "idx_feedback_media_status" ON "feedback_media"("status");

