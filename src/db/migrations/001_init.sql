-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  platform TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  nps_enabled BOOLEAN DEFAULT FALSE NOT NULL,
  feedback_enabled BOOLEAN DEFAULT FALSE NOT NULL,
  social_listening_enabled BOOLEAN DEFAULT FALSE NOT NULL,
  profile JSONB NOT NULL
);

-- Create surveys table
CREATE TABLE IF NOT EXISTS surveys (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'draft' NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  questions JSONB NOT NULL,
  settings JSONB
);

-- Create survey_responses table
CREATE TABLE IF NOT EXISTS survey_responses (
  id TEXT PRIMARY KEY,
  survey_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  submitted_at TIMESTAMP DEFAULT NOW() NOT NULL,
  user_name TEXT,
  user_email TEXT,
  answers JSONB NOT NULL,
  nps_score INTEGER,
  sentiment TEXT
);

-- Create weekly_rankings table
CREATE TABLE IF NOT EXISTS weekly_rankings (
  id TEXT PRIMARY KEY,
  week_start TIMESTAMP NOT NULL,
  week_end TIMESTAMP NOT NULL,
  category TEXT NOT NULL,
  category_name TEXT NOT NULL,
  products JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create ranking_history table
CREATE TABLE IF NOT EXISTS ranking_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL,
  category TEXT NOT NULL,
  week_start TIMESTAMP NOT NULL,
  rank INTEGER NOT NULL,
  score REAL NOT NULL,
  metrics JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create social_posts table
CREATE TABLE IF NOT EXISTS social_posts (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  content TEXT NOT NULL,
  url TEXT,
  author TEXT,
  sentiment TEXT,
  engagement_score REAL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  scraped_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL,
  user_name TEXT,
  user_email TEXT,
  feedback_text TEXT NOT NULL,
  rating INTEGER,
  sentiment TEXT,
  category TEXT,
  status TEXT DEFAULT 'new' NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);
CREATE INDEX IF NOT EXISTS idx_surveys_product_id ON surveys(product_id);
CREATE INDEX IF NOT EXISTS idx_surveys_status ON surveys(status);
CREATE INDEX IF NOT EXISTS idx_survey_responses_survey_id ON survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_product_id ON survey_responses(product_id);
CREATE INDEX IF NOT EXISTS idx_weekly_rankings_category ON weekly_rankings(category);
CREATE INDEX IF NOT EXISTS idx_weekly_rankings_week_start ON weekly_rankings(week_start);
CREATE INDEX IF NOT EXISTS idx_ranking_history_product_id ON ranking_history(product_id);
CREATE INDEX IF NOT EXISTS idx_ranking_history_week_start ON ranking_history(week_start);
CREATE INDEX IF NOT EXISTS idx_social_posts_product_id ON social_posts(product_id);
CREATE INDEX IF NOT EXISTS idx_feedback_product_id ON feedback(product_id);
