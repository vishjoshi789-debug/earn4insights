-- Phase 8: AI-Powered Theme Extraction
CREATE TABLE IF NOT EXISTS "extracted_themes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" text NOT NULL,
  "theme" text NOT NULL,
  "mention_count" integer DEFAULT 0 NOT NULL,
  "sentiment" text DEFAULT 'mixed' NOT NULL,
  "examples" jsonb DEFAULT '[]'::jsonb,
  "total_feedback_analyzed" integer DEFAULT 0 NOT NULL,
  "extracted_at" timestamp DEFAULT now() NOT NULL,
  "extraction_method" text DEFAULT 'keyword' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_extracted_themes_product" ON "extracted_themes" ("product_id");
CREATE INDEX IF NOT EXISTS "idx_extracted_themes_extracted_at" ON "extracted_themes" ("extracted_at");
