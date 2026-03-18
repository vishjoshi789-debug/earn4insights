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
34. [Appendix A — Cost Calculator & Capacity Planning](#appendix-a--cost-calculator--capacity-planning)

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
│  │ 24+ tables       │  │ public CDN URLs   │                            │
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
```

### Key Relationships

```
users
  └── user_profiles        (1:1  — consumer profile + consent)
  └── user_events          (1:N  — behavioral events)
  └── brand_subscriptions  (1:1  — brand tier)
  └── products             (1:N  — brand owns products via ownerId)

products
  └── surveys              (1:N)
  └── feedback             (1:N  — direct feedback)
  └── weekly_rankings      (1:N  — appears in category rankings)
  └── extracted_themes     (1:N  — AI themes per product)
  └── social_posts         (1:N  — scraped social content)

surveys
  └── survey_responses     (1:N)

survey_responses
  └── feedback_media       (1:N  — via ownerType='survey_response')

feedback
  └── feedback_media       (1:N  — via ownerType='feedback')
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
| Category Intelligence | Industry-level social trends | Aggregated |
| Theme Extraction | Social themes merged | Unified themes |
| Consumer Intelligence | Segment social behavior | Behavioral data |

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

*This document reflects the architecture as of March 16, 2026. It should be updated as new systems are added.*
