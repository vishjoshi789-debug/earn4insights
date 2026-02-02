-- Create audit_log table for tracking sensitive data access
-- GDPR compliance: Log all access to personal data

CREATE TABLE IF NOT EXISTS "audit_log" (
  "id" SERIAL PRIMARY KEY,
  "user_id" TEXT NOT NULL,
  "action" TEXT NOT NULL, -- 'read', 'write', 'delete', 'export'
  "data_type" TEXT NOT NULL, -- 'sensitiveData', 'profile', 'events', etc.
  "accessed_by" TEXT NOT NULL, -- userId or 'system' or 'cron'
  "ip_address" TEXT,
  "user_agent" TEXT,
  "timestamp" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  "metadata" JSONB DEFAULT '{}'::jsonb, -- Additional context
  "reason" TEXT -- Why the data was accessed
);

-- Index for querying by user
CREATE INDEX IF NOT EXISTS "audit_log_user_id_idx" ON "audit_log" ("user_id");

-- Index for querying by timestamp
CREATE INDEX IF NOT EXISTS "audit_log_timestamp_idx" ON "audit_log" ("timestamp" DESC);

-- Index for querying by action
CREATE INDEX IF NOT EXISTS "audit_log_action_idx" ON "audit_log" ("action");

-- Index for querying by data type
CREATE INDEX IF NOT EXISTS "audit_log_data_type_idx" ON "audit_log" ("data_type");
