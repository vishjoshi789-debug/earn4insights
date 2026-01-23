# 🏆 Product Hunt-Style Weekly Rankings System

## Overview

A comprehensive, data-driven ranking system that displays **Top 10 Products** per category every week based on real analytics, feedback, sentiment, and engagement data.

---

## 🎯 Core Features

### 1. Product Categorization
- **12 predefined categories** (SaaS, Fintech, E-Commerce, Health, etc.)
- Each product belongs to **ONE primary category**
- Category selected during product profile creation
- Editable later in product settings

### 2. Multi-Signal Ranking Algorithm

**Weighted Scoring Formula:**
```
Final Score = (
  NPS Score      × 0.25 +  // Core satisfaction
  Sentiment      × 0.20 +  // Feedback quality
  Engagement     × 0.20 +  // User participation
  Volume         × 0.15 +  // Data quantity
  Recency        × 0.10 +  // Fresh data
  Trend          × 0.10    // Week-over-week improvement
) × Confidence Multiplier
```

**Minimum Requirements for Ranking:**
- ≥ 20 total responses
- ≥ 5 responses in last 30 days
- Last response within 30 days

**Confidence Multipliers:**
- 100+ responses: 1.0×
- 50-99 responses: 0.9×
- 20-49 responses: 0.8×
- < 20 responses: 0.5× (not eligible)

### 3. Weekly Ranking Generation

**Automation:**
- **MVP:** Manual trigger via API endpoint
- **Production:** Vercel Cron (every Monday 00:00 UTC)

**Data Storage:**
- Rankings stored as JSON files in `data/rankings/`
- Format: `YYYY-WW-{CATEGORY}.json`
- Immutable historical records
- Easy to query and display

### 4. Public Ranking Pages

**Routes:**
- `/top-products` - Category overview
- `/top-products/[category]` - Top 10 for specific category

