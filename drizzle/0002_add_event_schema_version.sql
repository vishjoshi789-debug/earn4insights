-- Migration: Add schema_version to user_events table
-- Purpose: Track event schema versions to handle historical data migrations
-- Date: Feb 3, 2026

-- Add schema_version column with default value 1 for existing rows
ALTER TABLE user_events 
ADD COLUMN schema_version INTEGER NOT NULL DEFAULT 1;

-- Create index on schema_version for efficient filtering
CREATE INDEX idx_user_events_schema_version ON user_events(schema_version);

-- Comment explaining the column
COMMENT ON COLUMN user_events.schema_version IS 'Event schema version for backward compatibility during schema migrations';
