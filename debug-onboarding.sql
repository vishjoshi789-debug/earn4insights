-- Check your current profile data
-- Run this in your Neon database console

SELECT 
  id,
  email,
  demographics,
  interests,
  "createdAt",
  "updatedAt"
FROM user_profiles
WHERE email = 'YOUR_EMAIL_HERE';  -- Replace with your actual email

-- Check if onboarding is considered complete
-- A user is "complete" if they have:
-- 1. ANY demographic field filled (gender, ageRange, location, education), OR
-- 2. ANY interests selected (productCategories array not empty)

-- Example: Check demographics fields
SELECT 
  email,
  demographics->>'gender' as gender,
  demographics->>'ageRange' as age_range,
  demographics->>'location' as location,
  demographics->>'education' as education,
  interests->'productCategories' as product_categories
FROM user_profiles
WHERE email = 'YOUR_EMAIL_HERE';


-- OPTION 1: Clear your onboarding data to test again
-- This will make your profile "incomplete" so you get redirected to /onboarding
UPDATE user_profiles
SET 
  demographics = NULL,
  interests = NULL,
  "updatedAt" = NOW()
WHERE email = 'YOUR_EMAIL_HERE';


-- OPTION 2: Delete your profile completely (will be recreated on next login)
DELETE FROM user_profiles
WHERE email = 'YOUR_EMAIL_HERE';


-- After running one of the above, log out and log back in
-- You should be redirected to /onboarding
