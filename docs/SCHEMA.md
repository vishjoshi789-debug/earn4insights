# Database Schema — Earn4Insights

## Migration 002 — Hyper-Personalization (6 new tables + 3 ALTERs)

### `consent_records`
Per-category consent records. One row per (user, dataCategory). Independently revocable.
Stores proof of consent: IP, UA, policy version, timestamp.
**Purpose:** GDPR Art. 7 + DPDP §6 accountability.

### `consumer_signal_snapshots`
Append-only time-series. Never overwrites — every computation creates a new row.
Columns: `userId`, `signalCategory`, `signals` (JSONB), `triggeredBy`, `schemaVersion`, `snapshotAt`.
**Purpose:** ICP scoring history, preference drift, GDPR Art. 15 export.
Retention: `SIGNAL_RETENTION_DAYS` env var (default 365). Purged daily by cron.

### `consumer_sensitive_attributes`
AES-256-GCM encrypted storage for GDPR Art. 9 / DPDP sensitive personal data:
religion, caste, dietary, health. Columns: `encryptedValue`, `encryptionKeyId`, `deletedAt` (soft-delete).
**Purpose:** Independently deletable. Physical deletion 30 days after soft-delete. Linked to a `consent_records` row — if consent revoked, immediately soft-deleted.

### `brand_icps`
Brand Ideal Consumer Profile definitions. `attributes` JSONB: weighted criteria (weights must sum to 100).
Optional `productId` — null means brand-wide ICP.

### `icp_match_scores`
Cached match scores. UNIQUE (icpId, consumerId). `isStale=true` triggers daily cron recomputation.

### `consumer_social_connections`
Connected social accounts (Instagram, Twitter, LinkedIn, YouTube). OAuth token encrypted AES-256-GCM.
LinkedIn implemented; Instagram pending App Review.

### Modified existing tables

| Table | Added columns |
|-------|--------------|
| `userProfiles` | `psychographic` (JSONB), `socialSignals` (JSONB), `signalVersion`, `lastSignalComputedAt` |
| `brandAlertRules` | `icpId` (UUID → brand_icps), `minMatchScore` (int, default 60) |
| `brandAlerts` | `matchScoreSnapshot` (JSONB — score breakdown at alert fire time) |

---

## Migration 004 — Influencers Adda (11 new tables + ALTER users)

| Table | Purpose |
|-------|---------|
| `influencer_profiles` | Public profiles (niche, handles, rates, verification) |
| `influencer_social_stats` | Per-platform follower/engagement metrics (UNIQUE per influencer+platform) |
| `influencer_content_posts` | Content posts with media, cross-posting, campaign links |
| `influencer_campaigns` | Campaign briefs, budgets, deliverables, status lifecycle |
| `campaign_influencers` | Junction: campaigns ↔ influencers with invitation status |
| `campaign_milestones` | Milestone-based deliverables with payment amounts |
| `campaign_payments` | Payment records with Razorpay integration, escrow tracking |
| `campaign_performance` | Per-post/platform metrics (views, likes, reach, etc.) |
| `influencer_follows` | Consumer → influencer follow relationships |
| `influencer_reviews` | Post-campaign reviews with 1-5 rating |
| `campaign_disputes` | Dispute filing and admin resolution |

`ALTER users ADD COLUMN is_influencer BOOLEAN DEFAULT FALSE`

---

## Migration 005 — Real-Time Connection Layer (6 new tables + 1 ALTER)

| Table | Purpose |
|-------|---------|
| `realtime_events` | Persistent event log. Written before any dispatch. Indexes on actor, (type, createdAt), (entityType, entityId). |
| `notification_inbox` | Per-user notifications. 90-day TTL (`expiresAt`). Indexes on `(userId, isRead)`, `(expiresAt)`, `(userId, createdAt DESC)`. |
| `notification_preferences` | Per-user, per-event-type inApp/email/sms toggles (16 event types). UNIQUE(userId, eventType). |
| `activity_feed_items` | Live activity stream per user. 90-day retention. Index on `(userId, createdAt DESC)`. |
| `social_mentions` | Brand social mention records. Index on pending (notificationsSent=false) for cron processing. |
| `social_listening_rules` | Brand keyword + platform monitoring rules. Partial index on `isActive=true`. |

