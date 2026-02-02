# 🔧 Fix Runtime Error - Database Migration Required

## Problem
Your app builds successfully but crashes at runtime with "Application error: a server-side exception has occurred."

**Root Cause:** The `onboarding_complete` column doesn't exist in your production database yet.

---

## ✅ Solution: Run Database Migration

### Step 1: Access Your Neon Database

1. Go to https://console.neon.tech
2. Select your `earn4insights` project
3. Click on **SQL Editor** or **Tables**

### Step 2: Run the Migration SQL

Copy and paste this SQL into the Neon SQL Editor:

```sql
-- Add the onboardingComplete column
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false NOT NULL;

-- Update existing users: mark as complete if they have data
UPDATE user_profiles
SET onboarding_complete = true
WHERE 
  demographics IS NOT NULL 
  AND demographics::text != 'null'
  AND demographics::text != '{}'
  AND interests IS NOT NULL
  AND interests::text != 'null'
  AND interests::text != '{}';
```

### Step 3: Verify Migration

Run this query to check:

```sql
SELECT 
  id, 
  email, 
  onboarding_complete,
  demographics IS NOT NULL as has_demographics,
  interests IS NOT NULL as has_interests
FROM user_profiles
LIMIT 10;
```

### Step 4: Redeploy (If Needed)

After running the migration:
1. Your app should start working immediately
2. Try refreshing https://earn4insights.vercel.app
3. If still showing error, wait 1-2 minutes for cache to clear

---

## 🛡️ What I Fixed in Code

**Added graceful error handling:**

1. **Try-catch wrapper** - Catches all runtime errors
2. **Null coalescing** - `profile.onboardingComplete ?? false` (handles missing field)
3. **Console logging** - Better error messages in Vercel logs
4. **User-friendly error UI** - Shows actual error instead of generic "Application error"

**Files updated:**
- `src/app/dashboard/recommendations/page.tsx` - Added error handling
- `add-onboarding-complete.sql` - Migration script (included)

---

## 🔍 How to Check Vercel Logs

1. Go to https://vercel.com/vishjoshi789-debug/earn4insights
2. Click on latest deployment
3. Click **"Runtime Logs"** tab
4. Look for `[Recommendations]` or error messages
5. You should now see detailed errors instead of generic ones

---

## 📊 Expected Behavior After Migration

### Before Migration:
❌ Runtime error: "Application error: a server-side exception has occurred"

### After Migration:
✅ App loads successfully
✅ Users with data: marked as `onboarding_complete = true`
✅ New users: default to `onboarding_complete = false`
✅ Recommendations page shows proper onboarding check

---

## 🚨 If Still Getting Errors

Run this diagnostic query in Neon:

```sql
-- Check if column exists
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;
```

You should see `onboarding_complete | boolean | NO | false` in the results.

---

## 📝 Alternative: Use Drizzle Kit (For Future Migrations)

For future schema changes, use Drizzle's migration tools:

```bash
# Generate migration
npx drizzle-kit generate

# Push to database
npx drizzle-kit push
```

This will auto-sync your schema changes to the database.

---

## ✅ Summary

**Immediate action:** Run the migration SQL in Neon console  
**Result:** App will work without code changes  
**Code deployed:** Already has error handling as fallback  
**Commit:** 5304aff

Let me know once you've run the migration and I'll help verify everything is working! 🚀
