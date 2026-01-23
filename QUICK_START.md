# 🚀 Quick Start Guide - Weekly Rankings System

## 1️⃣ First-Time Setup (5 minutes)

### Step 1: Migrate Existing Products

Run migration to add categories to existing products:

```bash
# Dry run first (see what will happen)
curl -X POST http://localhost:3000/api/admin/migrate-categories \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'

# Actually migrate
curl -X POST http://localhost:3000/api/admin/migrate-categories \
  -H "Content-Type: application/json" \
  -d '{"dryRun": false}'
```

**OR** manually update `migrationScript.ts` with your product mappings:

```typescript
const PRODUCT_CATEGORY_MAP = {
  'your-product-id-1': 'TECH_SAAS',
  'your-product-id-2': 'FINTECH',
  // ...
}
```

### Step 2: Generate First Rankings

```bash
curl -X POST http://localhost:3000/api/admin/generate-rankings
```

### Step 3: View Rankings

Open browser:
```
http://localhost:3000/top-products
```

---

## 2️⃣ Weekly Workflow

### Manual (Current MVP)

Every Monday morning:
```bash
curl -X POST http://localhost:3000/api/admin/generate-rankings
```

### Automated (Recommended)

Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/admin/generate-rankings",
    "schedule": "0 0 * * 1"
  }]
}
```

Deploy to Vercel:
```bash
git add .
git commit -m "Add automated weekly rankings"
git push
```

---

## 3️⃣ Updating Product Categories

### During Product Creation

Users select category in Step 1 of product onboarding.

**Update your Step 1 component:**

```typescript
import { CATEGORY_KEYS, getCategoryName, CATEGORY_DESCRIPTIONS, CATEGORY_ICONS } from '@/lib/categories'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

