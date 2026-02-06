-- Phase 3.5: Add consent_images field to survey_responses and feedback tables
ALTER TABLE survey_responses ADD COLUMN IF NOT EXISTS consent_images BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE feedback ADD COLUMN IF NOT EXISTS consent_images BOOLEAN NOT NULL DEFAULT false;
