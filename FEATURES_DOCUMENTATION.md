# Earn4Insights — Feature Documentation

> **Last updated:** March 16, 2026  
> **Platform:** Next.js 15 + Drizzle ORM + PostgreSQL + Vercel  
> **Domain:** [earn4insights.com](https://earn4insights.com)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Authentication & Onboarding](#2-authentication--onboarding)
3. [Role System](#3-role-system)
4. [Dashboard Shell & Navigation](#4-dashboard-shell--navigation)
5. [Product Tour](#5-product-tour)
6. [Admin Analytics Dashboard](#6-admin-analytics-dashboard)
7. [Brand Analytics (Unified + Detailed)](#7-brand-analytics-unified--detailed)
8. [Rankings System](#8-rankings-system)
9. [Surveys & NPS](#9-surveys--nps)
10. [Rewards & Payouts](#10-rewards--payouts)
11. [Consent & Privacy (GDPR)](#11-consent--privacy-gdpr)
12. [Mobile UX Fixes](#12-mobile-ux-fixes)
13. [Backend Bug Fixes](#13-backend-bug-fixes)
14. [Deployment](#14-deployment)
15. [Multimodal Feedback (Audio / Video / Images)](#15-multimodal-feedback-audio--video--images)
16. [Subscription Tier System](#16-subscription-tier-system)
17. [Production Hardening (March 11, 2026)](#17-production-hardening-march-11-2026)
18. [Build Fix & Config Cleanup (March 12, 2026)](#18-build-fix--config-cleanup-march-12-2026)
19. [Homepage Footer Mobile Fix (March 12, 2026)](#19-homepage-footer-mobile-fix-march-12-2026)
20. [Sign-in Latency Optimization (March 12, 2026)](#20-sign-in-latency-optimization-march-12-2026)
21. [Dashboard Query Parallelization (March 12, 2026)](#21-dashboard-query-parallelization-march-12-2026)
22. [Auth Flow Rewrite & 500 Error Fix (March 13, 2026)](#22-auth-flow-rewrite--500-error-fix-march-13-2026)
23. [Survey System Enhancements (March 14–15, 2026)](#23-survey-system-enhancements-march-1415-2026)
24. [Multi-Channel Notification System — Slack (March 15, 2026)](#24-multi-channel-notification-system--slack-march-15-2026)
25. [WhatsApp Real-Time Notifications (March 15, 2026)](#25-whatsapp-real-time-notifications-march-15-2026)
26. [Brand Alerts Dashboard (March 15, 2026)](#26-brand-alerts-dashboard-march-15-2026)
27. [Bell Icon Real-Time Notifications (March 16, 2026)](#27-bell-icon-real-time-notifications-march-16-2026)

---

## 1. Architecture Overview

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Auth | NextAuth.js (Google OAuth) |
| Database | PostgreSQL (Neon) |
| ORM | Drizzle ORM |
| Styling | Tailwind CSS + shadcn/ui |
| Hosting | Vercel |
| Domain | earn4insights.com |

### Key Directory Structure
```
src/
├── app/
│   ├── dashboard/           # Authenticated dashboard pages
│   │   ├── DashboardShell.tsx  # Client-side shell with sidebar
│   │   ├── layout.tsx          # Server layout (auth + guards)
│   │   ├── page.tsx            # Main dashboard
│   │   ├── products/           # Product management
│   │   ├── rankings/           # Weekly Top 10
│   │   ├── feedback/           # Feedback views
│   │   ├── surveys/            # Surveys & NPS
│   │   ├── analytics/          # Unified analytics
│   │   ├── detailed-analytics/ # Per-product deep analytics
│   │   ├── rewards/            # Reward tracking
│   │   ├── payouts/            # Payout management
│   │   ├── social/             # Social hub
│   │   ├── community/          # Community discussions
│   │   ├── launch/             # Launch new products
│   │   └── settings/           # User settings & privacy
│   ├── admin/
│   │   └── analytics/          # Admin-only analytics
│   ├── onboarding/             # 4-step onboarding wizard
│   ├── login/                  # Auth pages
│   └── api/                    # API routes
├── components/
│   ├── ProductTour.tsx         # Product tour engine
│   ├── dashboard-header.tsx    # Dashboard header (notifications, user menu)
│   ├── ui/                     # shadcn/ui components
│   └── ...
├── lib/
│   ├── db/
│   │   └── schema.ts           # Drizzle DB schema
│   ├── auth.ts                 # NextAuth config
│   └── ...
└── middleware.ts                # Route protection middleware
```

---

## 2. Authentication & Onboarding

### Auth Flow
- **Provider:** Google OAuth via NextAuth.js
- **Session:** JWT-based, includes `user.id`, `user.role`, `user.email`
- **Protected routes:** All `/dashboard/*` routes require authentication
- **Middleware:** `middleware.ts` redirects unauthenticated users to `/login`

### Onboarding (4 Steps)
**File:** `src/app/onboarding/OnboardingClient.tsx` (~790 lines)

| Step | Fields | Required? |
|------|--------|-----------|
| 1 — Welcome | Name, Avatar | Yes |
| 2 — Demographics | Age, Gender, Country, **Profession**, **Field of Study** | Profession: Yes, Field of Study: Optional |
| 3 — Interests | Product categories selection | Yes (min 1) |
| 4 — Preferences | Communication preferences | Yes |

**Key implementation details:**
- `calculateCompletion()` tracks progress across all steps
- Profession dropdown: 15 options (Software Engineer, Doctor, Teacher, Student, etc.)
- Field of Study dropdown: 20 options (Computer Science, Medicine, Business, etc.)
- Data saved via server action: `src/app/onboarding/actions.ts`
- `OnboardingGuard` component wraps dashboard layout — redirects to `/onboarding` if profile incomplete

### Onboarding Guard
**File:** `src/app/dashboard/layout.tsx`

```
layout.tsx (server) → auth check → getUserProfile → OnboardingGuard → ConsentRenewalWrapper → DashboardShell
```

**Bug fix applied:** Previously used `session.user.email` for profile lookup, changed to `session.user.id` (database ID) to fix ID mismatch.

---

## 3. Role System

### Roles
| Role | Description | DB Value |
|------|-------------|----------|
| Brand | Company/brand users who manage products | `'brand'` |
| Consumer | End users who review/earn rewards | `'consumer'` |
| Admin | Platform administrators | `'admin'` |

### How roles are accessed
- **Server side:** `session.user.role` from NextAuth session
- **Client side:** `useSession().data.user.role`
- **Type definition:** `UserRole = 'brand' | 'consumer'` in schema

### Role-based behavior
- Product Tour shows different steps per role
- Navigation items are the same but tour explanations differ
- Admin analytics at `/admin/analytics` is admin-only

---

## 4. Dashboard Shell & Navigation

### DashboardShell
**File:** `src/app/dashboard/DashboardShell.tsx` (126 lines)

Client component (`'use client'`) providing the main layout:
- `SidebarProvider` → `Sidebar` + `SidebarInset`
- Sidebar header: Earn4Insights logo + title
- 12 navigation items + Settings footer
- Each nav item has a `data-tour` attribute for the product tour

### Navigation Items
| Route | Label | Tour ID | Icon |
|-------|-------|---------|------|
| `/dashboard` | Dashboard | `nav-dashboard` | LayoutDashboard |
| `/dashboard/products` | Products | `nav-products` | Package |
| `/dashboard/rankings` | Weekly Top 10 products | `nav-rankings` | Trophy |
| `/dashboard/feedback` | Feedback | `nav-feedback` | MessageSquare |
| `/dashboard/social` | Social | `nav-social` | Users |
| `/dashboard/community` | Community | `nav-community` | MessagesSquare |
| `/dashboard/surveys` | Surveys & NPS | `nav-surveys` | BarChart3 |
| `/dashboard/analytics/unified` | Unified Analytics | `nav-analytics` | TrendingUp |
| `/dashboard/rewards` | Rewards | `nav-rewards` | Award |
| `/dashboard/payouts` | Payouts | `nav-payouts` | HandCoins |
| `/dashboard/detailed-analytics` | Detailed product analytics | `nav-detailed-analytics` | FileText |
| `/dashboard/launch` | Launch Product | `nav-launch` | PackagePlus |
| `/dashboard/settings` | Settings | `nav-settings` | Settings |

### Dashboard Header
**File:** `src/components/dashboard-header.tsx`

- Sticky header with mobile sidebar trigger
- **Notifications bell dropdown** (`data-tour="notifications"`) — real-time, role-based:
  - **Brand users:** fetches last 10 `brand_alerts` from `GET /api/brand/alerts`; numeric unread badge; "Mark all read" button; links to `/dashboard/alerts`
  - **Consumer users:** fetches last 20 `notification_queue` items from `GET /api/consumer/notifications`; unread derived from `localStorage.notif_last_read`; links to `/dashboard/my-feedback`
  - Loading spinner on first fetch; empty inbox state; `formatDistanceToNow` timestamps
- User avatar dropdown (`data-tour="user-menu"`) with:
  - User name & email from session
  - Settings link
  - **Restart Product Tour** button (Sparkles icon)
  - Log out (redirects to `/login`)

---

## 5. Product Tour

### Overview
**File:** `src/components/ProductTour.tsx` (~380 lines)

Zero-dependency, role-aware product tour that guides brand and consumer users through the entire platform.

### How It Works

| Feature | Implementation |
|---------|---------------|
| **Engine** | Custom-built, zero external dependencies |
| **Highlighting** | SVG mask-based spotlight with purple glowing border |
| **Tooltip** | Positioned relative to target element, auto-adjusted to stay in viewport |
| **Role filtering** | Steps have optional `role` field — filtered by `session.user.role` |
| **Persistence** | `localStorage` key: `e4i_product_tour` stores `{completed, dismissed}` |
| **Auto-trigger** | Starts 1.5s after first visit to `/dashboard` (if not completed/dismissed) |
| **Restart** | User menu → "Restart Product Tour" calls `window.__startProductTour()` |
| **Keyboard** | `→` / `Enter` = Next, `←` = Back, `Esc` = Skip |
| **Progress** | Purple-to-pink gradient progress bar at top of tooltip |

### Brand Tour Steps (in order)
1. **Welcome** — Introduction to Earn4Insights
2. **Dashboard** — Home base with personalized recommendations
3. **Products** — View/manage all products, track performance
4. **Launch Product** — Add new products for consumer discovery
5. **Surveys & NPS** — Create surveys, track Net Promoter Score
6. **Feedback** — Read consumer feedback, respond to build trust
7. **Unified Analytics** — Demographics, engagement, sentiment, conversions
8. **Detailed Analytics** — Deep-dive per-product performance comparisons
9. **Rankings** — Weekly Top 10, competitive ranking visibility
10. **Social** — Community engagement hub
11. **Community** — Discussions and connections
12. **Rewards** — View earned rewards from engagement
13. **Notifications** — Updates on surveys, feedback, rankings, rewards
14. **Profile** — Account settings, privacy, sign-out
15. **Settings & Privacy** — Data control, consent, customization
16. **Finish** — Tour complete!

### Consumer Tour Steps (in order)
1. **Welcome** — Introduction to Earn4Insights
2. **Dashboard** — Home base with recommendations
3. **Discover Products** — Browse products, earn rewards for reviews
4. **Rankings** — Vote-influenced weekly Top 10
5. **Surveys** — Complete surveys for points
6. **Feedback** — Share detailed feedback for rewards
7. **Rewards** — Track earnings from all activities
8. **Payouts** — Cash out earned rewards
9. **Social** — Connect with community
10. **Community** — Join discussions
11. **Notifications** — Stay updated on milestones
12. **Profile** — Account management
13. **Settings & Privacy** — Data control
14. **Finish** — Tour complete!

### Technical: Adding New Tour Steps
```tsx
// In src/components/ProductTour.tsx — add to TOUR_STEPS array:
{
  target: '[data-tour="your-id"]',  // CSS selector for element
  title: '🎯 Step Title',
  description: 'What this feature does and the outcome.',
  role: 'brand',                     // 'brand' | 'consumer' | omit for all
  position: 'right',                 // 'top' | 'bottom' | 'left' | 'right'
}
```

### Technical: data-tour Attributes
Tour targets elements via `data-tour` attributes. Current attributes:
- Sidebar: `data-tour="nav-dashboard"`, `nav-products`, `nav-rankings`, `nav-feedback`, `nav-social`, `nav-community`, `nav-surveys`, `nav-analytics`, `nav-rewards`, `nav-payouts`, `nav-detailed-analytics`, `nav-launch`, `nav-settings`
- Header: `data-tour="welcome"`, `data-tour="notifications"`, `data-tour="user-menu"`

### SidebarMenuButton Props Update
**File:** `src/components/ui/sidebar.tsx`

`SidebarMenuButton` was updated to forward extra props (like `data-tour`) via `...rest` spread when using `asChild` mode. This ensures `React.cloneElement` passes custom attributes to the rendered `<Link>` elements.

---

## 6. Admin Analytics Dashboard

### Overview
**File:** `src/app/admin/analytics/page.tsx` (~765 lines)  
**API:** `src/app/api/admin/analytics/route.ts` (~410 lines)

Admin-only dashboard with tabs: Overview, Visitors, Engagement, Content.

### Visitors Tab Features
| Feature | Details |
|---------|---------|
| **Search bar** | Filter visitors by name or email |
| **Country filter** | Dropdown with dynamically populated countries |
| **Role filter** | Predefined: `user`, `brand`, `admin` + dynamic |
| **Gender filter** | Predefined: `male`, `female`, `non-binary`, `prefer-not-to-say` + dynamic |
| **Profession column** | Shows visitor's profession in the table |
| **Expandable detail** | Click row to see: email, role, country, gender, profession, field of study, join date, last active, page views |
| **View full history** | Button loads up to 500 history entries (API `limit` param, capped at 500) |

### Filter Implementation
**Bug fixed:** Gender and role dropdowns were empty because they were populated only from DB data (no profiled users yet). Fixed by merging **predefined options** with dynamic data:
```tsx
const predefinedGenders = ['male', 'female', 'non-binary', 'prefer-not-to-say'];
const predefinedRoles = ['user', 'brand', 'admin'];
// Merged with: new Set([...predefined, ...dynamicFromData])
```

---

## 7. Brand Analytics (Unified + Detailed)

### Unified Analytics
**Route:** `/dashboard/analytics/unified`  
**File:** `src/app/dashboard/analytics/page.tsx` (1074 lines)

Comprehensive analytics view with:
- Demographics breakdown
- Engagement trends
- Sentiment analysis
- Conversion metrics
- Product Performance Comparison table

### Product Performance Table Fixes
| Issue | Fix |
|-------|-----|
| Text invisible in dark mode | Changed `hover:bg-gray-50` → `hover:bg-muted/50` |
| Sentiment colors unreadable | Added dark mode variants: `text-green-600 dark:text-green-400`, etc. |
| No cursor pointer on rows | Added `cursor-pointer transition-colors` to `<tr>` elements |

### Detailed Analytics
**Route:** `/dashboard/detailed-analytics`

Deep-dive per-product analytics with individual product performance tracking and comparison metrics.

---

## 8. Rankings System

### Weekly Top 10
**Route:** `/dashboard/rankings`

Displays weekly product rankings voted/rated by consumers.

### Layout Fix (Mobile)
- Fixed rankings grid layout for mobile responsive display
- Ensured cards stack properly on small screens

---

## 9. Surveys & NPS

### Route
**Dashboard:** `/dashboard/surveys`  
**Public survey form:** `/survey`

### Features
- Create and manage surveys
- Track Net Promoter Score (NPS)
- View survey responses
- Consumer-facing survey completion for rewards

---

## 10. Rewards & Payouts

### Rewards
**Route:** `/dashboard/rewards`

Track earned points from:
- Survey completions
- Product reviews/feedback
- Community engagement

### Payouts
**Route:** `/dashboard/payouts`

Cash out accumulated rewards through supported payout methods.

---

## 11. Consent & Privacy (GDPR)

### Consent Renewal
**Component:** `ConsentRenewalWrapper`
- Wraps dashboard layout
- Checks if user consent needs renewal
- **Bug fix:** Changed lookup from email to database user ID

### Privacy Controls
**Route:** `/dashboard/settings`
- Manage data consent
- Update privacy preferences
- Control data sharing

---

## 12. Mobile UX Fixes

| Component | Issue | Fix |
|-----------|-------|-----|
| **Select dropdowns** | Not rendering properly on mobile | Fixed component rendering |
| **Hamburger menu** | Not toggling sidebar on mobile | Fixed `SidebarTrigger` click handler |
| **Sheet overlay** | Not dismissible on mobile | Fixed touch/click event handling |
| **Rankings layout** | Cards overlapping on small screens | Fixed responsive grid |
| **Tabs** | Tab content overflow on mobile | Fixed horizontal scrolling |

---

## 13. Backend Bug Fixes

### ID Mismatch Bugs
Multiple components were using `session.user.email` for database lookups instead of `session.user.id`:

| Component | File | Fix |
|-----------|------|-----|
| Onboarding Guard | `layout.tsx` | `email` → `id` for profile lookup |
| Consent Renewal | ConsentRenewalWrapper | `email` → `id` for consent lookup |
| Dashboard Layout | `layout.tsx` | `email` → `id` for user profile |

### Branding Updates
| Location | Old | New |
|----------|-----|-----|
| Dashboard page title | "Brand Pulse Dashboard" | "Earn4Insights Dashboard" |
| Sidebar header | "Brand Pulse" | "Earn4Insights" |

---

## 15. Multimodal Feedback (Audio / Video / Images)

### Overview
Consumers can attach audio recordings, video clips, and images alongside text feedback. Brands see all media inline on their dashboard with playback controls.

### Infrastructure
| Component | Technology |
|-----------|------------|
| File storage | Vercel Blob (public access) |
| File metadata | `feedback_media` table in PostgreSQL |
| Upload API | `POST /api/feedback/upload-media` |
| Submit API | `POST /api/feedback/submit` |

### File Limits
| Type | Max Size | Formats |
|------|----------|---------|
| Audio | 4MB | webm, ogg, mp4, mpeg, wav |
| Video | 10MB, max 60s | webm, mp4, quicktime |
| Images | 5MB each | jpeg, png, webp |

### Consumer Submit Pages (3 locations)
| Page | Path |
|------|------|
| Dashboard submit | `src/app/dashboard/submit-feedback/page.tsx` |
| Public product page | `src/app/submit-feedback/[productId]/DirectFeedbackForm.tsx` |
| General submit | `src/app/submit-feedback/page.tsx` |

### Upload Flow
1. Consumer submits text → `/api/feedback/submit` → returns `feedbackId`
2. Media files uploaded one by one → `/api/feedback/upload-media` with `feedbackId`
3. Each upload: validates auth + ownership → uploads to Vercel Blob → saves URL to `feedback_media` table
4. On any upload failure: amber warning banner shown on success screen (text feedback always saved)

### Brand Dashboard Media Display
- **Overview page:** `src/app/dashboard/feedback/page.tsx` — shows media for latest feedback per product card
- **Product detail page:** `src/app/dashboard/products/[productId]/feedback/page.tsx` — shows full media for every feedback item
- Media rendered via `FeedbackMediaSection` component — audio player, video player, image gallery
- Media fetched via `getMediaForFeedbackIds()` in `src/db/repositories/feedbackRepository.ts`
- Filters out `moderationStatus = 'hidden'` and `status = 'deleted'` records

### Access Control
- Upload requires authenticated session (401 if not logged in)
- Upload verifies `feedbackId` belongs to the current user's email (403 otherwise)
- Brands only see media for their own products (filtered by `getBrandProductIds`)

### Key Fixes Applied (March 4, 2026)
- **Silent upload failures fixed:** All 3 consumer pages now check `response.ok` on every upload fetch, collect error messages, and display amber warning banner on success screen if any media failed
- **Resilient media query:** `getMediaForFeedbackIds` now falls back gracefully if `moderation_status` DB column is missing (avoids silent empty results)
- **Vercel Blob connected:** `BLOB_READ_WRITE_TOKEN` configured in Vercel project — was missing previously causing all uploads to fail silently
- **Schema migration applied:** `moderation_status`, `moderation_note`, `moderated_at` columns now present in `feedback_media` table

### Database Schema
```
feedback_media table:
  id, owner_type, owner_id, media_type, storage_provider,
  storage_key (Vercel Blob URL), mime_type, size_bytes, duration_ms,
  status, transcript_text, retry_count, moderation_status,
  created_at, updated_at
```

---

## 16. Subscription Tier System

### Overview
Three-tier subscription model for brands. Feature gates defined but **currently all features are free** (early traction phase — gates not yet enforced on feedback pages).

### Tiers
| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Aggregate analytics | ✅ | ✅ | ✅ |
| Individual feedback text | ❌ | ✅ | ✅ |
| Audio/video playback | ❌ | ✅ | ✅ |
| Image viewing | ❌ | ✅ | ✅ |
| CSV/JSON export | ❌ | ✅ | ✅ |
| Advanced filters | ❌ | ✅ | ✅ |
| API access | ❌ | ❌ | ✅ |
| Max products | 1 | 10 | unlimited |

### Key Files
| Purpose | File |
|---------|------|
| Tier definitions + feature matrix | `src/server/subscriptions/subscriptionService.ts` |
| Subscription DB table | `brand_subscriptions` (schema.ts) |
| Analytics gate (enforced) | `src/app/dashboard/analytics/unified/page.tsx` |
| Upgrade prompt component | `src/app/dashboard/analytics/unified/UpgradePrompt.tsx` |

### Current Status
- Subscription gates **enforced on analytics page only**
- Feedback pages (direct feedback, product feedback) show full data to all tiers — intentional for early growth
- Stripe integration not yet connected — no real payment flow
- When ready to monetize: wire `getBrandSubscription()` checks into feedback pages

---

## 14. Deployment

### Platform
- **Hosting:** Vercel (automatic deployments from `main` branch)
- **Domain:** earn4insights.com
- **Config:** `apphosting.yaml` + `vercel.json`

### Deploy Process
```bash
git add -A
git commit -m "feat: description"
git push origin main
# Vercel auto-deploys from main branch
```

### Environment Variables (Vercel)
| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `GOOGLE_CLIENT_ID/SECRET` | Google OAuth |
| `AUTH_SECRET` | NextAuth v5 session secret |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob file storage (media uploads) |
| `ENCRYPTION_KEY` | Data encryption (256-bit base64) |
| `RESEND_API_KEY` | Email sending |

### Schema Migrations
- Migrations in `/drizzle` directory (0000 → 0013)
- Apply with: `.\push-schema.ps1` (uses `drizzle-kit push`)
- Key migration for media: `0004_add_multimodal_multilingual_foundations.sql`
- Performance indexes: `0013_add_performance_indexes.sql` (added March 11, 2026)

### Environment Variables Added (March 11, 2026)
| Variable | Purpose | Required? |
|----------|---------|----------|
| `ADMIN_API_KEY` | Admin API header-based auth | Optional |
| `CRON_SECRET` | Vercel Cron job authorization | Required for cron |
| `GA_MEASUREMENT_ID` | Google Analytics 4 tracking | Optional |

---

## Quick Reference: Key Files

| Purpose | File Path |
|---------|-----------|
| Dashboard shell + sidebar | `src/app/dashboard/DashboardShell.tsx` |
| Dashboard layout (auth) | `src/app/dashboard/layout.tsx` |
| Dashboard header | `src/components/dashboard-header.tsx` |
| Product tour | `src/components/ProductTour.tsx` |
| Sidebar UI component | `src/components/ui/sidebar.tsx` |
| Onboarding wizard | `src/app/onboarding/OnboardingClient.tsx` |
| Onboarding server action | `src/app/onboarding/actions.ts` |
| Admin analytics page | `src/app/admin/analytics/page.tsx` |
| Admin analytics API | `src/app/api/admin/analytics/route.ts` |
| Brand unified analytics | `src/app/dashboard/analytics/page.tsx` |
| DB schema | `src/db/schema.ts` |
| Auth config | `src/lib/auth/auth.config.ts` |
| Route middleware | `middleware.ts` |
| Drizzle config | `drizzle.config.ts` |
| Feedback submit API | `src/app/api/feedback/submit/route.ts` |
| Media upload API | `src/app/api/feedback/upload-media/route.ts` |
| Media repo (upsert) | `src/server/uploads/feedbackMediaRepo.ts` |
| Feedback repository | `src/db/repositories/feedbackRepository.ts` |
| Brand feedback overview | `src/app/dashboard/feedback/page.tsx` |
| Product feedback detail | `src/app/dashboard/products/[productId]/feedback/page.tsx` |
| Subscription service | `src/server/subscriptions/subscriptionService.ts` |
| Environment validation | `src/lib/env.ts` |
| Rate limiter | `src/lib/rate-limit.ts` |
| Structured logger | `src/lib/logger.ts` |
| Zod validators | `src/lib/validators.ts` |
| Entity checks | `src/lib/entity-checks.ts` |
| Instrumentation hook | `src/instrumentation.ts` |

---

## 17. Production Hardening (March 11, 2026)

### Overview
A comprehensive 9-phase production hardening pass was applied before public launch to eliminate deployment risks, security gaps, performance fragilities, and observability blind spots — without restructuring or refactoring existing code.

### Phase 1: Deployment & Config Risks
| Change | File | Detail |
|--------|------|--------|
| Debug mode gated | `auth.config.ts` | `debug: true` → `debug: process.env.NODE_ENV === 'development'` |
| DB connection guard | `db/index.ts` | Throws immediately if `POSTGRES_URL`/`DATABASE_URL` missing |
| Env validation at startup | `src/lib/env.ts` + `src/instrumentation.ts` | Validates CRITICAL vars (POSTGRES_URL, AUTH_SECRET) and warns for OPTIONAL vars at server boot via Next.js instrumentation hook |
| Email service deprecation | `emailService.ts` | Marked `@deprecated` (stub: console.log only, used by responseService and digestService) |

### Phase 2: Architectural Hardening
| Change | File | Detail |
|--------|------|--------|
| Schema section headers | `schema.ts` | 7 labeled sections: Users, Surveys, Feedback, Personalization, Notifications, Analytics, Deep Analytics |
| Sentiment interface | `sentimentService.ts` | Added `SentimentAnalyzer` interface for future AI upgrade path |
| Ranking thresholds | `rankingEngine.ts` | `MINIMUM_THRESHOLDS` changed from 0 to production values: `TOTAL_RESPONSES: 5`, `RECENT_RESPONSES: 3` |

### Phase 3: Security Hardening
| Change | Files | Detail |
|--------|-------|--------|
| Admin API auth fix | `src/lib/auth.ts` | Removed query parameter auth (`?apiKey=`); now only accepts `Authorization: Bearer` or `x-admin-api-key` header |
| Rate limiting | `src/lib/rate-limit.ts` + 4 API routes | In-memory rate limiter with auto-cleanup; applied to `/api/analytics/track`, `/api/track-event`, `/api/feedback/submit`, `/api/feedback/upload-media` |
| Security headers | `next.config.ts` | X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin, HSTS (1 year), Permissions-Policy (restricted camera/mic/geolocation) |

### Phase 4: Fragility Reduction
| Change | Files | Detail |
|--------|-------|--------|
| Zod validators | `src/lib/validators.ts` | Runtime schemas for JSONB fields: demographics, interests, consent, product profile, survey questions, feedback metadata, event data; includes `safeValidate()` helper |
| Entity checks | `src/lib/entity-checks.ts` | `productExists()` and `surveyExists()` — application-level FK validation |
| Feedback submit validation | `api/feedback/submit/route.ts` | Added `productExists` check before inserting feedback |

### Phase 5: Performance Safeguards
| Change | Files | Detail |
|--------|-------|--------|
| Analytics cleanup cron | `api/cron/cleanup-analytics-events/route.ts` | Deletes `analytics_events` older than 90 days (daily at 5 AM UTC) |
| Performance indexes | `drizzle/0013_add_performance_indexes.sql` | 15+ indexes on feedback, survey_responses, user_events, analytics_events, notification_queue, weekly_rankings, ranking_history, feedback_media, products |

### Phase 6: UI Responsiveness
| Change | File | Detail |
|--------|------|--------|
| Responsive CSS utilities | `globals.css` | `.table-responsive`, `.dashboard-grid`, `.chart-container` classes; Recharts overflow fix |

### Phase 7: API Abuse Protection
| Change | File | Detail |
|--------|------|--------|
| Upload rate limiting | `api/feedback/upload-media/route.ts` | IP-based rate limit on media uploads |

### Phase 8: Error Logging & Observability
| Change | Files | Detail |
|--------|-------|--------|
| Structured logger | `src/lib/logger.ts` | JSON structured logging with sensitive data redaction (passwords, tokens, API keys, SSN etc.); methods: `serviceError()`, `apiError()`, `cronResult()`, `warn()`, `info()` |
| Cron logging | All 7 cron routes | Replaced `console.error` with `logger.cronResult()` for structured JSON output |
| Service logging | `notificationService.ts`, `whatsappNotifications.ts` | Replaced `console.error` with `logger.serviceError()` for Resend/Twilio failures |

### Phase 9: Analytics Stability
| Change | Files | Detail |
|--------|-------|--------|
| Silent analytics failures | `api/analytics/track/route.ts`, `api/track-event/route.ts` | Both routes now return 200 on DB errors (analytics never break user experience); structured logging via `logger.apiError()` |

### Pre-configured Rate Limits
| Endpoint | Limit | Window |
|----------|-------|--------|
| Feedback submit | 10 requests | 60 seconds |
| Survey response | 20 requests | 60 seconds |
| Analytics event | 100 requests | 60 seconds |
| Auth attempt | 5 requests | 60 seconds |

### Cron Jobs (Complete List)
| Route | Schedule | Purpose |
|-------|----------|--------|
| `/api/cron/process-notifications` | Every 5 min | Send pending email/WhatsApp/SMS |
| `/api/cron/process-feedback-media` | Every 5–15 min | Whisper STT for audio/video |
| `/api/cron/cleanup-feedback-media` | Daily | Delete expired media blobs |
| `/api/cron/extract-themes` | Daily | AI theme extraction per product |
| `/api/cron/update-behavioral` | Daily | Recompute user behavioral profiles |
| `/api/cron/cleanup-analytics-events` | Daily (5 AM) | **NEW** — Delete analytics events older than 90 days |
| `/api/cron/send-time-analysis` | Weekly | Email send-time optimization |
| `/api/generate-rankings` | Weekly | Compute weekly product rankings |

---

---

## 18. Build Fix & Config Cleanup (March 12, 2026)

### Overview
The production build (`npm run build`) had been failing since commit `7fa4e13` (WatchButton feature), blocking all Vercel deployments for ~2 days across 5 consecutive commits.

### Root Cause
The `/public-products` listing page was a **Server Component** that contained an `onClick` event handler (used to wrap `<WatchButton>` and prevent link navigation). Next.js Server Components cannot pass event handlers — this causes a build-time prerender error.

### Changes Made

| Change | File | Detail |
|--------|------|--------|
| Added `"use client"` directive | `src/app/public-products/page.tsx` | Page uses `onClick` handler and renders `<WatchButton>` (a Client Component) — must be a Client Component itself |
| Removed deprecated `instrumentationHook` | `next.config.ts` | `experimental.instrumentationHook` is no longer needed in Next.js 15 — `instrumentation.ts` is loaded by default |

### Build Result
- **Before:** `EXIT CODE 1` — `Error: Event handlers cannot be passed to Client Component props` on `/public-products`
- **After:** `EXIT CODE 0` — All 126 pages compiled and generated successfully

---

---

## 19. Homepage Footer Mobile Fix (March 12, 2026)

### Problem
On mobile/smartphone browsers, the homepage footer was cluttered:
- The 4-column grid (Product, Company, Legal, Earn4Insights tagline) collapsed to a single column on small screens, creating a long vertical list
- The brand tagline and description text appeared inline with navigation links, making it hard to distinguish sections
- Company links pointed to wrong URLs (`/about` and `/contact` instead of `/about-us` and `/contact-us`)

### Fix
| Change | Detail |
|--------|--------|
| Restructured footer layout | Moved brand tagline + description to a centered full-width section above the link columns |
| Removed Product column | Removed "Product" section (Rankings + Dashboard links) — Dashboard requires auth (404 for visitors), Rankings already in header nav |
| Changed grid to 2-col | Company + Legal — clean 2-column layout centered on all screens |
| Fixed broken links | `/about` → `/about-us`, `/contact` → `/contact-us` |
| Centered text on mobile | Footer link columns use `text-center sm:text-left` for better mobile readability |

### File Changed
- `src/app/page.tsx` — homepage footer section

---

## 20. Sign-in Latency Optimization (March 12, 2026)

### Problem
Sign-in was noticeably slow for both Google OAuth and credentials-based login:
- **Google OAuth:** `prompt: "consent"` forced the full consent screen on every sign-in, even for returning users — adding 3-5 seconds
- **Database cold starts:** The Neon PostgreSQL serverless connection had no pooling configuration, causing cold start delays on every function invocation during auth callbacks

### Fixes Applied
| Change | File | Detail |
|--------|------|--------|
| Changed OAuth prompt | `src/lib/auth/auth.config.ts` | `prompt: "consent"` → `prompt: "select_account"` — returning users skip the consent screen, only see account picker |
| Added connection pooling | `src/db/index.ts` | Added `prepare: false` (required for Neon pgBouncer), `idle_timeout: 20`, `max: 10`, `connect_timeout: 10` to the postgres client options |

### Impact
- Google OAuth returning users: **~3-5 seconds faster** (skip consent screen)
- Database queries during auth: **Reduced cold start latency** via connection pooling and pgBouncer compatibility
- No functional changes — all auth flows work identically

---

## 21. Dashboard Query Parallelization (March 12, 2026)

### Problem
The dashboard page and layout fetched multiple pieces of data sequentially — each query waited for the previous one to finish, slowing page loads.

### Fix
| Change | File | Detail |
|--------|------|--------|
| Parallel queries on dashboard page | `src/app/dashboard/page.tsx` | `feedbackStats` and `recommendations` now fetched via `Promise.all` instead of sequentially |
| Parallel queries on dashboard layout | `src/app/dashboard/layout.tsx` | `getUserProfile` and `getUserProfileByEmail` now fetched via `Promise.all` |

### Impact
- Faster dashboard load times — queries overlap instead of stacking
- No user-facing changes — same data, same UI

---

## 22. Auth Flow Rewrite & 500 Error Fix (March 13, 2026)

### Problem
Sign-in was completely broken in production:
1. **Spinner hung forever:** The sign-in button's loading spinner never stopped. Caused by using NextAuth v5's `signIn()` inside a server action — the `NEXT_REDIRECT` exception propagated as an uncaught error.
2. **500 Internal Server Error:** After fixing the spinner, clicking "Sign In" returned a 500 error. Caused by `authorize()` throwing `new Error()` instead of returning `null`, plus missing `trustHost: true` for Vercel.

### What Changed

**Login page** (`src/app/(auth)/login/page.tsx`):
- Completely rewritten as a `'use client'` component
- Uses `signIn` from `next-auth/react` (client-side) instead of server actions
- Credentials: calls `signIn('credentials', { redirect: false })`, checks `result?.ok`, then `router.push('/dashboard')`
- Google: calls `signIn('google', { callbackUrl: '/dashboard' })`
- Shows user-friendly error messages for invalid credentials

**Signup page** (`src/app/(auth)/signup/page.tsx`):
- Hybrid approach: server action `signUpAction` for account creation (with Zod validation), then client-side `signIn` for authentication
- Role selection (brand/consumer) with consent checkboxes
- After creation: auto-signs-in and redirects to role-appropriate page

**Server actions** (`src/lib/actions/auth.actions.ts`):
- Stripped to only `signUpAction` — creates user and returns `{ success: true }` or `{ error: string }`
- Removed `signInAction` and `signInWithGoogleAction` (no longer needed)

**Auth config** (`src/lib/auth/auth.config.ts`):
- `authorize()` returns `null` instead of throwing errors — NextAuth treats null as "credentials rejected"
- Added `trustHost: true` — required for Vercel deployments
- JWT callback only populates token on initial sign-in (removed per-request DB lookup)

### User Experience
- Sign-in works reliably for both credentials and Google OAuth
- Invalid credentials show a clear error message instead of a spinner or 500
- Faster subsequent requests (no DB lookup on every JWT refresh)

---

---

## 23. Survey System Enhancements (March 14–15, 2026)

### 23.1 Google Forms-Style Question Editor

**File:** `src/app/dashboard/surveys/[id]/QuestionEditor.tsx` (**new**)

A new inline question editor is now embedded in the survey detail page (`/dashboard/surveys/[id]`):
- Shows each question with its type badge, required flag, options (for multiple-choice), and scale (for rating)
- Per-question delete controls
- "Add question" button appended at the bottom

### 23.2 `multiple_choice` → `multiple-choice` Bug Fix

**Problem:** The survey creation form saved question type as `multiple_choice` (underscore). The
consumer-facing `SurveyResponseForm` expected `multiple-choice` (hyphen). Surveys with multiple-choice
questions crashed for consumers because the type comparison never matched.

**Fixes applied:**

| Fix | File |
|---|---|
| Normalized type string | `src/app/dashboard/surveys/[id]/QuestionEditor.tsx` — all switch/type comparisons use `'multiple-choice'` |
| Seed data normalized | `data/surveys.json` — `multiple_choice` → `multiple-choice` in all records |
| Production backfill | `POST /api/admin/fix-surveys` — scans `surveys` table, normalizes JSONB `questions` array in-place (idempotent) |

### 23.3 Survey Type Selector Mobile Fix

**File:** `src/components/survey-creation-form.tsx`

The NPS / Product Feedback / Custom Survey type-selector button grid overflowed on small screens.
Changed from a fixed 3-column grid to `grid-cols-1 sm:grid-cols-3` — stacks vertically on mobile,
reverts to 3 columns on `sm` breakpoint.

### 23.4 Files Changed

| File | Change |
|---|---|
| `src/app/dashboard/surveys/[id]/QuestionEditor.tsx` | **New** — Google Forms-style question editor |
| `src/app/api/admin/fix-surveys/route.ts` | **New** — Admin backfill endpoint for type normalization |
| `data/surveys.json` | Normalized `multiple_choice` → `multiple-choice` |
| `src/components/survey-creation-form.tsx` | Survey type selector: responsive grid |

---

## 24. Multi-Channel Notification System — Slack (March 15, 2026)

### 24.1 Slack Integration

**File:** `src/server/slackNotifications.ts` (**new**)

Brand alerts can now be delivered to a Slack channel via Incoming Webhook (no SDK — plain HTTP POST).

Each brand configures their own Slack webhook URL in the Settings page. The webhook URL is stored per
brand in `brand_alert_rules.slackWebhookUrl`. `fireAlert()` looks up this URL and posts a Block Kit
message non-blocking — Slack failures never break in-app alert delivery.

**Emoji per alert type:** new_feedback `:speech_balloon:`, negative_feedback `:warning:`,
survey_complete `:bar_chart:`, high_intent `:rocket:`, watchlist `:eyes:`, frustration `:rotating_light:`

### 24.2 Survey Publish → Consumer Notification

The survey creation action now calls `notifyNewSurvey(surveyId)` when a survey goes `active`.
This schedules emails (and WhatsApp, see §25) for all matching consumers at their optimal send hour.

### 24.3 Notification Settings API (Brand)

`GET/PATCH /api/brand/notification-settings` — get/save the Slack webhook URL stored across the
brand's alert rules. Created in `src/app/api/brand/notification-settings/route.ts`.

### 24.4 Notification Settings Page

**Route:** `/dashboard/settings`
**File:** `src/app/dashboard/settings/page.tsx` (**new**)

| Section | Detail |
|---|---|
| Slack webhook URL input | Input + save button; setup instructions link to Slack docs |
| Alert rules table | Toggle email / Slack per alert type (in-app always on) |
| Channel toggles disabled | Until webhook URL is saved — tooltip explains requirement |

---

## 25. WhatsApp Real-Time Notifications (March 15, 2026)

### 25.1 Real Twilio Implementation

**File:** `src/server/whatsappNotifications.ts`

Replaced the `"WhatsApp not yet implemented"` stub with a real Twilio API call:
- Reads `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` env vars
- E.164 phone validation before sending
- Non-throwing — returns `false` rather than crashing the caller on failure

### 25.2 Coverage

| Trigger | Who receives WhatsApp |
|---|---|
| Brand alert fires (`fireAlert()`) | Brand user (if phone + enabled in their notification preferences) |
| New survey published | Matching consumers (instantly, alongside queued email) |

### 25.3 User Notification Settings API

`GET/PATCH /api/user/notification-settings` — available to **all** authenticated users:
- `GET` → returns `{ phoneNumber, enabled }` for the user's WhatsApp preferences
- `PATCH` → saves phone number + enabled toggle to `userProfiles.notificationPreferences.whatsapp`

### 25.4 Settings Page (All Users)

`/dashboard/settings` now renders for brands AND consumers:

| Section | Brands | Consumers |
|---|---|---|
| WhatsApp card | ✅ (phone + enable toggle) | ✅ (phone + enable toggle) |
| Alert rules table | ✅ | ❌ |
| Survey info card | ❌ | ✅ |

Brand-only role gate removed from the settings page route.

### 25.5 Files Changed

| File | Change |
|---|---|
| `src/server/whatsappNotifications.ts` | Real Twilio implementation |
| `src/server/notificationService.ts` | `sendWhatsApp()` calls real Twilio function |
| `src/server/brandAlertService.ts` | Sends WhatsApp in `fireAlert()` (non-blocking) |
| `src/server/campaigns/surveyNotificationCampaign.ts` | Consumers get instant WhatsApp on survey publish |
| `src/app/api/user/notification-settings/route.ts` | **New** — WhatsApp settings GET/PATCH |
| `src/app/dashboard/settings/page.tsx` | WhatsApp card for all users; consumer card added |

---

## 26. Brand Alerts Dashboard (March 15, 2026)

**Route:** `/dashboard/alerts`
**File:** `src/app/dashboard/alerts/page.tsx` (**new**)

A full-page inbox showing the current brand's real alerts.

| Feature | Detail |
|---|---|
| Alert list | Up to 50 alerts, newest first |
| Alert type icons | MessageSquare (new_feedback), AlertCircle (negative/frustration), BarChart3 (survey_complete), TrendingUp (high_intent), Eye (watchlist) |
| Mark all read | `POST /api/brand/alerts {action:'mark_all_read'}` |
| Unread count | Displayed in page heading |
| Empty / loading states | Inbox icon + message; spinner on load |
| Sidebar integration | "Alerts" nav link shows live unread badge (polls every 30 s) |

---

## 27. Bell Icon Real-Time Notifications (March 16, 2026)

### Problem
The dashboard header bell always showed 3 hardcoded consumer mocks to every user regardless of role:
- "New Survey Response"
- "New Reward Earned"
- "Payout Processed"

### Solution

**File:** `src/components/dashboard-header.tsx` — complete rewrite of the bell section.

The bell now fetches real data and renders role-appropriate content:

| | Brands | Consumers |
|---|---|---|
| Data API | `GET /api/brand/alerts?limit=10` | `GET /api/consumer/notifications` |
| Unread count | `unread` from API | Items newer than `localStorage.notif_last_read` |
| Mark read on open | "Mark all read" button | `localStorage.notif_last_read = now()` |
| View all link | `/dashboard/alerts` | `/dashboard/my-feedback` |

**Consumer Notifications API (new):** `GET /api/consumer/notifications`
(`src/app/api/consumer/notifications/route.ts`)
— queries `notification_queue` for the current user, last 30 days, limit 20.

**Notification type icons:**

Brands: MessageSquare (new_feedback) · AlertCircle (negative) · BarChart3 (survey_complete) · TrendingUp (high_intent) · Eye (watchlist) · Zap (frustration)

Consumers: ClipboardList (new_survey) · BarChart3 (weekly_digest) · CheckCheck (survey_submitted) · Star (reward_earned)

**UX:** Numeric badge (capped `9+`), hidden when zero. Loading spinner. Empty state. `formatDistanceToNow` timestamps. HTML stripped from consumer body text.

### Files Changed

| File | Change |
|---|---|
| `src/components/dashboard-header.tsx` | Rewritten: hardcoded mocks → real role-based `NotificationDropdown` |
| `src/app/api/consumer/notifications/route.ts` | **New** — consumer notification feed API |

---

*This document covers all features implemented as of March 16, 2026. Update this file when adding new features.*
