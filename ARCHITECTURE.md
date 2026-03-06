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
| **Validation** | Zod | Runtime schema validation on API inputs |
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
│  │ 18 tables        │  │ public CDN URLs   │                            │
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

*This document reflects the architecture as of March 2026. It should be updated as new systems are added.*
