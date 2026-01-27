# Phase 4 Analytics System - Complete Testing Instructions

## 🎯 Quick Summary

Phase 4 (Analytics & Personalization) is **DEPLOYED** ✅

You now have a complete system that:
- Tracks user events (product views, onboarding, rankings, etc.)
- Computes behavioral attributes (engagement scores, category interests)
- Generates personalized product recommendations
- Provides analytics on user behavior

## 📝 Detailed Testing Steps

### **STEP 1: Generate Test Events** 🎬

**You need to create real user behavior data first.**

1. **Open the live site in incognito browser:**
   ```
   https://earn4insights.vercel.app
   ```

2. **Sign in with Google** (or create new account)

3. **Complete onboarding** (3-step wizard):
   - Select role: Brand or Consumer
   - Fill demographics: Age, location
   - Select interests: Pick 2-3 categories (TECH_SAAS, FINTECH, etc.)

4. **View products** (Visit 4-5 different products):
   - Go to `/top-products`
   - Click on 4-5 different products
   - Read details, scroll around

5. **View category rankings:**
   - Visit `/top-products/TECH_SAAS`
   - Visit `/top-products/FINTECH`
   - Visit `/top-products/ECOMMERCE`

6. **Update privacy settings:**
   - Go to `/settings/privacy`
   - Toggle tracking consent ON
   - Toggle email notifications

7. **If Brand role, visit dashboard:**
   - Go to `/dashboard`
   - Click on your products

8. **Wait 30-60 seconds** for events to save to database

---

### **STEP 2: Verify Events Are Tracked** ✅

**Run this command:**
```powershell
node test-event-tracking.mjs
```

**What you should see:**
```
✅ Total events tracked: 15

📊 Recent events (last 5 minutes):
   product_view: 5
   onboarding_complete: 1
   profile_update: 2
   rankings_view: 3
   ...
```

**✅ Success criteria:**
- Total events > 0
- Your recent actions appear in "Recent events"
- Event types match what you did

**❌ If you see "No events":**
- Make sure you're signed in (not anonymous)
- Verify tracking consent is ON in privacy settings
- Wait another 30 seconds and try again

---

### **STEP 3: Check Analytics Data** 📊

**Run this command:**
```powershell
node test-analytics.mjs
```

**What you should see:**
```
👥 Users with events:
   1. your-email@gmail.com: 12 events

🎯 Testing analytics for: your-email@gmail.com

📊 Event breakdown:
   product_view: 5
   onboarding_complete: 1
   rankings_view: 3
   ...

📋 User Profile:
   Demographics: ✅ Set
   Interests: {"TECH_SAAS":true,"FINTECH":true}
   Behavioral Attributes: ❌ Not computed yet
   👉 Run: node test-behavioral-update.mjs to compute

🏷️  Category viewing behavior:
   TECH_SAAS: 3 views
   FINTECH: 2 views
```

**✅ Success criteria:**
- Your email appears with events
- Event breakdown matches your actions
- Demographics and interests show as "Set"
- Category viewing behavior matches categories you visited

**Note:** "Behavioral Attributes: Not computed yet" is expected - we compute them in Step 4

---

### **STEP 4: Compute Behavioral Attributes** 🧮

**This runs the analytics engine to compute:**
- Engagement scores (0-100)
- Category interests (0-1 per category)
- Survey completion rates
- Active hours (time of day patterns)

**Run this command:**
```powershell
node test-behavioral-update.mjs
```

**What you should see:**
```
📊 Before update:
   Total users: 3
   Users with behavioral data: 0

⏳ Computing behavioral attributes...
✅ Update complete!
   Processed: 3 users
   Updated: 2 users
   Errors: 0

📊 After update:
   Users with behavioral data: 2

📋 Sample behavioral data:
   1. your-email@gmail.com:
      Engagement Score: 24.5
      Category Interests: {"TECH_SAAS":0.65,"FINTECH":0.42}
      Active Hours: [15,16,14]
```

**✅ Success criteria:**
- "Updated" count > 0
- Your user has behavioral data computed
- Engagement Score is > 0
- Category Interests match categories you viewed

**Understanding the scores:**
- **Engagement Score (0-100):** 
  - Product view = 0.1 points
  - Onboarding = 3.0 points
  - Survey complete = 2.0 points
  - Higher = more engaged user

- **Category Interests (0-1 per category):**
  - 0.8 = Very interested (80% of your views in this category)
  - 0.5 = Moderately interested
  - 0.2 = Some interest
  - 0.0 = No interest

- **Active Hours:**
  - Top 5 hours of day (0-23) when you use the platform
  - Example: [15, 16, 14] = Most active at 3pm, 4pm, 2pm

---

### **STEP 5: Test Recommendations** 🎯

**This tests the personalization engine.**

**Run this command:**
```powershell
node test-recommendations.mjs
```