**Modified (migration 005):**
- `user_profiles`: `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP` — stamped on every Pusher presence channel auth via `POST /api/pusher/auth`.

---

## Migration 006 — Campaign Content Approval (2 ALTERs + 1 new table)

### Modified existing tables

| Table | Added columns |
|-------|--------------|
| `influencer_content_posts` | `reviewSubmittedAt` (timestamp), `reviewedAt` (timestamp), `reviewedBy` (UUID), `rejectionReason` (text), `resubmissionCount` (int default 0), `previousPostId` (UUID self-ref) |
| `influencer_content_posts` | Status enum expanded: added `'approved'` and `'rejected'` to existing statuses |
| `influencer_campaigns` | `reviewSlaHours` (INTEGER NULL — hours brand has to review), `autoApproveEnabled` (BOOLEAN DEFAULT false) |

### `content_review_reminders`
Deduplication table for SLA reminder notifications. Prevents double-firing reminders on successive cron runs.

Columns: `id`, `postId`, `campaignId`, `brandId`, `reminderType` (`'75_pct'|'90_pct'|'sla_expired'|'daily'`), `scheduledAt`, `sentAt`, `createdAt`

Indexes:
- UNIQUE on `(post_id, reminder_type)` — hard constraint preventing duplicate reminders
- Partial index on `(scheduled_at) WHERE sent_at IS NULL` — fast unsent reminder lookup for cron

---

## Migration 007 — Campaign Marketplace (3 ALTERs + 1 new table)

### ALTER `influencer_campaigns`

New columns:
- `is_public` BOOLEAN NOT NULL DEFAULT false — true = visible in marketplace
- `max_influencers` INTEGER NULL — max applications accepted, NULL = unlimited
- `application_deadline` DATE NULL — when applications close, NULL = no deadline

Index: partial index on `(is_public, status) WHERE is_public = true` for marketplace queries.

### `campaign_applications`

Influencer applications to public campaigns. Tracks proposal, rate, and brand response.

Columns: `id` (UUID PK), `campaignId`, `influencerId`, `proposalText`, `proposedRate` (paise), `proposedCurrency` (default 'INR'), `status` (`'pending'|'reviewing'|'accepted'|'rejected'|'withdrawn'`), `brandResponse`, `appliedAt`, `respondedAt`

Indexes:
- UNIQUE on `(campaign_id, influencer_id)` — one application per influencer per campaign
- `(campaign_id, status)` — brand view: filter applications by status
- `(influencer_id, status)` — influencer view: my applications by status
- `(applied_at DESC)` — newest-first ordering

---

## Migration 008 — Razorpay Payment Integration (4 new tables)

Applied via `POST /api/admin/run-migration-008` (inline SQL, idempotent `IF NOT EXISTS`).

### `razorpay_orders`

Razorpay payment orders created when brands escrow campaign milestone funds.

Columns: `id` (UUID PK), `campaignId` (UUID → influencer_campaigns), `brandId` (UUID → users), `milestoneId` (UUID → campaign_milestones), `razorpayOrderId` (TEXT UNIQUE), `razorpayPaymentId` (TEXT), `amount` (INTEGER — paise), `currency` (TEXT default 'INR'), `status` (`'created'|'paid'|'failed'|'refunded'`), `platformFee` (INTEGER), `influencerAmount` (INTEGER), `receipt` (TEXT), `notes` (JSONB), `paidAt`, `refundedAt`, `createdAt`, `updatedAt`

Indexes: `razorpay_order_id` (UNIQUE), `(campaign_id, status)`, `(brand_id, created_at DESC)`

### `payout_accounts`

Influencer and consumer payout destinations. AES-256-GCM encrypted sensitive fields.

