# Earn4Insights — Technical Architecture Document

> **Version:** March 2026  
> **Stack:** Next.js 15 · TypeScript · Drizzle ORM · Neon PostgreSQL · Vercel Blob · NextAuth v5 · OpenAI · Resend · Twilio · Vercel

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Tech Stack Reference](#2-tech-stack-reference)
3. [High-Level Architecture Diagram](#3-high-level-architecture-diagram)
4. [Database Schema](#4-database-schema)
5. [Authentication & Role System](#5-authentication--role-system)
6. [User Roles & Journeys](#6-user-roles--journeys)
7. [Feedback Pipeline](#7-feedback-pipeline)
8. [Survey Pipeline](#8-survey-pipeline)
9. [Multimodal & Multilingual Processing](#9-multimodal--multilingual-processing)
10. [Personalization Engine](#10-personalization-engine)
11. [Rankings System](#11-rankings-system)
12. [Notification & Email System](#12-notification--email-system)
13. [Send-Time Optimization](#13-send-time-optimization)
14. [Analytics & Event Tracking](#14-analytics--event-tracking)
15. [Subscription Tier System](#15-subscription-tier-system)
16. [GDPR & Compliance Layer](#16-gdpr--compliance-layer)
17. [Background Jobs (Cron)](#17-background-jobs-cron)
18. [API Surface Map](#18-api-surface-map)
19. [File & Folder Structure](#19-file--folder-structure)
20. [Data Flow: End-to-End Walkthrough](#20-data-flow-end-to-end-walkthrough)
21. [Production Hardening Infrastructure](#21-production-hardening-infrastructure)
22. [Build Fix & Config Cleanup (March 12, 2026)](#22-build-fix--config-cleanup-march-12-2026)
23. [Homepage Footer Mobile Fix (March 12, 2026)](#23-homepage-footer-mobile-fix-march-12-2026)
24. [Sign-in Latency Optimization (March 12, 2026)](#24-sign-in-latency-optimization-march-12-2026)
25. [Dashboard Query Parallelization (March 12, 2026)](#25-dashboard-query-parallelization-march-12-2026)
26. [Auth Flow Rewrite & 500 Error Fix (March 13, 2026)](#26-auth-flow-rewrite--500-error-fix-march-13-2026)
27. [Survey System Enhancements (March 14–15, 2026)](#27-survey-system-enhancements-march-1415-2026)
28. [Multi-Channel Notification System — Slack (March 15, 2026)](#28-multi-channel-notification-system--slack-march-15-2026)
29. [WhatsApp Real-Time Notifications (March 15, 2026)](#29-whatsapp-real-time-notifications-march-15-2026)
30. [Brand Alerts Dashboard (March 15, 2026)](#30-brand-alerts-dashboard-march-15-2026)
31. [Bell Icon Real-Time Notifications (March 16, 2026)](#31-bell-icon-real-time-notifications-march-16-2026)
32. [Social Listening System (March 17–18, 2026)](#32-social-listening-system-march-1718-2026)
33. [Social Data Relevance Filter (March 18, 2026)](#33-social-data-relevance-filter-march-18-2026)
34. [YouTube & Google Reviews API Activation (March 18, 2026)](#34-youtube--google-reviews-api-activation-march-18-2026)
35. [Production DB Schema Push & API Keys Deployed (March 19, 2026)](#35-production-db-schema-push--api-keys-deployed-march-19-2026)
36. [In-App Community & Rewards Engine (March 20, 2026)](#36-in-app-community--rewards-engine-march-20-2026)
37. [Appendix A — Cost Calculator & Capacity Planning](#appendix-a--cost-calculator--capacity-planning)
38. [Mobile Search, Welcome Notifications & Notification Pipeline Fix (March 23, 2026)](#38-mobile-search-welcome-notifications--notification-pipeline-fix-march-23-2026)
39. [Security Audit & Hardening (March 24, 2026)](#39-security-audit--hardening-march-24-2026)
40. [Deep Security Hardening — Phase 2 (March 24, 2026)](#40-deep-security-hardening--phase-2-march-24-2026)
41. [Data Source Consolidation — JSON Store → Database (March 24, 2026)](#41-data-source-consolidation--json-store--database-march-24-2026)
42. [Repository Health Hardening (March 24, 2026)](#42-repository-health-hardening-march-24-2026)
43. [Accessibility Fixes & Cross-Browser Testing Infrastructure (March 24–25, 2026)](#43-accessibility-fixes--cross-browser-testing-infrastructure-march-2425-2026)
44. [UI/UX Audit & Stability Fixes (March 25, 2026)](#44-uiux-audit--stability-fixes-march-25-2026)
45. [Self-Serve Import System & Analytics Data Flow Verification (March 27, 2026)](#45-self-serve-import-system--analytics-data-flow-verification-march-27-2026)

---

## 1. System Overview

Earn4Insights is a **two-sided product intelligence platform**:

- **Brands** publish products, create surveys, collect multimodal feedback, and get AI-driven analytics.
- **Consumers** submit feedback (text, audio, video, images), take surveys, earn rewards, and receive personalized product recommendations.

The core value loop:

```
Consumer submits feedback / takes survey
        ↓
AI pipeline: transcription → language normalization → sentiment analysis
        ↓
Brand sees individual responses + aggregate trends + extracted themes
        ↓
Rankings generated weekly (visible publicly)
        ↓
Consumers discover ranked products → more feedback
```

### Figure 1.1 — Platform Value Loop

```
  ┌────────────────────────────────────────────────────────────────────┐
  │                     EARN4INSIGHTS VALUE LOOP                      │
  │                                                                    │
  │        ┌──────────┐        Feedback         ┌──────────┐          │
  │        │          │ ─────────────────────▶   │          │          │
  │        │ CONSUMER │    text / audio /        │  BRAND   │          │
  │        │          │    video / images        │          │          │
  │        │          │ ◀─────────────────────   │          │          │
  │        └────┬─────┘   Personalized recs      └────┬─────┘          │
  │             │         + survey invites             │               │
  │             │                                      │               │
  │             │  ┌──────────────────────────────┐    │               │
  │             │  │         AI LAYER              │    │               │
  │             │  │                               │    │               │
  │             └──▶  Whisper STT → Translate  ◀───┘               │
  │                │  → Sentiment → Themes         │               │
  │                │  → Personalization scores      │               │
  │                └──────────────┬─────────────────┘               │
  │                               │                                    │
  │                     ┌─────────▼──────────┐                        │
  │                     │  PUBLIC RANKINGS   │                        │
  │                     │  /top-products     │                        │
  │                     │  Weekly leaderboard│                        │
  │                     └────────────────────┘                        │
  └────────────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack Reference

| Layer | Technology | Role |
|---|---|---|
| **Framework** | Next.js 15 (App Router) | Full-stack React framework — pages, API routes, server components, middleware |
| **Language** | TypeScript | Strict typing across entire codebase |
| **Database** | Neon PostgreSQL (serverless) | Primary data store — all persistent state |
| **ORM** | Drizzle ORM | Type-safe SQL query builder + schema management |
| **Auth** | NextAuth v5 (Auth.js) | Session management, email/password + Google OAuth |
| **File Storage** | Vercel Blob | Audio, video, image uploads from consumers |
| **AI / STT** | OpenAI Whisper (`whisper-1`) | Audio & video transcription, language detection |
| **AI / LLM** | Firebase Genkit + Google GenAI | Theme extraction, AI-assisted analytics |
| **Email** | Resend | Transactional email + weekly digest notifications |
| **SMS / WhatsApp** | Twilio | Consumer notifications via WhatsApp and SMS |
| **Deployment** | Vercel | Hosting, cron triggers, edge middleware |
| **Styling** | Tailwind CSS + Radix UI | UI components (shadcn/ui pattern) |
| **Charts** | Recharts | All dashboard visualizations |
| **Validation** | Zod | Runtime schema validation on API inputs + JSONB fields |
| **Rate Limiting** | Custom in-memory | IP-based rate limiting with auto-cleanup (serverless-safe) |
| **Logging** | Structured JSON logger | Production-safe with sensitive data redaction |
| **Forms** | React Hook Form | Consumer-facing forms (surveys, feedback, onboarding) |
| **Analytics** | Google Analytics 4 (GA4) | Front-end page analytics (optional, env-gated) |

### Figure 2.1 — Tech Stack Layer Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                                │
│  React 18 · Next.js App Router · Tailwind CSS · Radix UI · Recharts   │
│  React Hook Form · Zod · analytics-tracker.tsx · GA4                   │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ HTTPS / fetch
┌──────────────────────────────▼──────────────────────────────────────────┐
│                    SERVER (Vercel Serverless)                            │
│  Next.js Route Handlers · NextAuth v5 (sessions, OAuth, bcrypt)        │
│  middleware.ts (role-based route protection)                             │
│                                                                         │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────────────┐  │
│  │ Business     │  │ AI Services   │  │ Communication Services      │  │
│  │ Logic        │  │               │  │                              │  │
│  │ sentiment    │  │ OpenAI        │  │ Resend (email)               │  │
│  │ normalization│  │ Whisper STT   │  │ Twilio (WhatsApp, SMS)       │  │
│  │ personalize  │  │ Genkit/GenAI  │  │                              │  │
│  │ rankings     │  │ (themes)      │  │                              │  │
│  └──────┬───────┘  └───────┬───────┘  └──────────────┬───────────────┘  │
│         │                  │                          │                  │
└─────────┼──────────────────┼──────────────────────────┼──────────────────┘
          │                  │                          │
┌─────────▼──────────────────▼──────────────────────────▼──────────────────┐
│                        DATA LAYER                                        │
│  ┌──────────────────┐  ┌───────────────────┐                            │
│  │ Neon PostgreSQL  │  │ Vercel Blob Store │                            │
│  │ (via Drizzle ORM)│  │ (audio/video/img) │                            │
│  │ 35+ tables       │  │ public CDN URLs   │                            │
│  └──────────────────┘  └───────────────────┘                            │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VERCEL EDGE / CDN                            │
│  middleware.ts — route protection, role-based redirects             │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
           ┌────────────────────┴────────────────────┐
           │                                         │
    ┌──────▼──────┐                          ┌───────▼───────┐
    │  BRAND UI   │                          │  CONSUMER UI  │
    │ /dashboard  │                          │ /submit-      │
    │ /surveys    │                          │  feedback     │
    │ /analytics  │                          │ /survey/:id   │
    │ /products   │                          │ /onboarding   │
    │ /rankings   │                          │ /top-products │
    └──────┬──────┘                          └───────┬───────┘
           │           Next.js App Router            │
           └──────────────────┬──────────────────────┘
                              │
                    ┌─────────▼──────────┐
                    │   API ROUTES       │
                    │   /api/...         │
                    │  (Next.js Route    │
                    │   Handlers)        │
                    └─────────┬──────────┘
                              │
           ┌──────────────────┼──────────────────────┐
           │                  │                       │
    ┌──────▼──────┐   ┌───────▼───────┐    ┌─────────▼─────────┐
    │  Neon       │   │ Vercel Blob   │    │  External APIs    │
    │  PostgreSQL │   │ (media files) │    │  - OpenAI Whisper │
    │  (Drizzle)  │   │               │    │  - Resend (email) │
    │             │   │               │    │  - Twilio (SMS)   │
    └─────────────┘   └───────────────┘    │  - Google OAuth   │
                                           │  - Genkit/GenAI   │
                                           └───────────────────┘
```

---

## 4. Database Schema

### Tables Overview

```
users                    → Auth + role (brand | consumer)
user_profiles            → Consumer demographics, interests, behavioral data, consent
user_events              → Behavioral event log (product_view, survey_start, etc.)
analytics_events         → Deep clickstream analytics (page, click, scroll, device, geo)

products                 → Brand products (owned) + consumer-created placeholders
surveys                  → Survey definitions (questions as JSONB) linked to products
survey_responses         → Individual survey submissions per user per survey
feedback                 → Direct multimodal feedback per product
feedback_media           → Audio / video / image files linked to survey_responses or feedback
import_jobs              → CSV import tracking, column mapping, row counts, status, errors

brand_subscriptions      → Tier (free/pro/enterprise) + Stripe fields per brand

weekly_rankings          → Computed weekly top products per category (snapshot)
ranking_history          → Historical rank + score per product per week

extracted_themes         → AI-extracted keywords/themes from feedback per product
notification_queue       → Scheduled email/WhatsApp/SMS notifications
email_send_events        → Tracking per email sent (open/click/convert)
send_time_cohorts        → A/B cohort assignment per user (for optimal send-time)
send_time_analytics      → Aggregated hourly send performance
demographic_performance  → Per-segment send performance (age, income, industry)

audit_log                → GDPR audit trail (who accessed what data, when, why)
social_posts             → Scraped social media posts per product (sentiment + score)
community_posts          → In-app discussion threads, polls, AMAs, announcements
community_replies        → Replies to community threads (nested)
community_reactions      → Upvotes/downvotes on posts and replies
community_poll_votes     → One vote per user per poll post
user_points              → Current point balance + lifetime earned total per user
point_transactions       → Immutable reward ledger for all earn/spend/refund actions
rewards                  → Reward catalog with stock and activation state
reward_redemptions       → User reward redemption history
payout_requests          → Consumer cash-out requests and approval status
challenges               → Challenge definitions for gamified earning
user_challenge_progress  → Per-user challenge counters and completion state
```

### Key Relationships

```
users
  └── user_profiles        (1:1  — consumer profile + consent)
  └── user_events          (1:N  — behavioral events)
  └── user_points          (1:1  — current and lifetime rewards balance)
  └── point_transactions   (1:N  — points ledger)
  └── payout_requests      (1:N  — payout history)
  └── reward_redemptions   (1:N  — redemption history)
  └── community_posts      (1:N  — authored discussion threads)
  └── community_replies    (1:N  — authored replies)
  └── brand_subscriptions  (1:1  — brand tier)
  └── products             (1:N  — brand owns products via ownerId)

products
  └── surveys              (1:N)
  └── feedback             (1:N  — direct feedback)
  └── weekly_rankings      (1:N  — appears in category rankings)
  └── extracted_themes     (1:N  — AI themes per product)
  └── social_posts         (1:N  — scraped social content)
  └── community_posts      (1:N  — optional product-linked threads)

surveys
  └── survey_responses     (1:N)

survey_responses
  └── feedback_media       (1:N  — via ownerType='survey_response')

feedback
  └── feedback_media       (1:N  — via ownerType='feedback')

community_posts
  └── community_replies    (1:N)
  └── community_reactions  (1:N)
  └── community_poll_votes (1:N)

challenges
  └── user_challenge_progress (1:N)
```

### Figure 4.1 — Entity Relationship Diagram

```
┌──────────┐       ┌──────────────┐      ┌──────────────────┐
│  users   │       │   products   │      │    surveys       │
│──────────│       │──────────────│      │──────────────────│
│ id (PK)  │──┐   │ id       (PK)│──┐   │ id       (PK)   │
│ email    │  │   │ name         │  │   │ productId (FK)  │──┐
│ role     │  │   │ ownerId (FK) │  │   │ title           │  │
│ password │  │   │ profile{}    │  │   │ questions[]     │  │
│ googleId │  │   │ lifecycle    │  │   │ status          │  │
└──────────┘  │   └──────┬───────┘  │   └─────────────────┘  │
              │          │          │                         │
   ┌──────────┘          │          │                         │
   │                     │          │                         │
   ▼                     │          │                         ▼
┌──────────────────┐     │    ┌─────▼───────────────┐  ┌──────────────────┐
│  user_profiles   │     │    │    feedback         │  │ survey_responses │
│──────────────────│     │    │────────────────────│  │──────────────────│
│ id (PK=userId)   │     │    │ id        (PK)     │  │ id       (PK)   │
│ demographics{}   │     │    │ productId (FK)  ◀──┘  │ surveyId (FK)◀──┘
│ interests{}      │     │    │ feedbackText       │  │ productId(FK)   │
│ behavioral{}     │     │    │ rating, sentiment  │  │ answers{}       │
│ consent{}        │     │    │ modality, language │  │ npsScore        │
│ sensitiveData{}  │     │    │ transcript         │  │ sentiment       │
└──────────────────┘     │    └────────┬───────────┘  └────────┬─────────┘
                         │             │                        │
┌──────────────────┐     │             │  ownerType=            │ ownerType=
│  user_events     │     │             │  'feedback'            │ 'survey_response'
│──────────────────│     │             │                        │
│ userId (FK)      │     │             └────────┬───────────────┘
│ eventType        │     │                      ▼
│ productId        │     │           ┌──────────────────────┐
│ metadata{}       │     │           │   feedback_media     │
└──────────────────┘     │           │──────────────────────│
                         │           │ ownerType + ownerId  │ ◀── polymorphic FK
┌──────────────────┐     │           │ mediaType            │
│brand_subscriptions│     │           │ storageKey → Blob    │
│──────────────────│     │           │ status, transcript   │
│ brandId (FK)  ◀──┘     │           │ retryCount, errors   │
│ tier             │     │           └──────────────────────┘
│ status           │     │
│ stripe fields    │     │          ┌────────────────────────┐
└──────────────────┘     │          │  extracted_themes      │
                         │          │────────────────────────│
                         └────────▶ │  productId (FK)        │
                                    │  theme, mentionCount   │
                                    │  sentiment, examples[] │
                                    └────────────────────────┘
```

### Notable Design Choices

- **`feedback_media` is polymorphic** — `ownerType` + `ownerId` links to either `survey_responses` or `feedback`. This avoids separate tables for each media owner type.
- **`products.profile`** is JSONB — category, targetAudience, website etc. stored flexibly so the schema doesn't need migration per new product field.
- **`userProfiles.behavioral`** is JSONB — system-computed engagement scores, category interests, active-at timestamps. Updated by the behavioral update cron.
- **`surveys.questions`** is JSONB — fully flexible question structures (NPS, scale, multiple-choice, text, audio, video) without schema changes.

---

## 5. Authentication & Role System

### Auth Provider

NextAuth v5 (Auth.js) is configured in `src/lib/auth/auth.config.ts`.

**Supported methods:**
- Email + password (bcryptjs hashed, stored in `users.passwordHash`)
- Google OAuth (stored in `users.googleId`)

### Role Assignment

Every user has one of two roles stored in `users.role`:

| Role | Where they go after login |
|---|---|
| `brand` | `/dashboard` |
| `consumer` | `/top-products` (then `/onboarding` if first visit) |

### Middleware Protection

`middleware.ts` runs on every non-API, non-static route:

```
/dashboard/**         → Requires login + role='brand'
/onboarding/**        → Requires login + role='consumer'
/settings/**          → Requires login
/surveys/**           → Requires login
/login, /signup       → Redirects away if already logged in
/rankings, /          → Public (no auth required)
/submit-feedback/**   → Public (consumers don't need to sign in)
```

### Session Shape

```typescript
session.user = {
  id: string         // users.id
  email: string
  name: string | null
  role: 'brand' | 'consumer'
}
```

### Figure 5.1 — Auth Flow

```
                    ┌──────────────────────────────────┐
                    │         /login or /signup         │
                    └──────────────┬───────────────────┘
                                   │
                    ┌──────────────▼───────────────────┐
                    │      NextAuth v5 (Auth.js)       │
                    │                                   │
                    │  ┌─ Email + Password ──────────┐  │
                    │  │  bcrypt verify → users table │  │
                    │  └────────────────────────────┘  │
                    │                                   │
                    │  ┌─ Google OAuth ──────────────┐  │
                    │  │  OAuth flow → users.googleId │  │
                    │  └────────────────────────────┘  │
                    └──────────────┬───────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────────┐
                    │       Session Created            │
                    │  { id, email, name, role }       │
                    └──────────────┬───────────────────┘
                                   │
                    ┌──────────────▼───────────────────┐
                    │        middleware.ts              │
                    │   Checks role on every request   │
                    └──────────────┬───────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
              ▼                    ▼                    ▼
      role = 'brand'       role = 'consumer'       not logged in
      → /dashboard         → /top-products         → /login
                           → /onboarding (1st)
```

---

## 6. User Roles & Journeys

### Brand Journey

```
1. Sign up (role=brand)
2. Create product → /dashboard/products → fills product name, category, description
3. Survey builder → /dashboard/surveys → creates survey with custom questions
4. Share feedback link → /submit-feedback/:productId or survey link
5. Consumers respond → feedback & survey_responses populate
6. Brand views analytics:
   - /dashboard/feedback         — aggregate stats + preview per product
   - /dashboard/surveys/:id      — individual responses, audio/video processing status
   - /dashboard/analytics/unified — all sources combined (free=aggregate, pro=individual)
   - /dashboard/rankings         — where their products rank weekly
   - /dashboard/recommendations  — AI recommendations for improving products
7. Upgrade to Pro to access individual feedback text, media playback, CSV export
```

### Consumer Journey

```
1. Sign up (role=consumer) OR submit without account
2. [First login] → /onboarding:
   - Step 1: Demographics (age, gender, location, language)
   - Step 2: Interests (product categories)
   - Step 3: Notification preferences (email, WhatsApp, SMS + frequency)
   - Step 4: Consent (tracking, personalization, analytics, marketing)
3. Receives personalized product recommendations on /top-products
4. Browses /top-products → views ranked products by category
5. Submits feedback → /submit-feedback/:productId:
   - Writes text review
   - Optionally records audio (mic) or video (camera)
   - Optionally attaches images
   - Gives star rating (1–5)
   - Submits → feedback row created, media uploaded to Vercel Blob
6. Takes surveys → /survey/:surveyId → answers questions, optionally records voice
7. Earns rewards → /dashboard/rewards (points for feedback + surveys)
8. My feedback history → /dashboard/my-feedback
9. Receives notifications (email/WhatsApp) with new surveys matching their interests
```

### Figure 6.1 — Brand Journey Flowchart

```
┌──────────┐    ┌─────────────┐    ┌──────────────┐    ┌───────────────┐
│  Sign Up │───▶│ Create      │───▶│ Create       │───▶│ Share Link    │
│ (brand)  │    │ Product     │    │ Survey       │    │ to consumers  │
└──────────┘    └─────────────┘    └──────────────┘    └───────┬───────┘
                                                               │
                ┌──────────────────────────────────────────────┘
                ▼
┌───────────────────────────────────────────────────────────────────────┐
│                    BRAND DASHBOARD                                    │
│                                                                       │
│  ┌─────────────┐ ┌───────────────┐ ┌─────────┐ ┌──────────────────┐  │
│  │  Feedback   │ │   Survey      │ │Rankings │ │  Unified         │  │
│  │  Overview   │ │   Responses   │ │Dashboard│ │  Analytics       │  │
│  │  /feedback  │ │   /surveys/:id│ │/rankings│ │  /analytics      │  │
│  │  per product│ │   + media     │ │  weekly │ │  aggregate+AI    │  │
│  └─────────────┘ └───────────────┘ └─────────┘ └──────────────────┘  │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │ FREE: Aggregate stats only │ PRO: + Individual + media + CSV   │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────┘
```

### Figure 6.2 — Consumer Journey Flowchart

```
┌──────────┐    ┌────────────────────────────────────────────────┐
│  Sign Up │───▶│             ONBOARDING (4 steps)               │
│(consumer)│    │  Demographics → Interests → Notifs → Consent   │
└──────────┘    └──────────────────────┬─────────────────────────┘
                                       │
                                       ▼
                         ┌──────────────────────────┐
                         │    /top-products          │
                         │  Personalized feed        │
                         │  (scored by match %)      │
                         └──────┬───────────┬────────┘
                                │           │
                    ┌───────────▼──┐   ┌────▼────────────┐
                    │ Submit       │   │ Take Survey     │
                    │ Feedback     │   │ /survey/:id     │
                    │ text+audio+  │   │ answers+voice   │
                    │ video+images │   │                 │
                    └──────┬───────┘   └───────┬─────────┘
                           │                   │
                           └─────────┬─────────┘
                                     ▼
                         ┌──────────────────────────┐
                         │    Earn Rewards           │
                         │  /dashboard/rewards       │
                         │  Points for participation │
                         └──────────────────────────┘
```

---

## 7. Feedback Pipeline

### Submission Flow

```
Consumer fills DirectFeedbackForm
(/submit-feedback/:productId/DirectFeedbackForm.tsx)
        │
        ▼
POST /api/feedback/submit
  ├── Auth check (session required)
  ├── Input validation (Zod, productId + feedbackText required)
  ├── Anti-fraud:
  │     ├── Rate limit: max 5/hour per user
  │     ├── Duplicate: same product within 24h, >80% word overlap → reject
  │     └── Quality: min 20 chars, min 3 words, gibberish detection
  ├── Text normalization → normalizeTextForAnalytics()
  │     └── Detects language, translates to English if needed
  ├── Sentiment analysis → analyzeSentiment()
  │     └── Returns: 'positive' | 'neutral' | 'negative'
  ├── INSERT into feedback table (productId, text, rating, sentiment, normalizedText, ...)
  ├── Compute relevance score → computeRelevanceScore() [non-blocking]
  └── Return { feedbackId, sentiment, relevance }
        │
        ▼ (if media was recorded/attached)
POST /api/feedback/upload-media  [called per file: audio, video, image]
  ├── Auth check
  ├── Verify feedbackId belongs to session user
  ├── Size + content-type validation
  ├── Upload to Vercel Blob → blob.url
  ├── INSERT into feedback_media (ownerType='feedback', ownerId=feedbackId, storageKey=blob.url)
  ├── UPDATE feedback.modalityPrimary → 'audio' | 'video' | 'mixed'
  └── For audio/video: set processingStatus='processing', consentAudio/Video=true
```

### Modality Progression

```
Initial submission:  modalityPrimary = 'text'
After audio upload:  modalityPrimary = 'audio',  processingStatus = 'processing'
After video upload:  modalityPrimary = 'video',  processingStatus = 'processing'
After image upload:  modalityPrimary = 'mixed'   (no processing needed)
After image+ audio:  modalityPrimary = 'mixed'   (audio will still be processed)
```

### Figure 7.1 — Feedback Submission Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                    CONSUMER BROWSER                               │
│  DirectFeedbackForm.tsx                                          │
│  ┌──────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐          │
│  │ Text │ │ Rating │ │  Mic   │ │ Camera │ │ Images │          │
│  │ ████ │ │ ★★★★☆ │ │  🎤   │ │  🎥   │ │  🖼️  │          │
│  └──┬───┘ └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘          │
│     │         │          │          │          │                 │
│     └────┬────┘          └────┬─────┘          │                 │
│          │                    │                 │                 │
└──────────┼────────────────────┼─────────────────┼─────────────────┘
           │                    │                 │
    ┌──────▼──────┐     ┌───────▼──────┐  ┌──────▼───────┐
    │ POST        │     │ POST         │  │ POST         │
    │ /feedback/  │     │ /feedback/   │  │ /feedback/   │
    │ submit      │     │ upload-media │  │ upload-media │
    │             │     │ (audio/video)│  │ (image)      │
    └──────┬──────┘     └───────┬──────┘  └──────┬───────┘
           │                    │                 │
    ┌──────▼──────┐     ┌───────▼──────┐         │
    │ NLP inline  │     │ Vercel Blob  │         │
    │ normalize + │     │ upload →     │         │
    │ sentiment   │     │ CDN URL      │         │
    └──────┬──────┘     └───────┬──────┘         │
           │                    │                 │
    ┌──────▼────────────────────▼─────────────────▼──────┐
    │              NEON POSTGRESQL                        │
    │  feedback row (text, rating, sentiment, modality)  │
    │  feedback_media rows (storageKey → blob URL)       │
    └────────────────────────┬───────────────────────────┘
                             │
                     ┌───────▼────────┐
                     │  CRON (5 min)  │
                     │  Whisper STT   │
                     │  → transcript  │
                     │  → translate   │
                     │  → sentiment   │
                     └───────┬────────┘
                             │
                     ┌───────▼────────────────────┐
                     │  feedback row UPDATED      │
                     │  transcriptText, normText, │
                     │  processingStatus='ready'  │
                     └────────────────────────────┘
```

---

## 8. Survey Pipeline

### Survey Creation (Brand)

```
Brand uses survey builder → /dashboard/surveys/new
  └── Defines: title, description, type (nps|feedback|custom)
  └── Adds questions (stored as JSONB array: { id, type, text, options, required })
  └── Activates survey → status='active'
  └── Gets shareable link: /survey/:surveyId
```

### Survey Response (Consumer)

```
Consumer opens /survey/:surveyId (SurveyResponseForm.tsx)
        │
        ▼
POST /api/public/survey-responses  (or similar survey submit route)
  ├── Validates survey is active
  ├── Collects answers (JSONB), NPS score, userName, userEmail
  ├── Text normalization + sentiment on text answers
  ├── INSERT into survey_responses
  └── Returns responseId
        │
        ▼ (if voice/video was recorded)
POST /api/uploads/survey-media  (uploads audio/video to Vercel Blob)
  ├── INSERT into feedback_media (ownerType='survey_response')
  └── UPDATE survey_responses.processingStatus = 'processing'
        │
        ▼ (client polls for processing status)
GET /api/public/survey-responses/:id/status
  └── Returns { processingStatus, audio: { status }, video: { status } }
  └── Client shows "Processing voice…" → "Voice processed!" as status changes
```

### Figure 8.1 — Survey Lifecycle

```
┌──────────────────────────────────────────────────────────────────────┐
│  BRAND SIDE                              CONSUMER SIDE               │
│                                                                      │
│  ┌────────────┐   ┌──────────┐           ┌──────────────┐           │
│  │ Survey     │──▶│ Activate │──Link────▶│ /survey/:id  │           │
│  │ Builder    │   │ status=  │           │ SurveyForm   │           │
│  │ questions[]│   │ 'active' │           │              │           │
│  └────────────┘   └──────────┘           └──────┬───────┘           │
│                                                  │                   │
│                                          ┌───────▼───────┐          │
│                                          │ Submit answers │          │
│                                          │ + voice/video  │          │
│                                          └───────┬───────┘          │
│                                                  │                   │
│                           ┌──────────────────────┼──────────┐       │
│                           │                      │          │       │
│                           ▼                      ▼          ▼       │
│                    ┌────────────┐  ┌────────────────┐ ┌──────────┐  │
│                    │ survey_    │  │ feedback_media  │ │ Vercel   │  │
│                    │ responses  │  │ (audio/video)   │ │ Blob     │  │
│                    │ (answers,  │  │ status=uploaded │ │ (files)  │  │
│                    │  sentiment)│  └───────┬─────────┘ └──────────┘  │
│                    └────────────┘          │                         │
│                                    ┌──────▼──────────┐              │
│  ┌──────────────────┐              │ Cron: Whisper   │              │
│  │ Dashboard        │◀─────────── │ → transcript    │              │
│  │ /surveys/:id     │  ready      │ → sentiment     │              │
│  │ Responses list   │             └─────────────────┘              │
│  │ + audio/video    │                                               │
│  │   players        │                                               │
│  └──────────────────┘   ┌───────────────────────────┐              │
│                          │ Client polls:             │              │
│                          │ GET /survey-responses/    │              │
│                          │     :id/status            │              │
│                          │ "Processing…" → "Ready!"  │              │
│                          └───────────────────────────┘              │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 9. Multimodal & Multilingual Processing

### Media Processing Service

`src/server/feedbackMediaProcessingService.ts`

This is the core async processing pipeline triggered by cron.

#### Audio Processing

```
feedback_media row where mediaType='audio', status='uploaded'
        │
        ▼
transcribeAndNormalizeFromBlobUrl(blobUrl)
  ├── Fetch file from Vercel Blob URL into memory
  ├── Send to OpenAI Whisper → { text, language }
  ├── If language != 'en': translate to English via Whisper translation
  ├── Run keyword sentiment on normalized text
  └── Return { transcriptText, originalLanguage, normalizedText, normalizedLanguage, sentiment }
        │
        ▼
UPDATE feedback_media SET status='ready', transcriptText=..., originalLanguage=...
        │
        ▼
propagateToOwner(ownerType, ownerId, processed)
  └── If ownerType='feedback':
        UPDATE feedback SET transcriptText, normalizedText, normalizedLanguage,
                            originalLanguage, sentiment, processingStatus='ready'
  └── If ownerType='survey_response':
        UPDATE survey_responses SET same fields
  └── If onlyIfEmpty=true: skip if any analytics already populated
        (prevents video processing from overwriting typed-text analytics)
```

#### Video Processing

Same pipeline as audio (`processPendingVideoFeedbackMedia`), with:
- Default batch size of 5 (vs 10 for audio) to control OpenAI costs
- `onlyIfEmpty=true` in `propagateToOwner` — won't overwrite prior text/audio analytics
- Stale job detection: jobs stuck in `processing` > timeout → re-queued with backoff

#### Retry & Resilience

```
Each feedback_media row tracks:
  retryCount         → incremented on each failure
  lastErrorAt        → timestamp of last failure
  lastAttemptAt      → timestamp of last processing attempt

Backoff formula: wait = 30s * 2^retryCount  (exponential, capped)
Max retries: configurable via FEEDBACK_MEDIA_MAX_RETRIES env var (default: 3)
Stale timeout: configurable via FEEDBACK_MEDIA_PROCESSING_TIMEOUT_SECONDS (default: 900s)

After maxRetries exceeded: status set to 'failed' permanently
Manual retry available to brands via: POST /api/dashboard/feedback-media/:id/retry
```

#### Text Normalization (synchronous, inline)

`src/server/textNormalizationService.ts`

- Called during feedback/survey submission (not cron)
- Detects source language
- Translates to English for analytics if non-English
- Returns `{ originalLanguage, normalizedLanguage, normalizedText }`

#### Sentiment Analysis

`src/server/sentimentService.ts`

- Keyword-based sentiment scoring (no external API cost)
- Applied to `normalizedText` (English)
- Returns `'positive' | 'neutral' | 'negative'`

### Figure 9.1 — Multimodal Processing Pipeline

```
┌──────────────────────────────────────────────────────────────────────┐
│  SUBMISSION TIME (synchronous)                                        │
│                                                                      │
│  Text feedback                        Audio / Video / Image          │
│       │                                      │                       │
│       ▼                                      ▼                       │
│  ┌──────────────────┐               ┌─────────────────────┐      │
│  │ Language Detect   │               │ Upload to Vercel   │      │
│  │ + Translate to EN │               │ Blob → CDN URL      │      │
│  └────────┬─────────┘               └──────────┬──────────┘      │
│           │                                     │               │
│           ▼                                     ▼               │
│  ┌──────────────────┐               ┌─────────────────────┐      │
│  │ Keyword Sentiment │               │ feedback_media row  │      │
│  │ → pos/neg/neutral │               │ status = 'uploaded' │      │
│  └──────────────────┘               └─────────────────────┘      │
└──────────────────────────────────────────────────────────────────────┘
                          │
                  ┌───────▼────────────────────────────────────────┐
                  │  CRON (every 5–15 min, async)                   │
                  │                                                  │
                  │  feedback_media (status='uploaded')               │
                  │       │                                          │
                  │       ▼                                          │
                  │  Fetch blob → OpenAI Whisper                     │
                  │       │                                          │
                  │       ▼                                          │
                  │  { transcript, language }                        │
                  │       │                                          │
                  │       ▼                                          │
                  │  language != 'en' ? Whisper translate : passthru │
                  │       │                                          │
                  │       ▼                                          │
                  │  Keyword sentiment                               │
                  │       │                                          │
                  │       ▼                                          │
                  │  UPDATE feedback_media SET status='ready'        │
                  │  propagateToOwner() → UPDATE feedback /          │
                  │                       survey_responses           │
                  └────────────────────────────────────────────────┘

            ┌────────────────────────────────────────────────┐
            │  RETRY & BACKOFF                                │
            │                                                  │
            │  uploaded ──▶ processing ───┬───▶ ready            │
            │                             │                    │
            │                             └──▶ failed           │
            │                                    │              │
            │       retryCount < max ?            │              │
            │              │                      │              │
            │        yes   │   no                  │              │
            │         ┌────┴────┐  ┌─────────────┘              │
            │         ▼          ▼  ▼                            │
            │     re-queue     mark 'failed'                    │
            │     (30s × 2^n   permanently                      │
            │      backoff)    (brand can retry)                 │
            └────────────────────────────────────────────────┘
```

### Multimodal Policy (enforced in code)

These policies keep quality high while controlling cost. See Appendix A for full cost model.

#### Duration Caps

| Modality | Max duration | Enforcement point |
|---|---|---|
| **Audio** | **60 seconds** | Client-side `MAX_AUDIO_DURATION_S`, server upload route validation |
| **Video** | **90 seconds** | Client-side `MAX_VIDEO_DURATION_S`, server `MAX_VIDEO_DURATION_MS` |
| **Image** | N/A | Storage-only, max 5 MB each, max 3 per submission |

Caps are hard ceilings baked into every recorder component:
- `src/app/submit-feedback/page.tsx`
- `src/app/submit-feedback/[productId]/DirectFeedbackForm.tsx`
- `src/app/dashboard/submit-feedback/page.tsx`
- `src/components/survey-response-form.tsx`
- `src/app/api/uploads/feedback-media/server/route.ts` (server-side)

#### Preferred Formats & Compression

| Modality | Target format | Why |
|---|---|---|
| Audio | **WebM / Opus** (`audio/webm;codecs=opus`) | Smallest file at good speech quality; fallback to `audio/webm` → `audio/mp4` |
| Video | **WebM / VP9** (`video/webm;codecs=vp9`) | Good compression; fallback to `video/webm` → `video/mp4` |
| Image | JPEG / WebP / PNG | No re-encode; quality preserved as-is |

> **Compression note:** Current implementation relies on browser MediaRecorder defaults.
> Quality is **not** degraded — we accept the native codec output.
> Future: client-side `ffmpeg.wasm` for pre-upload compression if storage costs warrant it.

#### Transcription Policy

| Content | Transcription | Notes |
|---|---|---|
| Audio feedback | **Yes** — Whisper STT + language detect + translation | Core pipeline in `feedbackMediaProcessingService.ts` |
| Video feedback | **Audio track only** — extracted and transcribed identically | Same Whisper pipeline; no frame/vision analysis |
| Image feedback | **No** — storage only | OCR/vision **not** enabled by default (see OCR Readiness below) |
| Text feedback | Inline language detect + translate (no STT) | `textNormalizationService.ts`, synchronous at submission |

#### OCR Readiness (images)

Images are stored in Vercel Blob with full metadata in `feedback_media`.
OCR / vision analysis is **architecturally ready** but **not enabled** by default to avoid AI cost:

```
When OCR is needed:
  1. Add `processImages` flag to feedbackMedia cron
  2. For each image with status='uploaded':
     - Fetch from Vercel Blob
     - Send to OpenAI Vision or Tesseract OCR
     - Store extracted text in feedback_media.transcriptText
     - Propagate to owner row (same as audio/video path)
  3. Gate behind subscription tier (Pro+ only recommended)
```

No code change is required in the image upload path — only the cron processing loop needs extension.

#### Retention Policy

| Content | Retention | What survives |
|---|---|---|
| **Raw audio** | 30–90 days (env `AUDIO_MEDIA_RETENTION_DAYS`, default 30) | Blob deleted; transcript + sentiment remain forever |
| **Raw video** | 30–90 days (env `VIDEO_MEDIA_RETENTION_DAYS`, default 90) | Blob deleted; transcript + sentiment remain forever |
| **Images** | 30–90 days (same cleanup cron) | Blob deleted; metadata in `feedback_media` survives |
| **Transcripts** | **Permanent** | `transcriptText`, `normalizedText`, `sentiment` in DB |

Cleanup runs via `GET /api/cron/cleanup-feedback-media` (daily).
Only blobs with `status='ready'` and confirmed transcript are eligible for deletion.

#### Retry Policy — Transient vs Permanent Errors

```
isTransientError(errorCode)?
  ├── YES (network, timeout, 5xx, unknown)
  │     → re-queue as 'uploaded'
  │     → exponential backoff: 60s × 2^retryCount
  │     → max retries (env FEEDBACK_MEDIA_MAX_RETRIES, default 3)
  │     → owner stays 'processing' (not surfaced as failure to user)
  │
  └── NO (quota_exceeded, billing_hard_limit, invalid_api_key,
  │       content_policy_violation)
        → mark 'failed' immediately
        → owner marked 'failed' (surfaced on dashboard)
        → no retry — prevents wasted API spend
        → brand/admin must resolve root cause before manual retry
```

Non-retryable error codes:
`insufficient_quota`, `billing_hard_limit`, `rate_limit_exceeded`, `invalid_api_key`, `model_not_found`, `content_policy_violation`

#### Per-Brand Transcription Quotas

Enforced via `TierFeatures.maxTranscriptionMinutesPerMonth` in `subscriptionService.ts`:
- **Free:** 0 min (text + images only; no STT cost)
- **Pro:** 1,000 min/month
- **Enterprise:** 10,000 min/month (custom negotiable)

Quota tracking: aggregate `feedback_media.durationMs` per brand per billing period.
When quota is exceeded: new audio/video uploads are rejected with a clear upgrade CTA.

---

## 10. Personalization Engine

`src/server/personalizationEngine.ts`

### Signal Sources

```
UserProfile.demographics     → age range, gender, location, language, education
UserProfile.interests        → explicitly selected product categories + topics
UserProfile.behavioral       → system-computed: engagementScore, categoryInterests,
                               surveyCompletionRate, lastActiveAt
UserProfile.sensitiveData    → spending capacity, income (only if user opted in)
UserEvents                   → raw event log: product_view, survey_complete, etc.
```

### Scoring Algorithm

For each product, a `matchScore` (0–100) is computed against the user's profile:

| Signal | Max Points | Notes |
|---|---|---|
| Category interest match (explicit) | 25 | User selected this category in onboarding |
| Category interest (behavioral) | 15 | Learned from event history |
| Age range match | 8 | Product targets user's age group |
| Gender match | 7 | Product targets user's gender |
| Location / cultural relevance | 5 | Country / region match |
| Language preference | 5 | Product content matches user language |
| Income / spending capacity | 10 | If sensitiveData consented |
| Engagement score bonus | 10 | High-engagement users get broader match |
| Topic interest overlap | 15 | Specific topics (fitness, tech, etc.) |

Final output: sorted list of `{ productId, score, reasons[] }` displayed on `/top-products`.

### Consent Enforcement

`src/lib/consent-enforcement.ts` — `enforceConsent()` gates each signal:
- `demographics` → requires `consent.personalization=true`
- `behavioral` → requires `consent.tracking=true`
- `sensitiveData` → requires `consent.personalization=true` AND explicit opt-in
- Demographics never inferred — only user-provided

### Figure 10.1 — Personalization Scoring Flow

```
┌───────────────────────────────────────────────────────────────────┐
│                  USER SIGNAL SOURCES                                 │
│                                                                     │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌─────────────┐   │
│  │ Demographics│ │  Explicit  │ │ Behavioral │ │ Sensitive   │   │
│  │ age, gender │ │  Interests │ │ engagement │ │ income     │   │
│  │ location   │ │  categories│ │ categoryInt│ │ (opt-in)   │   │
│  └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └──────┬──────┘   │
│        │             │             │              │            │
│        └─────┬─────┘      ┌─────┴──────┬───────┘            │
│              │              │            │                    │
│              ▼              ▼            ▼                    │
│     ┌─────────────────────────────────────────────────┐    │
│     │        enforceConsent() gate                       │    │
│     │  consent.personalization? → demographics + sensitive │    │
│     │  consent.tracking?        → behavioral              │    │
│     └──────────────────────┬──────────────────────────┘    │
│                           │                                  │
└──────────────────────────┼───────────────────────────────┘
                           │
                   ┌───────▼───────────────────────────────────────┐
                   │    SCORING ENGINE (per product)               │
                   │                                               │
                   │   Category match      █████████████  25pts    │
                   │   Behavioral interest  █████████  15pts       │
                   │   Topic overlap        █████████  15pts       │
                   │   Income/spending      ███████  10pts         │
                   │   Engagement bonus     ███████  10pts         │
                   │   Age range            █████  8pts            │
                   │   Gender               ████  7pts             │
                   │   Location             ███  5pts              │
                   │   Language             ███  5pts              │
                   │                        ──────────────        │
                   │                        Total: 0–100 pts       │
                   └───────────────────┬───────────────────────────┘
                                    │
                            ┌───────▼───────────────┐
                            │ /top-products       │
                            │ Sorted by score     │
                            │ with match reasons  │
                            └───────────────────────┘
```

### 10.2 Granular Personalization — Phase 1

> Added March 2026. Extends the base personalization engine with **consumer intent tracking**, **product watchlists**, and **brand real-time alert routing**.

#### New Database Tables

| Table | Purpose | Key Columns |
|---|---|---|
| `product_watchlist` | Consumer says "notify me about this product" | `userId`, `productId`, `watchType` (launch/price_drop/feature/update/any), `desiredFeature`, `notifyChannels`, `active`, `notifiedAt` |
| `consumer_intents` | Extracted intent signals from feedback/survey text | `userId`, `productId`, `categorySlug`, `intentType` (want_product/want_feature/frustrated/price_sensitive/purchase_ready/churning), `extractedText`, `confidence`, `sourceType`, `sourceId` |
| `brand_alert_rules` | Per-brand rules: which events trigger alerts, on which channels | `brandId`, `alertType`, `productId` (null = all), `channels` (in_app/email), `threshold` (JSONB), `enabled` |
| `brand_alerts` | Materialized alert queue for brand dashboard | `brandId`, `ruleId`, `alertType`, `productId`, `consumerId`, `title`, `body`, `payload` (JSONB), `channel`, `status` (pending/sent/read/dismissed), `readAt` |

#### Consumer Watchlist Flow

```
Consumer views product → clicks "Watch" (WatchButton.tsx)
        │
        ▼
POST /api/watchlist { productId, watchType: 'any' }
        │
        ▼
watchlistService.addToWatchlist() → inserts into product_watchlist
        │
        │── duplicate check (same user + product + type)
        │── returns entry
        │
        ▼
Later: brand launches product → launchProduct() server action
        │
        ├── triggerProductLaunchNotifications()  (existing smart distribution)
        └── notifyWatchersOnLaunch()             (NEW — Phase 1C)
                │
                ▼
        Find all active watchers where watchType = 'launch' | 'any'
                │
                ▼
        queueNotification() per watcher per channel
        Mark notifiedAt on watchlist entry
```

#### Intent Extraction Flow

```
Consumer submits feedback or survey response
        │
        ▼
  extractAndPersistIntents()  (intentExtractionService.ts)
        │
        ├── Regex pattern matching against 12 intent patterns:
        │     purchase_ready  — "will buy", "take my money", "ready to purchase"
        │     want_feature    — "wish it had ...", "please add ...", "feature request: ..."
        │     want_product    — "waiting for this to launch", "exactly what I need"
        │     frustrated      — "terrible", "unusable", "broken", "waste of money"
        │     price_sensitive — "too expensive", "can't afford", "cheaper alternative"
        │     churning        — "switching to", "cancelling", "looking for alternative"
        │
        ├── Each match: intentType + extractedText + confidence (0.0–1.0)
        ├── Deduplicate by type (highest confidence wins)
        ├── Write rows to consumer_intents table
        │
        ▼
  If high-value intent detected (purchase_ready | want_feature | churning):
        │
        ▼
  alertOnHighIntent() → fires brand alert
```

#### Brand Alert Routing Flow

```
Consumer submits feedback
        │
        ├── alertOnNewFeedback()     → always fires 'new_feedback' alert
        │     └── if sentiment = 'negative' → also fires 'negative_feedback' alert
        │
Consumer completes survey
        │
        └── alertOnSurveyComplete()  → fires 'survey_complete' alert
                                           with NPS score + sentiment


  fireAlert() logic:
        │
        ├── Query brand_alert_rules for matching brand + alertType + product
        ├── Merge channels from all matching rules (default: in_app)
        │
        ├── 1. INSERT into brand_alerts (in-app queue)
        └── 2. If 'email' channel matched → queueNotification() via notificationService
```

#### Alert Types

| Alert Type | Trigger | Default Channel |
|---|---|---|
| `new_feedback` | Every feedback submission | in_app |
| `negative_feedback` | Feedback with negativesentiment | in_app + email |
| `survey_complete` | Every survey response | in_app |
| `high_intent_consumer` | Intent extraction finds purchase_ready / want_feature / churning | in_app + email |
| `watchlist_milestone` | Watchers for a product cross threshold (future) | in_app |
| `frustration_spike` | Negative feedback volume spikes (future) | in_app + email |

#### API Surface (Phase 1)

| Method | Route | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/watchlist` | Consumer | Get watchlist (or check single product with `?productId=`) |
| `POST` | `/api/watchlist` | Consumer | Add to watchlist |
| `DELETE` | `/api/watchlist?id=` | Consumer | Remove from watchlist |
| `GET` | `/api/brand/alerts` | Brand | Get alerts (paginated, filterable; `?countOnly=true` for badge) |
| `PATCH` | `/api/brand/alerts?id=` | Brand | Mark alert as read |
| `POST` | `/api/brand/alerts` | Brand | Bulk actions (`action=mark_all_read`) |
| `GET` | `/api/brand/alert-rules` | Brand | Get all alert rules |
| `PUT` | `/api/brand/alert-rules` | Brand | Create/update a rule |
| `PATCH` | `/api/brand/alert-rules?id=` | Brand | Toggle rule on/off |

#### UI Integration

| Component | Role | What |
|---|---|---|
| `WatchButton.tsx` | Consumer | Bell icon on product cards; toggles watch state via `/api/watchlist` |
| `DashboardShell.tsx` → "My Watchlist" | Consumer | Sidebar nav item linking to `/dashboard/watchlist` |
| `DashboardShell.tsx` → "Alerts" (with badge) | Brand | Sidebar nav item with red unread-count badge; polls `/api/brand/alerts?countOnly=true` every 30s |

#### Files Added/Modified

| File | Type | Purpose |
|---|---|---|
| `src/db/schema.ts` | Modified | +4 tables: product_watchlist, consumer_intents, brand_alert_rules, brand_alerts |
| `src/server/watchlistService.ts` | New | CRUD + notifyWatchersOnLaunch |
| `src/server/intentExtractionService.ts` | New | 12-pattern regex intent extraction + persistence |
| `src/server/brandAlertService.ts` | New | Alert rules CRUD, fireAlert(), convenience triggers, bootstrap defaults |
| `src/app/api/watchlist/route.ts` | New | Consumer watchlist API (GET/POST/DELETE) |
| `src/app/api/brand/alerts/route.ts` | New | Brand alerts API (GET/PATCH/POST) |
| `src/app/api/brand/alert-rules/route.ts` | New | Brand alert rules API (GET/PUT/PATCH) |
| `src/components/WatchButton.tsx` | New | Client component: watch/unwatch toggle |
| `src/app/api/feedback/submit/route.ts` | Modified | +intent extraction, +brand alert triggers |
| `src/server/surveys/responseService.ts` | Modified | +intent extraction, +brand survey-complete alert |
| `src/app/dashboard/launch/launch.actions.ts` | Modified | +notifyWatchersOnLaunch on product launch |
| `src/app/dashboard/DashboardShell.tsx` | Modified | +Watchlist nav (consumer), +Alerts nav with badge (brand) |

---

## 11. Rankings System

### Weekly Ranking Computation

`src/server/rankings/` + `GET /api/generate-rankings`

```
Weekly cron (or manual trigger) runs:
  1. Pull all products with feedback + survey responses from past 7 days
  2. For each product, compute ranking score:
     ├── NPS score (promoters - detractors) / total × 100
     ├── Average star rating (normalized 0–100)
     ├── Sentiment ratio (positive / total)
     ├── Response volume (log-scaled to avoid size bias)
     └── Trend delta (this week vs last week)
  3. Group products by category
  4. Rank within each category (top 10 per category)
  5. INSERT into weekly_rankings (snapshot)
  6. INSERT/UPDATE ranking_history (for trend tracking)
```

### Public Display

`/top-products` and `/rankings` — no auth required:
- Shows top products by category
- Badge shows rank change vs previous week (↑ ↓ =)
- Consumers can click → view public product profile → submit feedback

### Figure 11.1 — Weekly Ranking Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│               WEEKLY CRON: generate-rankings                    │
│                                                                 │
│  ┌────────────┐  ┌─────────────────┐  ┌──────────────────┐    │
│  │  feedback   │  │ survey_responses│  │ ranking_history   │    │
│  │  (7 days)  │  │ (7 days)        │  │ (last week)       │    │
│  └─────┬──────┘  └──────┬──────────┘  └───────┬──────────┘    │
│        │               │                    │                  │
│        └───────┬───────┘                    │                  │
│                ▼                              │                  │
│   ┌────────────────────────────────┐       │                  │
│   │   Per-product score:          │       │                  │
│   │   NPS            35%          │       │                  │
│   │   Avg rating      25%         │       │                  │
│   │   Sentiment ratio 20%         │◀──────┘                  │
│   │   Volume (log)    10%         │  trend delta              │
│   │   Trend delta     10%         │                            │
│   └───────────────┬────────────────┘                            │
│                  │                                              │
│             ┌────▼───────────────────────────────┐             │
│             │  Group by category → rank (top 10) │             │
│             └──────┬────────────────────┬─────────┘             │
│                   │                     │                        │
│                   ▼                     ▼                        │
│      ┌────────────────┐  ┌──────────────────┐              │
│      │ weekly_rankings │  │ ranking_history   │              │
│      │ (snapshot)      │  │ (delta tracking)  │              │
│      └────────────────┘  └──────────────────┘              │
│                                                                 │
│                     ┌────────────────────┐                      │
│                     │  PUBLIC DISPLAY    │                      │
│                     │  /top-products     │                      │
│                     │  ↑ ↓ = rank badges │                      │
│                     └────────────────────┘                      │
└──────────────────────────────────────────────────────────────┘
```

---

## 12. Notification & Email System

### Architecture

```
Event occurs (new survey matching user interests, weekly digest, etc.)
        │
        ▼
INSERT into notification_queue
  (userId, channel, type, body, scheduledFor based on send-time optimization)
        │
        ▼
Cron: GET /api/cron/process-notifications
  ├── Pull pending notifications where scheduledFor <= now
  ├── For channel='email':  → Resend API
  ├── For channel='whatsapp': → Twilio WhatsApp API
  └── For channel='sms':    → Twilio SMS API
        │
        ▼
UPDATE notification_queue SET status='sent' or status='failed'
INSERT into email_send_events (for open/click tracking)
```

### Notification Types

| Type | Trigger | Channel |
|---|---|---|
| `new_survey` | Brand activates survey matching user interests | email / whatsapp |
| `weekly_digest` | Weekly — new rankings, product updates | email |
| `product_update` | Brand updates a product consumer reviewed | email |
| `feedback_response` | Brand responds to a specific feedback | email |

### Email Templates

`src/server/emailService.ts` + `src/server/emailNotifications.ts`

- HTML emails built as template strings
- Signed tracking pixel for open events
- Click tracking via redirect through `/api/track`

### Figure 12.1 — Notification Delivery Pipeline

```
┌─────────────────┐
│  Event Trigger   │    E.g., new survey activated
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────────┐
│  Match consumers by:                           │
│  - interests.productCategories overlaps survey │
│  - notificationPreferences.email.enabled       │
│  - consent.marketing = true                    │
└───────────────────────┬─────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│  INSERT into notification_queue                │
│  scheduledFor = optimal send hour              │
└───────────────────────┬─────────────────────────┘
                        │
              ┌─────────▼────────────┐
              │ Cron (every 5 min)   │
              │ process-notifications│
              └────┬──────┬──────┬───┘
                   │      │      │
            ┌──────▼───┐ │  ┌───▼──────┐
            │  Resend  │ │  │  Twilio   │
            │  (email) │ │  │ WhatsApp  │
            └──────────┘ │  │  SMS      │
                       │  └───────────┘
                       ▼
          ┌──────────────────────┐
          │ email_send_events     │
          │ open/click tracking   │
          │ via /api/track pixel  │
          └──────────────────────┘
```

---

## 13. Send-Time Optimization

`src/lib/send-time-optimizer.ts` + related DB tables

### Goal

Send each notification at the hour when that specific user is most likely to click.

### How it works

```
1. New users assigned to a send-time cohort:
   'morning' (6–9), 'lunch' (11–13), 'evening' (17–20),
   'night' (21–23), 'weekend' (Sat/Sun), 'control' (random)

2. Every email sent → INSERT into email_send_events
   (userId, sentAt, sendHour, sendDayOfWeek, demographics snapshot)

3. Consumer opens or clicks email:
   → PATCH /api/track/:notificationId → sets opened=true, openedAt, clicked=true, clickedAt
   → Computes timeToOpen, timeToClick in minutes

4. Cron: GET /api/cron/send-time-analysis (weekly)
   → Aggregates click rates by hour → INSERT/UPDATE send_time_analytics
   → Computes per-demographic optimal hours → INSERT demographic_performance
   → Updates send_time_cohorts with performance metrics

5. When scheduling a new notification:
   → Reads user's cohort + demographic_performance
   → schedules for their optimal send hour (within quiet hours constraint)
```

### Figure 13.1 — Send-Time Optimization Feedback Loop

```
┌────────────────────────────────────────────────────────────────────┐
│  1. ASSIGN   New user → random send-time cohort                    │
│             'morning' | 'lunch' | 'evening' | 'night' | 'weekend' │
└────────────────────────────────┬───────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────┐
│  2. SEND     Email sent at cohort hour                             │
│             INSERT email_send_events (hour, dayOfWeek)            │
└────────────────────────────────┬───────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────┐
│  3. TRACK    User opens email → tracking pixel fires              │
│             User clicks link → /api/track redirect               │
│             UPDATE email_send_events SET opened, clicked          │
│             Compute timeToOpen, timeToClick (minutes)             │
└────────────────────────────────┬───────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────┐
│  4. ANALYZE  Weekly cron aggregates:                               │
│             - Click rate per hour (send_time_analytics)           │
│             - Best hour per demographic (demographic_performance) │
│             - Update cohort stats (send_time_cohorts)             │
└────────────────────────────────┬───────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────┐
│  5. OPTIMIZE Next notification scheduled at user’s best hour      │
│             (respecting quiet hours + cohort data)                │
│             ─── loop back to step 2 ───                           │
└────────────────────────────────────────────────────────────────────┘
```

---

## 14. Analytics & Event Tracking

### Two Event Streams

#### 1. User Behavioral Events (`user_events` table)

`src/server/eventTrackingService.ts`

Semantic business events:

```
product_view          → consumer viewed a product page
survey_start          → consumer started a survey
survey_complete       → consumer completed a survey
feedback_submit       → consumer submitted direct feedback
notification_click    → consumer clicked a notification link
```

Used by the personalization engine to compute `behavioral.categoryInterests`.

Cron: `GET /api/cron/update-behavioral` — re-computes `userProfiles.behavioral` JSONB from recent events.

#### 2. Deep Analytics Events (`analytics_events` table)

`src/components/analytics-tracker.tsx` (client component, auto-injected in root layout)

Captures every page view + click + scroll across all pages:
- Session ID, user ID (if logged in), anonymous ID
- Full URL, referrer, UTM parameters
- Element clicked (tag, text, id, class, coordinates)
- Device, browser, OS, screen dimensions
- Country, region, city (from server IP lookup)
- Time on page, scroll depth, page load time

Sent to: `POST /api/track-event`

### Figure 14.1 — Dual Event Stream Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                       USER INTERACTION                              │
└─────────────────┬───────────────────────────────┬──────────────────┘
                  │                                │
   ┌──────────────▼─────────────┐     ┌────────▼─────────────────┐
   │  STREAM 1: Semantic       │     │  STREAM 2: Deep Clickstream  │
   │  (server-side writes)     │     │  (client-side auto-capture)  │
   │                           │     │                              │
   │  eventTrackingService.ts  │     │  analytics-tracker.tsx       │
   │                           │     │                              │
   │  Events:                  │     │  Events:                     │
   │  • product_view            │     │  • page_view (every page)     │
   │  • survey_start            │     │  • click (every click)        │
   │  • survey_complete          │     │  • scroll (depth tracking)    │
   │  • feedback_submit          │     │  • form_submit               │
   │  • notification_click       │     │  • signup, login, logout     │
   │                           │     │                              │
   │  Written to:              │     │  Written to:                 │
   │  user_events table        │     │  analytics_events table      │
   └──────────┬────────────────┘     └───────────────┬───────────┘
           │                                    │
           ▼                                    ▼
┌─────────────────────┐          ┌────────────────────────────┐
│ Cron: update-      │          │ Dashboard analytics         │
│ behavioral         │          │ page views, conversions,    │
│ → recomputes       │          │ device breakdown,           │
│ userProfiles       │          │ geo, UTM attribution        │
│ .behavioral JSONB  │          └────────────────────────────┘
└─────────────────────┘
           │
           ▼
┌─────────────────────┐
│ Feeds personalization│
│ engine scoring       │
└─────────────────────┘
```

---

## 15. Subscription Tier System

`src/server/subscriptions/subscriptionService.ts`

### Tiers

| Feature | Free | Pro | Enterprise |
|---|---|---|---|
| View aggregate analytics | ✅ | ✅ | ✅ |
| View individual feedback | ❌ | ✅ | ✅ |
| View trends over time | ✅ | ✅ | ✅ |
| Play audio / video | ❌ | ✅ | ✅ |
| View images | ❌ | ✅ | ✅ |
| Export CSV / JSON | ❌ | ✅ | ✅ |
| Advanced filters | ❌ | ✅ | ✅ |
| API access | ❌ | ❌ | ✅ |
| Webhooks | ❌ | ❌ | ✅ |
| Max products | 1 | 10 | Unlimited |
| Max exports/month | 0 | 100 | Unlimited |

### Multimodal Quotas by Tier

| Quota | Free | Pro | Enterprise |
|---|---|---|---|
| Consumer audio submission | ❌ | ✅ | ✅ |
| Consumer video submission | ❌ | ✅ | ✅ |
| Consumer image submission | ✅ (storage-only) | ✅ (storage-only) | ✅ (storage-only) |
| Transcription minutes/month | 0 | 1,000 | 10,000 (or custom) |
| Upload cap/month | 2 GB | 50 GB | 500 GB+ |
| Raw media retention | 30 days | 60 days | 90 days (custom available) |
| Transcript retention | Permanent | Permanent | Permanent |

> **Free tier** consumers submit text + optional images only — no transcription cost.  
> **Pro** includes fixed audio/video quota — overage blocked or charged at ~$0.015–$0.020/min.  
> **Enterprise** gets pooled/custom quotas, longer retention, and can negotiate BYO-storage for video-heavy programs.

### Pricing Bands (Recommended Retail)

| Plan | Price | Included transcription | Included upload | Best fit |
|---|---:|---:|---:|---|
| **Free** | $0 | 0 min | 0–2 GB | Text-first brands, trials |
| **Pro** | $49–$99/mo | 500–1,000 min | 25–50 GB | SMB brands using audio |
| **Enterprise** | $299+/mo or custom | 5,000–10,000+ min | 250 GB+ | API/webhook, high-volume, video-heavy |

### Where Pricing Is Shown

| Location | What's displayed | Audience |
|---|---|---|
| **`/dashboard/pricing`** | Full 3-tier comparison: Free / Pro / Enterprise with features, quotas, value propositions, FAQ | All brand users |
| **`/dashboard/feedback`** | UpgradePrompt banner (links to pricing) | Free-tier brands |
| **`/dashboard/products/:id/feedback`** | UpgradePrompt above feedback list | Free-tier brands |
| **`/dashboard/analytics/unified`** | UpgradePrompt gating individual feedback | Free-tier brands |
| **Sidebar nav** | "Plans & Pricing" link (CreditCard icon) | All brand users |
| **`tierMiddleware.ts`** | Server-side `TierError` with upgrade CTA metadata | API routes |

The UpgradePrompt component now links directly to `/dashboard/pricing` and shows tier-specific messaging (e.g. "Pro starts at $79/mo").

### Cost Model (drives retail pricing)

```
Infrastructure cost per brand (approximate):
  Shared platform:  Vercel Pro ~$20/mo + Neon DB ~$19/mo (amortized)
  Per-brand base:   ~$0.50/mo (DB rows, minimal blob)
  Whisper STT:      $0.006/min
  Vercel Blob:      $0.023/GB/mo stored
  Email (Resend):   $0 (first 3k/mo) → $20/mo
  SMS (Twilio):     ~$0.01/msg

Variable cost at Pro scale (1,000 min + 50 GB):
  Transcription:    1000 × $0.006 = $6/mo
  Storage:          50 × $0.023  = $1.15/mo
  Total variable:   ~$7–$15/mo

Retail markup: 3–5× variable cost → $79/mo Pro
Annual discount: ~17% (2 months free) → $66/mo billed annually
Enterprise: custom based on volume, starts at $299/mo
```

### Enforcement Pattern

```typescript
// Hard block (throws, used in API routes)
await requireFeature(brandId, 'canViewIndividual')

// Soft check (returns boolean, used in page server components for UI gating)
const { allowed, upgradeCTA } = await checkFeatureAccess(brandId, 'canExportCSV')

// Tier check
await requirePaidTier(brandId)   // throws if free
await requireTier(brandId, 'enterprise')
```

### Upgrade Prompts (UI)

`src/app/dashboard/analytics/unified/UpgradePrompt.tsx`

Shown on:
- `/dashboard/feedback` — below stats cards for free-tier brands
- `/dashboard/products/:id/feedback` — above feedback list for free-tier brands
- `/dashboard/analytics/unified` — instead of individual feedback list for free-tier brands

Non-blocking: free-tier brands still see aggregate stats and counts.

### Figure 15.1 — Tier Feature Gate Flow

```
┌─────────────────┐
│  Brand requests │
│  a page / API   │
└────────┬────────┘
         │
         ▼
┌────────────────────────────────────────────┐
│  getBrandSubscription(brandId)            │
│  Returns tier + features from             │
│  brand_subscriptions table                │
│  (defaults to 'free' if no row exists)    │
└─────────────────────┬──────────────────────┘
                      │
         ┌────────────┼──────────────┐
         │            │              │
         ▼            ▼              ▼
┌───────────┐ ┌───────────┐ ┌──────────────┐
│   FREE    │ │    PRO    │ │  ENTERPRISE   │
│           │ │           │ │               │
│ Aggregate │ │ +Individual│ │ +API access   │
│ stats only│ │ +Media    │ │ +Webhooks     │
│ 1 product │ │ +Export   │ │ +Unlimited    │
│ No export │ │ +Filters  │ │               │
│           │ │ 10 prods  │ │               │
└─────┬─────┘ └─────┬─────┘ └──────┬───────┘
      │             │              │
      ▼             ▼              ▼
┌────────────────────────────────────────┐
│  UI RENDERING                          │
│                                        │
│  free?  → Show UpgradePrompt banner    │
│            (content still visible)     │
│  pro?   → Full access, no banner       │
│  API route? → requireFeature() throws  │
└────────────────────────────────────────┘
```

---

## 16. GDPR & Compliance Layer

### Consent Model

`userProfiles.consent` JSONB:
```json
{
  "tracking": true,
  "personalization": true,
  "analytics": false,
  "marketing": true,
  "grantedAt": "2026-01-15T10:00:00Z"
}
```

### Consent Enforcement

`src/lib/consent-enforcement.ts` — `enforceConsent(userId, dataType)`:
- Called before any access to `behavioral`, `sensitiveData`, or `events`
- Returns sanitized data with non-consented fields nulled out
- Logs each access to `audit_log`

### Audit Log

Every read/write/delete/export of sensitive data:
```
audit_log: userId, action, dataType, accessedBy, ipAddress, userAgent, timestamp, reason
```

### Data Rights

Consumers can:
- Export all their data (GDPR Article 20)
- Delete their account + all associated data (GDPR Article 17)
- Withdraw consent per category independently
- View what data is held about them in `/settings`

### Figure 16.1 — GDPR Data Access & Consent Flow

```
┌────────────────────────────────────────────────────────────────────┐
│  Any code accessing user data (server-side)                          │
└────────────────────────────────┬───────────────────────────────────┘
                                 │
                                 ▼
                     ┌──────────────────────────┐
                     │  enforceConsent()       │
                     │  Check user’s consent{}  │
                     └────┬────────────┬─────────┘
                          │            │
               consented  │            │  not consented
                          ▼            ▼
             ┌─────────────┐ ┌──────────────┐
             │ Return real │ │ Return null  │
             │ data        │ │ for gated    │
             │             │ │ fields       │
             └─────┬───────┘ └──────┬───────┘
                   │                 │
                   └───────┬───────┘
                           ▼
              ┌────────────────────────┐
              │   audit_log INSERT       │
              │   userId, action,        │
              │   dataType, accessedBy,  │
              │   ipAddress, timestamp,  │
              │   reason                 │
              └────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│  CONSUMER DATA RIGHTS (via /settings)                                │
│                                                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  ┌───────────┐  │
│  │  View my   │  │  Export my │  │  Delete     │  │  Withdraw │  │
│  │  data      │  │  data      │  │  account    │  │  consent  │  │
│  │  (Art 15)  │  │  (Art 20)  │  │  (Art 17)   │  │  per-type │  │
│  └─────────────┘  └─────────────┘  └──────────────┘  └───────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

---

## 17. Background Jobs (Cron)

All cron routes live under `/api/cron/`. They accept `Authorization: Bearer $CRON_SECRET` from Vercel Cron.

| Route | Frequency | What it does |
|---|---|---|
| `GET /api/cron/process-feedback-media` | Every 5–15 min | Transcribe pending audio + video via Whisper, propagate to owner rows |
| `GET /api/cron/cleanup-feedback-media` | Daily | Delete expired media from Vercel Blob (retention policy) |
| `GET /api/cron/extract-themes` | Daily | AI theme extraction per product from recent feedback |
| `GET /api/cron/process-notifications` | Every 5 min | Send pending email / WhatsApp / SMS from notification_queue |
| `GET /api/cron/update-behavioral` | Daily | Re-compute userProfiles.behavioral from user_events |
| `GET /api/cron/send-time-analysis` | Weekly | Aggregate email click stats, update send-time cohorts |
| `GET /api/cron/cleanup-analytics-events` | Daily (5 AM UTC) | Delete analytics_events older than 90 days (data retention) |
| `GET /api/generate-rankings` | Weekly | Compute weekly rankings per category, update weekly_rankings |

Manual triggers (brand only, gated by `ALLOW_MANUAL_MEDIA_PROCESSING=true`):
- `POST /api/dashboard/feedback-media/process-now`

### Figure 17.1 — Cron Job Schedule Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                VERCEL CRON SCHEDULER                                │
│                                                                     │
│  Every 5 min    ┌───────────────────────────────────────────┐    │
│    ──────────▶ │  process-notifications (Resend + Twilio)    │    │
│                 └───────────────────────────────────────────┘    │
│                                                                     │
│  Every 5–15 min ┌───────────────────────────────────────────┐    │
│    ──────────▶ │  process-feedback-media (Whisper STT)       │    │
│                 └───────────────────────────────────────────┘    │
│                                                                     │
│  Daily           ┌──────────────────────────────────────────┐    │
│    ──────────▶ │  cleanup-feedback-media (retention)       │    │
│                 │  extract-themes (AI per product)           │    │
│                 │  update-behavioral (recompute profiles)    │    │
│                 │  cleanup-analytics-events (90-day purge)   │    │
│                 └──────────────────────────────────────────┘    │
│                                                                     │
│  Weekly          ┌──────────────────────────────────────────┐    │
│    ──────────▶ │  generate-rankings (leaderboard)          │    │
│                 │  send-time-analysis (optimization)        │    │
│                 └──────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 18. API Surface Map

### Public (no auth)
```
GET  /api/health-check
GET  /api/public/survey-responses/:id/status   — polling endpoint for media processing status
GET  /api/rankings                              — public weekly rankings data
GET  /api/public-products                       — public product discovery
```

### Consumer (auth required, role=consumer)
```
POST /api/feedback/submit                       — submit direct feedback
POST /api/feedback/upload-media                 — upload audio/video/image for feedback
GET  /api/feedback/my                           — fetch own feedback history
POST /api/track-event                           — analytics event tracking
POST /api/user/onboarding                       — save onboarding profile
PATCH /api/user/consent                         — update consent settings
GET  /api/recommendations                       — personalized product recommendations
GET  /api/consumer/notifications                — bell icon notification feed (notification_queue)
GET/PATCH /api/user/notification-settings       — get/save WhatsApp phone + enabled flag
GET  /api/user/points                           — live point balance + recent transaction history
GET  /api/rewards                               — reward catalog + redemption history
POST /api/rewards                               — redeem a reward using points
GET  /api/challenges                            — challenge list with user progress
GET  /api/payouts                               — own payout requests + current balance
POST /api/payouts                               — request a cash-out from points
GET  /api/community/posts                       — list/filter community threads
POST /api/community/posts                       — create a thread or poll
GET  /api/community/posts/:postId               — fetch thread detail + replies
POST /api/community/posts/:postId/replies       — reply to a thread
POST /api/community/react                       — upvote/downvote post or reply
POST /api/community/poll/vote                   — cast poll vote
```

### Brand (auth required, role=brand)
```
GET/POST /api/products                          — CRUD products
GET/POST /api/surveys                           — CRUD surveys
GET  /api/analytics/*                           — aggregated analytics
GET  /api/analytics/weekly-digest               — weekly email digest trigger
POST /api/dashboard/feedback-media/process-now  — manual media processing trigger
POST /api/dashboard/feedback-media/:id/retry    — retry failed media processing
GET  /api/rankings                              — ranking data for own products
POST /api/import/csv                            — bulk CSV feedback upload
POST /api/import/webhook                        — v1 webhook import (text + rating)
POST /api/import/webhook/v2                     — v2 webhook import (social + reviews + multimodal)
GET  /api/brand/alerts                          — brand alert feed (paginated; ?countOnly=true for badge)
PATCH /api/brand/alerts?id=                     — mark single alert read
POST /api/brand/alerts                          — bulk action (action=mark_all_read)
GET/PATCH /api/brand/notification-settings      — get/save Slack webhook URL per brand
GET  /api/payouts                               — review all payout requests with user info
PATCH /api/payouts                              — approve or deny pending payout requests
POST /api/community/posts                       — brand-only AMAs and announcements allowed
```

### Admin
```
GET  /api/admin/*                               — admin-only operations
GET  /api/debug/*                               — debug endpoints (env-gated)
```

### Cron (CRON_SECRET required)
```
GET  /api/cron/process-feedback-media
GET  /api/cron/cleanup-feedback-media
GET  /api/cron/extract-themes
GET  /api/cron/process-notifications
GET  /api/cron/update-behavioral
GET  /api/cron/send-time-analysis
GET  /api/cron/cleanup-analytics-events
```

### Figure 18.1 — API Route Auth Boundary Map

```
┌──────────────────────────────────────────────────────────────────────┐
│                        /api/* ROUTES                                │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  PUBLIC (no auth)                                           │  │
│  │  /api/health-check       /api/public/*      /api/rankings   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  CONSUMER AUTH (session required)                            │  │
│  │  /api/feedback/submit      /api/feedback/upload-media       │  │
│  │  /api/feedback/my           /api/track-event                │  │
│  │  /api/user/onboarding       /api/user/consent               │  │
│  │  /api/recommendations                                       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  BRAND AUTH (session + role='brand')                         │  │
│  │  /api/products              /api/surveys                    │  │
│  │  /api/analytics/*           /api/dashboard/*                │  │
│  │                                                             │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │  + TIER GATE (subscriptionService)                      │  │  │
│  │  │  requireFeature('canViewIndividual')                   │  │  │
│  │  │  checkFeatureAccess('canExportCSV')                    │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  CRON (Bearer $CRON_SECRET)                                 │  │
│  │  /api/cron/process-feedback-media                          │  │
│  │  /api/cron/cleanup-feedback-media                          │  │
│  │  /api/cron/extract-themes                                  │  │
│  │  /api/cron/process-notifications                           │  │
│  │  /api/cron/update-behavioral                               │  │
│  │  /api/cron/send-time-analysis                              │  │
│  │  /api/cron/cleanup-analytics-events                        │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

### 18.1 Webhook v2 — Unified External Import

The **v2 webhook** (`POST /api/import/webhook/v2`) is a unified ingestion surface that accepts feedback from 17 external sources across 4 categories. It replaces manual CSV exports with real-time or batch programmatic imports.

#### Source taxonomy

| Category | Sources | Data stored in |
|---|---|---|
| **Support / Helpdesk** | zendesk, intercom, freshdesk, hubspot | `feedback` |
| **Review Platforms** | google_reviews, trustpilot, g2, capterra, app_store, play_store | `feedback` |
| **Social Platforms** | reddit, youtube, twitter, linkedin | `feedback` + `social_posts` |
| **Custom** | custom | `feedback` |

#### Payload schema (v2)

```json
{
  "source": "google_reviews | reddit | youtube | zendesk | ...",
  "entries": [
    {
      "productId": "prod_abc",
      "text": "Review / comment / ticket text",
      "rating": 4,
      "author": "Jane D.",
      "email": "jane@example.com",
      "externalId": "source_native_id_for_dedup",
      "sourceUrl": "https://original-review-url",
      "createdAt": "2026-03-05T14:30:00Z",
      "category": "review",
      "engagement": {
        "upvotes": 142,
        "likes": 320,
        "shares": 12,
        "comments": 28
      },
      "media": [
        {
          "type": "video",
          "url": "https://cdn.example.com/clip.mp4",
          "mimeType": "video/mp4",
          "durationMs": 45000
        }
      ],
      "metadata": {
        "ticketId": "54821",
        "channel": "email",
        "tags": ["mobile-app", "checkout"]
      }
    }
  ]
}
```

#### Key improvements over v1

| Feature | v1 | v2 |
|---|---|---|
| Sources | 7 (text string) | 17 (validated taxonomy) |
| Deduplication | None | `externalId` within batch |
| Timestamp | Ignored | Preserved as `createdAt` |
| Traceability | None | `sourceUrl` + `externalId` |
| Social posts | Not stored separately | Also inserted into `social_posts` |
| Engagement | Not captured | upvotes, likes, shares, comments → engagement score |
| Media | Not supported | `media[]` with audio/video/image URLs → `feedback_media` pipeline |
| Metadata | Not supported | Arbitrary key/value via `metadata` field |
| Batch limit | 100 | 200 |

#### Figure 18.2 — Webhook v2 Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     WEBHOOK v2 DATA FLOW                                 │
│                                                                          │
│   EXTERNAL SOURCES                    EARN4INSIGHTS                      │
│                                                                          │
│   ┌────────────────┐                                                     │
│   │ Zendesk        │──┐                                                  │
│   │ Intercom       │  │  ┌──────────────┐   POST /api/import/webhook/v2  │
│   │ Freshdesk      │──┼─▶│ Adapter      │──────────────┐                 │
│   │ HubSpot        │  │  │ (Zapier/n8n/ │               │                │
│   └────────────────┘  │  │  custom fn)  │               │                │
│                       │  └──────────────┘               ▼                │
│   ┌────────────────┐  │                    ┌───────────────────────┐      │
│   │ Google Reviews │──┤                    │  Webhook v2 Handler   │      │
│   │ Trustpilot     │  │                    │                       │      │
│   │ G2 / Capterra  │──┤                    │  1. Validate API key  │      │
│   │ App Store      │  │                    │  2. Validate source   │      │
│   │ Play Store     │──┘                    │  3. Dedup externalId  │      │
│   └────────────────┘                       │  4. analyzeSentiment()│      │
│                                            │  5. Detect modality   │      │
│   ┌────────────────┐                       │  6. INSERT feedback   │      │
│   │ Reddit         │──┐                    │  7. INSERT media      │      │
│   │ YouTube        │  ├── direct POST ────▶│  8. INSERT social_post│      │
│   │ Twitter        │──┘                    │  9. Return summary    │      │
│   │ LinkedIn       │                       └───────────┬───────────┘      │
│   └────────────────┘                                   │                  │
│                                                        ▼                  │
│                          ┌─────────────────────────────────────────────┐  │
│                          │               NEON POSTGRESQL               │  │
│                          │                                             │  │
│                          │  feedback          — all sources            │  │
│                          │  feedback_media    — audio/video/image      │  │
│                          │  social_posts      — reddit/youtube/twitter │  │
│                          └─────────────┬───────────────────────────────┘  │
│                                        │                                  │
│                                        ▼                                  │
│                          ┌─────────────────────────────────┐              │
│                          │  Downstream Analytics           │              │
│                          │                                 │              │
│                          │  Unified Analytics Dashboard    │              │
│                          │  Product Health Score           │              │
│                          │  Category Intelligence          │              │
│                          │  Sentiment Trend Views          │              │
│                          │  Cron: Whisper STT (media)      │              │
│                          │  Cron: Theme Extraction          │              │
│                          └─────────────────────────────────┘              │
└──────────────────────────────────────────────────────────────────────────┘
```

#### Multimodal support by source

| Source | Text | Rating | Engagement | Audio | Video | Image |
|---|---|---|---|---|---|---|
| Zendesk / Intercom | ✅ | ✅ (CSAT) | — | Later | Later | Later |
| Google Reviews | ✅ | ✅ (1-5) | — | — | — | Later |
| Trustpilot / G2 | ✅ | ✅ (1-5) | — | — | — | — |
| App Store / Play Store | ✅ | ✅ (1-5) | — | — | — | — |
| Reddit | ✅ | — | ✅ | — | — | Later |
| YouTube | ✅ | — | ✅ | — | ✅ | — |
| Twitter | ✅ | — | ✅ | — | ✅ | ✅ |
| LinkedIn | ✅ | — | ✅ | — | ✅ | ✅ |
| Custom | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## 19. File & Folder Structure

```
src/
├── app/                          — Next.js App Router
│   ├── (auth)/                   — Login/signup pages (grouped, no layout)
│   ├── dashboard/                — Brand-only dashboard
│   │   ├── analytics/            — Unified + detailed analytics pages
│   │   ├── feedback/             — Feedback overview (all products)
│   │   ├── products/             — Product management + per-product feedback
│   │   ├── surveys/              — Survey builder + responses
│   │   ├── rankings/             — Rankings dashboard
│   │   ├── recommendations/      — AI recommendations for brands
│   │   └── rewards/              — Brand rewards (consumer engagement stats)
│   ├── submit-feedback/          — Public consumer feedback form
│   ├── survey/                   — Public survey-taking experience
│   ├── onboarding/               — Consumer onboarding flow
│   ├── top-products/             — Personalized product discovery feed
│   ├── settings/                 — Account settings + consent management
│   └── api/                      — All API route handlers
│
├── components/                   — Shared React components
│   ├── ui/                       — shadcn/ui primitives
│   ├── analytics-tracker.tsx     — Client-side event capture
│   ├── survey-response-form.tsx  — Full survey-taking component
│   └── site-header.tsx/footer.tsx
│
├── db/
│   ├── schema.ts                 — Single source of truth for all DB tables
│   ├── index.ts                  — Drizzle client initialization
│   └── repositories/             — Query abstraction layer
│       ├── feedbackRepository.ts
│       ├── productRepository.ts
│       ├── surveyRepository.ts
│       ├── userProfileRepository.ts
│       └── themeRepository.ts
│
├── server/                       — Server-only business logic
│   ├── personalizationEngine.ts  — Recommendation scoring
│   ├── feedbackMediaProcessingService.ts  — Audio/video transcription pipeline
│   ├── feedbackMediaRetentionService.ts   — Media cleanup/deletion
│   ├── sentimentService.ts       — Keyword sentiment analysis
│   ├── textNormalizationService.ts        — Language detection + translation
│   ├── themeExtractionService.ts — AI theme extraction
│   ├── analyticsService.ts       — Aggregated analytics queries
│   ├── emailService.ts           — Resend integration
│   ├── emailNotifications.ts     — Email template rendering
│   ├── notificationService.ts    — Notification queue management
│   ├── whatsappNotifications.ts  — Twilio WhatsApp integration
│   ├── eventTrackingService.ts   — Behavioral event writes
│   ├── subscriptions/
│   │   └── subscriptionService.ts — Tier checks, feature gates
│   ├── auth/
│   │   └── tierMiddleware.ts     — requireFeature, requireTier helpers
│   ├── rankings/                 — Ranking computation logic
│   ├── analytics/
│   │   └── unifiedAnalyticsService.ts
│   ├── products/                 — Product-related server logic
│   ├── surveys/                  — Survey server logic
│   ├── uploads/
│   │   └── feedbackMediaRepo.ts  — Vercel Blob + feedback_media insert
│   └── campaigns/                — Campaign management
│
├── lib/                          — Shared utilities (client + server)
│   ├── auth/                     — NextAuth config + server helpers
│   ├── personalization/          — Signal aggregation, smart distribution
│   ├── encryption.ts             — Sensitive data encryption at rest
│   ├── consent-enforcement.ts    — GDPR consent gating
│   ├── audit-log.ts              — Audit trail helpers
│   ├── send-time-optimizer.ts    — Optimal send-time logic
│   └── utils.ts                  — General utilities
│
└── middleware.ts                 — Route protection, role-based redirects

instrumentation.ts               — Next.js startup hook: validates env vars
```

### Figure 19.1 — Code Organization by Concern

```
┌────────────────────────────────────────────────────────────────────┐
│                        src/ LAYERS                                  │
│                                                                     │
│   PRESENTATION        BUSINESS LOGIC       DATA ACCESS              │
│                                                                     │
│  ┌─────────────┐   ┌────────────────┐   ┌─────────────────┐      │
│  │ app/         │   │ server/         │   │ db/              │      │
│  │  pages       │   │  services      │   │  schema.ts       │      │
│  │  layouts     │──▶│  processing    │──▶│  repositories/  │      │
│  │  API routes  │   │  analytics     │   │  migrations/    │      │
│  └─────────────┘   │  subscriptions│   └────────┬────────┘      │
│                     └────────────────┘            │               │
│  ┌─────────────┐   ┌────────────────┐            │               │
│  │ components/  │   │ lib/            │            ▼               │
│  │  ui/         │   │  auth/          │   ┌─────────────────┐      │
│  │  shared      │   │  personalization│   │ Neon PostgreSQL │      │
│  │  trackers    │   │  consent        │   │ (via Drizzle)  │      │
│  └─────────────┘   │  encryption     │   └─────────────────┘      │
│                     │  audit          │                            │
│                     └────────────────┘                            │
└────────────────────────────────────────────────────────────────────┘
```

---

## 20. Data Flow: End-to-End Walkthrough

### Scenario: Consumer submits multimodal feedback → Brand sees it

```
[CONSUMER BROWSER]
  1. Opens /submit-feedback/prod_abc123
  2. Types review text, records audio via microphone, attaches 2 images
  3. Gives 4-star rating, clicks Submit

[CLIENT → SERVER]
  4. POST /api/feedback/submit (text + rating)
     ← Returns { feedbackId: "fb_xyz", sentiment: "positive" }
  5. POST /api/feedback/upload-media (audio blob, feedbackId: "fb_xyz")
     ← Uploads to Vercel Blob → blob.url stored in feedback_media
     ← feedback row updated: modalityPrimary='audio', processingStatus='processing'
  6. POST /api/feedback/upload-media (image 1, feedbackId: "fb_xyz")
  7. POST /api/feedback/upload-media (image 2, feedbackId: "fb_xyz")
     ← feedback row updated: modalityPrimary='mixed'

[DATABASE STATE]
  feedback row fb_xyz:
    productId='prod_abc123', feedbackText='...', rating=4,
    sentiment='positive', modalityPrimary='mixed',
    processingStatus='processing', consentAudio=true

  feedback_media rows:
    { ownerId='fb_xyz', mediaType='audio', status='uploaded', storageKey='https://blob.vercel...' }
    { ownerId='fb_xyz', mediaType='image', status='uploaded', storageKey='https://blob.vercel...image1' }
    { ownerId='fb_xyz', mediaType='image', status='uploaded', storageKey='https://blob.vercel...image2' }

[CRON — runs every 5–15 min]
  8. GET /api/cron/process-feedback-media
     → processPendingAudioFeedbackMedia()
     → Finds feedback_media row (audio, status='uploaded')
     → Fetches audio from Vercel Blob URL
     → Sends to OpenAI Whisper → { text: "The packaging is amazing...", language: "en" }
     → Runs sentiment → "positive"
     → UPDATE feedback_media SET status='ready', transcriptText='...'
     → UPDATE feedback SET transcriptText='...', normalizedText='...',
                           processingStatus='ready', originalLanguage='en'

[BRAND BROWSER]
  9. Opens /dashboard/products/prod_abc123/feedback
     → Sees feedback fb_xyz in list:
        ★★★★☆  |  mixed modality  |  "positive"
        Text: "The packaging is amazing..."
        Transcript: "The packaging is amazing..." [from Whisper]
        🎤 [audio player]
        🖼️ [two images displayed]
        [PRO ONLY: full text, media players visible]
        [FREE TIER: UpgradePrompt banner shown]
```

### Scenario: New survey notification to matching consumers

```
[BRAND]
  1. Creates survey for product prod_abc123 (category: 'skincare')
  2. Sets status='active'

[SERVER — notificationService.ts]
  3. Finds all consumers where:
     - userProfiles.interests.productCategories includes 'skincare'
     - notificationPreferences.email.enabled = true
     - consent.marketing = true
  4. For each matching consumer:
     - Determine optimal send hour (from send_time_cohorts + demographic_performance)
     - INSERT into notification_queue { channel='email', scheduledFor=<optimal time> }

[CRON — every 5 min]
  5. GET /api/cron/process-notifications
     → Pulls pending notifications where scheduledFor <= now
     → For each: sends via Resend API
     → INSERT into email_send_events (for tracking)
     → UPDATE notification_queue SET status='sent'

[CONSUMER]
  6. Receives email at their optimal engagement hour
  7. Clicks link → tracked via /api/track → email_send_events.clicked=true
  8. Takes survey → survey_response created
  9. If they recorded voice: audio processing pipeline runs (same as above)
```

### Figure 20.1 — Complete System Data Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  CONSUMER                                   BRAND                    │
│  ────────                                   ─────                    │
│  Sign up → Onboarding                       Sign up                  │
│       │                                         │                    │
│       ▼                                         ▼                    │
│  [user_profiles]                           [products]                │
│  demographics, consent                     name, category            │
│       │                                         │                    │
│       ▼                                         ▼                    │
│  Browse /top-products               ←───  Create surveys             │
│  (personalized by score)                    Share links              │
│       │                                         │                    │
│       ▼                                         │                    │
│  Submit feedback         ─────────────▶ [feedback]                  │
│  Take survey             ─────────────▶ [survey_responses]          │
│  Upload audio/video/img  ─────────────▶ [feedback_media]             │
│       │                                [Vercel Blob]               │
│       │                                         │                    │
│       │                                         ▼                    │
│       │                                 ┌──────────────────┐         │
│       │                                 │  CRON PIPELINES   │         │
│       │                                 │  Whisper STT      │         │
│       │                                 │  Sentiment NLP    │         │
│       │                                 │  Theme extraction │         │
│       │                                 │  Behavioral update│         │
│       │                                 │  Rankings compute │         │
│       │                                 │  Notifications    │         │
│       │                                 └────────┬─────────┘         │
│       │                                          │                    │
│       ▼                                          ▼                    │
│  Earns rewards                           Brand Dashboard             │
│  Gets notifications    ◀──────  feedback overview                      │
│  Sees rankings         ◀──────  survey responses                      │
│                                  unified analytics                  │
│                                  extracted themes                   │
│                                  weekly rankings                    │
│                                  ┌───────────────────────┐         │
│                                  │  FREE: aggregates only │         │
│                                  │  PRO:  + individual    │         │
│                                  │        + media + CSV   │         │
│                                  └───────────────────────┘         │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 21. Production Hardening Infrastructure

> Added March 11, 2026 — 9-phase production hardening before public launch.

### 21.1 Environment Validation

`src/lib/env.ts` + `src/instrumentation.ts`

At server startup (via Next.js instrumentation hook), `validateEnvironment()` runs:

- **CRITICAL** (throws if missing): `POSTGRES_URL` or `DATABASE_URL`, `AUTH_SECRET`
- **OPTIONAL** (warns if missing): `OPENAI_API_KEY`, `RESEND_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ADMIN_API_KEY`, `GA_MEASUREMENT_ID`

The DB connection module (`src/db/index.ts`) also guards independently — throws before Drizzle client creation if no connection string is present.

### 21.2 Rate Limiting

`src/lib/rate-limit.ts`

In-memory sliding window rate limiter designed for Vercel serverless (no external store required). Includes automatic memory cleanup every 60 seconds.

**Pre-configured limits:**

| Key | Max Requests | Window |
|---|---:|---:|
| `feedbackSubmit` | 10 | 60s |
| `surveyResponse` | 20 | 60s |
| `analyticsEvent` | 100 | 60s |
| `authAttempt` | 5 | 60s |

**Applied to routes:**

| Route | Limit Key |
|---|---|
| `POST /api/feedback/submit` | feedbackSubmit |
| `POST /api/feedback/upload-media` | feedbackSubmit |
| `POST /api/analytics/track` | analyticsEvent |
| `POST /api/track-event` | analyticsEvent |

### 21.3 Security Headers

Added to `next.config.ts` via `headers()`:

| Header | Value | Purpose |
|---|---|---|
| X-Frame-Options | `DENY` | Prevent clickjacking |
| X-Content-Type-Options | `nosniff` | Prevent MIME-type sniffing |
| Referrer-Policy | `strict-origin-when-cross-origin` | Limit referrer leakage |
| Strict-Transport-Security | `max-age=31536000; includeSubDomains` | Enforce HTTPS (1 year) |
| Permissions-Policy | `camera=(), microphone=(), geolocation=()` | Restrict browser APIs |

### 21.4 Admin API Auth

`src/lib/auth.ts` was updated to remove query parameter authentication (`?apiKey=`). Admin API routes now only accept:
- `Authorization: Bearer <ADMIN_API_KEY>` header
- `x-admin-api-key: <ADMIN_API_KEY>` header

### 21.5 Structured Logging

`src/lib/logger.ts`

Production-safe structured JSON logger. All log output is JSON for log aggregation (Vercel Logs, Datadog, etc.).

**Sensitive data redaction** — automatically redacts: `password`, `token`, `accessToken`, `refreshToken`, `apiKey`, `secret`, `authorization`, `creditCard`, `ssn`, `sensitiveData`

**Methods:**

| Method | Use case |
|---|---|
| `logger.serviceError(service, operation, error, meta?)` | External service failures (OpenAI, Resend, Twilio) |
| `logger.apiError(route, method, error, meta?)` | API route errors |
| `logger.cronResult(job, success, meta?)` | Cron job completion/failure |
| `logger.warn(message, meta?)` | General warnings |
| `logger.info(message, meta?)` | General info |

**Wired into:**
- All 7 cron routes (via `logger.cronResult()`)
- `notificationService.ts` — Resend failures
- `whatsappNotifications.ts` — Twilio failures
- `api/analytics/track` — DB write failures
- `api/track-event` — DB write failures

### 21.6 Zod Validators for JSONB Fields

`src/lib/validators.ts`

Runtime schemas for all JSONB columns in the database. Prevents malformed data from entering DB and provides type-safe validation at API boundaries.

| Schema | Validates |
|---|---|
| `demographicsSchema` | User demographic fields (age, gender, country, etc.) |
| `interestsSchema` | Product category interests array |
| `notificationPreferencesSchema` | Per-channel notification settings |
| `consentSchema` | GDPR consent flags (tracking, personalization, analytics, marketing) |
| `productProfileSchema` | Product metadata (category, targetAudience, website, etc.) |
| `surveyQuestionsSchema` | Survey question array structure |
| `feedbackMetadataSchema` | Feedback metadata fields |
| `eventDataSchema` | Analytics event payload |

Includes `safeValidate(schema, data)` helper that never throws — returns `{ success, data?, error? }`.

### 21.7 Entity Checks

`src/lib/entity-checks.ts`

Application-level foreign key validation:
- `productExists(productId)` — checks product table before inserting feedback
- `surveyExists(surveyId)` — checks survey table before accepting responses

### 21.8 Performance Indexes

`drizzle/0013_add_performance_indexes.sql`

15+ database indexes added to prevent slow queries at scale:

| Table | Indexed Columns |
|---|---|
| `feedback` | product_id, user_email, created_at, sentiment |
| `survey_responses` | survey_id, product_id, submitted_at |
| `user_events` | user_id, event_type, created_at, product_id |
| `analytics_events` | created_at, user_id, event_type, session_id, page_path |
| `notification_queue` | user_id, status + scheduled_for (composite) |
| `weekly_rankings` | category, week_start |
| `ranking_history` | product_id, category |
| `feedback_media` | owner_type + owner_id (composite), status |
| `products` | owner_id, lifecycle_status |

> **Note:** This migration must be applied manually: `psql $DATABASE_URL < drizzle/0013_add_performance_indexes.sql`

### 21.9 Analytics Stability

Both analytics tracking routes (`/api/analytics/track` and `/api/track-event`) are hardened to **never return 5xx** on DB errors. They:
- Catch all exceptions silently
- Log via `logger.apiError()` for observability
- Return HTTP 200 with `{ success: false }` or `{ ok: false }`

This ensures analytics instrumentation never degrades the user experience.

### 21.10 Responsive CSS Utilities

`src/app/globals.css` — added utility classes:

| Class | Purpose |
|---|---|
| `.table-responsive` | Horizontal scroll wrapper for tables on mobile |
| `.dashboard-grid` | Responsive grid (1 → 2 → 3 columns) |
| `.chart-container` | Max-width container for Recharts charts |

Plus a global fix for Recharts `ResponsiveContainer` overflow.

### Figure 21.1 — Production Hardening Layer Map

```
┌──────────────────────────────────────────────────────────────────────┐
│                  REQUEST LIFECYCLE (hardened)                         │
│                                                                      │
│  1. Security Headers (next.config.ts)                                │
│     X-Frame-Options, HSTS, CSP, Permissions-Policy                   │
│                                                                      │
│  2. Rate Limiting (rate-limit.ts)                                    │
│     IP-based, per-route, auto-cleanup                                │
│                                                                      │
│  3. Input Validation (validators.ts)                                 │
│     Zod schemas for JSONB fields                                     │
│                                                                      │
│  4. Entity Checks (entity-checks.ts)                                 │
│     productExists(), surveyExists()                                  │
│                                                                      │
│  5. Business Logic (existing services)                               │
│     Unchanged — no refactoring                                       │
│                                                                      │
│  6. Structured Logging (logger.ts)                                   │
│     JSON output, sensitive data redacted                             │
│                                                                      │
│  7. Error Resilience                                                 │
│     Analytics routes silently degrade                                │
│     Cron jobs log structured results                                 │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 27. Survey System Enhancements (March 14–15, 2026)

### 27.1 Google Forms-Style Question Editor

A new `QuestionEditor` component was added to the survey detail page:

**File:** `src/app/dashboard/surveys/[id]/QuestionEditor.tsx`

Allows brands to view and edit each question in a Google Forms-style UI:
- Displays each question with its type, required flag, options (for multiple-choice), and scale (for rating)
- Per-question delete + add-new controls
- Integrated inline in the survey detail page (`/dashboard/surveys/[id]`)

### 27.2 `multiple_choice` → `multiple-choice` Normalization Fix

**Problem:** The survey creation form stored question type as `multiple_choice` (underscore). The
`SurveyResponseForm` expected `multiple-choice` (hyphen). On surveys with multiple-choice questions,
the consumer-facing form crashed because `question.type === 'multiple-choice'` never matched.

**Fix applied in two places:**

| File | Change |
|---|---|
| `src/app/dashboard/surveys/[id]/QuestionEditor.tsx` | TypeScript type + switch cases use `'multiple-choice'` |
| `data/surveys.json` | Existing seed surveys normalized: `multiple_choice` → `multiple-choice` |

**Admin backfill endpoint:** `POST /api/admin/fix-surveys` (`src/app/api/admin/fix-surveys/route.ts`)

Scans all surveys in the DB and normalizes any `multiple_choice` → `multiple-choice` in the
`questions` JSONB array. Used once to heal production data; safe to re-run (idempotent).

### 27.3 Survey Type Selector Mobile Fix

`src/components/survey-creation-form.tsx`

The survey type selector (`NPS | Product Feedback | Custom Survey`) used a 3-column button grid that
overflowed on mobile. Changed to `grid-cols-1 sm:grid-cols-3` — stacks single-column on mobile,
reverts to 3-column on `sm` breakpoint and above.

### 27.4 Files Changed

| File | Change |
|---|---|
| `src/app/dashboard/surveys/[id]/QuestionEditor.tsx` | **New** — Google Forms-style question editor |
| `src/app/api/admin/fix-surveys/route.ts` | **New** — Admin backfill route for question type normalization |
| `data/surveys.json` | Updated seed data: `multiple_choice` → `multiple-choice` |
| `src/components/survey-creation-form.tsx` | Survey type selector: responsive `grid-cols-1 sm:grid-cols-3` |

---

## 28. Multi-Channel Notification System — Slack (March 15, 2026)

### 28.1 Overview

Extends the existing notification system with a **Slack channel** for brand alert routing, and
connects the survey publish event to consumer notification dispatch.

### 28.2 Slack Incoming Webhook Integration

**File:** `src/server/slackNotifications.ts`

Sends brand alerts to a Slack channel via Incoming Webhook (no SDK required — plain HTTP POST).

**Message format:** Slack Block Kit with:
- Header block: emoji + alert type label + product name
- Section with alert body text
- Context block: consumer name (if available), platform attribution

**Per-alert emojis:**
| Alert type | Emoji |
|---|---|
| `new_feedback` | `:speech_balloon:` |
| `negative_feedback` | `:warning:` |
| `survey_complete` | `:bar_chart:` |
| `high_intent_consumer` | `:rocket:` |
| `watchlist_milestone` | `:eyes:` |
| `frustration_spike` | `:rotating_light:` |

Returns `true` on success, `false` (non-throwing) on failure — Slack errors never break the main alert pipeline.

### 28.3 `fireAlert()` Wired to Slack

`src/server/brandAlertService.ts` — `fireAlert()` now:
1. Inserts `brand_alerts` row (in-app queue) as before
2. Reads brand's Slack webhook URL from `brand_alert_rules` (via `slackWebhookUrl` field on the rule)
3. If webhook URL present + `'slack'` in rule channels: calls `sendSlackNotification()` — non-blocking (`void` call)
4. Falls back gracefully if Slack fails — brand alert still saved in-app

### 28.4 Survey Publish → Consumer Notifications

The survey creation action was updated to call `notifyNewSurvey(surveyId)` immediately after a survey
is set to `status='active'`. This triggers the smart distribution pipeline:
```
notifyNewSurvey(surveyId)
  → finds consumers matching survey's product category
  → filters by notification preferences + marketing consent
  → schedules notifications at optimal send time
  → INSERT into notification_queue
```

### 28.5 Notification Settings API (Brand)

**Route:** `GET/PATCH /api/brand/notification-settings`
**File:** `src/app/api/brand/notification-settings/route.ts`

| Method | Purpose |
|---|---|
| `GET` | Returns current Slack webhook URL from `brand_alert_rules` |
| `PATCH` | Saves `slackWebhookUrl` to all of the brand's alert rules (or creates defaults) |

### 28.6 Notification Settings UI

**Route:** `/dashboard/settings`
**File:** `src/app/dashboard/settings/page.tsx`

Full-page notification management UI for brands:

| Section | What it does |
|---|---|
| **Slack Webhook config** | Input field for Incoming Webhook URL; save button; setup instructions link |
| **Alert Rules table** | One row per alert type; toggle email / Slack channel per type (in-app always on) |
| **Channel toggles** | Disabled with tooltip until Slack webhook URL is saved |

### 28.7 Files Added / Modified

| File | Type | Change |
|---|---|---|
| `src/server/slackNotifications.ts` | **New** | Slack Incoming Webhook service |
| `src/app/api/brand/notification-settings/route.ts` | **New** | GET/PATCH Slack webhook URL API |
| `src/app/dashboard/settings/page.tsx` | **New** | Notification settings UI |
| `src/server/brandAlertService.ts` | Modified | `fireAlert()` wired to Slack (non-blocking) |
| Survey creation action | Modified | `notifyNewSurvey()` called on survey activation |

---

## 29. WhatsApp Real-Time Notifications (March 15, 2026)

### 29.1 Overview

The WhatsApp channel was previously a stub (`"WhatsApp not yet implemented"`). It is now a fully
functional Twilio-backed real-time notification channel for both brands and consumers.

### 29.2 `sendWhatsAppAlertMessage()`

**File:** `src/server/whatsappNotifications.ts`

Real Twilio WhatsApp implementation:
- Reads `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` from env
- Validates destination phone to E.164 format before sending
- Sends branded emoji messages matching alert type (same emoji set as Slack)
- Returns `true` on success, `false` (throws-never) on failure

### 29.3 `notificationService.ts` WhatsApp Channel

`src/server/notificationService.ts` — replaced the `sendWhatsApp()` stub with a real call:
- Reads `userId` → looks up `userProfiles.notificationPreferences.whatsapp.phoneNumber`
- Calls `sendWhatsAppAlertMessage()` with the formatted message body

### 29.4 Brand Alert Flow (Real-Time)

`src/server/brandAlertService.ts` — `fireAlert()` now:
1. Fetches brand profile once (single DB read shared between Slack + WhatsApp)
2. Reads `notificationPreferences.whatsapp` from brand's user profile
3. If WhatsApp enabled + phone number present: calls `sendWhatsAppAlertMessage()` immediately (non-blocking)

### 29.5 Consumer Campaign Flow (Real-Time)

`src/server/campaigns/surveyNotificationCampaign.ts`:
- When a new survey is published and consumer matches, WhatsApp is sent immediately alongside queued email
- Reads consumer's WhatsApp phone from `userProfiles.notificationPreferences.whatsapp`

### 29.6 User Notification Settings API

**Route:** `GET/PATCH /api/user/notification-settings`
**File:** `src/app/api/user/notification-settings/route.ts`

Available to **all authenticated users** (brands + consumers):

| Method | Purpose |
|---|---|
| `GET` | Returns current WhatsApp phone number + enabled flag from user profile |
| `PATCH` | Saves `phoneNumber` and `enabled` to `userProfiles.notificationPreferences.whatsapp` |

### 29.7 Settings Page Expanded for All Users

`src/app/dashboard/settings/page.tsx` — expanded to serve brands AND consumers:

| Section | Brands | Consumers |
|---|---|---|
| **WhatsApp card** (top of page) | Phone + enable toggle | Phone + enable toggle |
| **Alert rules table** | ✅ Present (email / Slack / WhatsApp columns) | ❌ Not shown |
| **Consumer survey info card** | ❌ Not shown | ✅ Short-form survey notification info |

Role gating is removed — any authenticated user can reach `/dashboard/settings`.

### 29.8 Files Added / Modified

| File | Type | Change |
|---|---|---|
| `src/server/whatsappNotifications.ts` | Modified | Real Twilio impl replacing stub |
| `src/server/notificationService.ts` | Modified | `sendWhatsApp()` calls real Twilio function |
| `src/server/brandAlertService.ts` | Modified | Fetches brand profile once, sends WhatsApp (non-blocking) |
| `src/server/campaigns/surveyNotificationCampaign.ts` | Modified | Consumers get instant WhatsApp on survey publish |
| `src/app/api/user/notification-settings/route.ts` | **New** | GET/PATCH WhatsApp settings for any user |
| `src/app/dashboard/settings/page.tsx` | Modified | WhatsApp card + consumer info card; brand-only gate removed |

---

## 30. Brand Alerts Dashboard (March 15, 2026)

**Route:** `/dashboard/alerts`
**File:** `src/app/dashboard/alerts/page.tsx`

A dedicated full-page alerts inbox for brands.

### Features

| Feature | Detail |
|---|---|
| **Alert list** | Up to 50 alerts, newest first, scoped to current brand |
| **Per-alert icons** | Colour-coded by alert type: MessageSquare blue, AlertCircle red, BarChart3 green, TrendingUp purple, Eye amber |
| **Unread count** | Shown in page heading |
| **Mark all read** | Single button calls `POST /api/brand/alerts {action:'mark_all_read'}` |
| **Empty state** | Inbox icon + "No alerts yet" message |
| **Loading state** | Spinner on initial fetch |
| **Sidebar badge** | `DashboardShell` "Alerts" nav link polls `/api/brand/alerts?countOnly=true` every 30 s for live unread count |

### Component Data Flow

```
Page mounts → GET /api/brand/alerts?limit=50 → setAlerts + setUnread
Mark all read → POST /api/brand/alerts {action:'mark_all_read'} → optimistic local update
Sidebar badge  → polls /api/brand/alerts?countOnly=true every 30 s
Bell dropdown  → also reads /api/brand/alerts (first 10 items)
```

---

## 31. Bell Icon Real-Time Notifications (March 16, 2026)

### 31.1 Problem

The `DashboardHeader` bell dropdown (`src/components/dashboard-header.tsx`) showed three hardcoded
consumer-appropriate mock items to **all users regardless of role**:
- "New Survey Response" (consumer mock)
- "New Reward Earned" (consumer mock)
- "Payout Processed" (consumer mock)

The static badge dot was always visible regardless of whether any real notifications existed.

### 31.2 Solution Architecture

Completely rewritten as a `NotificationDropdown` sub-component with real data fetching:

| Role | Data source | Unread count derivation |
|---|---|---|
| `brand` | `GET /api/brand/alerts?limit=10` | `unread` field from API |
| `consumer` | `GET /api/consumer/notifications` | Items newer than `localStorage.notif_last_read` timestamp |

### 31.3 Consumer Notifications API

**Route:** `GET /api/consumer/notifications`
**File:** `src/app/api/consumer/notifications/route.ts`

- Authenticated (any user)
- Queries `notification_queue` WHERE `userId = currentUser` AND `createdAt >= 30 days ago`
- Returns `{ notifications[] }` — limit 20, descending by `createdAt`

### 31.4 `NotificationDropdown` Component Behaviour

```
Fetch on: mount (when role is known) + dropdown open event
Brand:    re-fetch → show items → "Mark all read" button calls POST /api/brand/alerts
Consumer: re-fetch → localStorage.notif_last_read = now (marks all read visually)
```

**Brand notification icons (by `alertType`):**
| Type | Icon | Color |
|---|---|---|
| `new_feedback` | MessageSquare | blue |
| `negative_feedback` | AlertCircle | red |
| `survey_complete` | BarChart3 | green |
| `high_intent_consumer` | TrendingUp | purple |
| `watchlist_milestone` | Eye | amber |
| `frustration_spike` | Zap | orange |

**Consumer notification icons (by `type`):**
| Type | Icon | Color |
|---|---|---|
| `new_survey` | ClipboardList | blue |
| `weekly_digest` | BarChart3 | purple |
| `survey_submitted` | CheckCheck | green |
| `reward_earned` | Star | yellow |

**UX details:**
- Numeric unread badge (capped at `9+`); hidden when count = 0 — replaces the always-visible static dot
- Loading spinner on initial fetch; empty inbox state with Inbox icon
- `formatDistanceToNow` timestamps (e.g. "3 hours ago")
- HTML stripped from consumer notification body before display
- "View all →" footer: brands → `/dashboard/alerts`, consumers → `/dashboard/my-feedback`

### 31.5 Files Added / Modified

| File | Type | Change |
|---|---|---|
| `src/components/dashboard-header.tsx` | Modified | Full rewrite: hardcoded mocks → real role-based `NotificationDropdown` |
| `src/app/api/consumer/notifications/route.ts` | **New** | Consumer notification feed API |

---

## 32. Social Listening System (March 17–18, 2026)

### 32.1 Overview

A complete social listening pipeline that aggregates public sentiment data from 10 external platforms and integrates it into the existing analytics stack. Brands can monitor what consumers say about their products across the internet.

### 32.2 Architecture

```
                   ┌─────────────────────────┐
                   │   Social Ingestion API   │
                   │  POST /api/social/ingest │
                   └────────────┬────────────┘
                                │
              ┌─────────────────┼─────────────────┐
              │                 │                 │
        ┌─────▼─────┐   ┌──────▼──────┐   ┌──────▼──────┐
        │  Reddit    │   │  YouTube    │   │  Twitter    │
        │  Adapter   │   │  Adapter    │   │  Adapter    │
        └─────┬─────┘   └──────┬──────┘   └──────┬──────┘
              │                │                 │
              └────────────────┼─────────────────┘
                               │
                    ┌──────────▼───────────┐
                    │  Relevance Scoring   │
                    │  (threshold ≥ 0.4)   │
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  Sentiment Analysis  │
                    │  + DB Persistence    │
                    └──────────┬───────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
        ┌─────▼─────┐  ┌──────▼──────┐  ┌──────▼──────┐
        │ Rankings   │  │ Health      │  │ Category    │
        │ (10% wt)   │  │ Score       │  │ Intel       │
        └───────────┘  └─────────────┘  └─────────────┘
```

### 32.3 Platform Adapters

| Platform | Adapter | Auth Required | Status |
|----------|---------|---------------|--------|
| Reddit | `redditAdapter` | No (public JSON API) | ✅ Working |
| YouTube | `youtubeAdapter` | `YOUTUBE_API_KEY` | Ready (free tier, 10K units/day) |
| Twitter/X | `twitterAdapter` | `TWITTER_BEARER_TOKEN` | Ready (Basic $100/mo) |
| Google Reviews | `googleReviewsAdapter` | `GOOGLE_PLACES_API_KEY` | Ready (free $200/mo credit) |
| Amazon | `amazonAdapter` | Scraper proxy needed | Shell |
| Flipkart | `flipkartAdapter` | Scraper proxy needed | Shell |
| Instagram | `instagramAdapter` | Meta Graph API | Shell |
| TikTok | `tiktokAdapter` | TikTok Research API | Shell |
| LinkedIn | `linkedinAdapter` | LinkedIn Marketing API | Shell |
| Brand-submitted | `processBrandSubmittedLink` | None | ✅ Working |

### 32.4 Database Schema

**Table:** `social_posts`

| Column | Type | Description |
|--------|------|-------------|
| `id` | serial PK | Auto-increment |
| `productId` | integer FK | Links to products table |
| `platform` | text | Source platform |
| `externalId` | text | Platform-specific post ID |
| `author` | text | Post author |
| `content` | text | Post body |
| `title` | text | Post title (nullable) |
| `url` | text | Link to original post |
| `sentimentScore` | real | AI sentiment (-1.0 to 1.0) |
| `sentimentLabel` | text | positive / neutral / negative |
| `relevanceScore` | real | Product relevance (0.0 to 1.0) |
| `engagement` | jsonb | {likes, comments, shares, views} |
| `mentionType` | text | review / mention / discussion / complaint / praise |
| `influenceScore` | real | Author influence estimate |
| `isKeyOpinionLeader` | boolean | High-influence flag |
| `createdAt` | timestamp | Record creation |
| `fetchedAt` | timestamp | When fetched from platform |
| `postedAt` | timestamp | Original post date |

**Unique constraint:** `(productId, platform, externalId)` — prevents duplicate ingestion.

### 32.5 Cross-App Integration

Social data feeds into 6 existing analytics services:

| Service | Integration | Weight |
|---------|------------|--------|
| Rankings Engine | `socialSentimentScore` field | 10% of total score |
| Product Health Score | Social sentiment component | Weighted input |
| Feature Sentiment | Social mentions of features | Cross-referenced |
| Category Intelligence | Category-level product health, sentiment, and theme comparison | Feedback + surveys + social + extracted themes |
| Theme Extraction | Social themes merged | Unified themes |
| Consumer Intelligence | Segment feedback by demographic and behavioral profile | Feedback + user profiles |

### 32.6 API Routes

| Route | Method | Purpose |
|-------|--------|----------|
| `/api/social` | GET | Fetch social posts for a product (paginated, filterable) |
| `/api/social/ingest` | POST | Trigger ingestion for a product from specified platforms |
| `/api/social/submit-link` | POST | Brand submits a specific URL for ingestion |

### 32.7 Files

| File | Purpose |
|------|----------|
| `src/server/social/platformAdapters.ts` | 10 platform adapters + relevance scoring |
| `src/server/social/socialIngestionService.ts` | Orchestration: fetch → score → filter → persist |
| `src/server/social/socialAnalyticsService.ts` | Aggregation, trends, keyword extraction |
| `src/db/repositories/socialRepository.ts` | CRUD, filters, aggregation queries |
| `src/app/dashboard/social/page.tsx` | Server component (data fetch) |
| `src/app/dashboard/social/SocialPageClient.tsx` | Client component (UI) |
| `src/db/schema.ts` | `socialPosts` table definition |

---

## 33. Social Data Relevance Filter (March 18, 2026)

### 33.1 Problem

Keyword-based searches on external platforms (Reddit, YouTube, Twitter) return many posts that mention the search term but are NOT actually about the target product. For example, searching "Galaxy" on Reddit returns posts about astronomy, Samsung Galaxy phones, and the Marvel movie — not necessarily the registered product.

### 33.2 Solution: Multi-Signal Relevance Scoring

**Function:** `calculateRelevanceScore()` in `platformAdapters.ts`

Every fetched post is scored 0.0–1.0 before being saved to the database:

| Signal | Weight | Description |
|--------|--------|-------------|
| Product name match | +0.40 | Product name found in content or title |
| Brand name match | +0.30 | Brand/company name found |
| Category keywords | +0.15 | Category-relevant terms found |
| Co-occurrence bonus | +0.15 | Product + brand appear in same post |

**Special cases:**
- ID-based platforms (Google Reviews, Amazon, Flipkart, brand-submitted) auto-score `1.0` — the data is definitively about the product.
- Brand-submitted links auto-score `1.0`.

**Threshold:** `RELEVANCE_THRESHOLD = 0.4` — posts below this score are discarded and counted as `irrelevantFiltered` in the ingestion result.

### 33.3 Precision Search Queries

Adapters were updated to use exact-phrase matching:

- **Reddit:** `"product name"` (quoted) instead of `product name`
- **YouTube:** `"product name"` + `order=relevance` instead of `order=date`

### 33.4 Ingestion Pipeline Flow

```
1. Fetch posts from platform adapter
2. Dedup against existing DB records (by externalId)
3. Look up brand name (from users table via product.ownerId)
4. Look up category (from product profile JSONB)
5. Score each post with calculateRelevanceScore()
6. Discard posts with score < 0.4
7. Run sentiment analysis on remaining posts
8. Persist to socialPosts table (with relevanceScore column)
```

### 33.5 Files Modified

| File | Change |
|------|--------|
| `src/server/social/platformAdapters.ts` | Added `calculateRelevanceScore()`, `RELEVANCE_THRESHOLD`, exact-phrase queries |
| `src/server/social/socialIngestionService.ts` | Wired relevance filter into pipeline, brand/category lookup |
| `src/db/schema.ts` | Added `relevanceScore` column to `socialPosts` |

---

## 34. YouTube & Google Reviews API Activation (March 18, 2026)

### 34.1 YouTube Data API v3

**What changed:** The `YouTubeAdapter` was upgraded from returning zero-value engagement stats to fetching real video statistics via a second batched API call.

**Before:** All videos had `likes: 0, comments: 0, views: 0` — engagement score was always `0`.

**After:** A batch call to `GET /youtube/v3/videos?part=statistics&id=id1,id2,...` fetches real stats for all search results in a single extra request. Engagement score is now calculated from actual data.

```
Search API call (maxResults=15)
       ↓
Extract all videoIds
       ↓
Batch statistics call (one request for all 15 videos)
       ↓
Map stats back to posts by videoId
       ↓
Calculate engagement score from real views/likes/comments
```

**API used:** `https://www.googleapis.com/youtube/v3/videos?part=statistics`
**Quota cost:** +1 unit per batch (negligible, free tier is 10,000 units/day)
**Env var:** `YOUTUBE_API_KEY`

### 34.2 Google Places API (Reviews)

**What changed:** The `GoogleReviewsAdapter` previously required a `placeId` option to be passed explicitly — making it unusable from the generic ingestion pipeline which doesn't know place IDs.

**Before:** `if (!placeId) return []` — adapter was effectively non-functional without manual placeId.

**After:** When no `placeId` is provided, the adapter auto-discovers it via Google Text Search API:

```
keywords (product name + brand name)
       ↓
GET /maps/api/place/textsearch/json?query=...
       ↓
Top result → extract place_id
       ↓
GET /maps/api/place/details/json?place_id=...&fields=reviews
       ↓
Return up to 5 Google Reviews with rating + content
```

**Env var:** `GOOGLE_PLACES_API_KEY`
**Cost:** Free within Google's $200/month Maps Platform credit (~13,000 Text Search requests free/month)

### 34.3 Environment Variables Added

Added to `.env.local` and documented in `.env.example`:

| Variable | Value source | Purpose |
|----------|-------------|----------|
| `YOUTUBE_API_KEY` | Google Cloud Console → YouTube Data API v3 | YouTube search + video stats |
| `GOOGLE_PLACES_API_KEY` | Google Cloud Console → Places API | Google Reviews text search + details |

Both use the same Google Cloud project. Same API key is used for both (key restricted to both APIs).

### 34.4 Files Modified

| File | Change |
|------|--------|
| `src/server/social/platformAdapters.ts` | YouTube: added batch stats fetch; Google: added Text Search auto-discovery |
| `.env.example` | Added YOUTUBE_API_KEY, GOOGLE_PLACES_API_KEY, TWITTER_BEARER_TOKEN docs |
| `.env.local` | Added both keys (local dev only, not committed to git) |

---

## 35. Production DB Schema Push & API Keys Deployed (March 19, 2026)

### 35.1 Schema Migration
The `relevance_score` column (defined in `src/db/schema.ts` in commit `56e81de`) was applied to the production Neon PostgreSQL database.

**Column added:**
```sql
ALTER TABLE social_posts ADD COLUMN relevance_score real;
```

Drizzle-kit push was used to apply the change. Migration confirmed via `information_schema.columns` query before and after.

### 35.2 API Keys Added to Vercel
Both Google Cloud API keys were added to Vercel environment variables for production:

| Variable | Platform |
|----------|----------|
| `YOUTUBE_API_KEY` | YouTube Data API v3 |
| `GOOGLE_PLACES_API_KEY` | Google Places API (Reviews) |

Same key value used for both (one Google Cloud API key with both APIs enabled).

### 35.3 Production Status
As of March 19, 2026, the full social listening pipeline is live in production:
- Reddit ingestion (no API key required)
- YouTube ingestion with real video stats (views/likes/comments)
- Google Reviews ingestion with auto-discovery of place IDs
- Relevance scoring (0–1) stored per post in `relevance_score` column
- Posts below threshold 0.4 filtered before DB insert

---

## 36. In-App Community & Rewards Engine (March 20, 2026)

### 36.1 Community System

The `/dashboard/community` surface was converted from a mock social wall into a real in-app discussion subsystem.

Supported thread types:
- `discussion`
- `ama`
- `announcement`
- `feature_request`
- `tips`
- `poll`

Technical behavior:
- Brand users are allowed to create AMAs and announcements
- Consumers and brands can create standard discussion threads
- Polls store denormalized option state in `community_posts.poll_options`
- Thread detail requests increment `view_count`
- Replies support parent-child nesting through `community_replies.parent_reply_id`
- Reactions are normalized in `community_reactions` and counters are denormalized onto posts/replies for fast reads

### 36.2 Rewards & Payments Engine

The previous reward experience was mock-only. It is now implemented as a shared service plus database-backed APIs.

Core service:
- `src/server/pointsService.ts`

Point values currently wired:
- `feedback_submit` = 25
- `survey_complete` = 50
- `community_post` = 10
- `community_reply` = 5
- `community_upvote_received` = 2

Conversion rate:
- `100 points = $1 USD`

Challenges are modeled as source-based counters:
- feedback
- survey
- community_post
- community_reply

When a qualifying action occurs, the system:
1. Upserts the balance in `user_points`
2. Writes an immutable ledger row to `point_transactions`
3. Advances matching rows in `user_challenge_progress`
4. Awards the challenge bonus when a threshold is crossed

### 36.3 APIs Added

New route handlers:
- `GET /api/user/points`
- `GET/POST /api/rewards`
- `GET /api/challenges`
- `GET/POST/PATCH /api/payouts`
- `GET/POST /api/community/posts`
- `GET/DELETE /api/community/posts/[postId]`
- `POST /api/community/posts/[postId]/replies`
- `POST /api/community/react`
- `POST /api/community/poll/vote`

### 36.4 Database Application Strategy

The new community and rewards tables were pushed directly to the configured Neon PostgreSQL database using helper scripts:
- `push-community-schema.mjs`
- `push-rewards-schema.mjs`

This was used as a pragmatic fallback because interactive schema push behavior in the terminal session was unreliable.

### 36.5 Verification

Local production builds completed successfully after both changesets:
- Community build: 138 generated pages
- Community + rewards build: 142 generated pages

The successful build included these new dynamic routes:
- `/dashboard/community`
- `/dashboard/community/[postId]`
- `/dashboard/rewards`
- `/dashboard/payouts`
- `/api/user/points`
- `/api/rewards`
- `/api/challenges`
- `/api/payouts`

---

## Appendix A — Cost Calculator & Capacity Planning

> **Planning note:** These are internal cost-planning estimates based on the current Earn4Insights architecture and the Whisper rate of `~$0.006 / minute`.  
> Verify live OpenAI and Vercel pricing before final commercial launch.

### A.1 Cost model assumptions

| Item | Assumption | Why it matters |
|---|---:|---|
| Whisper transcription | **$0.006 / minute** | Primary variable AI cost for audio/video |
| Average audio clip | **1 minute / 0.75 MB** | Good proxy for compressed mobile audio |
| Average short video clip | **1 minute / 15 MB** | Good proxy for compressed mobile video |
| Text + rating feedback | **$0 AI cost** | Current text normalization/sentiment path is not using paid STT |
| Image feedback | **$0 AI cost** | Current system stores images; no OCR/vision pipeline yet |
| Raw media retention | **90 days** | Storage footprint is roughly 3× monthly uploads |
| Billing model recommendation | **Per brand subscription + usage overage** | More accurate than charging per consumer seat |

### Figure A.1 — Cost Drivers by Modality

```text
┌────────────────────────────────────────────────────────────────────┐
│                    COST DRIVER COMPARISON                         │
│                                                                    │
│  Text + Rating   → DB write only                                  │
│                    Lowest variable cost                            │
│                                                                    │
│  Image           → Blob storage + CDN delivery                    │
│                    No AI cost today                                │
│                                                                    │
│  Audio           → Blob storage + Whisper minutes                 │
│                    Predictable and relatively low-cost             │
│                                                                    │
│  Video           → Blob storage + Whisper minutes + playback      │
│                    Highest scaling risk due to file size/egress    │
└────────────────────────────────────────────────────────────────────┘
```

### A.2 Core formulas

```text
TranscriptionCost
= ActiveUsers × FeedbackPerUserPerMonth × MediaAttachRate × AvgMinutes × $0.006

MonthlyUploadGB
= ActiveUsers × FeedbackPerUserPerMonth × MediaAttachRate × AvgFileSizeMB / 1000

SteadyStateStorageGB
≈ MonthlyUploadGB × RetentionMonths
```

### A.3 Raw transcription cost — if every feedback contains 1 minute of speech

This is the **upper-bound** estimate if **100%** of submitted feedback includes media with 1 minute of speech.

| Active users / month | Feedback / user / month | Total transcribed minutes | Raw Whisper cost |
|---|---:|---:|---:|
| **1,000** | 1 | 1,000 | **$6** |
| **1,000** | 3 | 3,000 | **$18** |
| **50,000** | 1 | 50,000 | **$300** |
| **50,000** | 3 | 150,000 | **$900** |
| **1,000,000** | 1 | 1,000,000 | **$6,000** |
| **1,000,000** | 3 | 3,000,000 | **$18,000** |

### A.4 Realistic scenario — 25% of feedback includes 1 minute of media

Only **1 in 4** feedback submissions contains audio/video — better planning model for launch.

| Active users / month | Feedback / user / month | Media attach rate | Total transcribed minutes | Raw Whisper cost |
|---|---:|---:|---:|---:|
| **1,000** | 1 | 25% | 250 | **$1.50** |
| **1,000** | 3 | 25% | 750 | **$4.50** |
| **50,000** | 1 | 25% | 12,500 | **$75** |
| **50,000** | 3 | 25% | 37,500 | **$225** |
| **1,000,000** | 1 | 25% | 250,000 | **$1,500** |
| **1,000,000** | 3 | 25% | 750,000 | **$4,500** |

### A.5 Monthly upload footprint — audio-heavy vs video-heavy

- **Audio-heavy** = every feedback includes 1 audio clip averaging **0.75 MB**
- **Video-heavy** = every feedback includes 1 video clip averaging **15 MB**

| Scenario | 1k @ 1/mo | 1k @ 3/mo | 50k @ 1/mo | 50k @ 3/mo | 1M @ 1/mo | 1M @ 3/mo |
|---|---:|---:|---:|---:|---:|---:|
| **Audio uploads / month** | 0.75 GB | 2.25 GB | 37.5 GB | 112.5 GB | 0.75 TB | 2.25 TB |
| **Video uploads / month** | 15 GB | 45 GB | 0.75 TB | 2.25 TB | 15 TB | 45 TB |

### A.6 Approximate 90-day steady-state storage

| Scenario | 1k @ 1/mo | 1k @ 3/mo | 50k @ 1/mo | 50k @ 3/mo | 1M @ 1/mo | 1M @ 3/mo |
|---|---:|---:|---:|---:|---:|---:|
| **Audio 90-day storage** | 2.25 GB | 6.75 GB | 112.5 GB | 337.5 GB | 2.25 TB | 6.75 TB |
| **Video 90-day storage** | 45 GB | 135 GB | 2.25 TB | 6.75 TB | 45 TB | 135 TB |

### A.7 Practical interpretation

| Pattern | Interpretation |
|---|---|
| **1 min audio** | Cheap to scale; AI cost stays predictable |
| **1 min video** | Transcription cost manageable, but storage and playback grow fast |
| **1M users × 3 video/month** | Raw STT ≈ **$18,000/month**, but **45 TB/month uploads** is the bigger problem |
| **Audio vs video** | For equal speech duration, AI cost is similar; video is expensive because of **file size** |

### A.8 Suggested brand pricing bands

| Plan | Recommended retail | Included transcription | Included media upload | Overage guidance | Best fit |
|---|---:|---:|---:|---:|---|
| **Free** | **$0** | **0 min** | **0–2 GB** | None / blocked | Text-first brands, trials |
| **Pro** | **$49–$99 / month** | **500–1,000 min** | **25–50 GB** | **$0.015–$0.020 / min** | SMB brands using audio occasionally |
| **Enterprise** | **$299+ / month** or custom | **5,000–10,000+ min** | **250 GB+** or BYO storage | Custom | API/webhook, high-volume, video-heavy tenants |

### A.9 Cost optimization checklist

| Optimization | Expected impact |
|---|---|
| Cap audio/video to **60 seconds** | Hard ceiling on transcription cost per upload |
| Prefer **audio** over video | Much lower storage and bandwidth |
| Compress media on client before upload | Lower Blob cost |
| Delete raw video after transcript is ready | Major reduction in long-term storage |
| Keep transcript permanently, raw media temporarily | Best analytics-to-cost ratio |
| Retry only transient failures | Prevent duplicate AI spend |
| Add per-brand minute quotas | Protects margin |
| Keep image uploads storage-only | Avoid unnecessary AI cost until OCR is needed |
| Move large Enterprise video tenants to external object storage | Better long-term economics |

### A.10 Default recommendation for Earn4Insights

```text
Free tier:
  text + rating (+ optional images)
  no routine audio/video transcription

Pro tier:
  audio enabled
  short video allowed
  fixed monthly transcription quota
  limited monthly upload/storage allowance

Enterprise tier:
  webhook/API access
  multimodal at scale
  custom quotas
  short-retention or BYO-storage for video-heavy programs
```

### A.11 Bottom line

```text
Transcription cost is predictable:
  1 minute of speech ≈ $0.006

Infrastructure cost is asymmetric:
  1 minute audio ≈ 0.75 MB
  1 minute video ≈ 15 MB

Therefore:
  Audio scales cleanly.
  Video should be quota-based and Enterprise-oriented.
```

---

---

## 22. Build Fix & Config Cleanup (March 12, 2026)

### 22.1 Server/Client Component Boundary Fix

The `/public-products` listing page (`src/app/public-products/page.tsx`) was a Server Component that contained an `onClick` event handler to wrap `<WatchButton>` on product cards. This violates the Next.js App Router contract: Server Components cannot pass event handlers to the DOM or to Client Component wrapper elements.

**Fix:** Added `"use client"` directive to the page. The page has no server-side data fetching (uses static `mockProducts` from `@/lib/data`), so converting to a Client Component has zero impact on functionality or SSR.

### 22.2 Deprecated Config Removal

Removed `experimental.instrumentationHook: true` from `next.config.ts`. In Next.js 15, `instrumentation.ts` is automatically recognized without explicit opt-in. The old flag was generating a build warning and is listed as an unrecognized key.

### 22.3 Build Impact

| Metric | Before | After |
|--------|--------|-------|
| Build status | **FAIL** (exit 1) | **PASS** (exit 0) |
| Failing page | `/public-products` prerender error | All 126 pages generated |
| Affected commits | 5 commits over 2 days blocked | Unblocked |
| Warnings removed | `instrumentationHook` deprecation | Clean config |

---

---

## 23. Homepage Footer Mobile Fix (March 12, 2026)

The homepage (`src/app/page.tsx`) contained an inline footer with a 4-column grid (`lg:grid-cols-4`, `sm:grid-cols-2`). On small screens this collapsed to a single column, stacking all sections vertically — Product links, Company links, Legal links, and the Earn4Insights brand description — creating a long, cluttered footer.

**Restructured to:**
- Brand tagline/description moved to a centered full-width block above the link columns
- Removed "Product" column (Rankings + Dashboard) — Dashboard requires auth (404 for unauthenticated visitors), Rankings is already in the site header nav
- Link columns changed to a 2-column grid (`grid-cols-2`): Company + Legal
- Fixed dead links: `/about` → `/about-us`, `/contact` → `/contact-us`

Note: `SiteFooter` component (`src/components/site-footer.tsx`) is imported in `layout.tsx` but not rendered — the homepage uses its own inline footer. This is intentional: the homepage has a richer footer than the simple copyright bar in `SiteFooter`.

---

## 24. Sign-in Latency Optimization (March 12, 2026)

Two changes to reduce sign-in latency across both Google OAuth and credentials flows:

### 24.1 Google OAuth Prompt Change

The Google OAuth provider in `src/lib/auth/auth.config.ts` used `prompt: "consent"`, which forced the full Google consent screen on **every** sign-in — even for returning users who had already granted permissions. Changed to `prompt: "select_account"`, which shows only the account picker for returning users (fast) while still prompting consent for first-time users automatically.

### 24.2 Serverless Database Connection Optimization

The Postgres client in `src/db/index.ts` was initialized with default options — no connection pooling, no timeouts, no pgBouncer compatibility. On Vercel + Neon serverless, this caused cold start delays on every function invocation during auth callbacks (`getUserByEmail`, `createUser`).

**Added connection options:**
```typescript
postgres(connectionString, {
  prepare: false,       // Required for Neon connection pooler (pgBouncer)
  idle_timeout: 20,     // Close idle connections after 20s in serverless
  max: 10,              // Limit connection pool size
  connect_timeout: 10,  // 10s connection timeout
})
```

- `prepare: false` — Required when using Neon's connection pooler (pgBouncer mode), which doesn't support prepared statements
- `idle_timeout: 20` — Prevents stale connections in serverless where functions spin down
- `max: 10` — Caps concurrent connections to avoid exhausting Neon's connection limit
- `connect_timeout: 10` — Fails fast instead of hanging indefinitely on connection issues

### 24.3 Files Changed
| File | Change |
|------|--------|
| `src/lib/auth/auth.config.ts` | `prompt: "consent"` → `prompt: "select_account"` |
| `src/db/index.ts` | Added `prepare`, `idle_timeout`, `max`, `connect_timeout` options |

---

## 25. Dashboard Query Parallelization (March 12, 2026)

The dashboard page and layout performed sequential database queries, adding unnecessary latency on every page load.

### 25.1 Dashboard Page (`src/app/dashboard/page.tsx`)

**Before:** `feedbackStats` and `recommendations` were fetched sequentially — each waited for the previous to complete.

**After:** Both queries run in parallel via `Promise.all`:
```typescript
const [feedbackStats, recommendations] = await Promise.all([
  getFeedbackStats(userId),
  getRecommendations(userId),
])
```

### 25.2 Dashboard Layout (`src/app/dashboard/layout.tsx`)

**Before:** `getUserProfile` and `getUserProfileByEmail` were fetched sequentially.

**After:** Both run in parallel via `Promise.all`.

### 25.3 Impact
- Dashboard load time reduced by the duration of the slower query (queries overlap instead of stacking)
- No functional changes — same data, same rendering

### 25.4 Files Changed
| File | Change |
|------|--------|
| `src/app/dashboard/page.tsx` | Parallelized `feedbackStats` + `recommendations` with `Promise.all` |
| `src/app/dashboard/layout.tsx` | Parallelized `getUserProfile` + `getUserProfileByEmail` with `Promise.all` |

---

## 26. Auth Flow Rewrite & 500 Error Fix (March 13, 2026)

A complete rewrite of the authentication flow to fix a persistent sign-in spinner and 500 Internal Server Error.

### 26.1 Problem

Three cascading issues prevented sign-in from working:

1. **Server action + NextAuth v5 incompatibility:** Using `signIn()` from `next-auth` inside a server action caused `NEXT_REDIRECT` exceptions to propagate as uncaught errors — the sign-in button spinner would spin forever.
2. **`authorize()` throwing errors:** The credentials provider's `authorize()` function threw `new Error()` on invalid credentials. In NextAuth v5's API route handler, thrown errors become 500 Internal Server Errors instead of graceful auth failures.
3. **Missing `trustHost: true`:** Without this flag, NextAuth v5 on Vercel rejects requests because it can't verify the host header — causing silent auth failures.

### 26.2 Solution: Client-Side SignIn

Replaced the server action approach with client-side `signIn` from `next-auth/react`:

**Login page (`src/app/(auth)/login/page.tsx`):**
- Converted to `'use client'` component
- Credentials: `signIn('credentials', { email, password, redirect: false })` → check `result?.ok` → `router.push('/dashboard')`
- Google: `signIn('google', { callbackUrl: '/dashboard' })`
- Error handling via `result?.error` — displays user-friendly message

**Signup page (`src/app/(auth)/signup/page.tsx`):**
- Uses `signUpAction` server action for account creation only (Zod validation + `createUser()`)
- After successful creation: client-side `signIn('credentials', ...)` for authentication
- Google: `signIn('google', { callbackUrl: '/dashboard' })`

**Server actions (`src/lib/actions/auth.actions.ts`):**
- Stripped down to only `signUpAction` — returns `{ success: true }` or `{ error: string }`
- Removed `signInAction` and `signInWithGoogleAction` (no longer needed)

### 26.3 Solution: authorize() Returns Null

In `src/lib/auth/auth.config.ts`, all `throw new Error(...)` calls in `authorize()` were replaced with `return null`:

```typescript
// Before (caused 500 errors):
if (!credentials?.email || !credentials?.password) {
  throw new Error('Missing credentials')
}

// After (NextAuth treats null as "invalid credentials"):
if (!credentials?.email || !credentials?.password) {
  return null
}
```

NextAuth v5 treats `null` from `authorize()` as "credentials rejected" and returns a proper error response instead of a 500.

### 26.4 Solution: trustHost Configuration

Added `trustHost: true` to the NextAuth configuration. Required for Vercel deployments where the host header comes from the CDN/proxy layer.

### 26.5 JWT Callback Optimization

The JWT callback previously called `getUserById()` on **every token refresh** (every authenticated request). Now it only populates the token on initial sign-in (when `user` object exists), avoiding unnecessary DB queries:

```typescript
async jwt({ token, user }) {
  if (user) {
    token.id = user.id
    token.role = user.role
    token.name = user.name
    token.email = user.email
  }
  return token
}
```

### 26.6 Architecture Change

**Before:**
```
Login Page → Server Action (signInAction) → NextAuth signIn() → NEXT_REDIRECT → 500 error
```

**After:**
```
Login Page → Client-side signIn('credentials', {redirect: false}) → NextAuth API route → JSON response → router.push()
```

The key insight: NextAuth v5's `signIn()` is designed for API route usage (returns JSON). Calling it from server actions causes `redirect()` exceptions that can't be properly caught.

### 26.7 Files Changed
| File | Change |
|------|--------|
| `src/app/(auth)/login/page.tsx` | Full rewrite: server action → client-side `signIn` from `next-auth/react` |
| `src/app/(auth)/signup/page.tsx` | Hybrid: server action for creation + client-side `signIn` for auth |
| `src/lib/actions/auth.actions.ts` | Stripped to `signUpAction` only; removed `signInAction`, `signInWithGoogleAction` |
| `src/lib/auth/auth.config.ts` | `authorize()` returns `null` instead of throwing; added `trustHost: true`; JWT callback only populates on initial sign-in |

---

---

## 37. Social Listening Charts, Data Fixes & Schema Drift Audit (March 21, 2026)

### 37.1 Social Listening Charts

Three analytics charts added to `SocialPageClient.tsx`:

| Chart | Recharts Component | dataKey / data source |
|-------|-------------------|-----------------------|
| **Mentions Over Time** | `AreaChart` | `{ date, count }` — posts grouped by day (last 30 days) |
| **Sentiment Trend** | `LineChart` | `{ date, score }` — daily avg sentiment (last 30 days) |
| **Platform Breakdown** | `BarChart` (horizontal) | `{ platform, mentions }` — total posts per platform |

All charts:
- Wrapped in `ResponsiveContainer width="100%" height={300}`
- Only rendered when `data.overview !== null`
- Colors from `PLATFORM_COLORS` map (10 platforms: twitter, instagram, tiktok, meta, google, amazon, flipkart, reddit, youtube, linkedin)

**Commit:** `cfcdc1e`

### 37.2 Platform Breakdown Chart UX Improvements

| Change | Detail |
|--------|--------|
| `dataKey` | `"value"` → `"mentions"` — Recharts tooltip shows key name, so "mentions" is meaningful |
| Custom `CustomTooltip` | Bold platform name + "Mentions: N" label in a `bg-background border rounded` container |
| Y-axis tick style | `tick={{ fontWeight: 600 }}` — bold platform labels |
| X-axis label | `<Label value="Mentions" position="insideBottom" offset={-5} />` |

**Commit:** `c4fb520`

### 37.3 Brand User Fallback Fix

**File:** `src/app/dashboard/social/page.tsx`

**Root cause:** All 5 social-listening products had `owner_id = NULL` in the DB. The server component query `WHERE owner_id = userId` returned 0 rows → `productIds = []` → `overview = null` → `{data.overview && ...}` guard hid all charts and stats.

**Fix applied:**

```typescript
// After owned-products query:
if (productIds.length === 0) {
  // Brand has no owned products — fall back to all social-enabled products
  const allSocialProducts = await db.select({ id: products.id })
    .from(products)
    .where(eq(products.socialListeningEnabled, true));
  productIds = allSocialProducts.map(p => p.id);
}
```

**Also fixed (DB):** All 5 social products `UPDATE SET owner_id = 'user_1770175075455_vy7th'` so future owned-products queries return correctly.

**Commit:** `b7630c4`

### 37.4 Fake URL Fix

**Problem:** 376 seed/scraper posts used placeholder format `https://google.com/post/{uuid}` which 404'd when users clicked "View original".

**Fix:**
```sql
UPDATE social_posts SET url = NULL WHERE url LIKE '%/post/%';
-- Rows affected: 376
```

`SocialPageClient.tsx` already renders `{post.url && <a href={post.url}>View original</a>}` so the link auto-hides for null URLs. 83 real API posts (Reddit, YouTube, Google Reviews) retain proper URLs.

### 37.5 Full Schema Drift Audit & Fix

Compared all 40 tables in `src/db/schema.ts` against `information_schema.tables` in Neon PostgreSQL.

**Result: 4 missing tables, 0 missing columns**

| Table | Created columns |
|-------|----------------|
| `product_watchlist` | id, userId, productId, createdAt |
| `consumer_intents` | id, userId, productId, intentType, strength, context, detectedAt, expiresAt, isActioned, actionedAt, createdAt, updatedAt |
| `brand_alert_rules` | id, brandId, alertType, isEnabled, threshold, emailEnabled, slackEnabled, slackWebhookUrl, whatsappEnabled, createdAt, updatedAt |
| `brand_alerts` | id, brandId, productId, alertType, title, message, severity, isRead, readAt, metadata, createdAt |

All applied via `CREATE TABLE IF NOT EXISTS` directly to Neon. Schema drift gap closed; all 40 tables now exist in production.

### 37.6 Mobile Header Layout Fix

**File:** `src/components/dashboard-header.tsx`

Fixed layout on mobile devices — sidebar trigger, logo/title, and action buttons (bell + avatar) now properly flex-align on small screens without overflow or wrapping issues.

**Commit:** `5b7abb0`

### 37.7 Vercel Rebuild

Added comment to `next.config.ts` to trigger a clean Vercel rebuild after all fixes were applied.

**Commit:** `d4b33b4`

### 37.8 Social Data Summary (as of March 21, 2026)

| Platform | Post count | Source |
|----------|-----------|--------|
| YouTube | 100 | Seed |
| Reddit | 75 | Seed + real API |
| Google Reviews | 61 | Seed + real API |
| Instagram | 55 | Seed |
| LinkedIn | 50 | Seed |
| Amazon | 42 | Seed |
| Meta | 40 | Seed |
| Twitter/X | 36 | Seed |
| **Total** | **459** | |

URLs: 376 nulled (seed/scraper), 83 real URLs retained (Reddit + YouTube + Google Reviews).

### 37.9 Commits Summary

| Commit | Description |
|--------|-------------|
| `5b7abb0` | fix: mobile header layout |
| `cfcdc1e` | feat: add time-series mentions, sentiment trend, platform breakdown charts |
| `b7630c4` | fix: brand users with no owned products now see social charts |
| `c4fb520` | feat: improve platform breakdown chart (bold labels, custom tooltip, Mentions axis) |
| `d4b33b4` | chore: trigger Vercel rebuild |

---

## 38. Mobile Search, Welcome Notifications & Notification Pipeline Fix (March 23, 2026)

### 38.1 Mobile Search & Command Palette

**Problem:** The search button in the dashboard header was hidden on mobile (`hidden sm:flex`), and the command palette dialog wasn't optimized for small screens.

**Fixes applied:**

| File | Change |
|------|--------|
| `src/components/dashboard-header.tsx` | Search button always visible: icon-only on mobile, full button on `sm:` screens |
| `src/components/command-palette.tsx` | Mobile-friendly: lower margin (`mt-[10vh] sm:mt-[15vh]`), larger touch targets (`text-base sm:text-sm`), scrollable results (`max-h-[50vh] sm:max-h-[300px]`), `autoFocus` on input |

**Commit:** `e831e8e`

### 38.2 Welcome Email & WhatsApp on Signup

New file: `src/server/welcomeNotifications.ts`

Sends branded welcome notifications when a user signs up (fire-and-forget from `createUser()` in `src/lib/user/userStore.ts`).

| Function | Channel | Template |
|----------|---------|----------|
| `sendWelcomeEmail()` | Resend (email) | Role-specific HTML: Consumer → browse, earn, redeem. Brand → add products, track rankings, surveys. |
| `sendWelcomeWhatsApp()` | Twilio (WhatsApp) | Short text greeting with role-specific CTA |
| `sendWelcomeNotifications()` | Both | Fire-and-forget wrapper; errors are logged not thrown |

Called from `createUser()` after successful DB insert, covering both email/password and OAuth signup paths.

**Commit:** `5ffa900`

### 38.3 Notification Pipeline — Root Cause & Fix

**Problem:** No notifications (brand or consumer) were ever received since launch.

**Root cause:** The cron endpoint `/api/cron/process-notifications` was never added to `vercel.json`. All notifications were queued into the `notificationQueue` table but never processed.

**Fixes:**

| File | Issue | Fix |
|------|-------|-----|
| `vercel.json` | Missing cron entry | Added `process-notifications` (initially `*/5 * * * *`, later changed to `0 6 * * *` for Hobby plan) |
| `src/server/brandAlertService.ts` | `fireAlert()` default channels = `['in_app']` only | Changed to `['in_app', 'email']` |
| `src/server/notificationService.ts` | `queueNotification()` silently returned null for users without profiles | Now allows email channel through even without a profile |
| `src/server/notificationService.ts` | `sendEmail()` required `userProfiles` entry to find email | Added fallback to `users` table |

**Commit:** `5c05349`

### 38.4 Consumer Notifications Service

New file: `src/server/consumerNotifications.ts`

| Function | Trigger | Email Template |
|----------|---------|----------------|
| `notifyPointsEarned()` | After feedback submission (wired in `/api/feedback/submit/route.ts`) | Points earned badge + source activity + product name |
| `notifyNewProductRelevant()` | When new product matches consumer interests | Product card with category + CTA |
| `notifyWatchlistUpdate()` | When watchlisted product gets new feedback | Update summary with CTA |

All functions use `queueNotification()` to insert into the notification queue with HTML email templates.

### 38.5 Build Fix: Products Page Timeout

**Problem:** `/dashboard/products` was being statically generated at build time. The page queries the database, which took >60 seconds during SSG, causing the build to fail after 3 retries.

**Fix:** Added `export const dynamic = 'force-dynamic'` to `src/app/dashboard/products/page.tsx` so it renders on demand at request time.

**Commit:** `d4c7219`

### 38.6 Type Error Fix: awardPoints Argument Order

**Problem:** `awardPoints(userId, 'feedback_submit', POINT_VALUES.feedback_submit)` had swapped arguments — passing a `string` as the `amount` parameter and a `number` as the `source` parameter.

**Fix:** Corrected to `awardPoints(userId, POINT_VALUES.feedback_submit, 'feedback_submit')` — `(userId: string, amount: number, source: string)`.

Also excluded `src/__tests__/` from `tsconfig.json` to prevent missing `@jest/globals` types from failing the build.

**Commit:** `8c95218`

### 38.7 Vercel Hobby Plan Cron Limit

**Problem:** Vercel Hobby plan only supports daily cron jobs. The `*/5 * * * *` schedule (every 5 minutes) silently blocked ALL deployments — Vercel rejected the entire `vercel.json` without triggering a visible deployment failure in the dashboard.

**Fix:** Changed `process-notifications` schedule to `0 6 * * *` (once daily at 6 AM UTC), matching the daily cadence of all other crons.

**Commit:** `1c7d7bf`

### 38.8 Notification Queue Architecture (Updated)

```
User action (signup / feedback / survey / brand alert)
        ↓
queueNotification() → INSERT into notificationQueue table
        ↓                    channels: ['in_app', 'email'] / ['email'] / ['whatsapp']
Vercel Cron (daily 6AM UTC) → /api/cron/process-notifications
        ↓
processPendingNotifications() → SELECT pending WHERE scheduledAt <= NOW()
        ↓
Per notification:
  ├── sendEmail() via Resend (fallback: users table if no profile)
  ├── sendWhatsApp() via Twilio
  └── Mark as sent / failed in notificationQueue
```

### 38.9 Commits Summary (March 23, 2026)

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

## 39. Security Audit & Hardening (March 24, 2026)

Full architecture audit identified 14 fragile areas across security, reliability, data integrity, and build hygiene. 10 were fixed in commit `60ace6d`.

### 39.1 Hardcoded Admin Key Removal

Five admin API routes had `'test123'` as a hardcoded fallback key, and one had `'e4i-admin-2026'`.

| Route | Old Pattern | Fix |
|-------|-------------|-----|
| `/api/admin/apply-migration` | `apiKey !== 'test123' && apiKey !== env` | Require `ADMIN_API_KEY` env only |
| `/api/admin/migrate` | `apiKey !== env && apiKey !== 'test123'` | Require `ADMIN_API_KEY` env only |
| `/api/admin/migrate-data` | `env \|\| 'test123'` fallback | Require `ADMIN_API_KEY` env only |
| `/api/admin/run-data-migration` | `apiKey !== 'test123' && apiKey !== env` | Require `ADMIN_API_KEY` env only |
| `/api/admin/migrate-data-get` | `searchParams.get('key') !== 'test123'` | Switched to `x-api-key` header |
| `/api/admin/analytics` | `env \|\| 'e4i-admin-2026'` | Require env var, reject if unset |

All routes now return 401 if `ADMIN_API_KEY` is not set in environment.

### 39.2 Admin Page Middleware Protection

`middleware.ts` now protects `/admin/*` pages:

```
/admin/* → not logged in? → redirect /login
/admin/* → logged in but role !== 'admin'? → redirect /dashboard
/admin/* → role === 'admin' → allow
```

Previously admin pages were unprotected — any authenticated user could access them.

### 39.3 Auth Header Standardization

The codebase now has two auth patterns (both secure, different use cases):

| Pattern | Header | Used By |
|---------|--------|---------|
| `authenticateAdmin()` | `Authorization: Bearer <key>` or `x-admin-api-key` | Newer admin routes |
| Inline check | `x-api-key` | Migration routes (legacy, one-time use) |
| `checkAuth()` | `x-admin-key` or `?key=` query param | Analytics route |

`src/lib/auth.ts` provides `authenticateAdmin()`, `unauthorizedResponse()`, and `withAdminAuth()` helper.

### 39.4 Build Artifact Cleanup

28 `.txt` build artifact files were removed from git tracking. Added patterns to `.gitignore`:

```
build-*.txt
build*.txt
audit-results.txt
media-check-result.txt
nix-scan-results.txt
broken_components.txt
cookies.txt
prod-cookies*.txt
```

Files remain on disk but are no longer tracked in the repository.

### 39.5 Environment Variables

`.env.example` updated with all 43 environment variables used across the codebase, organized into sections: Database, Auth, Admin/Cron, Email, WhatsApp, OpenAI, Encryption, App URLs, Analytics, Social APIs, Media Processing.

### 39.6 External Cron Setup

Vercel Hobby plan limits cron to daily schedules. `DEPLOY.md` now documents external cron setup (e.g., cron-job.org) for more frequent notification processing:

| Endpoint | Purpose | Recommended |
|----------|---------|-------------|
| `/api/cron/process-notifications` | Send queued notifications | Every 5 min |
| `/api/cron/process-feedback-media` | Process audio/video uploads | Every 15 min |
| `/api/cron/extract-themes` | Extract feedback themes | Every 30 min |

All cron endpoints require `Authorization: Bearer <CRON_SECRET>` header.

### 39.7 Dead File Removal

- `src/app/dashboard/layout.tsx.backup` — deleted (dead backup file)
- `emailNotifications.ts` and `emailService.ts` — still actively imported by `rankingService.ts`, `digestService.ts`, `responseService.ts`, `test-email/route.ts`; left in place

### 39.8 Notification Retry Logic (Verified)

`processPendingNotifications()` in `src/server/notificationService.ts` already implements exponential backoff:

```
Failure → retryCount + 1
Delay = 3^retryCount × 5 minutes (5min, 15min, 45min)
Max retries: 3
After 3 failures → status = 'failed'
```

No changes needed — retry logic was already robust.

### 39.9 Audit Summary

| Category | Issues Found | Fixed | Deferred |
|----------|-------------|-------|-----------|
| Security | 6 | 6 | 0 |
| Reliability | 4 | 1 (external cron docs) | 3 (Hobby plan limits) |
| Data Integrity | 2 | 1 (.env.example) | 1 (email services in use) |
| Build/Deploy | 2 | 2 | 0 |
| **Total** | **14** | **10** | **4** |

### 39.10 Commits (March 24, 2026)

| Commit | Description |
|--------|-------------|
| `c4b37f4` | pre-audit snapshot |
| `60ace6d` | security: remove hardcoded admin keys, protect /admin pages, clean build artifacts |

---

## 40. Deep Security Hardening — Phase 2 (March 24, 2026)

Second deep scan of all 103 API routes identified **22 additional unprotected endpoints** missed by the Phase 1 audit (§39). These were routes that had no auth at all (not just weak auth), making them publicly callable.

### 40.1 Middleware Coverage Gap

`middleware.ts` matcher explicitly excludes `/api` routes:
```
'/((?!api|_next/static|_next/image|favicon.ico).*)'
```
All API route protection must be **inline** — the middleware only guards UI pages.

### 40.2 Deleted Endpoints (8 routes removed)

One-time migration and debug endpoints that should never have remained in production:

| Deleted Route | Risk |
|--------------|------|
| `api/setup-db` | Executed raw `CREATE TABLE` DDL — no auth |
| `api/create-personalization-tables` | Executed raw `CREATE TABLE` DDL — no auth |
| `api/create-google-user` | Created arbitrary brand-role users via query params — no auth |
| `api/migrate-products` | Bulk INSERTs from data/products.json — no auth |
| `api/migrate-all-data` | Had hardcoded `test123` (missed in Phase 1) — ran full data migration |
| `api/generate-rankings` | Used raw `neon()` (bypassed Drizzle), queried products — no auth |
| `api/debug/media-status` | Code comment said "DELETE THIS after debugging" — no auth |
| `api/debug/check-media` | Read feedback + media data — no auth |

### 40.3 Admin Routes Protected (12 routes)

Added `authenticateAdmin()` + `unauthorizedResponse()` from `src/lib/auth.ts` to all unprotected admin API routes:

| Route | Method | Previous State |
|-------|--------|---------------|
| `admin/assign-category` | POST | No auth — wrote to product profiles |
| `admin/assign-categories-bulk` | POST | No auth — bulk wrote to products |
| `admin/campaigns/schedule` | POST | No auth — triggered push notifications to all users |
| `admin/fix-surveys` | POST | No auth — modified survey data |
| `admin/run-send-time-analysis` | POST | No auth — triggered analysis job |
| `admin/migrate-categories` | POST | No auth — ran category migration |
| `admin/test-whatsapp` | POST | No auth — sent WhatsApp to any phone number |
| `admin/test-email` | POST | No auth — sent emails to any address |
| `admin/test-db` | GET | No auth — queried products table |
| `admin/send-time-stats` | GET | No auth — read analytics data |
| `admin/send-time-analytics` | GET | No auth — read comprehensive analytics |
| `admin/check-products` | GET | No auth — read all products with stats |

### 40.4 Rate Limiting Expanded

Phase 1 had rate limiting on only 4 routes. Phase 2 added 3 more and wired up a 4th that was defined but never imported:

| Endpoint | Config | Scope |
|----------|--------|-------|
| Credential login (`auth.config.ts` `authorize`) | 5 req / 60s | Per email |
| `auth/complete-signup` | 3 req / 60s | Per IP |
| `community/posts` POST | 5 req / 60s | Per userId |

`RATE_LIMITS` in `src/lib/rate-limit.ts` now has 6 configs: `feedbackSubmit`, `surveyResponse`, `analyticsEvent`, `authAttempt`, `communityPost`, `signup`.

### 40.5 Error Leakage Fixed

- `health-check/route.ts`: Removed `error.stack` from HTTP response (was exposing full stack traces)
- `create-google-user/route.ts`: Deleted entirely (also had `error.stack`)
- 30+ routes still return `error.message` — acceptable for user-facing errors but worth monitoring

### 40.6 SQL Safety Audit

- All Drizzle `sql` tagged template usages are parameterized (safe)
- `generate-rankings/route.ts` used raw `neon()` with tagged templates (safe but bypassed Drizzle) — now deleted
- No SQL injection vectors found. The risk was **authorization**, not injection.

### 40.7 Current Auth Coverage Summary

| Auth Pattern | Route Count | Description |
|-------------|-------------|-------------|
| `auth()` session | ~60 | User routes, community, feedback, dashboard |
| `authenticateAdmin()` | ~20 | Admin API routes (x-api-key header) |
| `requireRole('brand')` | ~8 | Dashboard feedback-media routes |
| `CRON_SECRET` bearer | ~5 | Cron job routes |
| No auth (deleted) | -8 | Removed in this phase |
| No auth (remaining) | 1 | `health-check` (intentionally public) |

### 40.8 Commit (March 24, 2026)

| Commit | Description |
|--------|-------------|
| `9229abb` | security: protect 12 admin routes, delete 8 unsafe endpoints, add rate limiting |

---

---

## 41. Data Source Consolidation — JSON Store → Database (March 24, 2026)

A risky-pattern audit discovered a critical **dual data source** problem: five files imported product functions from `@/lib/product/store` (a local JSON file at `data/products.json`) instead of `@/db/repositories/productRepository` (the Neon PostgreSQL database). On Vercel, the JSON file is ephemeral — wiped on every deployment — so any data written or read through it was silently lost or stale in production.

### 41.1 Problem: Two Implementations of the Same API

| Function | JSON Store (`@/lib/product/store`) | DB Repository (`@/db/repositories/productRepository`) |
|----------|-----------------------------------|---------------------------------------------------------|
| `getProducts()` / `getAllProducts()` | Reads `data/products.json` from disk | `SELECT * FROM products` via Drizzle ORM |
| `getProductById(id)` | Returns `undefined` if not found | Returns `null` if not found |
| `updateProductProfile(id, updater)` | Reads → mutates → writes entire JSON file | `UPDATE products SET profile = ... WHERE id = ?` |

The JSON store also uses `import 'server-only'` and `fs` — it works on local dev but is a no-op on Vercel's read-only filesystem for writes.

### 41.2 Files Migrated

| File | Old Import | New Import | Impact |
|------|-----------|------------|--------|
| `src/app/top-products/[category]/page.tsx` | `getProductById` from `@/lib/product/store` | `getProductById` from `@/db/repositories/productRepository` | Rankings pages now show real DB products |
| `src/server/rankings/rankingService.ts` | `getProducts` from `@/lib/product/store` | `getAllProducts as getProducts` from `@/db/repositories/productRepository` | Weekly ranking generation uses real data |
| `src/server/rankings/migrationScript.ts` | `getProducts`, `updateProductProfile` from `@/lib/product/store` | Both from `@/db/repositories/productRepository` | Category migration writes to DB |
| `src/app/api/rankings/[category]/trends/route.ts` | `getProducts` from `@/lib/product/store` | `getAllProducts as getProducts` from `@/db/repositories/productRepository` | Trends API reads real data |
| `src/app/api/admin/assign-categories-bulk/route.ts` | `updateProductProfile` from `@/lib/product/store` | `updateProductProfile` from `@/db/repositories/productRepository` | Bulk assign persists to DB |

### 41.3 Additional Cleanups

| File | Change |
|------|--------|
| `src/app/layout.tsx` | Removed dead `SiteFooter` import (imported but never rendered) |
| `src/components/ui/dialog.tsx` | Removed unused `export default DialogModule` |
| `src/components/ui/alert.tsx` | Removed unused `export default AlertModule` |
| `src/components/ui/separator.tsx` | Removed unused `export default Separator` |

### 41.4 Return Type Difference

The JSON store's `getProductById()` returned `Product | undefined`, while the DB version returns `Product | null`. All call sites in the migrated files use truthiness checks (`if (!product)`) which handle both `null` and `undefined` identically — no logic changes needed.

### 41.5 Remaining JSON Store Usage

`@/lib/product/store` still exists and is still imported by `src/app/api/admin/assign-categories-bulk/route.ts`'s sibling `assign-category/route.ts` already used the DB version. The store file itself is not deleted — it may be useful for local seed scripts — but no production code paths reference it anymore.

---

---

## 42. Repository Health Hardening (March 24, 2026)

A comprehensive repository audit covering npm vulnerabilities, unused dependencies, build safety, error boundaries, accessibility, logging gaps, and CI/CD configuration. Fixes applied without breaking any existing functionality.

### 42.1 Build Safety: `ignoreBuildErrors` Disabled

`next.config.ts` had `typescript: { ignoreBuildErrors: true }` — meaning TypeScript errors were **silently swallowed** during `next build`. Combined with no CI pipeline, a breaking type error could deploy to production undetected.

**Fix**: Set `ignoreBuildErrors: false`. Builds now fail on TypeScript errors. The existing `eslint: { ignoreDuringBuilds: true }` is intentionally kept due to a known Next.js 15.x circular structure bug with `next/core-web-vitals` + `next/typescript`.

### 42.2 Unused Dependencies Removed

| Package | Size | Reason for Removal |
|---------|------|-------------------|
| `firebase` (~1MB) | Zero imports anywhere in `src/` | Dead dependency — project uses Neon PostgreSQL via Drizzle, not Firebase |
| `@radix-ui/react-toast` | Project uses `sonner` for toasts | shadcn toast primitive was never adopted |

`@vercel/postgres` was initially suspected unused but is actively imported in `src/db/migrate.ts` and `src/app/api/admin/apply-migration/route.ts` — kept.

### 42.3 Root Error Boundary

Created `src/app/error.tsx` — a `'use client'` component that catches unhandled React errors and renders a "Something went wrong / Try again" UI instead of a blank white page. Logs errors via `console.error('[ErrorBoundary]', error)`.

### 42.4 Accessibility: Skip-to-Content Link

Added a visually-hidden skip-to-content link as the first element inside `<body>` in `src/app/layout.tsx`. It becomes visible on keyboard focus (`focus:not-sr-only`) and links to `#main-content` (added `id="main-content"` to the `<main>` element). This is a WCAG 2.1 Level A requirement (Success Criterion 2.4.1).

### 42.5 Audit Results — No Action Required

| Area | Finding | Status |
|------|---------|--------|
| npm audit | 4 moderate vulns — all in `esbuild` via `drizzle-kit` (dev-only) | Fix requires breaking `drizzle-kit` downgrade — skipped |
| eval-like patterns | Zero `eval()` / `new Function()` / `dangerouslySetInnerHTML` (1 commented-out occurrence) | Clean |
| Root layout bundle | `SiteHeader` is `'use client'` with ~15 lucide icons — loads on every page | Acceptable for now |
| `recharts` (~500KB) | Used in 8 dashboard chart components — only loaded on chart pages, not root layout | Fine |
| CI/CD | No `.github/workflows/` — pushes deploy directly via Vercel with no automated gates | Noted — requires shared infra setup |
| Error tracking | No Sentry/LogRocket — 60+ `console.error()` calls go to Vercel Logs (1hr retention on Hobby) | Noted — requires account setup |
| Logging | Structured `console.error('[Tag]', ...)` pattern consistently used across API routes and services | Acceptable |

### 42.6 Files Changed

- `next.config.ts` — `ignoreBuildErrors: true` → `false`
- `package.json` — removed `firebase`, `@radix-ui/react-toast`
- `src/app/error.tsx` — new file (root error boundary)
- `src/app/layout.tsx` — skip-to-content link + `id="main-content"` on `<main>`

---

## 43. Accessibility Fixes & Cross-Browser Testing Infrastructure (March 24–25, 2026)

Addressed static accessibility audit findings (A1–A6) and established a Playwright-based cross-browser and viewport testing infrastructure.

### 43.1 Accessibility: Vote Button ARIA Labels (A1–A2)

Community vote buttons (`<button>` elements containing only `<ThumbsUp>` / `<ThumbsDown>` icons) had no accessible names. Screen readers announced them as blank buttons.

**Fix** — Added `aria-label` attributes in `src/app/dashboard/community/[postId]/page.tsx`:

| Element | `aria-label` |
|---------|-------------|
| Reply upvote button | `"Upvote reply"` |
| Reply downvote button | `"Downvote reply"` |
| Reply button | `"Reply to comment"` |
| Post upvote button | `"Upvote post"` |
| Post downvote button | `"Downvote post"` |
| Poll option buttons | `"Vote for {option text}"` |
| Cancel reply button | `"Cancel reply"` |

### 43.2 Accessibility: Form Label Binding (A3)

`src/components/feedback-form.tsx` had `<label>` elements not programmatically associated with their inputs — assistive technology could not map labels to controls.

**Fix** — Added `htmlFor`/`id` pairs:
- `<label htmlFor="feedback-rating">` → `<select id="feedback-rating">`
- `<label htmlFor="feedback-text">` → `<textarea id="feedback-text">`

### 43.3 Accessibility: No-Action Items (A4–A6)

| Issue | Severity | Decision |
|-------|----------|----------|
| A4: Homepage heading has no explicit size class | LOW | Heading hierarchy (h1→h2→h3) is correct; Tailwind base styles apply |
| A5: Hardcoded `lang="en"` despite multilingual support | INFO | UI is English-only; multilingual support applies to user-submitted feedback content, not UI. `lang="en"` is correct |
| A6: Color contrast needs runtime check | INFO | Requires browser DevTools / Lighthouse audit — not a static code fix |

### 43.4 Performance Assessment

| Area | Finding | Action |
|------|---------|--------|
| `recharts` dynamic import | All 7 recharts imports are in dedicated route pages (dashboard/surveys/admin) — already code-split by App Router | No change needed |
| `AnalyticsTracker` dynamic import | Attempted `next/dynamic` with `ssr: false` in root layout — blocked by Next.js 15 (`ssr: false` not allowed in Server Components) | Reverted — component is already `'use client'` and tree-shakes correctly |
| `SiteHeader` client bundle | ~15 lucide icons + Radix primitives loaded on every page | Acceptable — returns `null` on `/dashboard/*` routes |

### 43.5 Playwright Cross-Browser Testing Infrastructure

Installed `@playwright/test` v1.58.2 with Chromium browser engine. Created a comprehensive test configuration and smoke test suite.

**Config** — `playwright.config.ts`:
- 6 browser projects: Chromium, Firefox, WebKit, Mobile Chrome (Pixel 5), Mobile Safari (iPhone 12), Microsoft Edge
- Test timeout: 120s (accommodates dev server compilation)
- Navigation timeout: 90s
- Single worker for sequential stability
- `webServer` config with `reuseExistingServer: true` for manual dev server management

**Smoke Tests** — `e2e/smoke.spec.ts` (11 tests, 4 suites):

| Suite | Tests |
|-------|-------|
| Public pages | Homepage loads with hero heading, login page loads, top-products page loads |
| Accessibility basics | `lang` attribute present, skip-to-content link attached, `main#main-content` attached, all images have alt text |
| Viewport responsiveness | Mobile (375px), tablet (768px), desktop (1440px) — h1 visible, no horizontal scroll |
| Navigation | Homepage → login link navigation |

**Results** (Chromium): 10/11 passed. Single failure is first-test cold-start compilation timeout (dev server, not a code bug).

### 43.6 Files Changed

- `src/app/dashboard/community/[postId]/page.tsx` — aria-labels on 7 interactive elements
- `src/components/feedback-form.tsx` — `htmlFor`/`id` label binding
- `playwright.config.ts` — new file (Playwright configuration)
- `e2e/smoke.spec.ts` — new file (11 smoke tests)
- `package.json` — added `@playwright/test` dev dependency

---

## 44. UI/UX Audit & Stability Fixes (March 25, 2026)

Comprehensive 6-part UI audit covering onboarding, profile state, responsiveness, sidebar navigation, toast system, and UX stability. All issues identified were fixed.

### 44.1 Onboarding Step Persistence

**Problem:** Consumer onboarding (4-step flow) stored all form data in React `useState` only. A page reload at any step lost all progress.

**Fix:** Added `sessionStorage`-based draft persistence in `OnboardingClient.tsx`:
- Draft saved automatically on every field/step change via `useEffect` + `useCallback`
- Draft restored on component mount from `sessionStorage`
- Draft cleared on successful onboarding completion
- Consents (checkboxes) intentionally NOT persisted — must be re-acknowledged each session
- Storage key: `e4i_onboarding_draft`

### 44.2 Onboarding Step 3 Overflow Fix

**Problem:** Step 3 card had `style={{ overflow: 'visible' }}` inline on both `<Card>` and `<CardContent>`, plus `overflow-visible` Tailwind class and redundant responsive breakpoint classes — risked horizontal scrollbar on narrow viewports.

**Fix:** Replaced with `className="w-full max-w-4xl"` on Card and removed all `overflow: visible` inline styles.

### 44.3 Sidebar Session Flicker Fix

**Problem:** `DashboardShell` used `useSession()` to get `userRole`. During the loading state (`status === 'loading'`), `userRole` was `undefined`, causing all role-specific menu items to be filtered out. Once session resolved, items popped in — visible layout shift.

**Fix:**
- Now reads `status` from `useSession()` and uses `displayItems` computed via `useMemo`
- While `status === 'loading'`: shows only shared (non-role-specific) items — stable baseline
- Once authenticated: shows full role-filtered list
- `visibleItems` also memoized with `useMemo` keyed on `userRole`

### 44.4 Dashboard Loading Skeleton

**Problem:** No `loading.tsx` existed under `src/app/dashboard/`. Server-rendered pages (e.g., main dashboard with multiple DB queries) showed a blank screen during navigation.

**Fix:** Created `src/app/dashboard/loading.tsx` with `animate-pulse` skeleton layout: title bar, 4 stat cards, and content area placeholder.

### 44.5 Dashboard Error Boundary

**Problem:** Only the root `src/app/error.tsx` existed. All 20+ dashboard pages shared it, providing no contextual recovery.

**Fix:** Created `src/app/dashboard/error.tsx` with "Try again" and "Back to Dashboard" buttons using shadcn `Button` component.

### 44.6 Product Profile Guard

**Problem:** `src/app/dashboard/products/[productId]/profile/page.tsx` passed `product.profile` directly to `ProfileClient`. If `profile` was `undefined` (data corruption), the component would crash accessing `profile.currentStep`.

**Fix:** Added fallback: `product.profile ?? { currentStep: 1, data: {} }`

### 44.7 Alert Polling Visibility Check

**Problem:** Alert count polling in `DashboardShell` ran every 30s regardless of whether the browser tab was visible — wasting network requests.

**Fix:** Added `document.visibilitychange` listener with `useRef` flag. Polling callback skips `fetch` when `document.hidden` is `true`.

### 44.8 Toast System Verification

Audited all toast imports across the codebase — **no issues found**:
- 8 files import `{ toast } from 'sonner'` — all valid
- `<Toaster />` rendered in root `layout.tsx`
- No stale `use-toast`, `useToast`, `@/components/ui/toast`, or `@radix-ui/react-toast` references remain

### 44.9 Files Changed

| File | Change |
|------|--------|
| `src/app/onboarding/OnboardingClient.tsx` | sessionStorage draft persistence, overflow fix |
| `src/app/dashboard/DashboardShell.tsx` | useMemo for menu items, visibility-aware polling, session flicker fix |
| `src/app/dashboard/loading.tsx` | New — skeleton loading UI |
| `src/app/dashboard/error.tsx` | New — scoped error boundary |
| `src/app/dashboard/products/[productId]/profile/page.tsx` | profile fallback guard |

---

## 45. Self-Serve Import System & Analytics Data Flow Verification (March 27, 2026)

Complete self-serve import capability was added for brand users, then traced through the downstream analytics stack to verify exactly where imported rows are consumed.

### 45.1 What Was Added

- New brand dashboard route: `/dashboard/import`
- Guided CSV upload flow with preview, smart column mapping, and final import confirmation
- New `import_jobs` table for operational tracking
- New APIs:
  - `POST /api/import/csv` — preview and import modes
  - `GET /api/import/jobs` — import history
  - `GET /api/import/products` — owned product list for default assignment

### 45.2 Import Flow

```
Brand uploads CSV
  ↓
Preview mode parses headers + sample rows
  ↓
Column mapper auto-detects likely fields
  ↓
Brand confirms mapping or selects default product
  ↓
Import job created (status=processing)
  ↓
Rows validated → deduped → sentiment analyzed → inserted into feedback
  ↓
Import job updated with counts/errors/completion timestamp
```

### 45.3 CSV Mapping & Validation

- Required logical fields: `feedbackText` and either `productId` or `defaultProductId`
- Auto-detection supports common aliases such as `review`, `comment`, `stars`, `sku`, `email`, `customer name`
- CSV constraints: `.csv` only, max 5 MB, max 500 rows
- Default product assignment is available when the source file has no product identifier column
- Ownership check ensures the selected default product belongs to the logged-in brand user

### 45.4 Dedup, Survey Detection, and Persistence

- Dedup uses SHA-256 hash of `productId:feedbackText` within the batch
- Survey export detection supports Google Forms, SurveyMonkey, Typeform, and generic question/answer style CSVs
- Survey-style imports are normalized into a single feedback body using `Q: ... / A: ...` blocks
- Imported rows are stored in the existing `feedback` table with `multimodalMetadata.importSource='csv'` and `importJobId`

### 45.5 Import Jobs Table

`import_jobs` stores importer brand ID, source, original file name, chosen column mapping, status, row counters, error summaries, default product assignment, survey metadata, and completion timestamps.

### 45.6 Verified Downstream Data Flow

Imported rows are first-class `feedback` records, so any subsystem that queries `feedback` by `productId` automatically includes them.

| System | Imported data status | Notes |
|---|---|---|
| Feedback Hub | Direct | Brand dashboard feedback views read `feedback` for owned products |
| Product Deep Dive | Direct | Report pages aggregate feedback alongside surveys, rankings, and community/social context |
| Weekly Rankings | Direct | `fetchAllDirectFeedback()` reads all feedback rows without filtering by import source |
| Feature Insights | Direct | Reads product text from `feedback`, `surveyResponses`, and `socialPosts` |
| Product Health Score | Direct | Uses `feedback`, `surveyResponses`, and `socialPosts` |
| Category Intelligence | Direct | Built from per-product health/sentiment/theme data, which now includes imported feedback |
| Consumer Intelligence | Partial/direct | Imported rows count if they exist in `feedback`; demographic segmentation depends on matching `userProfiles` by email |

### 45.7 Important Nuance: Consumer Intelligence

Consumer Intelligence is not driven by raw social posts. Its main input is product feedback joined to `user_profiles` by email. Imported CSV rows help immediately with product-level counts, average rating, and average sentiment. Demographic and behavioral segment breakdowns only improve when imported rows carry emails that resolve to known `user_profiles` records.

### 45.8 Current Operational Status

- Build verification completed successfully on March 27, 2026 (`npx next build`, exit code `0`)
- TypeScript error checks returned clean for the import files and workspace
- Import system committed and pushed on `main` as `9a67eeb`
- Ranking email branding fix committed earlier as `37ae2e1`
- WhatsApp notification infrastructure exists but Twilio credentials / Meta approval are still not configured

---

*This document reflects the architecture as of March 27, 2026. It should be updated as new systems are added.*
