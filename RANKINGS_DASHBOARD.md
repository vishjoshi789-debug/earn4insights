# Rankings Dashboard - Feature Documentation

## Overview
A comprehensive dashboard section has been added to manage the Product Hunt-style weekly rankings system. This provides brand-side UI for viewing, managing, and generating product rankings.

## Dashboard Integration

### Sidebar Navigation
Added a new **"Rankings"** menu item in the dashboard sidebar with Trophy (🏆) icon, positioned between Products and Feedback.

**Location**: `src/app/dashboard/DashboardShell.tsx`

## Dashboard Pages

### 1. Main Rankings Dashboard
**Path**: `/dashboard/rankings`

**Features**:
- **Overview Cards**: 
  - Categories Ranked (shows how many categories have rankings)
  - Ranked Products (total products in current week)
  - Current Week (displays week number and date range)
  
- **Category Tabs**: 
  - View rankings for all 12 product categories
  - Switch between categories with icon + name display
  - Shows top 10 products per category
  
- **Product Ranking Cards**:
  - Rank position with medal colors (🥇 Gold #1, 🥈 Silver #2, 🥉 Bronze #3)
  - Product name and overall ranking score
  - Metric badges: NPS, Sentiment, Total Responses
  - Previous rank indicator with up/down arrows
  - Detailed metrics breakdown: Engagement, Trend, Recency, Recent responses
  
- **Generate Rankings Button**:
  - Trigger manual ranking generation for all categories
  - Shows loading spinner while generating
  - Success/error alerts after completion
  
- **Quick Actions**:
  - Link to public rankings page (`/top-products`)
  - Link to ranking history
  - Link to manage product categories

### 2. Ranking History
**Path**: `/dashboard/rankings/history`

**Features**:
- **Category Selector**: Dropdown to choose which category's history to view
- **Historical Timeline**: 
  - Shows all past ranking weeks (newest first)
  - "Latest" badge on most recent week
  - Week number, year, and date range
  - Product count per week
  - Expandable ranking details
  
- **Week Details** (expandable):
  - All ranked products with their positions
  - Ranking scores and metrics
  - Rank change indicators (↑↓ with colored text)
  - Generation timestamp
  
- **Empty State**: 
  - Helpful message when no history exists
  - Link back to main rankings dashboard

## API Endpoints

### Get Current Week Ranking
```
GET /api/rankings/[category]
```
Returns the current week's ranking for a specific category.

**Response**: `WeeklyRanking` object with products array

**Example**: 
```
GET /api/rankings/TECH_SAAS
```

### Get Ranking History
```
GET /api/rankings/[category]/history?limit=10
```
Returns historical rankings for a category (newest first).

**Query Params**:
- `limit` (optional): Number of weeks to return (default: 10)

**Response**: Array of `WeeklyRanking` objects

**Example**: 
```
GET /api/rankings/FINTECH/history?limit=5
```

## Data Flow

1. **User clicks "Generate Rankings"** → POST to `/api/admin/generate-rankings`
2. **Ranking Service** calculates scores for all products across categories
3. **Rankings stored** in `data/rankings/YYYY-WW-{CATEGORY}.json`
4. **Dashboard auto-refreshes** to show new rankings
5. **User browses history** by category via `/dashboard/rankings/history`

## UI/UX Highlights

### Visual Design
- **Medal System**: 
  - 🥇 Rank #1: Yellow/Gold text
  - 🥈 Rank #2: Silver/Gray text
  - 🥉 Rank #3: Bronze/Orange text
  - Ranks 4-10: Muted text

- **Badge Variants**:
  - Ranks 1-3: Default (prominent)
  - Ranks 4-5: Secondary
  - Ranks 6-10: Outline

- **Trend Indicators**:
  - Green with ↑ arrow: Rank improved
  - Red with ↓ arrow: Rank declined
  - Gray with — line: Rank unchanged

### Responsive Layout
- Grid layouts adapt for mobile (1 column) and desktop (3-4 columns)
- Tab system for category navigation
- Expandable sections for detailed views

### Loading States
- Skeleton loaders while fetching data
- Spinner on "Generate Rankings" button
- Empty state messages with helpful CTAs

## Category Management

Categories are defined in `src/lib/categories.ts`:

1. **TECH_SAAS** 💻 - Technology & SaaS
2. **FINTECH** 💳 - Financial Technology
3. **ECOMMERCE** 🛒 - E-commerce & Retail
4. **HEALTH** 🏥 - Health & Wellness
5. **EDUCATION** 📚 - Education & E-learning
6. **FOOD** 🍔 - Food & Beverage
7. **CONSUMER_ELECTRONICS** 📱 - Consumer Electronics
8. **GAMING** 🎮 - Gaming & Entertainment
9. **SOCIAL** 💬 - Social & Communication
10. **MARKETPLACE** 🏪 - Marketplaces & Platforms
11. **DEVELOPER_TOOLS** ⚙️ - Developer Tools
12. **OTHER** 🔧 - Other

Each category includes:
- Unique key (e.g., `TECH_SAAS`)
- Display name (e.g., "Technology & SaaS")
- Emoji icon
- Description

## Next Steps for Full Functionality

### Prerequisites
1. **Collect Survey Data**: 
   - Need minimum 20 total responses per product
   - At least 5 responses in last 30 days
   - See `SETUP_INSTRUCTIONS.md` for details

2. **Assign Categories to Products**:
   - Run migration: `POST /api/admin/migrate-categories`
   - Or manually update products via UI (to be implemented)

3. **First Ranking Generation**:
   - Click "Generate Rankings" in dashboard
   - Or run: `POST /api/admin/generate-rankings`

### Optional Enhancements
- **Automated Cron Job**: Schedule weekly ranking generation
- **Email Notifications**: Send ranking notifications to product owners
- **Product Category Selector**: Add UI in product creation/edit flow
- **Authentication**: Protect admin endpoints (generate, migrate)
- **Analytics Dashboard**: Charts showing ranking trends over time
- **Export Features**: Download rankings as CSV/PDF

## File Structure

```
src/
├── app/
│   ├── dashboard/
│   │   ├── DashboardShell.tsx          # Updated: Added Rankings menu item
│   │   └── rankings/
│   │       ├── page.tsx                # New: Main rankings dashboard
│   │       └── history/
│   │           └── page.tsx            # New: Ranking history viewer
│   └── api/
│       └── rankings/
│           └── [category]/
│               ├── route.ts            # New: Get current ranking
│               └── history/
│                   └── route.ts        # New: Get ranking history
├── server/
│   └── rankings/
│       └── rankingStore.ts             # Updated: Added API aliases
└── lib/
    └── categories.ts                   # Category definitions
```

## Usage Examples

### For Brand Owners
1. Navigate to **Dashboard → Rankings** in sidebar
2. View current week's rankings across all categories
3. Click category tabs to see specific rankings
4. Check if your products are in top 10
5. View historical performance via "View Ranking History"

### For Administrators
1. Click **"Generate Rankings"** button to manually trigger
2. Wait for confirmation alert
3. Rankings refresh automatically
4. View history to verify generation

### For Public Users
- Public rankings accessible at `/top-products`
- No authentication required
- Shows same data as dashboard but in public-facing format

## Technical Details

### State Management
- React hooks (`useState`, `useEffect`) for local state
- Automatic data refresh after generating rankings
- Category selection persists during session

### Error Handling
- Try-catch blocks on all API calls
- User-friendly error messages
- Graceful degradation when rankings don't exist

### Performance
- Lazy loading of ranking data per category
- Expandable sections to reduce initial render
- Efficient file-based storage

## Support & Documentation

For more information, see:
- `RANKING_SYSTEM.md` - Complete technical documentation
- `QUICK_START.md` - Step-by-step setup guide
- `SETUP_INSTRUCTIONS.md` - Current status and next steps