Columns: `id` (UUID PK), `userId` (UUID → users), `accountType` (`'bank_account'|'upi'|'wise'|'paypal'`), `currency` (TEXT), `isPrimary` (BOOLEAN default false), `isActive` (BOOLEAN default true), `accountHolderName` (TEXT), `accountNumber` (TEXT ENCRYPTED), `ifscCode` (TEXT ENCRYPTED), `upiId` (TEXT ENCRYPTED), `wiseEmail` (TEXT ENCRYPTED), `paypalEmail` (TEXT ENCRYPTED), `encryptionKeyId` (TEXT), `createdAt`, `updatedAt`

Constraints: PARTIAL UNIQUE on `(user_id, currency) WHERE is_primary=true AND is_active=true` — only one primary account per user per currency.

### `influencer_payouts`

Outgoing platform payments to influencers and consumers. All payouts start as `pending` (admin manual queue) until `RAZORPAYX_ENABLED=true`.

Columns: `id` (UUID PK), `campaignId` (UUID nullable → influencer_campaigns), `recipientId` (UUID → users), `recipientType` (`'influencer'|'consumer'`), `payoutAccountId` (UUID → payout_accounts), `amount` (INTEGER), `currency` (TEXT), `payoutMethod` (`'razorpay_payout'|'wise_manual'|'paypal_manual'|'bank_manual'`), `status` (`'pending'|'processing'|'completed'|'failed'`), `razorpayPayoutId` (TEXT nullable), `wiseTransferId` (TEXT nullable), `retryCount` (INTEGER default 0), `failureReason` (TEXT), `initiatedAt`, `processedBy` (TEXT — admin userId or 'system'), `adminNote` (TEXT), `completedAt`, `createdAt`, `updatedAt`

Indexes: `(recipient_id, status)`, `(campaign_id)`, `(status, updated_at)` — used by cron retry query, `(razorpay_payout_id)` — sync cron lookup

### `reward_redemptions`

Consumer reward point redemptions (platform credits, vouchers, cash payout).

Columns: `id` (UUID PK), `consumerId` (UUID → users), `points` (INTEGER), `value` (INTEGER — paise), `currency` (TEXT default 'INR'), `redemptionType` (`'platform_credits'|'voucher'|'cash_payout'`), `status` (`'pending'|'processing'|'completed'|'failed'`), `payoutId` (UUID nullable → influencer_payouts), `voucherCode` (TEXT), `brandId` (UUID nullable — for branded vouchers), `failureReason` (TEXT), `processedAt`, `adminNote` (TEXT), `createdAt`, `updatedAt`

Index: `(consumer_id, status)`, `(status, created_at DESC)` — admin queue

---

## Migration 009 — Deals Discovery + Community Platform (9 new tables)

Applied via `POST /api/admin/run-migration-009` (inline SQL, idempotent `IF NOT EXISTS`).

| Table | Purpose |
|-------|---------|
| `deals` | Brand-created deals/offers. Types: `promo_code`, `redirect`, `percentage_off`, `fixed_off`, `bogo`, `free_shipping`. Full-text search via `search_vector` tsvector column (DB trigger, not in Drizzle). Status: `draft → active → paused → expired`. |
| `community_deals_posts` | Reddit-style community posts. Types: `deal`, `review`, `discussion`, `alert`. Moderation status: `pending → approved / rejected / removed / needs_edit`. Tracks upvote/downvote/comment/save counts. Optional link to `deals` table. |
| `community_deals_post_votes` | Per-user upvote/downvote on posts. UNIQUE `(post_id, user_id)`. Vote types: `'up' | 'down'`. |
| `community_deals_post_saves` | Consumer saved/bookmarked posts. UNIQUE `(post_id, user_id)`. |
| `community_deals_comments` | Threaded comments on community posts. Self-referential `parent_comment_id` for nesting. Status: `active | removed | flagged`. |
| `community_deals_comment_votes` | Per-user upvote on comments. UNIQUE `(comment_id, user_id)`. |
| `deal_saves` | Consumer saved deals (from the deals discovery feed). UNIQUE `(deal_id, user_id)`. |
| `deal_redemptions` | Tracks each deal redemption event per consumer. Types: `promo_code_copied | redirect_clicked`. Awards `pointsAwarded` (default 10 pts). |
| `community_deals_flags` | Spam/fraud/inappropriate flags on posts or comments. `content_type`: `'post' | 'comment'`. Reasons: `spam | fake_deal | inappropriate | duplicate | other`. Status: `pending | reviewed | dismissed`. Auto-hide fires at ≥ 5 flags on a post. |

