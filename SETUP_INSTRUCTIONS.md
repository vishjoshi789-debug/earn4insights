# 🚀 SETUP INSTRUCTIONS - Weekly Rankings System

## Current Status

✅ **System is fully implemented** - All code is ready and waiting!

❌ **Missing data** - You need survey responses to generate rankings

---

## What You Have

Your products in the system:
- **earn4insights** - Consumer intelligence platform
- **Metacog** - Neurocognition/health tech
- **startupsgurukul** (multiple entries)

## What's Missing

**Survey Responses!** The ranking system needs at least:
- ≥ 20 total responses per product
- ≥ 5 responses in the last 30 days
- NPS scores from surveys

---

## Next Steps

### Step 1: Start Your App
```bash
npm run dev
```

### Step 2: Collect Some Survey Data

**Option A: Create Test Data** (Recommended for testing)
1. Create a few test NPS surveys for your products
2. Submit at least 20-25 responses per product
3. Include both NPS scores and text feedback

**Option B: Use Real Data**
1. Launch your surveys to real users
2. Wait to collect genuine responses
3. Come back when you have 20+ responses

### Step 3: Add Categories to Products

Once your app is running, visit your product profile pages and add categories:

1. Go to your Metacog product (it has a complete profile)
2. You'll see it's missing a category
3. Add category: **HEALTH** (for Health & Wellness)

For other products, categorize as:
- **earn4insights** → **TECH_SAAS** (SaaS & Productivity)
- **startupsgurukul** → **EDUCATION** (Education & Learning)

### Step 4: Generate Rankings

Once you have:
- ✅ Products with categories
- ✅ 20+ survey responses per product

Run:
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/admin/generate-rankings" `
  -Method POST -Headers @{"Content-Type"="application/json"}
```

Or navigate to:
```
http://localhost:3000/top-products
```

---

## Testing the UI (Without Data)

You can still view the pages to see the design:

1. Start your app: `npm run dev`
2. Visit: `http://localhost:3000/top-products`

You'll see a nice message: "No rankings yet"

---

## Quick Demo (When You Have Data)

Once you have survey responses:

1. **Generate Rankings:**
   ```powershell
   Invoke-WebRequest -Uri "http://localhost:3000/api/admin/generate-rankings" -Method POST
   ```

2. **View Rankings:**
   ```
   http://localhost:3000/top-products
   ```

3. **See Category Rankings:**
   ```
   http://localhost:3000/top-products/HEALTH
   http://localhost:3000/top-products/TECH_SAAS
   ```

---

## Creating Test Survey Data

If you want to test the system, you can manually create survey responses:

1. Navigate to your survey pages
2. Submit 20-25 responses per product
3. Include:
   - NPS scores (0-10)
   - Text feedback (for sentiment analysis)
   - Mix of promoters (9-10), passives (7-8), and detractors (0-6)

**Sample NPS Scores for Good Rankings:**
- Product A: Average NPS ~8 (mostly 9s and 10s)
- Product B: Average NPS ~6 (mix of 7s and 8s)
- Product C: Average NPS ~4 (mix of 5s and 6s)

---

## What Happens Next

Once you generate rankings with real data:

1. **Ranking files created:** `data/rankings/2026-W04-HEALTH.json`
2. **Top 10 displayed:** Products ranked by score
3. **Trend indicators:** Week-over-week changes
4. **Beautiful UI:** Product Hunt-style cards

---

## Troubleshooting

### "No rankings yet"
- ✅ Expected if you don't have survey responses
- ✅ Normal for new products

### "Product not ranked"
- Check if product has ≥ 20 total responses
- Check if product has ≥ 5 responses in last 30 days
- Verify product has a category assigned

### Rankings seem wrong
- Algorithm is data-driven and fair
- Check [RANKING_SYSTEM.md](RANKING_SYSTEM.md) for formula
- Verify response data is valid

---

## Files to Check

All the ranking system code is ready in:
- `src/server/rankings/` - Ranking engine & services
- `src/app/top-products/` - Public pages
- `src/lib/categories.ts` - Category definitions
- `data/rankings/` - Rankings storage (empty until you generate)

---

## Support

Questions? Check the documentation:
- [RANKING_SYSTEM.md](RANKING_SYSTEM.md) - Complete technical docs
- [QUICK_START.md](QUICK_START.md) - Step-by-step guide

---

**Bottom Line:**

The ranking system is **100% ready**. You just need survey response data to see it in action! 

Start collecting responses and come back to generate your first rankings! 🎉