**Displays:**
- Rank badge (#1-#10)
- Product name & description
- NPS score
- Sentiment percentage
- Total responses
- Trend indicator (↑ ↓ →)
- Link to product details

### 5. Notifications

**Brand Notifications:**
- Product enters Top 10 (new entry)
- Rank change (up/down)
- Milestone achievements (#1 position)

**User Notifications:**
- Weekly digest of top products in followed categories
- Personalized based on preferences

---

## 📊 Data Models

### WeeklyRanking
```typescript
{
  id: string
  weekStart: string         // ISO date (Monday)
  weekEnd: string           // ISO date (Sunday)
  category: ProductCategory
  categoryName: string
  rankings: RankingEntry[]  // Top 10
  generatedAt: string
  totalProductsEvaluated: number
}
```

### RankingEntry
```typescript
{
  rank: number              // 1-10
  productId: string
  productName: string
  score: number             // Final weighted score
  metrics: {
    npsScore: number
    sentimentScore: number
    totalResponses: number
    trendDirection: 'up' | 'down' | 'stable'
    weekOverWeekChange: number
  }
}
```

---

## 🚀 Implementation Guide

### Phase 1: MVP (Ready Now)

✅ **Completed:**
1. Category taxonomy (`src/lib/categories.ts`)
2. Ranking engine with scoring algorithm (`src/server/rankings/rankingEngine.ts`)
3. Ranking storage service (`src/server/rankings/rankingStore.ts`)
4. Ranking generation service (`src/server/rankings/rankingService.ts`)
5. Admin API endpoint (`/api/admin/generate-rankings`)
6. Public ranking pages (`/top-products`, `/top-products/[category]`)
7. Email notification templates
8. Product profile updated with category field

### Phase 2: Automation (Next Steps)

**1. Add Vercel Cron Job**

Create `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/admin/generate-rankings",
    "schedule": "0 0 * * 1"
  }]
}
```

**2. Protect Admin Endpoint**

Add authentication:
```typescript
// Add to route.ts
const authHeader = request.headers.get('authorization')
if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

**3. Update Product Onboarding UI**

Find your Step 1 component and add category selector:
```typescript
import { CATEGORY_KEYS, getCategoryName, CATEGORY_DESCRIPTIONS } from '@/lib/categories'

// Add to form
<Select onValueChange={(value) => setCategory(value)}>
  <SelectTrigger>
    <SelectValue placeholder="Select category" />
  </SelectTrigger>
  <SelectContent>
    {CATEGORY_KEYS.map(key => (
      <SelectItem key={key} value={key}>
        {getCategoryName(key)}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### Phase 3: Advanced Features

**1. User Preferences Storage**
- Store category preferences per user
- Enable/disable notifications
- Notification frequency settings

**2. Enhanced Analytics Dashboard**
- Brand dashboard showing ranking trends over time
- Detailed score breakdown
- Competitor analysis

**3. Real-time Notifications**
- WhatsApp integration
- In-app notification center
- Push notifications

**4. Database Migration**
- Move from JSON files to PostgreSQL/MongoDB
- Better querying and performance
- Real-time updates

---

## 🧪 Testing the System

### Step 1: Generate Rankings Manually

**Using API:**
```bash
curl -X POST http://localhost:3000/api/admin/generate-rankings
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Successfully generated rankings for 3 categories",
  "rankings": [
    {
      "category": "SaaS & Productivity",
      "topProductsCount": 10,
      "totalEvaluated": 25,
      "weekStart": "2026-01-20T00:00:00.000Z"
    }
  ]
}
```

### Step 2: View Rankings

Navigate to:
- `http://localhost:3000/top-products`
- Click on any category with rankings

### Step 3: Verify Data

Check `data/rankings/` directory:
```
data/rankings/
  └── 2026-W04-TECH_SAAS.json
  └── 2026-W04-FINTECH.json
  └── 2026-W04-ECOMMERCE.json
```

---

## 📈 How the Algorithm Works

### Signal Breakdown

**1. NPS Score (25%):**
- Calculated from survey responses
- Normalized to 0-1 scale
- Formula: `(nps + 100) / 200`

**2. Sentiment Score (20%):**
- AI analysis of text feedback
- Percentage of positive vs. negative
- Keyword-based (upgradeable to OpenAI)

**3. Engagement Score (20%):**
- Survey completion rate (60%)
- Feedback volume (40%)
- Higher participation = higher score

**4. Volume Score (15%):**
- Logarithmic scale (diminishing returns)
- Prevents gaming with few high-quality responses
- Formula: `log10(responses + 1) / log10(1000)`

**5. Recency Score (10%):**
- Exponential decay over 30 days
- Rewards active products
- Formula: `exp(-daysSinceLastResponse / 10)`

**6. Trend Score (10%):**
- Week-over-week NPS change
- Positive momentum bonus
- Range: -100% to +100%

### Anti-Gaming Measures

1. **Minimum thresholds** - Prevents ranking with insufficient data
2. **Confidence multiplier** - Reduces score for low-volume products
3. **Recency requirement** - Must have recent activity
4. **Outlier detection** - Remove top/bottom 5% if > 50 responses
5. **Time decay** - Old responses matter less

---

## 🔧 Configuration

### Environment Variables

```env
# Email notifications
NOTIFICATION_EMAIL=admin@yourdomain.com
EMAIL_FROM=rankings@yourdomain.com

# App URL for links
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Admin API protection (Phase 2)
ADMIN_SECRET=your-secret-key

# Email provider (when ready)
RESEND_API_KEY=your-resend-api-key
```

### Customization Options

**Adjust Ranking Weights:**
Edit `src/server/rankings/rankingEngine.ts`:
```typescript
const RANKING_WEIGHTS = {
  NPS: 0.25,
  SENTIMENT: 0.20,
  ENGAGEMENT: 0.20,
  VOLUME: 0.15,
  RECENCY: 0.10,
  TREND: 0.10,
}
```

**Change Minimum Thresholds:**
```typescript
const MINIMUM_THRESHOLDS = {
  TOTAL_RESPONSES: 20,
  RECENT_RESPONSES: 5,
  DAYS_SINCE_LAST: 30,
}
```

**Modify Top N:**
Change from Top 10 to Top 20:
```typescript
const topRankings = generateTopRankings(scores, metrics, 20)
```

---

## 📚 API Reference

### POST /api/admin/generate-rankings

Manually trigger weekly ranking generation.

**Response:**
```json
{
  "success": true,
  "message": "Successfully generated rankings for 5 categories",
  "rankings": [...]
}
```

### GET /api/admin/generate-rankings

Get current rankings summary.

**Response:**
```json
{
  "success": true,
  "summary": {
    "totalCategories": 12,
    "categoriesWithRankings": 5,
    "totalRankedProducts": 47,
    "lastGenerated": "2026-01-23T10:30:00.000Z"
  }
}
```

---

## 🎨 UI Components Used

- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` - Layout
- `Badge` - Status indicators
- `Button` - Actions
- `lucide-react` icons - Visual elements

All components from `@/components/ui/*` (shadcn/ui)

---

## 🔐 Security Considerations

### Current State (MVP)
- Admin endpoint is open (development only)
- No authentication required

### Production Requirements
1. Add API authentication (Bearer token)
2. Rate limiting on admin endpoints
3. CORS configuration
4. Input validation
5. SQL injection prevention (when using DB)
6. Email verification for notifications

---

## 📊 Performance Optimization

### Current Approach (Good for MVP)
- File-based storage (simple, fast)
- Batch processing (weekly)
- Static ranking pages (fast load)

### Future Optimization
1. **Database indexing** - Fast category/date queries
2. **Caching** - Redis for frequently accessed rankings
3. **CDN** - Edge caching for public pages
4. **Lazy loading** - Paginated rankings (if > 10)
5. **Background jobs** - Queue-based processing (BullMQ)

---

## 🐛 Troubleshooting

### Rankings not generating?

**Check:**
1. Do products have category assigned?
2. Are there enough responses (≥ 20)?
3. Are responses recent (last 30 days)?
4. Check console logs for errors

**Debug:**
```typescript
// Add to rankingService.ts
console.log('Products in category:', categoryProducts.length)
console.log('Eligible products:', eligibleMetrics.length)
```

### Category pages show "No rankings"?

**Verify:**
1. Rankings file exists: `data/rankings/YYYY-WW-{CATEGORY}.json`
2. Category key matches exactly (case-sensitive)
3. Week identifier is correct

### Scores seem incorrect?

**Validate:**
1. Check NPS calculation in responses
2. Verify sentiment analysis results
3. Review weight configuration
4. Ensure confidence multiplier is applied

---

## 📝 Next Steps

### Immediate (This Week)
- [ ] Update product onboarding UI with category selector
- [ ] Add authentication to admin endpoint
- [ ] Test with real product data
- [ ] Setup Vercel cron job

### Short-term (This Month)
- [ ] User preference management
- [ ] Email notification opt-in UI
- [ ] Brand dashboard ranking trends
- [ ] Public API for rankings

### Long-term (This Quarter)
- [ ] Database migration
- [ ] WhatsApp notifications
- [ ] Advanced analytics
- [ ] A/B testing framework

---

## 💡 Key Design Decisions

### Why file-based storage?
- **Simplicity**: No database setup required
- **Version control**: Rankings are git-trackable
- **Performance**: Fast reads, no DB overhead
- **Scalability**: Can migrate to DB later without breaking

### Why weekly updates?
- **Stability**: Prevents daily volatility
- **Fairness**: Equal opportunity for all products
- **Resource efficient**: Batch processing
- **User expectation**: Weekly digest is familiar

### Why confidence multiplier?
- **Prevents gaming**: Can't rank with 5 fake reviews
- **Quality signal**: More data = more trustworthy
- **Gradual growth**: New products can still compete
- **Transparent**: Users see "Based on X responses"

---

## 🤝 Contributing

When extending this system:

1. **Maintain fairness** - Don't introduce bias
2. **Document changes** - Update this README
3. **Test thoroughly** - Especially scoring changes
4. **Monitor impact** - Track ranking volatility
5. **Get feedback** - From brands and users

---

## 📞 Support

For questions or issues:
1. Check troubleshooting section
2. Review console logs
3. Verify data integrity
4. Test with minimal data set

---

**Built with:** Next.js, TypeScript, Server Actions, shadcn/ui

**Last Updated:** January 23, 2026
