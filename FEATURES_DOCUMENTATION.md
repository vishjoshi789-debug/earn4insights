# Earn4Insights — Feature Documentation

> **Last updated:** April 2026 (authoritative — reflects all phases through Influencers Adda + landing page + ProductTour)
> **Platform:** Next.js 15 + Drizzle ORM + Neon PostgreSQL + Vercel
> **Domain:** earn4insights.com

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Authentication & Onboarding](#2-authentication--onboarding)
3. [Role System](#3-role-system)
4. [Product Tour](#4-product-tour)
5. [Landing Page](#5-landing-page)
6. [Dashboard Shell & Navigation](#6-dashboard-shell--navigation)
7. [Brand Features](#7-brand-features)
8. [Consumer Features](#8-consumer-features)
9. [Influencer Features](#9-influencer-features)
10. [Admin Features](#10-admin-features)
11. [Rankings (Public)](#11-rankings-public)
12. [Consent & Privacy (GDPR)](#12-consent--privacy-gdpr)
13. [Personalization Engine](#13-personalization-engine)
14. [ICP Builder (Brand)](#14-icp-builder-brand)
15. [Influencers Adda Marketplace](#15-influencers-adda-marketplace)
16. [Notification System](#16-notification-system)
17. [Social Listening](#17-social-listening)
18. [Community & Rewards](#18-community--rewards)
19. [Analytics](#19-analytics)
20. [Known Gaps & Future Work](#20-known-gaps--future-work)

---

## 1. Platform Overview

Earn4Insights is a **three-sided platform** connecting:

| Role | Value Received | Value Given |
|------|---------------|------------|
| **Brands** | Consumer feedback, survey responses, audience insights, ICP matching, influencer campaigns | Pay for access; create surveys/products |
| **Consumers** | Points/rewards for their time; personalized product recommendations | Honest feedback, survey responses, consent to data |
| **Influencers** | Paid campaign work (milestone-based escrow) | Content creation, audience reach |

---

## 2. Authentication & Onboarding

### Sign-up / Sign-in

- **Google OAuth** — one-click sign in via Google
- **Email + password** — credentials-based sign in
- **Role selection** — consumer or brand at sign-up
- Sign-up URL accepts `?role=consumer` or `?role=brand` query param (used by landing page CTAs)
- Influencers sign up as consumers, then register as influencer from dashboard

### Onboarding flow (consumers)

After first sign-in, consumers are redirected to `/onboarding`:

1. **Step 1 — Demographics:** Age range, gender, location (country + city), education level, profession
2. **Step 2 — Interests:** Select categories of interest (electronics, fashion, food, etc.)
3. **Step 3 — Preferences:** Communication preference, notification settings
4. **Completion:** Redirected to consumer dashboard; `onboardingCompleted` flag set

Brands skip onboarding and go directly to `/dashboard`.

### OnboardingGuard

Client component that checks `onboardingCompleted` flag. If false, redirects to `/onboarding`. Runs on every dashboard page load.

---

## 3. Role System

| Role | Description | Dashboard |
|------|-------------|-----------|
| `consumer` | Regular consumer — submits feedback, takes surveys, earns rewards | `/dashboard` (consumer view) |
| `brand` | Business user — creates products, surveys, views analytics | `/dashboard` (brand view) |
| `admin` | Platform admin — access to all data, admin analytics | `/admin` |
| `consumer` + `is_influencer=true` | Consumer who has registered as an influencer | `/dashboard` (consumer + influencer nav) |

No separate 'influencer' role in NextAuth — influencers are consumers with `is_influencer=true`. This allows:
- Seamless conversion (no re-auth required)
- Consumers see influencer registration CTA in their dashboard
- Role-scoped product tour shows influencer steps to all consumers (conversion funnel)

---

## 4. Product Tour

First-time users see a guided product tour that walks through the platform's key features. Tour is role-scoped — brands see brand features, consumers see consumer + influencer features.

### Storage

Tour state stored in localStorage with role-scoped key:
```
e4i_product_tour_{userId}_{role}
```
This means returning users who become influencers get a fresh tour showing influencer features.

### Brand tour steps

1. **Welcome** — Overview of the brand dashboard
2. **Products & Feedback** — How to add products and collect feedback
3. **Consumer Intelligence** — What signal snapshots and ICP scores are
4. **Feature Insights** — How to read aggregate trends and extracted themes
5. **Smart Alerts** — How to set up alert rules with ICP filtering
6. **ICP Builder** — How to build an Ideal Consumer Profile with weighted criteria
7. **Influencer Campaigns** — How to create and manage campaigns
8. **Discover Influencers** — How to search and invite influencers

### Consumer tour steps

1. **Welcome** — Overview of the consumer dashboard
2. **Surveys** — Where to find and complete surveys
3. **For You / Recommendations** — Personalized product recommendations
4. **My Watchlist** — Saved products and tracked brands
5. **Privacy & Consent** — How to manage data sharing per category
6. **My Signals** — View your signal history across all categories
7. **My Data Export** — Download all your data as JSON (GDPR Art. 15)
8. **Rewards & Points** — How to earn and redeem points

### Influencer sub-section (within consumer tour)

All consumers see influencer steps (conversion funnel):

9. **Become an Influencer** — How to register as an influencer
10. **Influencer Profile** — Setting up your profile and rates
11. **My Campaigns** — Viewing and accepting campaign invitations
12. **My Content** — Managing content posts and campaign deliverables

---

## 5. Landing Page

`/` — Public landing page accessible without sign-in.

### Sections

1. **Hero** — Value proposition + dual CTA (Sign up as Brand / Sign up as Consumer)
2. **How it works** — 3-step visual explanation
3. **For Brands** (blue theme) — Feature cards:
   - Real-time Feedback, Survey Builder, AI Analytics, Brand Alerts
   - *(New Apr 2026)* ICP Builder, Influencer Campaigns, Discover Influencers
4. **For Consumers** (green theme) — Feature cards:
   - Earn Rewards, Smart Recommendations, Product Discovery, Secure & Private
   - *(New Apr 2026)* Privacy & Consent, My Signals, My Data Export, Become an Influencer
5. **For Influencers** (violet theme) *(New Apr 2026)*:
   - Influencer Profile, Campaign Invitations, Milestone Payments, Content Management, Performance Analytics, Reviews & Reputation
   - CTA: "Join as Influencer" → `/signup?role=consumer`
6. **Rankings Preview** — Top-ranked products
7. **Footer** — Links to privacy policy, terms of service, contact

---

## 6. Dashboard Shell & Navigation

`src/app/dashboard/DashboardShell.tsx` — Client-side shell with sidebar navigation. Renders role-appropriate nav items.

### Brand navigation

- Dashboard (overview)
- Products
- Feedback
- Surveys
- Analytics
- Brand Alerts
- Social Listening
- Rankings
- **ICP Builder** *(Apr 2026)*
- **Influencer Campaigns** *(Apr 2026)*
- **Discover Influencers** *(Apr 2026)*
- Settings

### Consumer navigation

- Dashboard (overview)
- Discover Products
- My Surveys
- My Feedback
- Rankings
- My Watchlist
- **Privacy & Consent** *(Apr 2026)*
- **My Signals** *(Apr 2026)*
- **My Data** *(Apr 2026)*
- Rewards
- Community
- Settings

### Influencer navigation (consumers with is_influencer=true)

All consumer nav items plus:
- **Influencer Profile** *(Apr 2026)*
- **My Campaigns** *(Apr 2026)*
- **My Content** *(Apr 2026)*

---

## 7. Brand Features

### 7.1 Product Management

- **Create product:** Name, description, category, images
- **Edit / archive product**
- **Product detail:** View all feedback, survey responses, aggregate stats
- **Claim existing product:** Brands can claim products added by consumers

### 7.2 Feedback Collection

- Consumers submit text, audio, video, or image feedback on products
- Brands see individual responses with:
  - Transcription (audio/video)
  - Sentiment score (positive / neutral / negative)
  - Language detection + normalized English version
  - AI-extracted themes (weekly cron)
- Aggregate view: sentiment distribution chart, theme word cloud, rating histogram

### 7.3 Survey Builder

- Create surveys with multiple question types:
  - Multiple choice (single/multi-select)
  - Rating (1–5 stars)
  - NPS (0–10 scale + optional comment)
  - Open text
- **Target audience:** Filter by consumer demographics, interests, or ICP match score
- **Rewards:** Set point reward per completion
- **Analytics:** Response rate, completion rate, per-question breakdown, NPS score

### 7.4 AI Analytics

- **Unified analytics dashboard:** Cross-product metrics
- **Per-product analytics:** Feedback trends, sentiment over time, survey NPS
- **Theme extraction:** GPT-4o clusters feedback into named themes weekly
- **Send-time optimization:** Optimal notification times per consumer segment

### 7.5 Brand Alerts

Configure alert rules that fire when:
- New feedback arrives for a product
- Feedback sentiment drops below threshold
- Survey NPS drops below threshold
- A consumer matching ICP engages *(ICP-gated — Apr 2026)*

Alert channels: email, WhatsApp, Slack, in-app bell notification

### 7.6 Social Listening

Monitor external platform mentions of brand/products:
- Twitter/X, YouTube comments, Google Reviews, Reddit
- AI relevance filtering: classify as relevant / noise / competitor
- Sentiment tagging on ingested mentions
- Dashboard with mention volume chart + recent mentions feed

### 7.7 ICP Builder *(Apr 2026)*

`/dashboard/brand/icps`

- **Create ICP:** Name, description, optional product link
- **Weight editor:** Drag/type weights for each criterion (must sum to 100 — hard validated)
- **Criteria types:** Demographic (age, gender, location, profession), Behavioral (engagement tier, feedback frequency, interests), Psychographic (values, lifestyle), Sensitive (health, dietary — requires consumer consent)
- **Match leaderboard:** Top-matching consumers by ICP score (paginated)
- **Audience charts:** Score distribution, consent gap analysis
- **Bulk rescore:** Re-score up to 200 consumers on demand (rate limited)
- **ICP in alerts:** Set `minMatchScore` on alert rules — only fire when matching consumer engages

### 7.8 Influencer Campaigns *(Apr 2026)*

`/dashboard/brand/campaigns`

- **Create campaign:** Title, brief, budget, deliverables, timeline, platform targets
- **Campaign lifecycle:** draft → proposed → negotiating → active → completed / cancelled / disputed
- **Manage influencers:** Invite, view acceptance status, remove
- **Milestones:** Add deliverables with payment amounts (total ≤ budget — validated)
  - Approve / reject milestone submissions
  - Escrow funds before milestone starts
- **Payments:** View payment summary, escrow status, released amounts
- **Performance:** View per-campaign analytics (views, likes, reach, saves, engagement rate)
- **Disputes:** File dispute on milestone; admin resolves

### 7.9 Discover Influencers *(Apr 2026)*

`/dashboard/brand/influencers`

- Search by niche, platform, follower range, engagement rate, location
- View influencer public profiles: stats, content samples, past campaign reviews
- Filter by verified vs self-declared stats
- Invite directly to campaign

---

## 8. Consumer Features

### 8.1 Product Discovery

- Personalized feed based on interests + behavioral signals
- Browse by category
- Search by name or brand
- Product detail: description, aggregate rating, recent reviews (anonymous)
- Add to watchlist

### 8.2 Feedback Submission

- Text feedback (up to 2000 chars)
- Audio recording (in-browser microphone)
- Video upload
- Image upload (up to 4 images)
- Star rating (1–5)
- Earn reward points on submission

### 8.3 Surveys

- Personalized survey feed (matched by demographics + interests)
- Complete surveys inline
- NPS surveys with follow-up comment
- Points credited on completion
- Survey history

### 8.4 Recommendations ("For You")

- AI-personalized product recommendations
- Based on signal snapshots: interests, engagement patterns, demographic match
- "Why recommended" explainer

### 8.5 My Watchlist

- Save products for later
- Track brands
- Get notified when watched products receive significant updates

### 8.6 Rewards & Points

- Points balance displayed in sidebar
- Transaction history: earned (survey, feedback, onboarding), spent (future: redemption)
- Point values configurable per reward type

### 8.7 Community

- Community posts (text + optional image)
- Comments and reactions on posts
- Posts linked to products
- Community feed filtered by product category

### 8.8 Privacy & Consent *(Apr 2026)*

`/dashboard/privacy`

- **12-category consent UI** organized in 3 tiers:
  - Tier 1: tracking, personalization, analytics, marketing
  - Tier 2: behavioral, demographic, psychographic, social
  - Tier 3: sensitive_health, sensitive_dietary, sensitive_religion, sensitive_caste
- Toggle consent per category — independently revocable
- Revocation cascade: revoking sensitive category immediately soft-deletes that attribute
- Consent proof shown (date granted, policy version)
- GDPR-compliant UI with plain-language descriptions

### 8.9 My Signals *(Apr 2026)*

`/dashboard/my-signals`

- **Tabbed view** by signal category: behavioral, demographic, psychographic, social
- Paginated signal snapshot history for each category
- Shows what data was collected, when, and from which trigger
- Powered by `/api/consumer/signals` (consent-gated per category)

### 8.10 My Data Export *(Apr 2026)*

`/dashboard/my-data`

- **GDPR Art. 15 right of access** — full data export as JSON
- Includes: profile, interests, signal snapshots, feedback history, survey responses, consent records, reward transactions
- Sensitive attributes listed by category (no decrypted values — DSAR flow not yet implemented)
- One-click JSON download
- Powered by `/api/consumer/my-data`

### 8.11 Account Deletion *(Apr 2026)*

- `DELETE /api/consumer/account` with `{ confirm: true }` body
- Requires explicit confirmation to prevent accidental erasure
- Immediate: signal snapshots deleted, social connections revoked, consent anonymized
- 30-day grace period before hard delete of account + sensitive attributes

---

## 9. Influencer Features

Consumers register as influencers from `/dashboard/influencer/profile`. Sets `is_influencer=true` on their user record.

### 9.1 Influencer Profile *(Apr 2026)*

`/dashboard/influencer/profile`

- **Create / edit profile:** display name, bio, niche categories, social handles, content rates
- **Social platform handles:** Instagram, Twitter, LinkedIn, YouTube, TikTok
- **Verification status:** self-declared → pending review → verified (admin-reviewed)
- **Base rates:** per post, per story, per reel, per video (in INR)
- **Profile visibility:** public (discoverable by brands) or private

### 9.2 Campaign Invitations *(Apr 2026)*

`/dashboard/influencer/campaigns`

- View all campaign invitations
- Filter by status: pending, accepted, rejected, active, completed
- **Campaign detail** (`/dashboard/influencer/campaigns/[id]`):
  - Campaign brief, deliverables, budget info, timeline
  - Accept or reject invitation
  - View milestones and their status
  - Submit deliverable for each milestone (link + description)
  - Track payment status per milestone

### 9.3 Milestone Submissions *(Apr 2026)*

- Submit content link + description for each milestone
- Brand approves → payment released from escrow
- Brand rejects → resubmit with revisions
- Dispute button if disagreement persists

### 9.4 Content Management *(Apr 2026)*

`/dashboard/influencer/content`

- Create content posts: title, body, platform, media URL, publish date
- Link posts to active campaigns
- Cross-post to multiple platforms in one entry
- View all posts with their linked campaign and performance data

### 9.5 Performance Analytics *(Apr 2026)*

- Per-campaign performance metrics: views, likes, comments, shares, reach, saves, engagement rate
- Metrics recorded per post per platform
- Campaign analytics aggregated across all posts

### 9.6 Follows & Reviews

- Consumers can follow influencer profiles
- Reviews posted after campaign completion (1–5 stars + comment)
- One review per reviewer per campaign
- Average rating shown on public profile

---

## 10. Admin Features

`/admin` — requires `role='admin'` in session.

### 10.1 Admin Analytics Dashboard

- Platform-wide metrics: total users, active brands, total feedback, survey completion rates
- Revenue metrics (subscription tier breakdown)
- Consumer engagement trends
- Signal coverage (% of users with each consent category granted)

### 10.2 User Management

- View / search all users
- Change user roles
- Soft-delete / restore accounts
- View user's consent records and signal history

### 10.3 Product Moderation

- Review flagged products
- Approve / reject brand product claims
- Merge duplicate products

### 10.4 Migration Runner

Admin API routes to apply database migrations (idempotent):
- `POST /api/admin/run-migration-002` — hyper-personalization schema
- `POST /api/admin/migrate-consent-records` — backfill legacy consent
- `POST /api/admin/run-migration-003` — FK constraints
- `POST /api/admin/run-migration-004` — Influencers Adda

All require `x-api-key: <ADMIN_API_KEY>` header.

### 10.5 Dispute Resolution

- View all active disputes
- Review evidence from both parties
- Mark dispute as resolved
- Specify resolution outcome (in favour of brand / influencer / mutual)
- Campaign reverts from 'disputed' to 'active' when all disputes resolved

---

## 11. Rankings (Public)

`/rankings` — publicly accessible without login.

Weekly rankings computed from:
- Feedback volume (weight: 30%)
- Average sentiment score (weight: 30%)
- Survey NPS (weight: 25%)
- Consumer engagement rate (weight: 15%)

- Top 10 products per category
- Brand can see their products' ranking history in analytics
- Consumers can discover top-ranked products on the landing page and rankings page

---

## 12. Consent & Privacy (GDPR)

See [Section 8.8 — Privacy & Consent](#88-privacy--consent-apr-2026) for the consumer-facing UI.

### Technical implementation

- 12 granular data categories across 3 tiers
- Each category has an independent row in `consent_records`
- Consent proof stored: IP address, user-agent, policy version, timestamp
- Sensitive categories (`sensitive_*`) require `legalBasis='explicit_consent'`
- Revoking sensitive consent immediately soft-deletes that attribute
- `anonymizeExpiredConsentMetadata()` nulls IP/UA after 3 years (GDPR Art. 5(1)(e))

### Consumer rights implemented

| Right | Route | Notes |
|-------|-------|-------|
| Right of access (Art. 15) | `GET /api/consumer/my-data` | Full JSON export |
| Right to erasure (Art. 17) | `DELETE /api/consumer/account` | 30-day grace period |
| Right to withdraw consent | `DELETE /api/consumer/consent` | Per-category |
| Right to data portability | `GET /api/consumer/my-data` | JSON format |

---

## 13. Personalization Engine

### How personalization works

1. **Signal collection** (daily cron, 02:30 UTC) — collects behavioral, demographic, psychographic, social signals per user
2. **Snapshots stored** — append-only history enables preference drift analysis
3. **Recommendations** — latest snapshots used to rank products/surveys for each consumer
4. **ICP scoring** — brands define ICPs; daily cron scores consumers against each ICP

### Signal categories

| Category | What it captures |
|----------|-----------------|
| `behavioral` | Engagement scores, category interests, feedback frequency, sentiment bias |
| `demographic` | Age range, gender, location, education, profession (from onboarding) |
| `psychographic` | Values, lifestyle, personality, aspirations (from preference surveys) |
| `social` | Platform activity signals from connected accounts |

### Consent gating

Every signal collection is consent-gated. If a consumer hasn't granted consent for a category, that signal is not collected and not used in ICP scoring. The consumer is not penalised for withheld consent.

---

## 14. ICP Builder (Brand)

See [Section 7.7 — ICP Builder](#77-icp-builder-apr-2026) for the full feature description.

### ICP scoring design

- Weights must sum to exactly 100 (hard throw on write)
- Unconsented criteria excluded from `totalPossible` (normalise upward, not downward)
- Required criteria that score 0 (non-consent reason) → total score zeroed
- Scores cached in `icp_match_scores`; `isStale=true` triggers overnight recompute
- Scores range 0–100; alert rules fire when score ≥ `minMatchScore` (default 60)

---

## 15. Influencers Adda Marketplace

See [Section 9 — Influencer Features](#9-influencer-features) and [Section 7.8 — Influencer Campaigns](#78-influencer-campaigns-apr-2026) for the full feature descriptions.

### Platform economics

- Brand sets campaign budget
- Milestones are sub-budgets (total ≤ budget — hard validated)
- Platform fee calculated at escrow time: `Math.round(amount × platformFeePct / 100)`
- Escrow → release flow ensures influencers are paid after delivery, not before
- Razorpay integration is stubbed (records store IDs; actual gateway not wired)

---

## 16. Notification System

### Channels

| Channel | Use case |
|---------|---------|
| **Email** (Resend) | Survey completion, alert fires, reward credited, welcome |
| **SMS** (Twilio) | OTP, critical alerts |
| **WhatsApp** (Twilio) | Real-time brand alerts |
| **Slack** | Brand workspace notifications |
| **In-app bell** | Real-time badge count (DB polling) |

### Send-time optimization

GPT-4o analyzes per-user engagement patterns to determine the optimal time to send notifications. Results applied when scheduling the next notification for each user.

---

## 17. Social Listening

See [ARCHITECTURE.md § 15 — Social Listening System](#15-social-listening-system).

Brands monitor mentions on Twitter/X, YouTube, Google Reviews, Reddit. AI relevance filter classifies mentions. Dashboard shows:
- Mention volume over time
- Sentiment breakdown of mentions
- Competitor mentions
- Recent mentions feed with source links

---

## 18. Community & Rewards

### Community

- Community posts with text + optional image
- Comments and nested reactions
- Posts linked to specific products
- Moderation queue (admin)

### Rewards

- Points credited for: survey completion, feedback submission, onboarding steps, referrals
- All transactions recorded in `rewardTransactions` with reason code
- Points displayed in consumer sidebar
- Future: UPI / bank transfer payout

---

## 19. Analytics

### Brand analytics

- **Unified:** Cross-product metrics (feedback count, avg sentiment, survey response rate)
- **Per-product:** Feedback trend, sentiment over time, NPS trend, theme timeline
- **ICP audience analytics:** `GET /api/analytics/icp-audience` — aggregate audience stats with min cohort size of 5 (re-identification protection)

### Admin analytics

- Platform-wide KPIs: DAU, MAU, feedback volume, survey completions
- Revenue by subscription tier
- Consumer signal coverage heatmap (% users with each consent category)

---

## 20. Known Gaps & Future Work

### Influencers Adda

| Item | Notes |
|------|-------|
| **Razorpay integration** | Records store IDs but payment gateway not wired |
| **Campaign content approval** | No brand-side review workflow before influencer publishes |
| **Social stats verification** | Self-declared; need platform API verification |
| **Campaign marketplace** | Influencers only see invited campaigns; no public browse |
| **Influencer earnings dashboard** | Data in `campaign_payments`; needs `/dashboard/influencer/earnings` |

### Privacy & Compliance

| Item | Notes |
|------|-------|
| **Instagram OAuth** | Basic Display API deprecated. Needs Graph API + App Review (4–6 weeks) |
| **Social interest inference** | `inferredInterests` empty on connect; needs `POST /api/consumer/social/sync` |
| **DSAR flow** | Decrypted sensitive data export requires identity verification — out of scope |
| **`icp_match_scores` orphan cleanup** | Consumer deletion should clean cached scores (no FK on consumerId — denormalised cache) |
| **Signal snapshots in process-deletions** | Admin-triggered profile deletions don't clean signal snapshots |

### Future Features

| Item | Notes |
|------|-------|
| **UPI / bank payout** | Consumers accumulate points; no redemption path yet |
| **Brand subscription billing** | Stripe integration stubbed; not actively billed |
| **A/B testing for surveys** | Survey variant testing for brands |
| **Consumer referral program** | Referral bonus tracked but not automated |
