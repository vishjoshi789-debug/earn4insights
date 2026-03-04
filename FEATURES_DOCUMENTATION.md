# Earn4Insights — Feature Documentation

> **Last updated:** March 4, 2026  
> **Platform:** Next.js 14 + Drizzle ORM + PostgreSQL + Vercel  
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

---

## 1. Architecture Overview

### Tech Stack
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
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
**File:** `src/components/dashboard-header.tsx` (164 lines)

- Sticky header with mobile sidebar trigger
- Notifications dropdown (`data-tour="notifications"`)
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
| `NEXTAUTH_SECRET` | NextAuth session secret |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob file storage (media uploads) |
| `ENCRYPTION_KEY` | Data encryption (256-bit base64) |
| `RESEND_API_KEY` | Email sending |

### Schema Migrations
- Migrations in `/drizzle` directory (0000 → 0012)
- Apply with: `.\push-schema.ps1` (uses `drizzle-kit push`)
- Key migration for media: `0004_add_multimodal_multilingual_foundations.sql`

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

---

*This document covers all features implemented as of March 4, 2026. Update this file when adding new features.*
