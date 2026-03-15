-- Auth performance indexes for users table
-- Speeds up sign-in (email lookup) and OAuth (google_id lookup)
-- Safe to re-run — CREATE INDEX IF NOT EXISTS prevents errors.

-- ── users table (auth lookups) ──────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id);
