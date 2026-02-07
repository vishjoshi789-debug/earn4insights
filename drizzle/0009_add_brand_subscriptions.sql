-- Phase 4: Add brand_subscriptions table for tier-based feature gating
CREATE TABLE IF NOT EXISTS brand_subscriptions (
  id TEXT PRIMARY KEY,
  brand_id TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active',
  
  -- Stripe integration
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  
  -- Billing
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at TIMESTAMP,
  canceled_at TIMESTAMP,
  trial_start TIMESTAMP,
  trial_end TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Feature overrides
  feature_overrides JSONB
);

-- Create index on brand_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_brand_subscriptions_brand_id ON brand_subscriptions(brand_id);

-- Create index on tier for analytics
CREATE INDEX IF NOT EXISTS idx_brand_subscriptions_tier ON brand_subscriptions(tier);

-- Create index on status for filtering active subscriptions
CREATE INDEX IF NOT EXISTS idx_brand_subscriptions_status ON brand_subscriptions(status);
