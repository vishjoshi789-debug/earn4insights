# Phase 4: Analytics & Personalization - Testing Guide

## Overview
This guide provides step-by-step instructions to test the complete analytics and personalization system deployed in Phase 4.

---

## Prerequisites

1. **Phase 4 deployed** ✅ (Just completed)
2. **Database connection** working (DATABASE_URL in .env)
3. **Live site** accessible at https://earn4insights.vercel.app

---

## Testing Workflow

### Step 1: Generate Test Events 🎬

**Goal:** Create real user behavior data by interacting with the site.

#### Actions to Perform:

1. **Open Incognito/Private Browser Window**
   - Ensures fresh session without cached data
   - URL: https://earn4insights.vercel.app

2. **Sign In / Create Account**
   - Click "Sign In" → Sign in with Google
   - Or create a new test account

3. **Complete Onboarding** (if prompted)
   - **Step 1:** Select role (Brand or Consumer)
   - **Step 2:** Fill demographics
     - Age range
     - Location
   - **Step 3:** Select 2-3 category interests
     - Example: TECH_SAAS, FINTECH, ECOMMERCE
   - ✅ This tracks: `onboarding_complete`, `profile_update`

4. **View Products** (Visit 4-5 different products)
   - Go to `/top-products`
   - Click on different products
   - ✅ Tracks: `product_view` events with category metadata

5. **View Rankings by Category**
   - Visit `/top-products/TECH_SAAS`
   - Visit `/top-products/FINTECH`
   - ✅ Tracks: `rankings_view` with category

6. **Update Privacy Settings**
   - Go to `/settings/privacy`
   - Toggle tracking consent
   - Toggle email preferences
   - ✅ Tracks: `privacy_settings_update`

7. **View Dashboard** (if Brand role)
   - Navigate to `/dashboard`
   - Click on a product
   - ✅ Tracks: `product_view` from dashboard

8. **Wait 30-60 seconds**
   - Allows events to be persisted to database

---

### Step 2: Verify Events in Database ✅

**Run the event tracking test script:**

```powershell
node test-event-tracking.mjs
```

**Expected Output:**
```
🔍 Checking event tracking...

✅ Total events tracked: 47

📊 Recent events (last 5 minutes):
   product_view: 5
   onboarding_complete: 1
   profile_update: 2
   rankings_view: 2
   privacy_settings_update: 1

🕒 Latest 10 events:
   1. [3:45:23 PM] product_view - {"category":"TECH_SAAS","productId":"...
   2. [3:45:18 PM] product_view - {"category":"FINTECH","productId":"...
   ...

📈 Event type distribution (all time):
   product_view: 32
   onboarding_complete: 4
   rankings_view: 6
   profile_update: 5
   ...

👥 Top users by event count:
   1. user@example.com: 12 events
   2. test@example.com: 8 events
   ...

✅ Event tracking test complete!
```

**What to Check:**
- ✅ Recent events (last 5 minutes) shows your actions
- ✅ Event types match what you did (product_view, onboarding_complete, etc.)
- ✅ Your email appears in "Top users by event count"

---

### Step 3: Check Analytics Data 📊

**Run the analytics test script:**

```powershell
node test-analytics.mjs
```

**Expected Output:**
```
🔍 Testing Analytics System...

👥 Users with events:
   1. user@example.com: 12 events
   2. test@example.com: 8 events

🎯 Testing analytics for: user@example.com

📊 Event breakdown:
   product_view: 5
   onboarding_complete: 1
   profile_update: 2
   rankings_view: 2

📋 User Profile:
   Demographics: ✅ Set
   Interests: {"TECH_SAAS":true,"FINTECH":true}
   Behavioral Attributes: ❌ Not computed yet
   👉 Run: node test-behavioral-update.mjs to compute

🏷️  Category viewing behavior:
   TECH_SAAS: 3 views
   FINTECH: 2 views

✅ Analytics test complete!
```

