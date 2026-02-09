-- Phase 8: AI-Powered Theme Extraction
CREATE TABLE IF NOT EXISTS extracted_themes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL,
  theme TEXT NOT NULL,
  count INTEGER NOT NULL,
  sentiment TEXT NOT NULL,
  examples JSONB,
  total_feedback_analyzed INTEGER NOT NULL,
  extracted_at TIMESTAMP NOT NULL,
  extraction_method TEXT NOT NULL DEFAULT 'openai',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extracted_themes_product_id ON extracted_themes(product_id);
CREATE INDEX IF NOT EXISTS idx_extracted_themes_extracted_at ON extracted_themes(extracted_at);
CREATE INDEX IF NOT EXISTS idx_extracted_themes_sentiment ON extracted_themes(sentiment);
