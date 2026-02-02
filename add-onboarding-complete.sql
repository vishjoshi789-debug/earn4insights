-- Migration: Add onboardingComplete column to user_profiles table
-- Run this on your Neon PostgreSQL database

-- Add the onboardingComplete column
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false NOT NULL;

-- Update existing users: mark as complete if they have demographics AND interests
UPDATE user_profiles
SET onboarding_complete = true
WHERE 
  demographics IS NOT NULL 
  AND demographics::text != 'null'
  AND demographics::text != '{}'
  AND interests IS NOT NULL
  AND interests::text != 'null'
  AND interests::text != '{}';

-- Verify the migration
SELECT 
  id, 
  email, 
  onboarding_complete,
  CASE 
    WHEN demographics IS NOT NULL AND demographics::text != 'null' AND demographics::text != '{}' THEN 'Yes'
    ELSE 'No'
  END as has_demographics,
  CASE 
    WHEN interests IS NOT NULL AND interests::text != 'null' AND interests::text != '{}' THEN 'Yes'
    ELSE 'No'
  END as has_interests
FROM user_profiles
LIMIT 10;