export function Step1ProductType() {
  const [category, setCategory] = useState<ProductCategory>()

  return (
    <div className="space-y-4">
      {/* Existing product type selection */}
      
      {/* Add category selection */}
      <div>
        <label className="text-sm font-medium">Product Category</label>
        <Select onValueChange={(value) => setCategory(value as ProductCategory)}>
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_KEYS.map(key => (
              <SelectItem key={key} value={key}>
                <div className="flex items-center gap-2">
                  <span>{CATEGORY_ICONS[key]}</span>
                  <span>{getCategoryName(key)}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          {category && CATEGORY_DESCRIPTIONS[category]}
        </p>
      </div>
    </div>
  )
}

// Update server action call
await saveStep1ProductType(productId, productType, category)
```

### For Existing Products

Build an admin page to bulk update or let brands edit:

```typescript
// Example: Product settings page
import { updateProductProfile } from '@/lib/product/store'

async function updateCategory(productId: string, newCategory: ProductCategory) {
  await updateProductProfile(productId, (prev) => ({
    ...prev,
    data: {
      ...prev.data,
      category: newCategory,
    },
  }))
}
```

---

## 4️⃣ Monitoring & Debugging

### Check Ranking Status

```bash
curl http://localhost:3000/api/admin/generate-rankings
```

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

### View Ranking Files

```bash
ls data/rankings/

# Output:
# 2026-W04-TECH_SAAS.json
# 2026-W04-FINTECH.json
# 2026-W04-ECOMMERCE.json
```

### Debug Individual Product

```typescript
import { calculateProductMetrics } from '@/server/rankings/rankingEngine'
import { getProductById } from '@/lib/product/store'
import { getAllResponses } from '@/lib/survey/responseStore'

// In a server action or API route
const product = await getProductById('product-id')
const allResponses = await getAllResponses()
const productResponses = allResponses.filter(r => r.productId === 'product-id')

const metrics = await calculateProductMetrics(product, productResponses)
console.log('Product metrics:', metrics)
```

---

## 5️⃣ Customization

### Change Ranking Criteria

Edit `src/server/rankings/rankingEngine.ts`:

```typescript
// Adjust weights (must sum to 1.0)
const RANKING_WEIGHTS = {
  NPS: 0.30,          // Increase NPS importance
  SENTIMENT: 0.15,    // Decrease sentiment
  ENGAGEMENT: 0.20,
  VOLUME: 0.15,
  RECENCY: 0.10,
  TREND: 0.10,
}

// Change minimum requirements
const MINIMUM_THRESHOLDS = {
  TOTAL_RESPONSES: 10,    // Lower requirement
  RECENT_RESPONSES: 3,
  DAYS_SINCE_LAST: 45,
}
```

### Add New Categories

Edit `src/lib/categories.ts`:

```typescript
export const PRODUCT_CATEGORIES = {
  TECH_SAAS: 'SaaS & Productivity',
  // ... existing categories
  YOUR_NEW_CATEGORY: 'Your Category Name',
} as const

// Add description
export const CATEGORY_DESCRIPTIONS = {
  // ... existing
  YOUR_NEW_CATEGORY: 'Description here',
}

// Add icon
export const CATEGORY_ICONS = {
  // ... existing
  YOUR_NEW_CATEGORY: '🎨',
}
```

### Customize Email Templates

Edit `src/server/emailService.ts`:

```typescript
export async function sendBrandRankingNotification(...) {
  // Modify HTML template
  const html = `
    <!-- Your custom email design -->
  `
}
```

---

## 6️⃣ Testing Checklist

Before going live:

- [ ] All existing products have categories
- [ ] Generated test rankings successfully
- [ ] Ranking pages load correctly
- [ ] Product details link works
- [ ] Email notifications configured
- [ ] Cron job setup (if using)
- [ ] Admin endpoints protected
- [ ] UI displays correctly on mobile
- [ ] Trend indicators showing properly
- [ ] Rankings update weekly

---

## 7️⃣ Common Tasks

### Regenerate Rankings for One Category

```typescript
import { regenerateCategoryRanking } from '@/server/rankings/rankingService'

await regenerateCategoryRanking('TECH_SAAS')
```

### Get Product's Ranking History

```typescript
import { getProductRankingHistory } from '@/server/rankings/rankingStore'

const history = await getProductRankingHistory('product-id', 'TECH_SAAS')
// Returns: [{ weekStart, rank, score, weekId }, ...]
```

### Check if Product is in Top 10

```typescript
import { checkProductRankingChange } from '@/server/rankings/rankingService'

const change = await checkProductRankingChange('product-id', 'TECH_SAAS')
// Returns: { isInTop10, currentRank, previousRank, isNewEntry, rankChange }
```

---

## 8️⃣ Production Deployment

### Environment Variables

Add to Vercel/production environment:

```env
# Required
NOTIFICATION_EMAIL=admin@yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# Recommended
ADMIN_SECRET=your-random-secret-key-here

# Optional (for real emails)
RESEND_API_KEY=re_xxxxxxxxxxxx
EMAIL_FROM=rankings@yourdomain.com
```

### Security Hardening

```typescript
// Add to all admin API routes
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.ADMIN_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // ... rest of handler
}
```

### Performance Optimization

```typescript
// Add caching to ranking pages
export const revalidate = 3600 // Revalidate every hour

// Or use ISR
export const dynamic = 'force-static'
export const revalidate = 86400 // Daily
```

---

## 9️⃣ Troubleshooting

### No products in rankings?

**Check:**
1. Products have categories assigned
2. Products have ≥ 20 responses
3. Products have ≥ 5 responses in last 30 days
4. Responses contain NPS data

**Debug:**
```typescript
const products = await getAllProducts()
console.log('Products with categories:', 
  products.filter(p => p.profile?.data?.category).length
)
```

### Rankings showing old data?

**Fix:**
```bash
# Regenerate rankings
curl -X POST http://localhost:3000/api/admin/generate-rankings

# Clear Next.js cache
rm -rf .next
npm run build
```

### Email notifications not sending?

**Check:**
1. `NOTIFICATION_EMAIL` is set
2. Email service configured (Resend, SendGrid, etc.)
3. Check console logs for errors
4. Verify email template renders correctly

---

## 🔟 Next Steps

After basic setup works:

1. **Week 1:** Monitor first rankings, gather feedback
2. **Week 2:** Adjust weights if needed, add authentication
3. **Week 3:** Setup automated cron, add user preferences
4. **Week 4:** Build brand dashboard with historical trends

---

## 📞 Quick Commands Reference

```bash
# Generate rankings
curl -X POST http://localhost:3000/api/admin/generate-rankings

# Check status
curl http://localhost:3000/api/admin/generate-rankings

# Migrate categories (dry run)
curl -X POST http://localhost:3000/api/admin/migrate-categories \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'

# View rankings
open http://localhost:3000/top-products

# Check ranking files
ls data/rankings/

# View logs
tail -f .next/server.log
```

---

**Need help?** Check `RANKING_SYSTEM.md` for detailed documentation.