**What you should see:**
```
👥 Users with behavioral data:
   1. your-email@gmail.com (Engagement: 24.5)

🎯 Getting recommendations for: your-email@gmail.com

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

🔎 Detailed explanation for top recommendation:
   Product: AI Analytics Platform
   Overall Score: 87/100

   Score Breakdown:
      Category Match: 35/40
      Behavioral Match: 28/30
      Engagement Bonus: 16/20
      Demographics Match: 8/10

🏷️  Category Interest Analysis:
   TECH_SAAS: 65.0%
   FINTECH: 42.0%
```

**✅ Success criteria:**
- Recommendations generated (shows product list)
- Match scores calculated (0-100)
- Reasons explain WHY products are recommended
- Category interests align with your viewing behavior
- Score breakdown shows algorithm logic

**Understanding match scores (100 points total):**
- **40 points:** Category interest match
  - Your category interests × product category
- **30 points:** Behavioral patterns
  - Viewing history, engagement patterns
- **20 points:** Engagement level bonus
  - Rewards highly engaged users
- **10 points:** Demographics alignment
  - Age, location match with product target audience

---

## 🔧 Troubleshooting

### Problem: "No events tracked"
**Solutions:**
1. Ensure you're signed in (not anonymous browsing)
2. Check privacy settings → Tracking consent is ON
3. Wait 30-60 seconds after actions
4. Clear browser cache and try again

### Problem: "No behavioral data"
**Solutions:**
1. Ensure Step 2 shows events exist
2. Run Step 4 command: `node test-behavioral-update.mjs`
3. Check for errors in the output

### Problem: "No recommendations"
**Solutions:**
1. Ensure products exist in database
2. Run Step 4 first (compute behavioral data)
3. Make sure products have categories assigned

### Problem: "Module not found" error
**Solution:**
```powershell
npm install @neondatabase/serverless
```

---

## ✅ Success Checklist

Mark each as complete:

- [ ] **Step 1:** Performed actions on live site (signed in, viewed products, etc.)
- [ ] **Step 2:** `test-event-tracking.mjs` shows recent events
- [ ] **Step 3:** `test-analytics.mjs` shows event breakdown and profile data
- [ ] **Step 4:** `test-behavioral-update.mjs` computed engagement scores
- [ ] **Step 5:** `test-recommendations.mjs` generated personalized recommendations

**If all checked:** Phase 4 is working correctly! 🎉

---

## 🚀 Next Steps

Once all tests pass:

### 1. Set up automated behavioral updates

Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/update-behavioral",
      "schedule": "0 2 * * *"
    }
  ]
}
```

This runs daily at 2am to update all user behavioral attributes.

### 2. Use recommendations in the app

Example code to show recommendations:
```typescript
import { getRecommendations } from '@/app/api/recommendations/actions';

// In a server component or server action:
const recommendations = await getRecommendations(5);

// Display to user:
recommendations.forEach(rec => {
  console.log(`${rec.productName}: ${rec.matchScore}/100`);
});
```

### 3. Move to Phase 5: Notification System

Build:
- Notification trigger rules
- Email/WhatsApp delivery
- Queue management
- Template system

---

## 📊 What Phase 4 Gives You

### Analytics Dashboard Data
- User engagement scores
- Category interest patterns
- Active time patterns
- Event tracking metrics

### Personalization Features
- Product recommendations (100-point scoring)
- Similar user discovery
- Survey recommendations
- Behavioral targeting

### Background Processing
- Daily behavioral updates
- Event aggregation
- Interest calculation
- Engagement scoring

---

## 📁 Related Files

**Test Scripts:**
- `test-event-tracking.mjs` - Verify event tracking
- `test-analytics.mjs` - Check analytics data
- `test-behavioral-update.mjs` - Run behavioral computation
- `test-recommendations.mjs` - Test recommendation engine

**Implementation:**
- [analyticsService.ts](src/server/analyticsService.ts)
- [personalizationEngine.ts](src/server/personalizationEngine.ts)
- [eventTrackingService.ts](src/server/eventTrackingService.ts)
- [/api/cron/update-behavioral](src/app/api/cron/update-behavioral/route.ts)
- [/api/recommendations](src/app/api/recommendations/actions.ts)

**Documentation:**
- `PHASE_4_TESTING_GUIDE.md` - Full testing guide
- `RANKING_SYSTEM.md` - Overall system architecture

---

## ⚡ Quick Command Reference

```powershell
# Run all tests in sequence (after generating data):
node test-event-tracking.mjs
node test-analytics.mjs
node test-behavioral-update.mjs
node test-recommendations.mjs

# Show quick start:
.\test-quickstart.bat

# Manual behavioral update:
node test-behavioral-update.mjs
```

---

**Questions or Issues?** Check the full guide: `PHASE_4_TESTING_GUIDE.md`