### Key indexes (Migration 009)

| Table | Index |
|-------|-------|
| `deals` | `(brand_id, status)`, `(status, valid_until)` — expiry cron, `(is_featured, status)`, full-text `search_vector` GIN |
| `community_deals_posts` | `(status, created_at DESC)`, `(author_id)`, `(deal_id)`, full-text `search_vector` GIN |
| `community_deals_comments` | `(post_id, created_at)`, `(parent_comment_id)` |
| `community_deals_flags` | `(content_type, content_id)`, `(status)` |
| `deal_redemptions` | `(deal_id, consumer_id)`, `(consumer_id)` |

---

---

## Migration 010 — Competitive Intelligence Dashboard (9 new tables)

Applied via `POST /api/admin/run-migration-010` (inline SQL, idempotent `IF NOT EXISTS`).

| Table | Purpose |
|-------|---------|
| `competitor_profiles` | Brands track competitors (on-platform brand, or off-platform by name). Types: `'on_platform' \| 'off_platform'`. Partial UNIQUE: one on-platform competitor per brand (`brand_id, competitor_brand_id WHERE competitor_brand_id IS NOT NULL`); one off-platform per brand per name. Flags: `is_system_suggested`, `is_confirmed`, `is_active`. |
| `competitor_products` | Competitor products with `current_price` (paise), `features` (JSONB array), `positioning`, `target_segment`. Linked to `competitor_profiles`. |
| `competitor_price_history` | Append-only price log per competitor product. Tracks `price`, `currency`, `source`, `recorded_at`. Index on `(competitor_product_id, recorded_at DESC)`. |
| `competitive_insights` | AI or system-generated insights per brand. `insight_type`, `severity` (`info \| warning \| critical`), `is_actionable`, `generated_by` (`'system' \| 'ai'`), `ai_model`. Index on `(brand_id, is_read, created_at DESC)`. Cap: 3 AI insights per brand per day. |
| `competitive_benchmarks` | Per-metric brand vs category comparison. `brand_value`, `category_avg`, `category_best`, `category_worst`, `percentile`, `competitor_values` (JSONB), `sample_size`, `period_start/end`. |
| `competitive_scores` | 0-100 composite score per `(brand_id, category)`. UNIQUE(brand_id, category). `score_breakdown` (JSONB — per-dimension scores), `rank`, `total_in_category`, `trend` (`improving \| stable \| declining`), `previous_score`. Score not written if effective weight < 40 (insufficient data). |
| `competitor_alerts` | Real-time alerts about competitor events. `alert_type`, `severity`, `data` (JSONB), `is_read`. 24h dedup window prevents repeated alerts of the same type. Index on `(brand_id, is_read, created_at DESC)`. |
| `competitive_reports` | Daily/weekly/monthly digest outputs. `report_type`, `content` (JSONB), `period_start/end`, `email_sent`, `email_sent_at`. |
| `competitor_digest_preferences` | Per-brand digest settings. UNIQUE(brand_id). `digest_frequency` (`daily \| weekly \| monthly`), `email_enabled`, `in_app_enabled`, `categories` (TEXT[]), `alert_types` (TEXT[]). |

### Scoring dimensions (6-dimension model)

| Dimension | Weight | Source |
|-----------|--------|--------|
| `sentiment` | 25 | Category-relative avg rating / sentiment mix (cohort ≥ 5) |
| `marketShare` | 20 | Share of feedback volume within category (cohort ≥ 5) |
| `pricing` | 15 | Proximity to category median price |
| `featureCoverage` | 15 | Distinct feedback categories covered vs category max |
| `influencerReach` | 10 | Approved influencer posts tagging brand |
| `consumerLoyalty` | 15 | Repeat-feedback ratio (proxy — real CRM data unavailable) |

