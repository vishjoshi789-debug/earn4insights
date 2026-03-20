import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';

// Load env
const envContent = readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const m = line.match(/^([^=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
}

const dbUrl = env.DATABASE_URL || env.POSTGRES_URL;
if (!dbUrl) { console.error('No DATABASE_URL or POSTGRES_URL found'); process.exit(1); }

const sql = neon(dbUrl);

async function migrate() {
  console.log('Creating contribution intelligence tables...\n');

  // 1. contribution_events
  await sql`CREATE TABLE IF NOT EXISTS contribution_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    contribution_type TEXT NOT NULL,
    raw_content TEXT,
    metadata JSONB,
    brand_id TEXT,
    product_id TEXT,
    source_id TEXT,
    quality_score REAL,
    quality_reasoning TEXT,
    relevance_score REAL,
    depth_score REAL,
    clarity_score REAL,
    novelty_score REAL,
    actionability_score REAL,
    authenticity_score REAL,
    base_points INTEGER,
    brand_weight REAL DEFAULT 1.0,
    quality_multiplier REAL DEFAULT 1.0,
    reputation_multiplier REAL DEFAULT 1.0,
    final_tokens INTEGER,
    scored_at TIMESTAMP,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`;
  console.log('✓ contribution_events');

  // 2. brand_reward_configs
  await sql`CREATE TABLE IF NOT EXISTS brand_reward_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id TEXT NOT NULL,
    product_id TEXT,
    contribution_type TEXT NOT NULL,
    weight REAL NOT NULL DEFAULT 1.0,
    priority_keywords JSONB,
    bonus_multiplier REAL DEFAULT 1.0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`;
  console.log('✓ brand_reward_configs');

  // 3. user_reputation
  await sql`CREATE TABLE IF NOT EXISTS user_reputation (
    user_id TEXT PRIMARY KEY,
    reputation_score REAL NOT NULL DEFAULT 50,
    tier TEXT NOT NULL DEFAULT 'bronze',
    earning_multiplier REAL NOT NULL DEFAULT 1.0,
    total_contributions INTEGER NOT NULL DEFAULT 0,
    quality_avg REAL NOT NULL DEFAULT 0,
    flag_count INTEGER NOT NULL DEFAULT 0,
    streak_days INTEGER NOT NULL DEFAULT 0,
    last_contribution_at TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`;
  console.log('✓ user_reputation');

  // 4. brand_quality_feedback
  await sql`CREATE TABLE IF NOT EXISTS brand_quality_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contribution_event_id UUID NOT NULL,
    brand_user_id TEXT NOT NULL,
    rating TEXT NOT NULL,
    comment TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`;
  console.log('✓ brand_quality_feedback');

  // 5. trust_flags
  await sql`CREATE TABLE IF NOT EXISTS trust_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    flag_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'warning',
    details TEXT,
    contribution_event_id UUID,
    resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_by TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`;
  console.log('✓ trust_flags');

  // Indexes for performance
  await sql`CREATE INDEX IF NOT EXISTS idx_contribution_events_user ON contribution_events(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_contribution_events_status ON contribution_events(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_contribution_events_brand ON contribution_events(brand_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_contribution_events_created ON contribution_events(created_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_brand_reward_configs_brand ON brand_reward_configs(brand_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_trust_flags_user ON trust_flags(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_trust_flags_resolved ON trust_flags(resolved)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_brand_quality_feedback_event ON brand_quality_feedback(contribution_event_id)`;
  console.log('✓ indexes created');

  console.log('\n✅ All 5 contribution intelligence tables created successfully!');
}

migrate().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
