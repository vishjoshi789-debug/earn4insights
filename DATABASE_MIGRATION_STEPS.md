# Database Migration Guide

## ✅ Step 1: Database Schema Created

The Postgres schema has been created with the following tables:
- `products` - Product information and profiles
- `surveys` - Survey configurations
- `survey_responses` - User survey responses
- `weekly_rankings` - Weekly product rankings by category
- `ranking_history` - Historical ranking data
- `social_posts` - Social media mentions
- `feedback` - User feedback submissions

## 🚀 Step 2: Run Migration (After Deployment)

Once the latest code is deployed to Vercel with the Postgres environment variables:

1. **Run the migration via API:**
   ```bash
   curl -X POST https://earn4insights.vercel.app/api/admin/migrate \
     -H "x-api-key: test123"
   ```

2. **Verify migration success:**
   - Check the response for `"success": true`
   - Tables should now exist in your Neon database

## 📝 Step 3: Update Code to Use Postgres

Next steps will update the application code to:
- Read from Postgres instead of JSON files
- Write to Postgres instead of JSON files
- Migrate existing JSON data to Postgres (one-time)

## 🔍 Verify Database

You can verify the migration in the Neon dashboard:
1. Go to your Vercel project → Storage tab
2. Click on your Neon database
3. Use the SQL Editor to run: `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`

## ⚠️ Important Notes

- The migration is idempotent (safe to run multiple times)
- Existing data in JSON files won't be automatically migrated
- We'll create a separate data migration script next
