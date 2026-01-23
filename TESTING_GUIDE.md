# Weekly Rankings - Setup Guide

## Environment Variables Required

Add these to your `.env.local` file:

```bash
# Admin Authentication
ADMIN_API_KEY=your-secure-random-key-here

# Email Notifications (Get free API key from resend.com)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxx
EMAIL_FROM=rankings@yourdomain.com

# App URL
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## Testing the System

### 1. Assign Categories to Products
- Go to `/dashboard/rankings/categories`
- Select category for each product
- Click "Save All Categories"

### 2. Add Test Survey Responses
You need at least 20 survey responses per product. You can:
- Use the survey response forms at `/survey/[surveyId]`
- Or create test data programmatically

### 3. Generate Rankings (with Authentication)

**Option A: Dashboard (No Auth Required)**
- Click "Generate Rankings" button in `/dashboard/rankings`

**Option B: API with Authentication**
```bash
curl -X POST http://localhost:3000/api/admin/generate-rankings \
  -H "Authorization: Bearer your-secure-random-key-here"
```

Or with query parameter:
```bash
curl -X POST "http://localhost:3000/api/admin/generate-rankings?apiKey=your-secure-random-key-here"
```

### 4. View Analytics
- Go to `/dashboard/rankings/analytics`
- Select category to view trends
- See ranking charts and top improvers

### 5. Test Email Notifications

Get a Resend API key (free plan available):
1. Sign up at https://resend.com
2. Verify your domain or use test mode
3. Get API key from dashboard
4. Add to `.env.local`

Then trigger ranking generation - emails will be sent automatically!

## API Endpoints

### Protected Endpoints (Require ADMIN_API_KEY)
- `POST /api/admin/generate-rankings` - Generate weekly rankings
- `POST /api/admin/assign-category` - Assign category to product
- `POST /api/admin/assign-categories-bulk` - Bulk assign categories

### Public Endpoints
- `GET /api/rankings/[category]` - Get current week's ranking
- `GET /api/rankings/[category]/history` - Get historical rankings
- `GET /api/rankings/[category]/trends` - Get trend analytics
- `GET /api/admin/check-products` - Check product status

## Testing with Your Contact Info

To test emails, you need:
1. Resend API key in `.env.local`
2. Verified sender domain/email
3. Product with your email in owner field (add to product data)

Then when rankings generate, you'll receive:
- Ranking position notification
- Rank change alerts
- Beautiful HTML email template