**What to Check:**
- ✅ Your user appears with event breakdown
- ✅ Demographics and interests are set
- ⚠️ Behavioral attributes NOT computed yet (expected - we'll do this next)
- ✅ Category viewing behavior matches your actions

---

### Step 4: Compute Behavioral Attributes 🧮

**Run the behavioral update job:**

```powershell
node test-behavioral-update.mjs
```

**Expected Output:**
```
🚀 Running behavioral attribute updates...

📊 Before update:
   Total users: 3
   Users with behavioral data: 0

⏳ Computing behavioral attributes...
✅ Update complete!
   Processed: 3 users
   Updated: 2 users
   Errors: 0

📊 After update:
   Total users: 3
   Users with behavioral data: 2

📋 Sample behavioral data:

   1. user@example.com:
      Engagement Score: 24.5
      Category Interests: {"TECH_SAAS":0.65,"FINTECH":0.42,"ECOMMERCE":0.18}
      Active Hours: [15,16,14]

   2. test@example.com:
      Engagement Score: 18.2
      Category Interests: {"FINTECH":0.58,"HEALTH_FITNESS":0.31}
      Active Hours: [10,11,15]

✅ Behavioral update test complete!
```

**What to Check:**
- ✅ "Updated" count > 0 (users processed successfully)
- ✅ Engagement Score calculated (0-100 scale)
- ✅ Category Interests computed (0-1 scale per category)
- ✅ Active Hours identified (hours of day you're most active)

**Understanding the Scores:**
- **Engagement Score:** Weighted sum of your activity
  - Product view = 0.1 points
  - Survey complete = 2.0 points
  - Onboarding complete = 3.0 points
  - Max ~100 points for very active users
  
- **Category Interests:** Normalized scores (0-1)
  - Based on product views, rankings views in each category
  - Time-decayed (recent activity weighted more)
  
- **Active Hours:** Top 5 hours of day (0-23) when you're most active

---

### Step 5: Test Recommendations 🎯

**Run the recommendations test script:**

```powershell
node test-recommendations.mjs
```

**Expected Output:**
```
🔍 Testing Recommendation Engine...

👥 Users with behavioral data:
   1. user@example.com (Engagement: 24.5)
   2. test@example.com (Engagement: 18.2)

🎯 Getting recommendations for: user@example.com

📦 Top 5 Recommended Products:

   1. AI Analytics Platform (ID: prod_123)
      Match Score: 87/100
      Category: TECH_SAAS
      Reasons:
         • Strong interest in TECH_SAAS category (65% match)
         • High engagement level (24.5 score)
         • Recent activity in similar products

   2. Fintech Dashboard (ID: prod_456)
      Match Score: 76/100
      Category: FINTECH
      Reasons:
         • Moderate interest in FINTECH category (42% match)
         • Behavioral patterns suggest compatibility
         • Demographics align with target audience

   ...

🔎 Detailed explanation for top recommendation:

   Product: AI Analytics Platform
   Overall Score: 87/100

   Score Breakdown:
      Category Match: 35/40
      Behavioral Match: 28/30
      Engagement Bonus: 16/20
      Demographics Match: 8/10

   Explanation:
      • User has 65% interest in TECH_SAAS category
      • Recent product views in similar category
      • High engagement level indicates serious interest
      • Demographics match target audience

🏷️  Category Interest Analysis:
   TECH_SAAS: 65.0%
   FINTECH: 42.0%
   ECOMMERCE: 18.0%

✅ Recommendation test complete!
```

**What to Check:**
- ✅ Recommendations generated (shows products)
- ✅ Match scores calculated (0-100)
- ✅ Reasons explain WHY each product is recommended
- ✅ Category interests align with your viewing behavior
- ✅ Score breakdown shows the algorithm's logic

**Understanding Match Scores:**
- **40 points:** Category interest match
- **30 points:** Behavioral patterns (viewing history, engagement)
- **20 points:** Engagement level bonus
- **10 points:** Demographics alignment
- **Total:** Up to 100 points

---

### Step 6: Test Via API Endpoints (Optional) 🔌

**Test recommendations via server action:**

Create a test page or use browser console:

```typescript
// In browser console on your site:
const { getRecommendations } = await import('/api/recommendations/actions');
const recs = await getRecommendations(5);
console.log('Recommendations:', recs);
```

**Or test the cron endpoint:**

```powershell
# Set your CRON_SECRET from .env
$cronSecret = "your-cron-secret-here"

# Test the behavioral update endpoint
curl -X GET `
  -H "Authorization: Bearer $cronSecret" `
  https://earn4insights.vercel.app/api/cron/update-behavioral
```

**Expected Response:**
```json
{
  "success": true,
  "processed": 3,
  "updated": 2,
  "errors": 0
}
```

---

## Troubleshooting 🔧

### Issue: "No events tracked"
**Solution:**
1. Ensure you're signed in (not anonymous)
2. Check tracking consent is enabled in privacy settings
3. Wait 30-60 seconds after actions
4. Verify DATABASE_URL is correct

### Issue: "No behavioral data"
**Solution:**
1. Run `node test-behavioral-update.mjs` manually
2. Ensure users have events (check with `test-event-tracking.mjs`)
3. Check logs for errors during computation

### Issue: "No recommendations generated"
**Solution:**
1. Ensure products exist in database
2. Run behavioral update first
3. Check if products have categories assigned

### Issue: "Module not found" errors
**Solution:**
```powershell
npm install @neondatabase/serverless
```

---

## Success Criteria ✅

Your Phase 4 system is working correctly if:

- ✅ Events are tracked when you interact with the site
- ✅ Event tracking script shows recent events with your actions
- ✅ Analytics script shows event breakdown by type
- ✅ Behavioral update computes engagement scores and category interests
- ✅ Recommendations are generated with match scores > 0
- ✅ Recommendation reasons align with your behavior

---

## Next Steps 🚀

Once all tests pass:

1. **Monitor Production:**
   - Set up Vercel Cron to run `/api/cron/update-behavioral` daily
   - Configure in `vercel.json`:
   ```json
   {
     "crons": [{
       "path": "/api/cron/update-behavioral",
       "schedule": "0 2 * * *"
     }]
   }
   ```

2. **Integrate Recommendations:**
   - Add recommendation widget to dashboard
   - Show "Recommended for You" on homepage
   - Use in email notifications

3. **Move to Phase 5: Notification System**
   - Build trigger rules
   - Email/WhatsApp delivery
   - Notification queue management

---

## Testing Summary

| Test | Script | What It Tests |
|------|--------|---------------|
| Event Tracking | `test-event-tracking.mjs` | Events are logged to database |
| Analytics | `test-analytics.mjs` | User profiles and event aggregation |
| Behavioral Update | `test-behavioral-update.mjs` | Engagement scoring and interest calculation |
| Recommendations | `test-recommendations.mjs` | Personalization algorithm and match scoring |

Run all tests in sequence after performing manual actions on the site.

---

**Questions?** Check the implementation files:
- [analyticsService.ts](src/server/analyticsService.ts) - Event aggregation logic
- [personalizationEngine.ts](src/server/personalizationEngine.ts) - Recommendation algorithm
- [eventTrackingService.ts](src/server/eventTrackingService.ts) - Event tracking with validation
