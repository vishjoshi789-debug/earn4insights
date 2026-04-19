# Earn4Insights — Technical Architecture Document

> **Version:** April 2026 v4 (authoritative — reflects all phases through Deals Discovery + Community Platform + Admin Role Fix + Admin Sidebar Nav)
> **Stack:** Next.js 15 · TypeScript (strict) · Drizzle ORM · Neon PostgreSQL · NextAuth v5 · Pusher · OpenAI · Resend · Twilio · Vercel Blob · Vercel

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Tech Stack Reference](#2-tech-stack-reference)
3. [Architecture Patterns](#3-architecture-patterns)
4. [Database Schema — All Tables](#4-database-schema--all-tables)
5. [Authentication & Role System](#5-authentication--role-system)
6. [Consent System](#6-consent-system)
7. [Encryption & Key Rotation](#7-encryption--key-rotation)
8. [Feedback Pipeline](#8-feedback-pipeline)
9. [Survey Pipeline](#9-survey-pipeline)
10. [Personalization & Signal Engine](#10-personalization--signal-engine)
11. [ICP Scoring System](#11-icp-scoring-system)
12. [Influencers Adda](#12-influencers-adda)
13. [Rankings System](#13-rankings-system)
14. [Notification & Alert System](#14-notification--alert-system)
15. [Social Listening System](#15-social-listening-system)
16. [Community & Rewards Engine](#16-community--rewards-engine)
17. [GDPR & Compliance Layer](#17-gdpr--compliance-layer)
18. [Background Jobs (Cron)](#18-background-jobs-cron)
19. [API Surface Map](#19-api-surface-map)
20. [Security Hardening](#20-security-hardening)
21. [Production & Vercel Notes](#21-production--vercel-notes)
22. [Environment Variables](#22-environment-variables)

---

## 1. System Overview

Earn4Insights is a **three-sided platform**:

- **Brands** publish products, create surveys, collect multimodal feedback, build Ideal Consumer Profiles (ICPs), run influencer marketing campaigns, and receive AI-driven analytics.
- **Consumers** submit feedback (text/audio/video/images), take surveys, earn points/rewards, manage their privacy, and optionally become influencers.
- **Influencers** (consumers with `is_influencer=true`) accept brand campaigns, deliver milestone-based content, and receive escrow payments.

### Core value loops

```
Consumer submits feedback / takes survey
        ↓
AI pipeline: transcription → sentiment → theme extraction
        ↓
Brand sees responses + aggregate trends + extracted themes
        ↓
ICP engine scores consumers → brand alerts fire on high-match engagement
        ↓
Rankings generated weekly (visible publicly at /rankings)
        ↓
Consumers discover ranked products → more feedback
```

```
Brand creates influencer campaign (with optional Review SLA) → invites influencers
        ↓
Influencer accepts → creates content (draft) → submits for review
        ↓
Brand reviews within SLA window (75%/90%/100% reminders via cron)
        ↓
Brand approves → content published → Pusher notifies influencer
        ↓ (or SLA expires + autoApproveEnabled) → auto-approved by system
Campaign performance tracked per post/platform
        ↓
Influencer views earnings dashboard with multi-currency breakdown + audience intelligence
```

---

## 2. Tech Stack Reference

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 15 (App Router, RSC) | All pages use React Server Components by default |
| Language | TypeScript (strict mode) | All type errors must resolve before Vercel builds |
| Database | Neon PostgreSQL (serverless, pgBouncer) | Pooler URL for connections; direct URL for migrations |
| ORM | Drizzle ORM | All application queries — never raw SQL in app code |
| DDL | `postgres` v3 (raw driver) | `pgClient.unsafe()` for DDL migrations only |
| Auth | NextAuth v5 (`@/lib/auth/auth.config`) | JWT sessions; Google OAuth + credentials |
| Styling | Tailwind CSS + shadcn/ui (Radix) | Custom Slider, Accordion, Dialog built from scratch |
| Email | Resend | Transactional emails |
| SMS/WhatsApp | Twilio | OTP, WhatsApp notifications |
| AI | OpenAI GPT-4o via Genkit | Sentiment, theme extraction, send-time optimization |
| File storage | Vercel Blob | Audio, video, image feedback |
| Hosting | Vercel (Edge + Serverless) | 60s function timeout on Pro plan |
| Dev port | `9002` (`npm run dev`) | |
| AI SDK | Genkit (`@genkit-ai/googleai`) | Flows for AI pipeline steps |
| Real-Time | Pusher (cluster `ap2` — Mumbai) | WebSocket push; private + presence channels |

---

## 3. Architecture Patterns

### Repository → Service → API Route (strict 3-layer)

```
src/db/repositories/        ← DB queries only. No business logic. No auth.
src/server/                 ← Business logic, orchestration, consent gating.
src/app/api/                ← HTTP boundary. Auth check → call service → return JSON.
```

**Rules (never break these):**
- API routes never query the DB directly — they call services or repositories.
- Services never import from `app/` — only repositories and other services.
- Repositories only import from `@/db` (schema + client). No service imports.
- All server-only files start with `import 'server-only'`.

### Auth pattern in API routes

```ts
const session = await auth()
if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
const userId = (session.user as any).id
const role = (session.user as any).role   // 'consumer' | 'brand' | 'admin'
const isInfluencer = (session.user as any).isInfluencer  // boolean
```

### Consent enforcement pattern

Every operation that touches personal data must check consent BEFORE reading/writing:

```ts
// Option A — throws ConsentDeniedError on denied (use in service layer)
await enforceConsent(userId, 'behavioral', 'operation_name')

// Option B — returns { allowed, reason } (use when consent is optional)
const { allowed } = await checkConsent(userId, 'behavioral')
if (!allowed) return null

// Option C — enforce by operation name (looks up required categories automatically)
await enforceConsentByOperation(userId, 'collect_behavioral_signals')
```

### Drizzle vs raw postgres.js

- **All application queries:** use `db` (Drizzle ORM) from `@/db`
- **DDL migrations only:** use `pgClient` (raw postgres.js) from `@/db`
- When running DDL via API: strip `BEGIN`/`COMMIT` — postgres.js blocks transaction control on pooled connections
- All DDL uses `IF NOT EXISTS` for idempotency
- **Never use `fs.readFileSync()` to load `.sql` files in API routes** — Vercel does not bundle them

### Cron auth pattern

```ts
const authHeader = request.headers.get('authorization')
const cronSecret = process.env.CRON_SECRET
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

Middleware excludes `/api` routes entirely — cron routes handle their own auth.

---

## 4. Database Schema — All Tables

### Core tables (original schema)

| Table | Purpose |
|-------|---------|
| `users` | All users — brand, consumer, admin. Has `role`, `is_influencer` flag |
| `userProfiles` | Consumer profile: demographics, interests, psychographic JSONB, social signals |
| `products` | Brand-created products |
| `feedback` | Individual consumer feedback submissions (text + media refs) |
| `surveys` | Brand-created surveys |
| `surveyQuestions` | Questions belonging to a survey |
| `surveyResponses` | Consumer responses to surveys |
| `surveyAnswers` | Individual answer records per question |
| `brandAlertRules` | Rules that trigger alerts (has `icpId` FK + `minMatchScore`) |
| `brandAlerts` | Fired alert records (has `matchScoreSnapshot` JSONB) |
| `notifications` | Queued notifications across all channels |
| `analyticsEvents` | Raw platform event log |
| `rankings` | Weekly product rankings |
| `subscriptionTiers` | Brand subscription tier definitions |
| `rewardTransactions` | Consumer reward point transactions |
| `communityPosts` | Community discussion posts |
| `communityComments` | Comments on community posts |
| `communityReactions` | Reactions on posts/comments |
| `socialListeningData` | Ingested social media mentions |
| `feedbackMedia` | Media attachments for feedback |

### Hyper-personalization tables (migration 002 — April 2026)

| Table | Purpose |
|-------|---------|
| `consent_records` | Per-category consent rows. One per (user, dataCategory). GDPR Art. 7 proof. |
| `consumer_signal_snapshots` | Append-only time-series of signal snapshots per category. Never overwrites. |
| `consumer_sensitive_attributes` | AES-256-GCM encrypted GDPR Art. 9 sensitive data (religion, caste, dietary, health). Soft-deletable. |
| `brand_icps` | ICP definitions with weighted criteria (weights must sum to 100). |
| `icp_match_scores` | Cached match scores (UNIQUE per icpId+consumerId). `isStale` triggers recomputation. |
| `consumer_social_connections` | Connected social accounts with encrypted OAuth tokens. |

**Modified existing tables (migration 002):**

| Table | Added columns |
|-------|--------------|
| `userProfiles` | `psychographic` JSONB, `socialSignals` JSONB, `signalVersion`, `lastSignalComputedAt` |
| `brandAlertRules` | `icpId` (UUID → brand_icps), `minMatchScore` (int, default 60) |
| `brandAlerts` | `matchScoreSnapshot` JSONB |

### Influencers Adda tables (migration 004 — April 2026)

| Table | Purpose |
|-------|---------|
| `influencer_profiles` | Influencer public profiles (niche, handles, rates, verification status) |
| `influencer_social_stats` | Per-platform follower/engagement metrics (UNIQUE per influencer+platform) |
| `influencer_content_posts` | Content posts with media, cross-posting, campaign links |
| `influencer_campaigns` | Campaign briefs, budgets, deliverables, status lifecycle |
| `campaign_influencers` | Junction: campaigns ↔ influencers with invitation/acceptance status |
| `campaign_milestones` | Milestone-based deliverables with payment amounts |
| `campaign_payments` | Payment records with Razorpay integration + escrow tracking |
| `campaign_performance` | Per-post/platform metrics (views, likes, reach, saves, etc.) |
| `influencer_follows` | Consumer → influencer follow relationships |
| `influencer_reviews` | Post-campaign reviews (1–5 stars, UNIQUE per reviewer+campaign) |
| `campaign_disputes` | Dispute filing and admin resolution |

**Modified (migration 004):**
- `users`: added `is_influencer` (boolean, default false)

### Real-Time Connection Layer tables (migration 005 — April 2026)

| Table | Purpose |
|-------|---------|
| `realtime_events` | Immutable audit log of all platform events. Written before any dispatch. |
| `notification_inbox` | Per-user notifications. 90-day TTL (`expiresAt`). Indexes on `(userId, isRead)` + `(expiresAt)`. |
| `notification_preferences` | Per-user, per-event-type toggles: `inAppEnabled`, `emailEnabled`, `smsEnabled`. UNIQUE(userId, eventType). |
| `activity_feed_items` | Live activity stream per user. 90-day retention. Index on `(userId, createdAt DESC)`. |
| `social_mentions` | External social mentions ingested via webhook or YouTube polling cron. |
| `social_listening_rules` | Brand keyword + platform monitoring rules. `textMatchesRule()` for keyword matching. |

**Modified (migration 005):**
- `userProfiles`: added `lastActiveAt TIMESTAMP` — stamped on every Pusher presence channel auth

### Deals + Community tables (migration 009 — April 2026)

| Table | Purpose |
|-------|---------|
| `deals` | Brand deals/offers. Types: `promo_code`, `redirect`, `percentage_off`, `fixed_off`, `bogo`, `free_shipping`. Full-text search via tsvector trigger. |
| `community_deals_posts` | Reddit-style community posts. Types: `deal`, `review`, `discussion`, `alert`. Approval-gated. |
| `community_deals_post_votes` | Per-user upvote/downvote on posts. UNIQUE `(post_id, user_id)`. |
| `community_deals_post_saves` | Consumer bookmarked posts. UNIQUE `(post_id, user_id)`. |
| `community_deals_comments` | Threaded comments with `parent_comment_id` self-ref for nesting. |
| `community_deals_comment_votes` | Per-user votes on comments. UNIQUE `(comment_id, user_id)`. |
| `deal_saves` | Consumer saved deals. UNIQUE `(deal_id, user_id)`. |
| `deal_redemptions` | Deal redemption events. Awards 10 pts per redemption. |
| `community_deals_flags` | Spam/fraud flags on posts and comments. Auto-hide at ≥ 5 flags. |

---

## 5. Authentication & Role System

- **NextAuth v5** with JWT sessions
- Providers: Google OAuth + email/password credentials
- Session shape:
  ```ts
  session.user = {
    id: string,
    email: string,
    name: string,
    role: 'brand' | 'consumer' | 'admin',
    isInfluencer: boolean,   // consumers only
  }
  ```
- **Influencer detection:** No separate role. Consumers with `is_influencer=true` get the influencer sub-navigation. This allows seamless conversion without re-auth.
- Middleware (`middleware.ts`) protects `/dashboard`, `/admin`, `/surveys`, `/respond`, `/onboarding`, `/settings`
- `/api` routes excluded from middleware matcher — handle their own auth

### Onboarding guard

After first login, consumers are redirected to `/onboarding` to complete demographics + interests. Brands and admins go directly to `/dashboard` — guard skips for both. Guard implemented in `OnboardingGuard` server component (`src/components/OnboardingGuard.tsx`).

**Admin role caveat:** `UserRole` TypeScript type only includes `'brand' | 'consumer'`. At runtime the DB stores `'admin'`. The guard casts: `(session.user.role as string) === 'admin'` to bypass TypeScript's union narrowing.

### Admin sidebar nav

Admin users see 7 role-specific nav items pointing to `/admin/*` pages (Platform Analytics, Payout Queue, Community Deals, Campaign Schedule, Campaign Analytics, Send-Time Optimizer, Send-Time Analytics) plus 8 shared tabs. Consumer and brand nav items are hidden. Implemented via `MenuItem.role: 'admin'` in `DashboardShell.tsx`.

---

## 6. Consent System

### Three-tier data category taxonomy

**Tier 1 — Platform Essentials**
- `tracking` — on-platform event tracking
- `personalization` — personalised recommendations
- `analytics` — usage pattern analysis
- `marketing` — marketing communications

**Tier 2 — Insight Signals**
- `behavioral` — engagement scores, category interests, feedback patterns
- `demographic` — age, gender, location, education (from onboarding)
- `psychographic` — values, lifestyle, personality, aspirations
- `social` — connected social account signals

**Tier 3 — Sensitive (GDPR Art. 9 / DPDP "sensitive personal data")**
- `sensitive_health` — health interests
- `sensitive_dietary` — dietary preferences and allergies
- `sensitive_religion` — faith and religious practices
- `sensitive_caste` — caste/community (India-specific)

### Key design decisions

1. **Granular, independently revocable** — one `consent_records` row per (user, category)
2. **Consent proof stored** — IP, user-agent, policy version, timestamp at grant time (GDPR Art. 7)
3. **Sensitive categories force `legalBasis='explicit_consent'`** regardless of caller
4. **Revocation cascades** — revoking `sensitive_*` immediately soft-deletes that `consumer_sensitive_attributes` row
5. **Legacy fallback** — `hasConsent()` falls back to old JSONB blob for pre-migration users

### Consent enforcement map (`src/lib/consent-enforcement.ts`)

`CONSENT_REQUIREMENTS` maps 13 operation names → required categories:
```
'collect_behavioral_signals'      → ['behavioral']
'collect_demographic_signals'     → ['demographic']
'collect_psychographic_signals'   → ['psychographic']
'collect_social_signals'          → ['social']
'collect_sensitive_health'        → ['sensitive_health']
'collect_sensitive_dietary'       → ['sensitive_dietary']
'collect_sensitive_religion'      → ['sensitive_religion']
'collect_sensitive_caste'         → ['sensitive_caste']
'compute_icp_match_score'         → ['behavioral', 'personalization']
'send_personalized_notification'  → ['personalization']
'connect_social_account'          → ['social']
'export_personal_data'            → ['analytics']
'anonymize_expired_consents'      → []   // system operation, no consent needed
```

`isSensitiveCategory(category)` — single source of truth for GDPR Art. 9 handling.

---

## 7. Encryption & Key Rotation

Two encryption systems coexist in `src/lib/encryption.ts`:

### Legacy encryption (userProfiles.sensitiveData)
```ts
encryptSensitiveData(data)     // AES-256-GCM, single key from ENCRYPTION_KEY env
decryptSensitiveData(value)
isEncrypted(value)             // base64 roundtrip + structural length validation
```

### Versioned encryption (sensitive attributes + social OAuth tokens)
```ts
encryptForStorage(data)        // returns { encryptedValue, encryptionKeyId }
decryptFromStorage(value, keyId)
reEncryptWithNewKey(value, oldKeyId, newKeyId)
getCurrentKeyId()              // reads CURRENT_ENCRYPTION_KEY_ID env var
```

Keys are identified by version ID (e.g., `v1`, `v2`). Each row stores which key encrypted it.

**Key derivation:** `deriveKeyFast()` uses SHA-256(salt ‖ keyMaterial) — avoids scrypt CPU overhead.

**Rotation procedure:**
1. Add `ENCRYPTION_KEY_v2` to env, set `CURRENT_ENCRYPTION_KEY_ID=v2`
2. New writes use v2; old v1 rows still decrypt
3. Run `rotateAttributeKey()` on each old row
4. Once all rows on v2, remove `ENCRYPTION_KEY_v1`

---

## 8. Feedback Pipeline

```
Consumer submits feedback (text / audio / video / image)
        ↓
POST /api/feedback
        ↓
If media: upload to Vercel Blob → store ref in feedbackMedia
        ↓
Cron: /api/cron/process-feedback-media (00:00 UTC daily)
  → transcribe audio/video (OpenAI Whisper)
  → normalize language (GPT-4o)
  → extract sentiment (GPT-4o)
  → extract themes (GPT-4o) ← weekly: /api/cron/extract-themes (Sundays 02:00 UTC)
        ↓
Brand sees: individual responses + aggregate stats + extracted themes
        ↓
Alert rules fire if matching criteria met
```

**Multimodal support:**
- Audio: `.mp3`, `.wav`, `.m4a` — transcribed via Whisper
- Video: frame extraction + audio transcription
- Images: GPT-4o vision analysis
- Text: direct sentiment analysis

**Multilingual support:**
- Language detected on submission
- GPT-4o normalizes to English for analysis
- Original text preserved alongside normalized version

---

## 9. Survey Pipeline

```
Brand creates survey → adds questions (multiple-choice, rating, NPS, open-text)
        ↓
Consumer sees matched surveys in dashboard
        ↓
Consumer completes survey → POST /api/surveys/[id]/respond
        ↓
Points credited → rewardTransactions row created
        ↓
Brand sees: response rate, individual answers, NPS score, aggregate charts
```

**Survey types:**
- Standard surveys (1–N questions)
- NPS surveys (0–10 scale + optional comment)
- Product feedback surveys (linked to specific product)

---

## 10. Personalization & Signal Engine

### Signal categories and sources

| Category | Source | Computed by |
|----------|--------|------------|
| `behavioral` | Survey completions, feedback frequency, engagement scores | `collectBehavioralSignals()` |
| `demographic` | Onboarding form answers | `collectDemographicSignals()` |
| `psychographic` | Interest survey responses, preference patterns | `collectPsychographicSignals()` |
| `social` | Connected social platform activity | `collectSocialSignals()` |

### Signal collection flow

```
Cron: /api/cron/update-consumer-signals (02:30 UTC daily)
        ↓
runUpdateConsumerSignals() in src/server/updateConsumerSignals.ts
        ↓
For each user (batched, SIGNAL_CRON_BATCH_SIZE):
  1. enforceConsentByOperation() for each category
  2. collectBehavioralSignals() → save snapshot
  3. collectDemographicSignals() → save snapshot
  4. collectPsychographicSignals() → save snapshot
  5. collectSocialSignals() (if social consent granted)
  6. anonymizeExpiredConsentMetadata() (GDPR Art. 5(1)(e) — nulls IP/UA after 3 years)
        ↓
Purge snapshots older than SIGNAL_RETENTION_DAYS (default 365)
```

### Signal snapshots (append-only)

`consumer_signal_snapshots` never overwrites. Every computation creates a new row. This enables:
- Preference drift analysis over time
- GDPR Art. 15 right-of-access history export
- Debugging ICP score changes

### Personalization output

- `userProfiles.psychographic` JSONB — updated with latest psychographic signals
- `userProfiles.socialSignals` JSONB — aggregated cross-platform signals
- Recommendations API uses latest snapshots to rank products/surveys for each consumer

---

## 11. ICP Scoring System

### ICP definition

A brand creates an ICP (`brand_icps`) with criteria and weights. **Weights must sum to exactly 100** (hard throw at write time — not a warning).

### Scoring algorithm

```
for each criterion in icp.criteria:
  if criterion.requiresConsentCategory:
    if consumer has NOT granted that consent:
      → skip criterion, add to consentGaps[]
      → DO NOT add criterion.weight to totalPossible  ← normalise upward, not downward
      continue

  totalPossible += criterion.weight
  consumerValue = lookup(signalSnapshots, criterionKey)

  if criterionValue is string (ageRange, gender, engagementTier, ...):
    earned = consumerValue in criterion.values ? weight : 0

  if criterionValue is array (interests, values, lifestyle, ...):
    overlap = count(consumerArr intersect criterion.values)
    earned = Math.min(Math.round(weight × overlap/criterion.values.length), weight)

  totalEarned += earned

// Post-loop: if any required criterion scored 0 (non-consent-gap reason) → zero total
matchScore = round((totalEarned / totalPossible) × 100)  // 0–100
```

**Key design:** Unconsented criteria excluded from `totalPossible`. Consumer not penalised for withholding sensitive data.

### Criterion key mapping

| Key | Source |
|-----|--------|
| `ageRange`, `gender`, `country`, `city`, `profession`, `education` | demographic snapshot |
| `engagementTier`, `feedbackFrequency`, `sentimentBias` | behavioral snapshot |
| `interests` / `categoryScores` | behavioral snapshot (overlap ratio) |
| `values`, `lifestyle`, `personality`, `aspirations` | psychographic snapshot |
| `health`, `dietary`, `religion`, `caste` | `consumer_sensitive_attributes` (decrypted on-the-fly) |

### ICP score recomputation

```
Cron: /api/cron/recompute-icp-scores (03:00 UTC daily)
        ↓
For each ICP with stale scores (isStale=true):
  batchScoreConsumersForIcp() — sequential, max ICP_SCORE_CRON_BATCH_SIZE (default 200)
        ↓
If score >= brandAlertRule.minMatchScore AND consumer engaged:
  alertOnIcpMatch() → creates brandAlerts row
        ↓
Dispatch alert via preferred channel (email / WhatsApp / Slack / in-app)
```

**Sequential scoring:** 200 × ~100ms ≈ 20s — safe within Vercel's 60s Pro function limit.

### Brand ICP Builder UI

- `/dashboard/brand/icps` — list + create dialog
- `/dashboard/brand/icps/[icpId]` — weight slider editor (`icp-weight-editor.tsx`), match leaderboard, audience charts, bulk rescore button
- Bulk rescore: `POST /api/brand/icps/[id]/bulk-score` — rate limited, max 200 consumers per call

---

## 12. Influencers Adda

### Campaign lifecycle

```
draft → proposed → negotiating → active → completed
                                      ↘ cancelled
                                      ↘ disputed → active (after resolution)
```

### Payment flow

```
1. Brand creates campaign with budget
2. Brand adds milestones (total must not exceed budget — hard validated)
3. Brand escrows funds for milestone → payment status: 'escrowed'
   Platform fee calculated: Math.round(amount × platformFeePct / 100)
4. Influencer submits deliverable → milestone status: 'submitted'
5. Brand approves → milestone: 'approved', payment: 'released'
   Brand rejects → milestone: 'rejected' (influencer can resubmit)
```

### Key services

| Service | File | Responsibility |
|---------|------|---------------|
| `influencerProfileService` | `src/server/influencerProfileService.ts` | Registration, discovery, public profiles |
| `campaignManagementService` | `src/server/campaignManagementService.ts` | Lifecycle, invitations, status transitions |
| `campaignPaymentService` | `src/server/campaignPaymentService.ts` | Milestone + escrow payment flows |
| `campaignPerformanceService` | `src/server/campaignPerformanceService.ts` | Metrics recording, campaign analytics |
| `disputeResolutionService` | `src/server/disputeResolutionService.ts` | Dispute lifecycle, admin resolution |

### Cron jobs

- `/api/cron/update-campaign-performance` (03:30 UTC) — fetches active campaigns, records analytics
- `/api/cron/sync-social-stats` (04:30 UTC) — validates social stats, counts self-declared vs verified

### Content Approval Flow (migration 006)

SLA-based review workflow added to Influencers Adda:

```
draft → pending_review → approved → published
              ↘ rejected → (edit) → pending_review (resubmit, increments resubmissionCount)
```

| Service | File | Responsibility |
|---------|------|---------------|
| `contentApprovalService` | `src/server/contentApprovalService.ts` | submitForReview, approve, reject, resubmit, processAutoApprovals |

**SLA cron** (`/api/cron/process-content-reviews`, daily 02:00 UTC / externally every 2h):
- 75% elapsed → brand reminder notification
- 90% elapsed → urgent reminder
- 100% + `autoApproveEnabled=true` → system auto-approves
- 100% + `autoApproveEnabled=false` → escalation notification

Duplicate reminders prevented by UNIQUE index on `(post_id, reminder_type)` in `content_review_reminders` + 23505 catch.

All approval/rejection actions audit-logged to `audit_log` table.

Role validation: brand → `isBrandCampaignOwner()` check; admin → bypass.

### Influencer Earnings Dashboard

Full multi-currency earnings dashboard at `/dashboard/influencer/earnings`:
- 3 API routes: `GET /api/influencer/earnings`, `/analytics`, `/[campaignId]`
- 6 components: `EarningsOverviewCards`, `PaymentBreakdown`, `EarningsTable` (CSV export), `AudienceIntelligencePanel` (consent-gated, cohort ≥ 5), `PerformanceCharts`, `CampaignDeepDive`
- Currency utility: `src/lib/currency.ts` — 10 currencies, `formatCurrency()`, `convertToMajor/Minor()`

### @ Mention Tags (Influencer Content)

Content posts support `@mention` tags for categories, brands, products, influencers:
- API: `GET /api/search/mentions?q=` — auth required, 3 results per type (12 max)
- `TagMentionInput` component with 300ms debounce, keyboard nav (↑↓ Enter Esc), colored pills

### Known gaps (future work)

| Item | Notes |
|------|-------|
| Razorpay integration | ✅ DONE — Full payment flow (order, verify, escrow, release, refund, webhooks, payout accounts, admin queue). See Section 12a. |
| Social stats verification | Stats self-declared; platform API verification not wired |
| Campaign marketplace | ✅ DONE — Public browse, filters, apply/withdraw, brand accept/reject, ICP match badge |
| Instagram OAuth | Blocked on Facebook App Review |
| Signal snapshot orphan cleanup | Admin-deleted profiles may leave orphaned snapshots |

---

## 12a. Razorpay Payment Integration

Full escrow payment system for influencer campaigns. 4 new tables (Migration 008): `razorpay_orders`, `payout_accounts`, `influencer_payouts`, `reward_redemptions`.

### Payment State Machine

```
Brand creates Razorpay order (POST /api/payments/create-order)
  → razorpay_orders.status: 'created'

Brand pays via Razorpay checkout → Webhook: payment.captured
  → razorpay_orders.status: 'paid'
  → campaign_payments.status: 'escrowed'
  → Emits: payment.escrowed

Brand approves milestone → POST /api/payments/release/[campaignId]
  → campaign_payments.status: 'released'
  → influencer_payouts.status: 'pending'  (admin manual queue)
  → Emits: payment.released

Admin processes at /admin/payouts:
  POST .../process   → 'processing'
  POST .../complete  → 'completed' + transfer reference
  POST .../fail      → 'failed'    → retry eligible (max 3)
```

### Core Files

| File | Purpose |
|------|---------|
| `src/server/razorpayService.ts` | `createOrder()`, `capturePayment()`, `verifyPayment()`, `verifyWebhookSignature()`, `processRefund()` |
| `src/server/payoutService.ts` | `initiateRecipientPayout()`, `markPayoutProcessing/Completed/Failed()`, `retryFailedPayout()` |
| `src/app/api/payments/create-order/route.ts` | Brand creates escrow order |
| `src/app/api/payments/verify/route.ts` | HMAC verification, escrow recording |
| `src/app/api/payments/release/[campaignId]/route.ts` | Release escrowed payment |
| `src/app/api/payments/refund/[orderId]/route.ts` | Refund paid order |
| `src/app/api/webhooks/razorpay/route.ts` | Razorpay webhook handler (synced await) |
| `src/app/api/payouts/accounts/route.ts` | List/add payout accounts |
| `src/app/api/payouts/accounts/[id]/route.ts` | Delete account |
| `src/app/api/payouts/accounts/[id]/primary/route.ts` | Set primary (transactional) |
| `src/app/api/admin/payouts/pending/route.ts` | Admin payout queue |
| `src/app/api/admin/payouts/[id]/*/route.ts` | Admin process/complete/fail/retry |
| `src/app/api/cron/process-payouts/route.ts` | Daily: create missing payouts, retry failed |
| `src/app/api/cron/sync-razorpay-status/route.ts` | Daily: sync RazorpayX status (placeholder) |
| `src/db/repositories/razorpayRepository.ts` | Order + payout CRUD |
| `src/db/repositories/payoutAccountRepository.ts` | Account CRUD + `setPrimaryAccount()` (transactional) |
| `src/db/repositories/rewardRedemptionRepository.ts` | Redemption CRUD, pending lookup |
| `src/app/dashboard/influencer/payouts/page.tsx` | Influencer payout accounts + history UI |

### Security Properties

- **HMAC verification:** `crypto.timingSafeEqual()` for constant-time comparison — no timing attack
- **Webhook:** awaited synchronously — Vercel serverless is terminated before fire-and-forget completes
- **Decrypt before mask:** `decryptFromStorage()` → plaintext → slice(-4), not ciphertext slice
- **Primary account swap:** `db.transaction()` prevents race condition between unset + set
- **Refund guards:** blocked if already refunded (`status !== 'paid'`) or payment released
- **Payout completion guard:** `markPayoutFailed()` throws if status is already `'completed'`

### RazorpayX Activation

`RAZORPAYX_ENABLED = false` (constant in `payoutService.ts`). When set to `true`:
- INR bank/UPI payouts route through Razorpay Payouts API automatically
- `sync-razorpay-status` cron polls Razorpay for `processing` payout state changes
- International payouts (Wise, PayPal, SWIFT) remain manual

### Environment Variables

```bash
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
NEXT_PUBLIC_RAZORPAY_KEY_ID=   # browser-safe
```

---

## 13. Rankings System

Weekly product rankings computed from:
- Feedback volume and sentiment scores
- Survey NPS scores
- Consumer engagement rate

Rankings visible publicly at `/rankings`. Consumers can discover top-ranked products and submit feedback.

---

## 14. Notification & Alert System

### Real-Time Connection Layer (Pusher WebSocket)

All real-time notifications flow through a central event bus (`src/server/eventBus.ts`).

#### Channel design

| Channel | Type | Purpose |
|---------|------|---------|
| `private-user-{userId}` | Private | Personal notifications + unread count updates |
| `presence-dashboard` | Presence | Active user tracking — powers online indicators |
| `public-product-{productId}` | Public | Product page live activity |

Auth: `POST /api/pusher/auth` — validates NextAuth session; enforces users can only subscribe to their own private channel.

#### 20 Platform Events

| Event | Who triggers | Who receives |
|-------|-------------|-------------|
| `brand.product.launched` | Brand API | ICP-matched consumers (score ≥ 60) |
| `brand.survey.created` | Brand API | ICP-matched consumers (score ≥ 50) |
| `brand.campaign.launched` | Brand API | All active influencers |
| `brand.alert.fired` | Alert service | Brand owner |
| `brand.member.active` | Brand API | ICP-matched consumers (score ≥ 50) — *handler ready; no emitter yet* |
| `brand.discount.created` | Brand API | ICP-matched consumers (score ≥ 50) — *handler ready; no emitter yet* |
| `brand.content.pending_review` | `contentApprovalService` | Campaign brand owner |
| `brand.content.auto_approved` | `contentApprovalService` (cron) | Campaign brand owner |
| `consumer.feedback.submitted` | Feedback API | Product brand |
| `consumer.survey.completed` | Survey API | Survey brand |
| `consumer.product.browsed` | Consumer API | Product brand |
| `consumer.product.searched` | Consumer API | Product brand |
| `consumer.community.posted` | Community API | Product brand |
| `consumer.reward.withdrawn` | Rewards API | Product brand (loyalty signal) |
| `influencer.post.published` | `contentApprovalService.approveContent()` | Campaign brand + ICP-matched consumers (score ≥ 60) |
| `influencer.campaign.accepted` | Influencer API | Brand |
| `influencer.milestone.completed` | Influencer API | Brand |
| `influencer.content.approved` | `contentApprovalService` | Influencer who submitted post |
| `influencer.content.rejected` | `contentApprovalService` | Influencer who submitted post |
| `social.mention.detected` | Webhook / cron | Brand owning entity |

**Note:** `influencer.post.published` was previously (incorrectly) emitted in `POST /api/influencer/content` when creating a draft. Fixed — now only emitted in `contentApprovalService.approveContent()`.

#### Dispatch flow (inbox-first)

```
emit(eventType, payload)
        ↓
1. Write realtime_events (audit)
2. Resolve targets (ICP scores + consent check)
3. For each target:
   a. Check notification_preferences — skip if all channels disabled
   b. Check consent ('personalization') — skip consumers who revoked
   c. Write notification_inbox (source of truth — always written first)
   d. Write activity_feed_items
   e. Pusher push → private-user-{userId} (best-effort, never throws)
   f. Queue email/SMS via existing notificationService
4. Mark realtime_events.processedAt
```

Pusher failure never propagates — notification is always in inbox regardless.

#### Presence tracking

`lastActiveAt` on `userProfiles` stamped (fire-and-forget) on every Pusher presence channel auth. Powers `OnlinePresenceIndicator` component.

### Notification channels (full list)

| Channel | Provider | Trigger |
|---------|----------|---------|
| In-app bell (real-time) | Pusher WebSocket | Instant on event dispatch |
| In-app inbox | `notification_inbox` DB | 90-day history, cursor pagination |
| Email | Resend | emailEnabled preference per event type |
| SMS | Twilio | smsEnabled preference per event type |
| WhatsApp | Twilio | Real-time brand alerts (legacy) |
| Slack | Slack API | Brand workspace notifications (legacy) |

### Send-time optimization

Cron `/api/cron/send-time-analysis` (04:00 UTC) — GPT-4o analyzes per-user engagement patterns to determine optimal send times. Results stored per-user, applied when scheduling notifications.

### Brand alert rules

Brands configure `brandAlertRules` with:
- Trigger conditions (sentiment threshold, keyword match, rating drop)
- `icpId` — optional ICP filter (only alert if consumer matches ICP)
- `minMatchScore` — minimum ICP score required to fire alert
- `matchScoreSnapshot` stored at alert fire time for audit
- `BRAND_ALERT_FIRED` event emitted to event bus after every alert write

---

## 15. Social Listening System

### Real-Time Connection Layer foundation (April 2026)

The Feature 3 social listening foundation uses:

- `social_listening_rules` — brands define keywords + platforms to monitor (CRUD at `GET/POST/PATCH /api/brand/social-listening/rules`)
- `social_mentions` — all ingested mentions stored here with sentiment + relevance scores
- `textMatchesRule()` — keyword matching function in `socialListeningRuleRepository`
- `POST /api/webhooks/social-mention` — HMAC-verified (sha256) webhook for Brand24/Mention.com push. **Rejects with 503 if `SOCIAL_MENTION_WEBHOOK_SECRET` is unset** (never accepts unsigned payloads)
- `GET /api/cron/process-social-mentions` (05:30 UTC) — polls YouTube API for new mentions + notifies brands on all pending `social_mentions` rows

### Legacy social listening (pre-Feature 3)

Monitors external platforms via ingestion services:

| Platform | Status | Notes |
|----------|--------|-------|
| Twitter/X | Active | API v2 search |
| YouTube | Active | Data API v3 — also polled by new cron |
| Google Reviews | Active | Places API |
| Reddit | Active | Public search |
| Instagram | Stub | Basic Display API deprecated; Graph API pending App Review |

AI-powered relevance filter (`src/server/socialRelevanceFilter.ts`) classifies mentions as `relevant`, `noise`, or `competitor`.

---

## 16. Community & Rewards Engine

### Deals Discovery (`/dashboard/deals`)
- Consumer-facing feed of brand deals: promo codes, redirects, percentage/fixed discounts, BOGO, free shipping
- Full-text search via `tsvector` DB trigger on `deals` table (GIN index)
- Filters: category, deal type, featured, verified, text search
- Save deals (`deal_saves`), redeem (`deal_redemptions`) — awards 10 pts per redemption
- Brand manages deals at `/dashboard/brand/deals`: create, publish, pause, analytics

### Community Deals Feed (`/dashboard/community-deals`)
- Reddit-style user-generated posts: `deal | review | discussion | alert`
- Upvote/downvote (UNIQUE per user), threaded comments, save posts
- Flag system: `spam | fake_deal | inappropriate | duplicate | other` — auto-hide at ≥ 5 flags
- Moderation: admin approves/rejects at `/admin/community-deals`; auto-approve cron fires daily
- Posts default to `status: 'pending'` — require approval before public visibility
- Brand-verified badge on posts/comments from brand accounts (`isBrandVerified`)

### Services
- `src/server/dealsService.ts` — deals CRUD, feed, redemption, save
- `src/server/communityService.ts` — posts, comments, votes, saves, flagging
- `src/server/dealsModerationService.ts` — admin approve/reject, auto-moderation, flag resolution

### Repositories
- `src/db/repositories/dealsRepository.ts` — 30+ functions covering deals feed, brand queries, analytics
- `src/db/repositories/communityDealsRepository.ts` — 30+ functions covering posts, comments, votes, flags

### Rewards system
- Points credited for: survey completion, feedback submission, onboarding steps, referrals, deal redemptions (10 pts)
- `rewardTransactions` table tracks every credit/debit with reason
- Points displayed in consumer dashboard
- Payout: Razorpay escrow + RazorpayX (when enabled); manual admin queue otherwise

---

## 17. GDPR & Compliance Layer

### India DPDP Act 2023 + GDPR compliance

| Requirement | Implementation |
|-------------|---------------|
| GDPR Art. 6 — lawful basis | `legalBasis` stored per consent record |
| GDPR Art. 7 — proof of consent | IP, UA, policy version, timestamp stored |
| GDPR Art. 9 — sensitive data | Separate encrypted table; explicit consent required |
| GDPR Art. 15 — right of access | `/api/consumer/my-data` exports full data as JSON |
| GDPR Art. 17 — right to erasure | `DELETE /api/consumer/account` — immediate signal deletion, 30-day grace for sensitive attributes |
| GDPR Art. 5(1)(e) — storage limitation | `anonymizeExpiredConsentMetadata()` nulls IP/UA after 3 years |
| DPDP §6 — notice + consent | Granular consent UI; 12 categories across 3 tiers |

### Erasure flow

```
DELETE /api/consumer/account { confirm: true }
        ↓
1. Soft-delete account → 30-day grace period
2. Signal snapshots deleted immediately
3. Social connections revoked
4. Consent records anonymized
        ↓
Cron: /api/jobs/process-deletions (02:00 UTC)
  → Hard-delete accounts after 30-day grace period
        ↓
Cron: /api/cron/physical-delete-sensitive-attributes (01:00 UTC)
  → Physical-delete soft-deleted sensitive attributes older than 30 days
```

### Min cohort size

Analytics endpoints enforce a minimum cohort size of 5 consumers. Prevents re-identification attacks where a brand could narrow down individuals by querying small segments.

---

## 18. Background Jobs (Cron)

All cron routes authenticated via `Authorization: Bearer CRON_SECRET`.
Middleware excludes `/api` routes — cron routes handle their own auth.

| Time (UTC) | Route | Purpose |
|------------|-------|---------|
| 00:00 | `/api/cron/process-feedback-media` | Process pending feedback media (transcription, sentiment) |
| 01:00 | `/api/cron/physical-delete-sensitive-attributes` | Physical-delete soft-deleted sensitive attributes >30 days (GDPR Art. 17) |
| 01:30 | `/api/cron/cleanup-feedback-media` | Clean up expired / orphaned media blobs |
| 02:00 | `/api/jobs/process-deletions` | Hard-delete user accounts after 30-day grace period |
| 02:00 | `/api/cron/extract-themes` | Extract themes from feedback (Sundays only — `0 2 * * 0`) |
| 02:30 | `/api/cron/update-consumer-signals` | Batch signal collection for all users |
| 03:00 | `/api/cron/recompute-icp-scores` | Recompute stale ICP match scores + fire alerts |
| 03:00 | `/api/cron/update-behavioral` | Update behavioral signals |
| 03:30 | `/api/cron/update-campaign-performance` | Record campaign performance metrics |
| 04:00 | `/api/cron/send-time-analysis` | Analyse optimal send times per user |
| 04:30 | `/api/cron/sync-social-stats` | Validate influencer social stats |
| 05:00 | `/api/cron/cleanup-analytics-events` | Purge old analytics events |
| 00:30 | `/api/cron/cleanup-notifications` | Purge expired notification_inbox rows + old activity_feed_items (90-day TTL) |
| 05:30 | `/api/cron/process-social-mentions` | Poll YouTube for new mentions + notify brands on pending social_mentions |
| 06:00 | `/api/cron/process-notifications` | Process queued notifications |
| 06:00 | `/api/cron/process-payouts` | Find released payments with no payout → create; retry failed payouts (max 3, 1h cool-down) |
| 07:00 | `/api/cron/sync-razorpay-status` | Sync RazorpayX payout status for processing payouts (placeholder, activates with RAZORPAYX_ENABLED) |
| 02:00 | `/api/cron/process-content-reviews` | SLA reminders (75%/90%) + auto-approve or escalate at 100% SLA. Externally triggered every 2h via cron-job.org |
| 04:00 | `/api/cron/community-deals-moderation` | Auto-approve pending community posts past time window; auto-hide posts with ≥ 5 flags |
| 05:00 | `/api/cron/deals-expiry` | Mark active deals with `valid_until < NOW()` as `expired` |

**vercel.json** defines all **20 cron entries** with exact schedules.

---

## 19. API Surface Map

### Consumer APIs (`/api/consumer/`)

| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST/DELETE | `/consent` | Manage consent per category |
| GET | `/signals` | Paginated signal snapshot history (consent-gated) |
| GET | `/my-data` | GDPR Art. 15 full data export as JSON |
| DELETE | `/account` | GDPR Art. 17 account erasure (`{ confirm: true }` required) |
| GET | `/social/connections` | List active social connections |
| POST | `/social/connect` | Store encrypted OAuth token |
| DELETE | `/social/disconnect` | Revoke social connection |
| GET | `/social/callback` | OAuth redirect handler (LinkedIn) |
| GET/POST/DELETE | `/follows/[influencerId]` | Follow / unfollow influencer |

### Brand APIs (`/api/brand/`)

| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/icps` | List / create ICPs |
| GET/PATCH/DELETE | `/icps/[icpId]` | Manage single ICP |
| GET/POST | `/icps/[icpId]/matches` | Cached matches / on-demand score |
| POST | `/icps/[icpId]/bulk-score` | Batch score 200 consumers (rate limited) |
| GET/POST | `/campaigns` | List / create influencer campaigns |
| GET/PATCH/DELETE | `/campaigns/[id]` | Manage campaign |
| GET/POST/DELETE | `/campaigns/[id]/influencers` | Manage campaign influencers |
| GET/POST | `/campaigns/[id]/milestones` | Manage milestones |
| PATCH/DELETE | `/campaigns/[id]/milestones/[mid]` | Approve / reject / escrow / delete milestone |
| GET | `/campaigns/[id]/payments` | Payment summary |
| GET/POST | `/campaigns/[id]/performance` | Analytics / record metrics |
| GET/POST | `/campaigns/[id]/disputes` | File / view disputes |

### Influencer APIs (`/api/influencer/`)

| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST/PATCH | `/profile` | Own profile CRUD |
| GET | `/discover` | Search / browse influencers |
| GET/POST | `/social-stats` | Platform stats |
| GET/POST | `/content` | Content posts (draft creation) |
| GET/PATCH/DELETE | `/content/[postId]` | Single post |
| POST | `/posts/[id]/submit-review` | Submit draft for brand review |
| POST | `/posts/[id]/resubmit` | Resubmit rejected post with edits |
| GET | `/earnings` | Earnings summary (multi-currency) |
| GET | `/earnings/analytics` | Audience analytics (consent-gated, cohort ≥ 5) |
| GET | `/earnings/[campaignId]` | Per-campaign deep-dive |
| GET | `/campaigns` | Influencer's campaign list |
| GET/PATCH | `/campaigns/[id]` | Campaign detail + accept/reject/submit |

### Analytics APIs

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/analytics/icp-audience` | Aggregate audience stats (min cohort 5) |

### Deals APIs (`/api/deals/` + `/api/community-deals/`)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/deals/feed` | Consumer deals feed (filters: category, type, featured, search) |
| GET | `/api/deals/[id]` | Single deal detail |
| POST | `/api/deals/[id]/redeem` | Record redemption + award points |
| POST | `/api/deals/[id]/save` | Save/unsave deal |
| GET | `/api/deals/saved` | Consumer's saved deals |
| GET | `/api/deals/redemptions` | Consumer's redemption history |
| GET | `/api/deals/search` | Full-text tsvector search |
| GET/POST | `/api/brand/deals` | Brand: list own deals / create deal |
| GET/PATCH/DELETE | `/api/brand/deals/[id]` | Brand: manage deal |
| POST | `/api/brand/deals/[id]/publish` | Publish draft deal |
| POST | `/api/brand/deals/[id]/pause` | Pause active deal |
| GET | `/api/brand/deals/[id]/analytics` | Deal view/save/redemption analytics |
| GET | `/api/brand/community-deals` | Brand: own community posts |
| GET/POST | `/api/community-deals/posts` | Feed (paginated) / create post |
| GET | `/api/community-deals/posts/[id]` | Single post with comments |
| POST | `/api/community-deals/posts/[id]/vote` | Upvote/downvote post |
| POST | `/api/community-deals/posts/[id]/save` | Save/unsave post |
| POST | `/api/community-deals/posts/[id]/flag` | Flag post |
| GET/POST | `/api/community-deals/posts/[id]/comments` | List / add comment |
| POST | `/api/community-deals/posts/[id]/comments/[commentId]/vote` | Vote on comment |
| GET | `/api/community-deals/saved` | Consumer's saved posts |

### Admin APIs (`/api/admin/`)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/run-migration-002` | Apply hyper-personalization schema |
| POST | `/migrate-consent-records` | Backfill legacy JSONB consent |
| POST | `/run-migration-003` | FK constraints + partial UNIQUE index |
| POST | `/run-migration-004` | Influencers Adda schema |
| POST | `/run-migration-005` | Real-Time Connection Layer schema (6 tables + userProfiles.lastActiveAt) |
| POST | `/run-migration-006` | Content Approval (2 ALTERs + content_review_reminders table) |
| POST | `/run-migration-007` | Campaign Marketplace (3 ALTERs + campaign_applications) |
| POST | `/run-migration-008` | Razorpay Payment (4 tables) |
| POST | `/run-migration-009` | Deals + Community (9 tables) |
| GET | `/content/pending` | All pending posts (admin view) |
| POST | `/content/[id]/approve` | Admin approve (bypasses brand ownership check) |
| POST | `/content/[id]/reject` | Admin reject with reason (min 10 chars) |
| GET | `/community-deals/pending` | Pending community posts queue |
| GET | `/community-deals/flagged` | Flagged posts/comments queue |
| POST | `/community-deals/moderate` | Approve/reject/remove community post |

All admin routes require `x-api-key: <ADMIN_API_KEY>` header.

### Brand Content Review APIs (`/api/brand/content/`)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/pending` | Brand's pending posts with computed SLA status |
| POST | `/[id]/approve` | Approve post (ownership-checked) |
| POST | `/[id]/reject` | Reject with reason (min 10 chars, ownership-checked) |

### Search APIs

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/search/mentions?q=` | @ mention search: categories, brands, products, influencers. Auth required. Max 3 per type |

### Notification APIs (`/api/notifications/`)

| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/inbox` | Paginated inbox / mark-all-read |
| PATCH/DELETE | `/inbox/[id]` | Mark single item read/unread / dismiss |
| POST | `/mark-all-read` | Mark all notifications read |
| GET/POST | `/preferences` | Per-event-type preference toggles |

### Activity Feed API

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/activity-feed` | Cursor-paginated activity feed |

### Pusher API

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/pusher/auth` | Authorize private + presence channel subscriptions |

### Social Listening APIs

| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST/PATCH | `/api/brand/social-listening/rules` | Brand keyword monitoring rules |
| POST | `/api/webhooks/social-mention` | HMAC-verified inbound mention webhook |

### Public campaign APIs

| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/campaigns/[id]/reviews` | Campaign reviews |
| GET/POST/PATCH | `/api/campaigns/[id]/disputes` | Disputes (influencer + admin) |

---

## 20. Security Hardening

8 issues found and fixed (April 2026 Opus security review):

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 1 | HIGH | No FK constraints on 6 new hyper-personalization tables | Migration 003: FK constraints with `ON DELETE CASCADE` |
| 2 | HIGH | Hardcoded dev fallback encryption key | Throw in ALL environments; key generation command in error |
| 3 | HIGH | IP/UA retained forever on revoked consents — GDPR Art. 5(1)(e) violation | `anonymizeExpiredConsentMetadata()` nulls IP/UA after 3 years |
| 4 | MEDIUM | `required` boolean on ICP criteria never enforced | Post-loop: if any required criterion scored 0, total score is zeroed |
| 5 | MEDIUM | Rounding drift: `Math.round(weight × ratio)` could produce `earned > weight` | All overlap paths use `Math.min(Math.round(weight × ratio), weight)` |
| 6 | MEDIUM | Table-level UNIQUE on `consumer_sensitive_attributes` blocked re-insert after soft-delete | Partial unique index `WHERE deleted_at IS NULL` (migration 003) |
| 7 | MEDIUM | Versioned encryption used scrypt KDF — unnecessary CPU overhead | Replaced with `deriveKeyFast()` using SHA-256(salt ‖ keyMaterial) |
| 8 | MEDIUM | `isEncrypted()` regex heuristic — false positives on base64 image data | Replaced with base64 roundtrip check + structural length validation |

### Post-launch review fixes (April 2026 — Sonnet review)

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 9 | WARNING | `influencer.post.published` only notified brand — spec required ICP-matched consumers too | Added `getConsumersForBrandViaIcps()` call in `INFLUENCER_POST_PUBLISHED` handler |
| 10 | WARNING | `/api/webhooks/social-mention` accepted all requests when `SOCIAL_MENTION_WEBHOOK_SECRET` unset | Now returns 503 immediately if env var missing — webhook never runs unauthenticated |
| 11 | WARNING | `community-features/c/[slug]` pages used old Next.js 14 sync params type | Updated to `params: Promise<T>` + `await params` (Next.js 15 requirement) |
| 12 | MINOR | `ACTIVITY_FEED_UPDATE` Pusher event defined but never triggered in service | Documented as known gap — ActivityFeed relies on polling until wired |
| 13 | MINOR | `brand.member.active` / `brand.discount.created` handlers exist but no API route emits them | Documented as known gap — handlers ready, emitters needed |

---

## 21. Production & Vercel Notes

### Critical Vercel gotchas

1. **`fs.readFileSync` in API routes** — Vercel does not bundle arbitrary source files. Only `import`-reachable files are included. SQL files read via `fs` will throw `ENOENT` in production. **Always inline SQL as template literals.**

2. **Cron route paths** — vercel.json `path` must be a relative path (e.g. `/api/cron/foo`). No domain, no protocol.

3. **`CRON_SECRET` scope** — Must be set for the **Production** environment specifically. If unset in Production scope, cron routes run unauthenticated (but don't fail — the guard only fires when `cronSecret` is defined).

4. **Middleware excludes `/api`** — The middleware.ts matcher `/((?!api|_next/static|_next/image|favicon.ico).*)` means no NextAuth session for API routes. All API routes handle their own auth.

5. **pgBouncer pooler** — Use `POSTGRES_URL` (pooler URL) for all app queries. Some DDL operations may need `DIRECT_URL` (direct connection).

6. **60-second function limit** — Sequential ICP scoring capped at 200 consumers to stay within Vercel Pro's 60s limit.

### TypeScript build requirements

All type errors must be resolved before Vercel accepts the build. Key issues resolved April 2026:

| File | Fix |
|------|-----|
| `src/app/api/consumer/account/route.ts` | `userProfiles.userId` → `userProfiles.id` |
| `src/db/repositories/influencerSocialStatsRepository.ts` | `platform: string` → `platform: InfluencerSocialStat['platform']` |
| `src/components/icp-weight-editor.tsx` | `([val])` → `([val]: number[])` |
| `src/components/ui/dialog.tsx` | Added `asChild` prop with `React.cloneElement` |
| `src/components/ui/slider.tsx` | Created from scratch (was empty) |
| `src/components/ui/accordion.tsx` | Created from scratch (was empty) |
| `src/app/dashboard/my-data/page.tsx` | `{data.profile.interests && ...}` → `{!!data.profile.interests && ...}` |
| `src/app/api/notifications/inbox/[id]/route.ts` | `{ params: { id: string } }` → `{ params: Promise<{ id: string }> }` + `await params` (Next.js 15) |
| `src/app/community-features/c/[slug]/page.tsx` | Same Next.js 15 async params fix |
| `src/app/community-features/c/[slug]/[postId]/page.tsx` | Same Next.js 15 async params fix |
| `src/db/repositories/contentApprovalRepository.ts` | `PendingPostRow.mediaUrls` typed as `string[] \| null` (not `string[]`) |

### Dialog scrolling fix

`src/components/ui/dialog.tsx` custom `DialogContent` backdrop changed from `flex items-center justify-center` to `flex justify-center overflow-y-auto p-4`. Inner dialog div gets `my-auto` for vertical centering on short dialogs. This enables tall forms (e.g. campaign creation with SLA fields, influencer content creation) to be fully scrollable — previously the bottom of forms was cut off with no way to reach it.

---

## 22. Environment Variables

```bash
# ── Database ────────────────────────────────────────────────────
POSTGRES_URL=                          # Neon pooler URL (app queries)
# DATABASE_URL=                        # alias for POSTGRES_URL
ADMIN_API_KEY=                         # for /api/admin/* routes

# ── Auth ────────────────────────────────────────────────────────
NEXTAUTH_SECRET=
NEXTAUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ── Encryption — versioned key rotation ───────────────────────
CURRENT_ENCRYPTION_KEY_ID=v1
ENCRYPTION_KEY_v1=                     # 32-byte hex or base64 AES key
# ENCRYPTION_KEY_v2=                   # add when rotating

# ── Signal retention ──────────────────────────────────────────
SIGNAL_RETENTION_DAYS=365

# ── Cron batch sizes ──────────────────────────────────────────
SIGNAL_CRON_BATCH_SIZE=               # default: all users
ICP_SCORE_CRON_BATCH_SIZE=200

# ── Cron auth ─────────────────────────────────────────────────
CRON_SECRET=                          # Bearer token Vercel injects

# ── AI ────────────────────────────────────────────────────────
OPENAI_API_KEY=
GOOGLE_AI_API_KEY=                    # Genkit / Google AI

# ── Email ─────────────────────────────────────────────────────
RESEND_API_KEY=

# ── SMS / WhatsApp ────────────────────────────────────────────
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_WHATSAPP_NUMBER=

# ── Social Listening ──────────────────────────────────────────
TWITTER_BEARER_TOKEN=
YOUTUBE_DATA_API_KEY=
GOOGLE_PLACES_API_KEY=

# ── Social OAuth (LinkedIn) ───────────────────────────────────
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
SOCIAL_OAUTH_REDIRECT_URI=
NEXT_PUBLIC_LINKEDIN_CLIENT_ID=       # exposed to client for OAuth URL

# ── File Storage ──────────────────────────────────────────────
BLOB_READ_WRITE_TOKEN=                # Vercel Blob

# ── Payments (Razorpay) ───────────────────────────────────────
RAZORPAY_KEY_ID=                      # Razorpay API key (server-side)
RAZORPAY_KEY_SECRET=                  # Razorpay API secret
RAZORPAY_WEBHOOK_SECRET=              # HMAC-SHA256 webhook signature verification
NEXT_PUBLIC_RAZORPAY_KEY_ID=          # Razorpay key for browser checkout

# ── Pusher (Real-Time Connection Layer) ──────────────────────
PUSHER_APP_ID=                        # Pusher app ID
PUSHER_KEY=                           # Pusher app key
PUSHER_SECRET=                        # Pusher app secret
PUSHER_CLUSTER=ap2                    # ap2 = Mumbai/Asia
NEXT_PUBLIC_PUSHER_KEY=               # Same as PUSHER_KEY — client-side
NEXT_PUBLIC_PUSHER_CLUSTER=ap2        # Same as PUSHER_CLUSTER — client-side
SOCIAL_MENTION_WEBHOOK_SECRET=        # HMAC secret for POST /api/webhooks/social-mention

# ── Slack ─────────────────────────────────────────────────────
SLACK_BOT_TOKEN=                      # Brand Slack notifications
```
