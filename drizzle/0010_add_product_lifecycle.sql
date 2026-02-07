-- Phase 5: Product Resolution & Claiming
-- Add lifecycle, ownership, and claiming fields to products table

ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE products ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'verified';
ALTER TABLE products ADD COLUMN IF NOT EXISTS owner_id TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS claimable BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP;
ALTER TABLE products ADD COLUMN IF NOT EXISTS claimed_by TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS merged_into_id TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS merged_at TIMESTAMP;
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS creation_source TEXT NOT NULL DEFAULT 'brand_onboarding';
ALTER TABLE products ADD COLUMN IF NOT EXISTS name_normalized TEXT;

-- Indexes for search and filtering
CREATE INDEX IF NOT EXISTS idx_products_lifecycle_status ON products(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_products_owner_id ON products(owner_id);
CREATE INDEX IF NOT EXISTS idx_products_claimable ON products(claimable) WHERE claimable = true;
CREATE INDEX IF NOT EXISTS idx_products_name_normalized ON products(name_normalized);
CREATE INDEX IF NOT EXISTS idx_products_creation_source ON products(creation_source);

-- Backfill: normalize existing product names for search
UPDATE products SET name_normalized = LOWER(TRIM(name)) WHERE name_normalized IS NULL;