Privacy: dimensions with cohort < 5 return `null` and are excluded from denominator (normalise upward). If effective weight < 40, no score is persisted.

---

## Migration 011 — Deals/Community FK CASCADE Hardening (19 new FKs)

Applied via `POST /api/admin/run-migration-011`. Prerequisite: migration 010.

Migration 009 created deals/community tables with raw `TEXT` user/entity columns and no FK constraints, leaving rows orphaned on account deletion (GDPR Art. 17 violation). Migration 011:

1. Cleans up pre-existing orphan rows (DELETE for required columns, NULL for optional columns).
2. Adds `ON DELETE CASCADE` FKs on all user references (consumer content deleted with account).
3. Adds `ON DELETE SET NULL` FKs on optional staff/admin references (audit history preserved).
4. Adds `ON DELETE CASCADE` FKs on entity references so deleting a deal/post cascades votes/saves/comments.

| Table | Column | FK type |
|-------|--------|---------|
| `deals` | `brand_id` | CASCADE → users |
| `community_deals_posts` | `author_id` | CASCADE → users |
| `community_deals_posts` | `reviewed_by` | SET NULL → users |
| `community_deals_post_votes` | `user_id` | CASCADE → users |
| `community_deals_post_votes` | `post_id` | CASCADE → community_deals_posts |
| `community_deals_post_saves` | `user_id` | CASCADE → users |
| `community_deals_post_saves` | `post_id` | CASCADE → community_deals_posts |
| `community_deals_comments` | `author_id` | CASCADE → users |
| `community_deals_comments` | `post_id` | CASCADE → community_deals_posts |
| `community_deals_comment_votes` | `user_id` | CASCADE → users |
| `community_deals_comment_votes` | `comment_id` | CASCADE → community_deals_comments |
| `deal_saves` | `user_id` | CASCADE → users |
| `deal_saves` | `deal_id` | CASCADE → deals |
| `deal_redemptions` | `consumer_id` | CASCADE → users |
| `deal_redemptions` | `deal_id` | CASCADE → deals |
| `community_deals_flags` | `reporter_id` | CASCADE → users |
| `community_deals_flags` | `reviewed_by` | SET NULL → users |
| `community_deals_flags` | `post_id` | CASCADE (when content_type='post') |
| `community_deals_flags` | `comment_id` | CASCADE (when content_type='comment') |

---

## Migration 012 — DSAR Requests (1 new table)

Applied via `POST /api/admin/run-migration-012`. Prerequisite: migration 011.

### `dsar_requests`

Data Subject Access Request tracking. One row per consumer request. FK CASCADE → users (account deletion removes all DSAR records).

Columns: `id` (UUID PK), `consumer_id` (TEXT → users CASCADE), `status` (`'otp_sent' \| 'generating' \| 'completed' \| 'expired' \| 'failed'`), `otp_hash` (TEXT — bcrypt hash of 6-digit OTP), `otp_expires_at` (TIMESTAMP), `otp_attempts` (INTEGER default 0), `max_otp_attempts` (INTEGER default 3), `pdf_url` (TEXT — Vercel Blob URL, set when completed), `pdf_generated_at` (TIMESTAMP), `email_sent_at` (TIMESTAMP), `expires_at` (TIMESTAMP — 7 days after generation), `ip_address` (TEXT), `user_agent` (TEXT), `created_at`, `updated_at`

Indexes:
- `(consumer_id, created_at DESC)` — fast lookup of latest request per consumer (rate limit check)
- `(status, created_at)` — cleanup cron query

---

## Consent Data Categories (3 tiers)

**Tier 1 — Platform Essentials:** `tracking`, `personalization`, `analytics`, `marketing`

**Tier 2 — Insight Signals:** `behavioral`, `demographic`, `psychographic`, `social`

**Tier 3 — Sensitive (GDPR Art. 9 / DPDP):** `sensitive_health`, `sensitive_dietary`, `sensitive_religion`, `sensitive_caste`
