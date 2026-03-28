# Earn4Insights — Feature Documentation

> **Last updated:** March 27, 2026  
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
28. [Social Listening System (March 17–18, 2026)](#28-social-listening-system-march-1718-2026)
29. [Social Data Relevance Filter (March 18, 2026)](#29-social-data-relevance-filter-march-18-2026)
30. [YouTube & Google Reviews API Activation (March 18, 2026)](#30-youtube--google-reviews-api-activation-march-18-2026)
31. [Production DB Schema Push & Full Deployment (March 19, 2026)](#31-production-db-schema-push--full-deployment-march-19-2026)
32. [In-App Community + Real Rewards Engine (March 20, 2026)](#32-in-app-community--real-rewards-engine-march-20-2026)
33. [Social Listening Charts, Data Fixes & Schema Drift Audit (March 21, 2026)](#33-social-listening-charts-data-fixes--schema-drift-audit-march-21-2026)
34. [Mobile Search, Welcome Notifications & Notification Pipeline Fix (March 23, 2026)](#34-mobile-search-welcome-notifications--notification-pipeline-fix-march-23-2026)
35. [Security Audit & Hardening (March 24, 2026)](#35-security-audit--hardening-march-24-2026)
36. [Deep Security Hardening — Phase 2 (March 24, 2026)](#36-deep-security-hardening--phase-2-march-24-2026)
37. [Data Source Consolidation — JSON Store → Database (March 24, 2026)](#37-data-source-consolidation--json-store--database-march-24-2026)
38. [Repository Health Hardening (March 24, 2026)](#38-repository-health-hardening-march-24-2026)
39. [Accessibility Fixes & Cross-Browser Testing (March 24–25, 2026)](#39-accessibility-fixes--cross-browser-testing-march-2425-2026)
40. [UI/UX Audit & Stability Fixes (March 25, 2026)](#40-uiux-audit--stability-fixes-march-25-2026)
41. [Self-Serve Import System & Downstream Analytics Coverage (March 27, 2026)](#41-self-serve-import-system--downstream-analytics-coverage-march-27-2026)

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

The rewards system is now **database-backed** and no longer a mock-only UI.

Consumers can now:
- View their live point balance and lifetime points total
- See recent point transactions from `GET /api/user/points`
- Browse a seeded reward catalog from `GET /api/rewards`
- Redeem rewards through `POST /api/rewards`
- Track challenge progress from `GET /api/challenges`

### Point sources currently wired
- Feedback submissions: 25 points (existing product copy and feedback stats flow)
- Community post creation: 10 points
- Community replies: 5 points
- Receiving an upvote on a community post or reply: 2 points

### Built-in challenges
- First Feedback
- Photo Reviewer
- Video Reviewer
- Community Starter
- Active Participant
- Survey Champion

### Reward catalog behavior
- Supports limited-stock and unlimited-stock rewards
- Deducts points immediately on redemption
- Stores redemption history in `reward_redemptions`
- Includes seeded rewards such as coupons, gift cards, merchandise, and cash-out options

### Payouts
**Route:** `/dashboard/payouts`

Payouts are also now backed by real database records and APIs.

Consumer behavior:
- Request a payout directly from `/dashboard/payouts`
- Minimum payout is 500 points
- Conversion rate is 100 points = $1 USD
- Balance is reduced immediately when the request is created

Brand behavior:
- Review all payout requests from the same page
- Approve or deny pending requests
- Denied requests automatically refund points to the consumer

### Core APIs
- `GET /api/user/points`
- `GET /api/rewards`
- `POST /api/rewards`
- `GET /api/challenges`
- `GET /api/payouts`
- `POST /api/payouts`
- `PATCH /api/payouts`

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

*This document covers all features implemented as of March 18, 2026. Update this file when adding new features.*

---

## 28. Social Listening System (March 17–18, 2026)

### Overview
Complete social listening pipeline that aggregates public sentiment from 10 external platforms into the existing analytics stack. Brands monitor what consumers say across the internet about their products.

### Platform Adapters (10 total)

| Platform | Status | Auth |
|----------|--------|------|
| Reddit | ✅ Working | None (public JSON API) |
| Brand-submitted links | ✅ Working | None |
| YouTube | Ready | `YOUTUBE_API_KEY` (free, 10K units/day) |
| Google Reviews | Ready | `GOOGLE_PLACES_API_KEY` (free $200/mo credit) |
| Twitter/X | Ready | `TWITTER_BEARER_TOKEN` ($100/mo) |
| Amazon | Shell | Scraper proxy needed |
| Flipkart | Shell | Scraper proxy needed |
| Instagram | Shell | Meta Graph API |
| TikTok | Shell | TikTok Research API |
| LinkedIn | Shell | LinkedIn Marketing API |

### Data Pipeline
```
Platform Adapter → Dedup → Relevance Score → Sentiment Analysis → DB → Analytics
```

### Cross-App Integration
Social data feeds into: Rankings (10% weight), Product Health Score, Feature Sentiment, Category Intelligence, and Theme Extraction. Consumer Intelligence is driven primarily by `feedback` joined with `userProfiles`, not raw `social_posts`.

### UI
- Dashboard page: `/dashboard/social`
- Overview cards: total posts, avg sentiment, platform breakdown, trend
- Keyword cloud from social mentions
- Submit-link form for brands to add specific URLs

### API Routes
- `GET /api/social` — fetch social posts (paginated, filterable)
- `POST /api/social/ingest` — trigger ingestion from platforms
- `POST /api/social/submit-link` — brand submits a URL

### Key Files
| File | Purpose |
|------|---------|
| `src/server/social/platformAdapters.ts` | 10 adapters + relevance scoring |
| `src/server/social/socialIngestionService.ts` | Fetch → score → filter → persist |
| `src/server/social/socialAnalyticsService.ts` | Aggregation & trends |
| `src/db/repositories/socialRepository.ts` | CRUD & aggregation queries |
| `src/app/dashboard/social/page.tsx` | Server component |
| `src/app/dashboard/social/SocialPageClient.tsx` | Client UI |

---

## 29. Social Data Relevance Filter (March 18, 2026)

### Problem
Keyword searches on platforms return irrelevant results (e.g., searching "Galaxy" returns astronomy posts, not the registered product). No post-fetch validation existed — everything went straight to DB.

### Solution: Multi-Signal Relevance Scoring

**Function:** `calculateRelevanceScore()` — scores every fetched post 0.0–1.0:

| Signal | Weight |
|--------|--------|
| Product name in content/title | +0.40 |
| Brand name in content/title | +0.30 |
| Category keywords | +0.15 |
| Co-occurrence (product + brand together) | +0.15 |

- **Threshold:** `0.4` — posts below this are discarded
- ID-based platforms (Google Reviews, Amazon, Flipkart) and brand-submitted links auto-score `1.0`
- Reddit & YouTube adapters now use exact-phrase queries (`"product name"`) for precision

### Pipeline Integration
Posts are scored after dedup but before sentiment analysis. Brand name is looked up from users table, category from product profile JSONB. The `irrelevantFiltered` counter tracks discarded posts.

### DB Change
Added `relevanceScore: real` column to `socialPosts` table.

---

## 30. YouTube & Google Reviews API Activation (March 18, 2026)

### YouTube Data API v3
- **Before:** all videos had `likes: 0, comments: 0, views: 0` — engagement score was always 0
- **After:** added a batch call to `GET /youtube/v3/videos?part=statistics&id=id1,id2,...` that fetches real stats for all search results in a single extra request
- Engagement score now calculated from actual views / likes / comments
- **Env var:** `YOUTUBE_API_KEY`
- **Quota cost:** +1 unit per batch (well within 10,000 free units/day)

### Google Places API (Reviews)
- **Before:** required a manually provided `placeId` — adapter was non-functional from the generic ingestion pipeline
- **After:** when no `placeId` is provided, the adapter auto-discovers it via Google Text Search API (`/maps/api/place/textsearch/json`), then fetches up to 5 reviews via the Place Details API
- **Env var:** `GOOGLE_PLACES_API_KEY`
- **Cost:** free within Google's $200/month Maps Platform credit

### Environment Variables
| Variable | Purpose |
|----------|---------|
| `YOUTUBE_API_KEY` | YouTube Data API v3 — search + video statistics |
| `GOOGLE_PLACES_API_KEY` | Google Places API — Reviews text search + place details |

### Files Modified
| File | Change |
|------|--------|
| `src/server/social/platformAdapters.ts` | YouTube: batch stats fetch; Google: Text Search auto-discovery |
| `.env.example` | Added both keys + `TWITTER_BEARER_TOKEN` documentation |

---

## 31. Production DB Schema Push & Full Deployment (March 19, 2026)

### What changed
The social listening system is now fully live in production:

1. **`relevance_score` column** applied to the production Neon DB — stores 0–1 relevance score per social post
2. **YouTube Data API v3** and **Google Places API** keys added to Vercel environment variables
3. **End-to-end pipeline active:** Reddit → YouTube → Google Reviews → relevance filter → sentiment → DB

### DB column
```sql
-- social_posts table
relevance_score REAL  -- 0.0 to 1.0, posts below 0.4 filtered before insert
```

### Platform status as of March 19, 2026

| Platform | Status | Notes |
|----------|--------|-------|
| Reddit | ✅ Live | No API key needed |
| YouTube | ✅ Live | Real stats: views/likes/comments |
| Google Reviews | ✅ Live | Auto-discovers placeId via Text Search |
| Twitter/X | ⏳ Pending | Requires $100/mo API plan |
| Amazon / Flipkart | ⏳ Pending | Requires scraper proxy setup |
| Instagram / TikTok / LinkedIn | ⏳ Pending | Requires partner API approval |

---

## 32. In-App Community + Real Rewards Engine (March 20, 2026)

### 32.1 Community Rebuilt as a Real Product Feature

The old `/dashboard/community` mock social feed was replaced with a true in-app discussion system.

Users can now:
- Create discussion threads
- Post AMAs and announcements (brand-only)
- Submit feature requests
- Share tips and tricks
- Create and vote in polls
- Reply to threads with nested replies
- Upvote and downvote posts and replies
- Delete their own posts

### 32.2 Community UX

**Routes:**
- `/dashboard/community` — thread listing page
- `/dashboard/community/[postId]` — thread detail page

**Listing page features:**
- Search by title
- Filter by post type
- Create-post dialog with poll option builder
- Pinned and locked thread indicators
- Reply count and view count

**Thread detail features:**
- Full post detail view
- Vote bar for upvotes/downvotes
- Poll rendering with vote percentages
- Nested replies up to two levels in the current UI
- Locked-thread state preventing new replies

### 32.3 Community APIs

- `GET /api/community/posts`
- `POST /api/community/posts`
- `GET /api/community/posts/[postId]`
- `DELETE /api/community/posts/[postId]`
- `POST /api/community/posts/[postId]/replies`
- `POST /api/community/react`
- `POST /api/community/poll/vote`

### 32.4 Real Rewards Backend Added

The previous rewards and payouts pages used hardcoded mock data. They now use:
- `user_points`
- `point_transactions`
- `rewards`
- `reward_redemptions`
- `payout_requests`
- `challenges`
- `user_challenge_progress`

The shared points logic lives in `src/server/pointsService.ts` and handles point awarding, deductions, balance reads, and challenge progression.

### 32.5 Validation Status

- Production build completed successfully locally after the changes
- Community routes compile cleanly
- Rewards, payouts, challenges, and user points routes compile cleanly

---

## 33. Social Listening Charts, Data Fixes & Schema Drift Audit (March 21, 2026)

### 33.1 Social Listening Charts

Three new analytics charts added to the social dashboard (`/dashboard/social`):

| Chart | Recharts type | Data |
|-------|--------------|------|
| Mentions Over Time | `AreaChart` | Daily post count, last 30 days |
| Sentiment Trend | `LineChart` | Daily average sentiment score (-1.0 to 1.0), last 30 days |
| Platform Breakdown | `BarChart` (horizontal) | Total mentions per platform |

**File:** `src/app/dashboard/social/SocialPageClient.tsx`  
All three charts use `ResponsiveContainer` and are only rendered when `data.overview` is non-null.  
**Commit:** `cfcdc1e`

### 33.2 Platform Breakdown Chart UX Improvements

| Change | Detail |
|--------|--------|
| `dataKey` renamed | `value` → `mentions` — tooltip now shows "mentions" |
| Custom tooltip | Bold platform name header + "Mentions: N" label |
| Y-axis labels bold | `tick={{ fontWeight: 600 }}` |
| X-axis label | Added "Mentions" axis label |

**Commit:** `c4fb520`

### 33.3 Brand User Fallback Fix

**Problem:** Brand users whose products had `owner_id = NULL` received an empty product list → `data.overview = null` → all charts hidden.

**Fix:** In `src/app/dashboard/social/page.tsx`, when `WHERE owner_id = userId` returns 0 rows, the server component falls back to all products with `social_listening_enabled = true`.

**Commit:** `b7630c4`

### 33.4 Fake URL Fix

376 seed/scraper posts had placeholder URLs (`https://google.com/post/{uuid}`) that 404'd when clicked.

```sql
UPDATE social_posts SET url = NULL WHERE url LIKE '%/post/%';
-- 376 rows updated
```

The "View original" link is guarded by `{post.url && ...}` so it auto-hides for null URLs. 83 real API posts retain their proper URLs.

### 33.5 Product Ownership Fix

All 5 social-listening-enabled products assigned to `vishweshwar@startupsgurukul.com` (`user_1770175075455_vy7th`) via direct DB `UPDATE` on Neon.

### 33.6 Full Schema Drift Audit & Fix

Audit compared all 40 Drizzle-defined tables against the live Neon database. **4 tables were missing from the DB:**

| Table | Purpose |
|-------|---------|
| `product_watchlist` | Consumer product watchlist entries |
| `consumer_intents` | Consumer purchase/interest intent signals |
| `brand_alert_rules` | Brand alert configuration per alert type |
| `brand_alerts` | Individual fired alert records |

All 4 created via `CREATE TABLE IF NOT EXISTS` directly on Neon. Zero schema drift remains.

### 33.7 Mobile Header Layout Fix

Fixed dashboard header alignment on mobile — sidebar trigger, logo, and action buttons now display correctly on small screens.

**Commit:** `5b7abb0`

### 33.8 Commits

| Commit | Description |
|--------|-------------|
| `5b7abb0` | fix: mobile header layout |
| `cfcdc1e` | feat: add time-series mentions, sentiment trend, platform breakdown charts |
| `b7630c4` | fix: brand users with no owned products now see social charts |
| `c4fb520` | feat: improve platform breakdown chart (bold labels, custom tooltip, Mentions axis) |
| `d4b33b4` | chore: trigger Vercel rebuild |

---

## 34. Mobile Search, Welcome Notifications & Notification Pipeline Fix (March 23, 2026)

### 34.1 Mobile Search & Command Palette

The search button in the dashboard header was invisible on mobile devices. Now it shows an icon-only search button on small screens and the full "Search" button on larger screens.

The command palette (`Ctrl+K`) was also not mobile-friendly — the dialog sat too high, text was too small for touch, and results could overflow. Updated with:
- Lower dialog position on mobile (`mt-[10vh]`)
- Larger input text for touch (`text-base` on mobile)
- Scrollable results list capped at viewport height
- Auto-focus on input when opened

### 34.2 Welcome Email & WhatsApp Notifications

New users now receive a branded welcome notification immediately after signup:

**Consumer welcome:**
- Email (via Resend): "Welcome to Earn4Insights" with steps: browse products → submit feedback → earn points → redeem rewards
- WhatsApp (via Twilio): Short greeting with link to browse products

**Brand welcome:**
- Email: "Welcome to Earn4Insights" with steps: add products → track rankings → create surveys → get AI insights
- WhatsApp: Short greeting with link to add first product

Both channels are fire-and-forget — failures are logged but don't block signup. Works for both email/password and Google OAuth signup flows.

**Key file:** `src/server/welcomeNotifications.ts`

### 34.3 Notification Pipeline Fix

**Problem:** Since launch, no email or WhatsApp notifications were ever delivered — not for brand alerts (new feedback, sentiment changes) and not for consumer events.

**Root causes found and fixed:**

1. **Missing cron job** (critical): `/api/cron/process-notifications` was never registered in `vercel.json`. All notifications were queued in the database but never processed.
2. **Brand alerts email-less**: `fireAlert()` defaulted to `['in_app']` channels only — email was never queued for brand alerts. Changed to `['in_app', 'email']`.
3. **New users dropped**: `queueNotification()` returned null when `getUserProfile()` found no profile (new users who haven't completed onboarding). Fixed to allow email even without a profile.
4. **Email lookup failed**: `sendEmail()` required a `userProfiles` entry to find the user's email. Added fallback to the `users` table.

### 34.4 Consumer Notification Types

New file `src/server/consumerNotifications.ts` provides:

| Notification | Trigger | Content |
|-------------|---------|---------|
| Points earned | After feedback submission | "You earned 25 points for your feedback on [Product]!" |
| New product relevant | New product in category of interest | "New product in [Category]: [Product Name]" |
| Watchlist update | New feedback on watchlisted product | "Your watchlisted product [Name] has new activity" |

All are queued via the notification pipeline and processed by the daily cron.

### 34.5 Build & Deployment Fixes

| Issue | Impact | Fix |
|-------|--------|-----|
| Products page SSG timeout | Build failed — DB query >60s during static generation | Added `export const dynamic = 'force-dynamic'` |
| `awardPoints()` args swapped | TypeScript error: `string` not assignable to `number` | Corrected argument order: `(userId, amount, source)` |
| Test files in tsconfig | `@jest/globals` missing types broke build | Added `src/__tests__` to tsconfig `exclude` |
| Vercel Hobby cron limit | `*/5 * * * *` silently blocked ALL deployments | Changed to `0 6 * * *` (daily) |

### 34.6 Commits (March 23, 2026)

| Commit | Description |
|--------|-------------|
| `e831e8e` | fix: mobile search visibility + type errors |
| `5ffa900` | feat: welcome email & WhatsApp notifications on signup |
| `5c05349` | fix: enable notification delivery pipeline |
| `d4c7219` | fix: make products page dynamic to prevent build timeout |
| `8c95218` | fix: correct awardPoints argument order and exclude tests from tsconfig |
| `1c7d7bf` | fix: set notification cron to daily (Vercel Hobby plan limit) |

---

---

## 35. Security Audit & Hardening (March 24, 2026)

Full architecture audit of 73 pages, 103 API routes, 40 server services, and 66 UI components. Identified 14 fragile areas and fixed 10.

### 35.1 Admin API Security

Removed hardcoded admin keys (`test123`, `e4i-admin-2026`) from 6 API routes. All admin endpoints now require `ADMIN_API_KEY` environment variable — no fallback keys.

Affected routes:
- `/api/admin/apply-migration`
- `/api/admin/migrate`
- `/api/admin/migrate-data`
- `/api/admin/run-data-migration`
- `/api/admin/migrate-data-get` (also switched from query param to header auth)
- `/api/admin/analytics` (removed `e4i-admin-2026` fallback)

### 35.2 Admin Page Protection

`middleware.ts` now blocks non-admin users from `/admin/*` pages. Unauthenticated users are redirected to `/login`, non-admin roles to `/dashboard`.

### 35.3 Environment Documentation

`.env.example` updated with all 43 environment variables organized by category (Database, Auth, Admin, Email, WhatsApp, OpenAI, Encryption, URLs, Analytics, Social APIs, Media Processing).

### 35.4 Repository Cleanup

- 28 build artifact `.txt` files removed from git tracking
- `.gitignore` updated with patterns to prevent future re-addition
- Deleted dead `layout.tsx.backup` file

### 35.5 External Cron Documentation

`DEPLOY.md` updated with setup guide for external cron services (e.g., cron-job.org) to run notification processing every 5 minutes, bypassing Vercel Hobby plan's daily-only cron limit.

### 35.6 Files Changed

| File | Change |
|------|--------|
| `src/app/api/admin/apply-migration/route.ts` | Removed `test123` fallback |
| `src/app/api/admin/migrate/route.ts` | Removed `test123` fallback |
| `src/app/api/admin/migrate-data/route.ts` | Removed `test123` fallback |
| `src/app/api/admin/run-data-migration/route.ts` | Removed `test123` fallback |
| `src/app/api/admin/migrate-data-get/route.ts` | Query param → header auth |
| `src/app/api/admin/analytics/route.ts` | Removed `e4i-admin-2026` fallback |
| `middleware.ts` | Added `/admin` route protection |
| `.env.example` | Complete rewrite with 43 vars |
| `.gitignore` | Added build artifact patterns |
| `DEPLOY.md` | External cron setup guide |

### 35.7 Commits (March 24, 2026)

| Commit | Description |
|--------|-------------|
| `c4b37f4` | pre-audit snapshot |
| `60ace6d` | security: remove hardcoded admin keys, protect /admin pages, clean build artifacts |

---

## 36. Deep Security Hardening — Phase 2 (March 24, 2026)

A second deep scan revealed 22 additional unprotected API routes missed by the Phase 1 audit (§35).

### 36.1 Deleted Unsafe Endpoints (8 routes)

Removed one-time migration and debug routes that were publicly callable with no authentication:
- `api/setup-db` — executed raw SQL DDL
- `api/create-personalization-tables` — executed raw SQL DDL
- `api/create-google-user` — allowed anyone to create brand users via URL params
- `api/migrate-products` — bulk inserted data from JSON file
- `api/migrate-all-data` — had hardcoded `test123` auth (missed in Phase 1)
- `api/generate-rankings` — queried products with raw neon() driver
- `api/debug/media-status` — debug endpoint (code said "DELETE THIS")
- `api/debug/check-media` — debug endpoint

### 36.2 Admin Route Protection (12 routes)

Added `authenticateAdmin()` (requires `ADMIN_API_KEY` header) to 12 admin routes that previously had zero authentication — including routes that wrote to the database, sent WhatsApp/email messages, and triggered notification campaigns.

### 36.3 Rate Limiting Expanded

Previously only 4 routes had rate limiting. Added:
- **Credential login**: 5 attempts / 60s per email (wired up existing unused `authAttempt` config)
- **Signup**: 3 attempts / 60s per IP
- **Community post creation**: 5 posts / 60s per user

### 36.4 Error Leakage Fixed

- Removed `error.stack` from `health-check` HTTP response
- Deleted `create-google-user` which also leaked stack traces

### 36.5 Files Changed

| File | Change |
|------|--------|
| 12 admin route files | Added `authenticateAdmin()` guard |
| 8 route files | Deleted (migration/debug endpoints) |
| `src/lib/rate-limit.ts` | Added `communityPost` and `signup` configs |
| `src/lib/auth/auth.config.ts` | Wired `authAttempt` rate limiting into `authorize()` |
| `src/app/api/auth/complete-signup/route.ts` | Added signup rate limiting |
| `src/app/api/community/posts/route.ts` | Added post creation rate limiting |
| `src/app/api/health-check/route.ts` | Removed `error.stack` from response |

### 36.6 Commit (March 24, 2026)

| Commit | Description |
|--------|-------------|
| `9229abb` | security: protect 12 admin routes, delete 8 unsafe endpoints, add rate limiting |

---

---

## 37. Data Source Consolidation — JSON Store → Database (March 24, 2026)

A codebase audit identified a critical data consistency bug: **5 files** were reading/writing product data from a local JSON file (`data/products.json`) instead of the Neon PostgreSQL database. On Vercel, this JSON file is ephemeral — data written to it is lost on every deployment.

### 37.1 What Was Fixed

- **Rankings system** (`rankingService.ts`, `migrationScript.ts`) — was generating weekly rankings from an empty/stale JSON file instead of real DB products
- **Top Products pages** (`top-products/[category]/page.tsx`) — was looking up product details from the JSON file; products created via the dashboard wouldn't appear
- **Trends API** (`api/rankings/[category]/trends`) — was filtering products by category from the JSON file
- **Bulk category assign** (`api/admin/assign-categories-bulk`) — category assignments were written to the JSON file and lost on deploy

All 5 files now import from `@/db/repositories/productRepository` (the real database).

### 37.2 Dead Code Cleanup

- Removed unused `SiteFooter` import from the root layout
- Removed 3 unused `export default` statements from `dialog.tsx`, `alert.tsx`, `separator.tsx` UI components (named exports still work correctly)

### 37.3 Impact

- Rankings, top products, and trends now reflect real database products
- Admin bulk category assignment now persists correctly
- No UI or behavior changes — only the data source was swapped
- Build verified: 137/137 pages, zero TypeScript errors

---

---

## 38. Repository Health Hardening (March 24, 2026)

Fixes applied to improve build safety, reduce bundle size, handle errors gracefully, and improve accessibility.

### 38.1 Build Safety

- **TypeScript errors now block production builds.** Previously `ignoreBuildErrors: true` in `next.config.ts` allowed broken code to deploy silently. Now set to `false`.
- ESLint `ignoreDuringBuilds` remains `true` due to a known Next.js 15.x tooling conflict — this is intentional.

### 38.2 Unused Dependencies Removed

- **`firebase`** (~1MB) — was in `package.json` but zero files imported it. Removed.
- **`@radix-ui/react-toast`** — the project uses `sonner` for all toast notifications. The Radix toast primitive was never used. Removed.

### 38.3 Error Boundary

- New file: `src/app/error.tsx`
- When an unhandled error occurs in any page, users now see a friendly "Something went wrong" message with a "Try again" button, instead of a blank white screen.

### 38.4 Accessibility: Skip Navigation

- A skip-to-content link is now the first focusable element in the root layout
- Invisible by default, appears on keyboard Tab focus
- Links to `#main-content` on the `<main>` element
- Helps keyboard and screen reader users skip past the header navigation

### 38.5 npm Audit

- 4 moderate vulnerabilities found — all in `esbuild` nested inside `drizzle-kit` (dev dependency only)
- Fix requires a breaking downgrade of `drizzle-kit` — intentionally skipped
- No production dependency vulnerabilities

---

## 39. Accessibility Fixes & Cross-Browser Testing (March 24–25, 2026)

### 39.1 Vote Button Accessibility (A1–A2)

**Problem**: Community discussion vote buttons (upvote/downvote) contained only SVG icons with no text — screen readers announced them as empty buttons.

**Fix**: Added descriptive `aria-label` attributes to all icon-only buttons in the community post detail page:
- Reply votes: `"Upvote reply"`, `"Downvote reply"`
- Post votes: `"Upvote post"`, `"Downvote post"`
- Poll options: `"Vote for {option text}"`
- Reply/Cancel buttons: `"Reply to comment"`, `"Cancel reply"`

**File**: `src/app/dashboard/community/[postId]/page.tsx`

### 39.2 Form Label Binding (A3)

**Problem**: The feedback form had `<label>` elements visually positioned near inputs but not programmatically linked — assistive technology couldn't associate labels with their controls.

**Fix**: Added `htmlFor`/`id` attribute pairs:
- Rating label → `id="feedback-rating"` on `<select>`
- Feedback label → `id="feedback-text"` on `<textarea>`

**File**: `src/components/feedback-form.tsx`

### 39.3 Items Assessed — No Code Change Needed

- **A4** (heading size): Proper h1→h2→h3 hierarchy already present on homepage
- **A5** (lang attribute): `lang="en"` is correct — multilingual support is for user content, not UI
- **A6** (color contrast): Requires runtime Lighthouse/axe audit, not a static code fix

### 39.4 Playwright Cross-Browser Testing

**What it does**: Automated smoke testing across 6 browser/device configurations to catch rendering, accessibility, and viewport issues.

**Setup**:
- `@playwright/test` v1.58.2 installed as dev dependency
- Chromium browser engine downloaded
- Config: `playwright.config.ts` (root)

**Browser Projects**:
1. Desktop Chrome (Chromium)
2. Desktop Firefox
3. Desktop Safari (WebKit)
4. Mobile Chrome (Pixel 5)
5. Mobile Safari (iPhone 12)
6. Microsoft Edge

**Smoke Test Suite** (`e2e/smoke.spec.ts` — 11 tests):
- **Public pages**: Homepage hero heading, login page, top-products page
- **Accessibility**: `lang="en"` attribute, skip-to-content link, `main#main-content` target, image alt text
- **Viewport**: Mobile (375px), tablet (768px), desktop (1440px) — heading visibility, no horizontal overflow
- **Navigation**: Homepage → login link flow

**How to run**:
```bash
npm run dev          # start dev server on port 9002
npx playwright test  # run all tests
npx playwright test --project=chromium  # single browser
npx playwright show-report   # view HTML report
```

**Results**: 10/11 passed on Chromium. The single failure is a cold-start dev server compilation timeout — not a code issue.

---

## 40. UI/UX Audit & Stability Fixes (March 25, 2026)

Comprehensive 6-part UI audit followed by fixes for all identified issues.

### Audit Areas & Results

| Area | Verdict | Issues Found |
|------|---------|-------------|
| Onboarding / Product Profile Flow | Fixed | No step-level persistence for consumer onboarding |
| Profile State Safety | Fixed | Missing profile fallback guard |
| Responsiveness | Fixed | Inline `overflow: visible` on Step 3 card |
| Sidebar / Navigation | Fixed | Session loading flicker, polling in background tabs |
| Toast System Integrity | Clean | All sonner imports valid, no stale references |
| UX Stability | Fixed | Missing loading.tsx and dashboard error boundary |

### Fixes Applied

1. **Onboarding Draft Persistence** — Consumer onboarding form data saved to `sessionStorage` on every change; restored on reload; cleared on successful completion. Consent checkboxes intentionally not persisted.

2. **Overflow Fix** — Removed `overflow: visible` inline styles and redundant breakpoint classes from onboarding Step 3 card (`OnboardingClient.tsx`).

3. **Sidebar Flicker Prevention** — During `useSession()` loading state, sidebar shows only shared (non-role-specific) items. Role-specific items appear once session resolves. Menu items memoized with `useMemo`.

4. **Dashboard Loading Skeleton** — Created `src/app/dashboard/loading.tsx` with animated pulse skeleton for title, stat cards, and content area.

5. **Dashboard Error Boundary** — Created `src/app/dashboard/error.tsx` with "Try again" and "Back to Dashboard" recovery actions.

6. **Product Profile Guard** — Added `product.profile ?? { currentStep: 1, data: {} }` fallback in profile page to prevent crash on undefined profile.

7. **Alert Polling Optimization** — Polling skips network requests when browser tab is hidden using `document.visibilitychange` event.

### Files Changed

- `src/app/onboarding/OnboardingClient.tsx` — draft persistence + overflow fix
- `src/app/dashboard/DashboardShell.tsx` — flicker fix + visibility polling
- `src/app/dashboard/loading.tsx` — new file
- `src/app/dashboard/error.tsx` — new file
- `src/app/dashboard/products/[productId]/profile/page.tsx` — profile guard

---

## 41. Self-Serve Import System & Downstream Analytics Coverage (March 27, 2026)

### Overview

Brand users can now import external feedback data themselves through a dashboard workflow instead of depending on manual DB work or rigid CSV formats.

### Brand UX

- New navigation item for brand users: `/dashboard/import`
- CSV upload flow is now two-step:
  1. Upload and preview
  2. Map columns and confirm import
- Import history panel shows recent jobs with status, imported count, skipped count, duplicate count, and total rows
- Downloadable CSV template included on the page

### Smart Column Mapping

The import UI auto-detects common source headers for:

- Product ID
- Feedback Text
- Rating
- User Name
- User Email
- Category

If the file does not contain a product identifier column, the user can assign all rows to one owned product.

### CSV Import API

`POST /api/import/csv` supports two modes:

- `action=preview` — parse CSV, return headers, sample rows, row count, survey format detection
- `action=import` — apply mapping, validate rows, deduplicate, analyze sentiment, persist into `feedback`

Validation rules:

- only `.csv`
- max 5 MB
- max 500 rows
- requires `feedbackText`
- requires either mapped `productId` or `defaultProductId`

### Survey Import Support

The importer detects and normalizes exports from:

- Google Forms
- SurveyMonkey
- Typeform
- generic Q&A style CSVs

Survey answers are transformed into a single feedback body so they can participate in the same downstream analytics pipeline as direct feedback.

### Import Tracking

New table: `import_jobs`

Tracks brand ID, source, original file name, selected column mapping, default product, status, row counters, errors, and timestamps.

Related APIs:

- `GET /api/import/jobs`
- `GET /api/import/products`

### Dedup + Metadata

- Duplicate detection uses SHA-256 of `productId:feedbackText`
- Imported rows are tagged in `feedback.multimodalMetadata` with `importSource`, `importJobId`, `fileName`, and optional survey format metadata

### Verified Downstream Coverage

Imported data reaches these systems because it is saved into the canonical `feedback` table:

| System | Coverage |
|---|---|
| Feedback Hub | Full |
| Product Deep Dive | Full |
| Weekly Rankings | Full |
| Feature Insights | Full |
| Product Health Score | Full |
| Category Intelligence | Full |
| Consumer Intelligence | Partial for segmentation; full for raw feedback metrics |

### Consumer Intelligence Caveat

Consumer Intelligence joins feedback rows to `userProfiles` using email. Imported feedback helps immediately with overall counts, rating, and sentiment, but demographic segmentation only improves when imported emails match known user profiles.

### Status

- Import system committed and pushed: `9a67eeb` (`feat: self-serve import system (P0-P4)`)
- Build verification completed successfully on March 27, 2026
- Earlier email branding fix: `37ae2e1`

---

*This document covers all features implemented as of March 27, 2026. Update this file when adding new features.*
