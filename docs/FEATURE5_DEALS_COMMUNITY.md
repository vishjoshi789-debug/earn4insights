# Feature 5 — Deals Discovery + Community Platform

Brand deals marketplace and Reddit-style community feed. 9 DB tables (migration 009) + FK CASCADE hardening (migration 011). Full moderation system, flagging, auto-approval cron.

**Status: ✅ COMPLETE (April 2026)**

---

## Overview

Two parallel surfaces:

- **Deals Discovery** (`/dashboard/deals`) — Brand-published deals (promo codes, redirects, discounts, BOGO, free shipping) shown to consumers. Full-text search, save, redeem (10 pts).
- **Community Deals Feed** (`/dashboard/community-deals`) — Reddit-style user-generated posts: deals, reviews, discussions, alerts. Upvote/downvote, threaded comments, flagging, admin moderation.

---

## Schema (Migration 009)

Applied via `POST /api/admin/run-migration-009`.

### `deals`

Brand-created deals/offers.

Columns: `id` (UUID PK), `brand_id` (TEXT), `title` (TEXT), `description` (TEXT), `deal_type` (`'promo_code' | 'redirect' | 'percentage_off' | 'fixed_off' | 'bogo' | 'free_shipping'`), `promo_code` (TEXT nullable), `redirect_url` (TEXT nullable), `discount_value` (INTEGER nullable), `discount_unit` (`'percent' | 'fixed'` nullable), `original_price` (INTEGER nullable paise), `deal_price` (INTEGER nullable paise), `category` (TEXT), `tags` (TEXT[]), `is_featured` (BOOLEAN), `is_verified` (BOOLEAN), `status` (`'draft' | 'active' | 'paused' | 'expired'`), `valid_from` (TIMESTAMP), `valid_until` (TIMESTAMP nullable), `max_redemptions` (INTEGER nullable), `redemption_count` (INTEGER default 0), `view_count` (INTEGER default 0), `save_count` (INTEGER default 0), `icp_target_data` (JSONB nullable — targeting criteria, not yet wired to ICP scoring), `search_vector` (tsvector — managed by DB trigger, NOT in Drizzle schema), `created_at`, `updated_at`

Indexes: `(brand_id, status)`, `(status, valid_until)` — expiry cron, `(is_featured, status)`, GIN on `search_vector`

### `community_deals_posts`

Reddit-style user-generated posts. Require admin/moderator approval before public visibility (`default status: 'pending'`).

Columns: `id`, `author_id` (TEXT), `title` (TEXT), `body` (TEXT), `post_type` (`'deal' | 'review' | 'discussion' | 'alert'`), `deal_id` (UUID nullable → deals), `external_url` (TEXT nullable), `tags` (TEXT[]), `status` (`'pending' | 'approved' | 'rejected' | 'removed' | 'needs_edit'`), `upvote_count` (INTEGER), `downvote_count` (INTEGER), `comment_count` (INTEGER), `save_count` (INTEGER), `flag_count` (INTEGER), `is_brand_verified` (BOOLEAN — post from a verified brand account), `reviewed_by` (TEXT nullable), `reviewed_at` (TIMESTAMP nullable), `rejection_reason` (TEXT nullable), `points_awarded` (INTEGER default 0 — wired to moderation approval, not yet linked to points ledger), `search_vector` (tsvector — DB trigger), `created_at`, `updated_at`

Indexes: `(status, created_at DESC)`, `(author_id)`, `(deal_id)`, GIN on `search_vector`

### `community_deals_post_votes`

Per-user upvote/downvote on posts. **UNIQUE `(post_id, user_id)`**.

Columns: `id`, `post_id` (UUID → community_deals_posts), `user_id` (TEXT), `vote_type` (`'up' | 'down'`), `created_at`

### `community_deals_post_saves`

Consumer bookmarked posts. **UNIQUE `(post_id, user_id)`**.

Columns: `id`, `post_id`, `user_id`, `saved_at`

### `community_deals_comments`

Threaded comments on community posts. Self-referential `parent_comment_id` for nesting.

Columns: `id`, `post_id` (UUID → community_deals_posts), `author_id` (TEXT), `body` (TEXT), `parent_comment_id` (UUID nullable self-ref), `status` (`'active' | 'removed' | 'flagged'`), `upvote_count` (INTEGER), `flag_count` (INTEGER), `is_brand_verified` (BOOLEAN), `created_at`, `updated_at`

Indexes: `(post_id, created_at)`, `(parent_comment_id)`

### `community_deals_comment_votes`

Per-user upvote on comments. **UNIQUE `(comment_id, user_id)`**.

Columns: `id`, `comment_id`, `user_id`, `vote_type` (`'up'`), `created_at`

### `deal_saves`

Consumer saved deals from the deals discovery feed. **UNIQUE `(deal_id, user_id)`**.

Columns: `id`, `deal_id` (UUID → deals), `user_id` (TEXT), `saved_at`

### `deal_redemptions`

Tracks each deal redemption event per consumer.

Columns: `id`, `deal_id` (UUID → deals), `consumer_id` (TEXT), `redemption_type` (`'promo_code_copied' | 'redirect_clicked'`), `points_awarded` (INTEGER default 10), `redeemed_at`

Indexes: `(deal_id, consumer_id)`, `(consumer_id)`

### `community_deals_flags`

Spam/fraud/inappropriate flags on posts or comments.

Columns: `id`, `content_type` (`'post' | 'comment'`), `content_id` (TEXT), `reporter_id` (TEXT), `reason` (`'spam' | 'fake_deal' | 'inappropriate' | 'duplicate' | 'other'`), `details` (TEXT nullable), `status` (`'pending' | 'reviewed | 'dismissed'`), `reviewed_by` (TEXT nullable), `reviewed_at` (TIMESTAMP nullable), `created_at`

Indexes: `(content_type, content_id)`, `(status)`

### Key Indexes (migration 009)

| Table | Index |
|-------|-------|
| `deals` | `(brand_id, status)`, `(status, valid_until)`, `(is_featured, status)`, GIN `search_vector` |
| `community_deals_posts` | `(status, created_at DESC)`, `(author_id)`, `(deal_id)`, GIN `search_vector` |
| `community_deals_comments` | `(post_id, created_at)`, `(parent_comment_id)` |
| `community_deals_flags` | `(content_type, content_id)`, `(status)` |
| `deal_redemptions` | `(deal_id, consumer_id)`, `(consumer_id)` |

### Full-Text Search

`search_vector` on `deals` and `community_deals_posts` is a `tsvector` column managed by a **Postgres DB trigger**, not Drizzle ORM. The column is not declared in `schema.ts` — it is invisible to Drizzle queries. The GIN index enables `to_tsquery()` full-text search via raw SQL fragments in the repository.

---

## Migration 011 — FK CASCADE Hardening (GDPR Art. 17)

Applied via `POST /api/admin/run-migration-011`. Prerequisite: migration 010.

Migration 009 created all tables with raw `TEXT` user/entity columns — no FK constraints. On user account deletion, rows were left as orphans (GDPR Art. 17 violation). Migration 011 adds 19 FKs:

**Approach:**
1. First cleans up any pre-existing orphan rows (DELETE for required columns, UPDATE SET NULL for optional).
2. Adds FK constraints wrapped in idempotent `DO $$ IF NOT EXISTS $$` blocks.

**FK types:**

| Column role | FK behavior | Rationale |
|-------------|-------------|-----------|
| `user_id`, `author_id`, `consumer_id`, `reporter_id` | `ON DELETE CASCADE` | Consumer content deleted with account |
| `reviewed_by` (optional staff/admin ref) | `ON DELETE SET NULL` | Preserves audit history; reviewer identity lost but record survives |
| `post_id`, `comment_id`, `deal_id` (entity refs) | `ON DELETE CASCADE` | Votes/saves/comments cascade with parent |

---

## Services

### `dealsService` (`src/server/dealsService.ts`)

Deals CRUD, feed, redemption, save/unsave.

Key functions:
- `getDealsFeed(filters)` — paginated feed with category, type, featured, search filters
- `getDealById(dealId)` — single deal with redemption count
- `createDeal(brandId, data)` — brand creates deal (starts as 'draft')
- `publishDeal(dealId, brandId)` — transitions draft → active
- `pauseDeal(dealId, brandId)` — transitions active → paused
- `redeemDeal(dealId, consumerId, type)` — records redemption, awards 10 pts, increments counts
- `saveDeal(dealId, userId)` / `unsaveDeal(...)` — save/unsave with UNIQUE guard
- `getSavedDeals(userId)` — consumer's saved deals
- `getDealAnalytics(dealId, brandId)` — views/saves/redemptions per deal

### `communityService` (`src/server/communityService.ts`)

Posts, comments, votes, saves, flagging.

Key functions:
- `getPosts(filters)` — paginated feed (approved only for consumers)
- `createPost(authorId, data)` — creates with `status: 'pending'`
- `votePost(postId, userId, voteType)` — upsert vote, update counts (UNIQUE guard)
- `savePost(postId, userId)` / `unsavePost(...)` — save/unsave
- `addComment(postId, authorId, body, parentCommentId?)` — threaded comment
- `voteComment(commentId, userId)` — upvote comment
- `flagContent(contentType, contentId, reporterId, reason)` — create flag record

### `dealsModerationService` (`src/server/dealsModerationService.ts`)

Admin approve/reject, auto-moderation, flag resolution.

Key functions:
- `approvePost(postId, moderatorId)` — sets `status: 'approved'`, awards points (not yet wired to points ledger)
- `rejectPost(postId, moderatorId, reason)` — sets `status: 'rejected'`
- `removePost(postId, moderatorId)` — sets `status: 'removed'`
- `resolveFlag(flagId, moderatorId, action)` — sets flag status
- `processAutoApprovals(windowHours)` — approves `pending` posts older than window
- `autoHideFlaggedPosts(threshold)` — hides posts with `flag_count >= threshold` (default 5)

---

## Cron Jobs (2 routes)

| Time (UTC) | Route | Purpose |
|------------|-------|---------|
| 04:00 | `/api/cron/community-deals-moderation` | Auto-approve `pending` posts past window; auto-hide posts with ≥ 5 flags |
| 05:00 | `/api/cron/deals-expiry` | Mark `deals` with `valid_until < NOW()` as `expired` |

---

## Key Design Decisions

| Decision | Why |
|----------|-----|
| **Community posts default to `pending`** | All posts require approval before public visibility. Prevents spam going live instantly. |
| **Flag auto-hide at ≥ 5 flags** | Automatic removal prevents viral spread of flagged content without requiring real-time admin action. |
| **Deal redemption: 10 pts flat** | Simple and predictable. No complex valuation logic at redemption time. |
| **tsvector managed by DB trigger** | Full-text search without adding a column to Drizzle schema. Trigger fires on insert/update; GIN index covers queries. |
| **FK CASCADE on user content, SET NULL on staff refs** | GDPR Art. 17 compliance: consumer data deleted with account. Staff audit history preserved (reviewer identity anonymised but action recorded). |
| **`icpTargetData` JSONB stored but not wired** | Brands can store ICP targeting criteria now; consumer-side filtering deferred until ICP→deal scoring is implemented. |
| **`pointsAwarded` column exists but not wired to ledger** | Moderation approval sets the field; integration with `rewardTransactions` table is a future step. |

---

## Known Gaps

| Item | Notes |
|------|-------|
| **Deal ICP targeting** | `icp_target_data` JSONB column on `deals` not yet wired to ICP scoring — consumer feed shows all active deals regardless of ICP match |
| **Community post points system** | `points_awarded` column exists; awarding logic in moderation approval not yet linked to `rewardTransactions` ledger |
| **Brand deal analytics page** | `/api/brand/deals/[id]/analytics` route exists; full analytics dashboard UI not yet built |

---

## API Routes

### Consumer — Deals

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/deals/feed` | Paginated deals feed (category, type, featured, search filters) |
| GET | `/api/deals/[id]` | Single deal detail |
| POST | `/api/deals/[id]/redeem` | Record redemption + award 10 pts |
| POST | `/api/deals/[id]/save` | Save/unsave deal |
| GET | `/api/deals/saved` | Consumer's saved deals |
| GET | `/api/deals/redemptions` | Consumer's redemption history |
| GET | `/api/deals/search` | Full-text tsvector search |

### Consumer — Community

| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/community-deals/posts` | Paginated feed / create post |
| GET | `/api/community-deals/posts/[id]` | Single post with comments |
| POST | `/api/community-deals/posts/[id]/vote` | Upvote/downvote |
| POST | `/api/community-deals/posts/[id]/save` | Save/unsave post |
| POST | `/api/community-deals/posts/[id]/flag` | Flag post |
| GET/POST | `/api/community-deals/posts/[id]/comments` | List / add comment |
| POST | `/api/community-deals/posts/[id]/comments/[commentId]/vote` | Vote on comment |
| GET | `/api/community-deals/saved` | Consumer's saved posts |

### Brand — Deals

| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/brand/deals` | List own deals / create deal |
| GET/PATCH/DELETE | `/api/brand/deals/[id]` | Manage deal |
| POST | `/api/brand/deals/[id]/publish` | Publish draft deal |
| POST | `/api/brand/deals/[id]/pause` | Pause active deal |
| GET | `/api/brand/deals/[id]/analytics` | View/save/redemption analytics |
| GET | `/api/brand/community-deals` | Brand's own community posts |

### Admin — Moderation

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/admin/community-deals/pending` | Pending posts queue |
| GET | `/api/admin/community-deals/flagged` | Flagged posts/comments queue |
| POST | `/api/admin/community-deals/moderate` | Approve/reject/remove post |

---

## File Map

```
src/
├── server/
│   ├── dealsService.ts                                  # CRUD, feed, redemption, save
│   ├── communityService.ts                              # Posts, comments, votes, saves, flags
│   └── dealsModerationService.ts                        # Admin + auto-moderation
│
├── db/
│   ├── schema.ts                                        # MODIFIED — 9 deals/community tables
│   └── repositories/
│       ├── dealsRepository.ts                           # 30+ functions: feed, brand, analytics
│       └── communityDealsRepository.ts                  # 30+ functions: posts, comments, votes, flags
│
└── app/
    ├── dashboard/
    │   ├── deals/page.tsx                               # Consumer deals discovery feed
    │   ├── community-deals/page.tsx                     # Community posts feed
    │   └── brand/
    │       └── deals/page.tsx                           # Brand deal management
    └── api/
        ├── admin/
        │   ├── run-migration-009/route.ts               # 9 tables
        │   ├── run-migration-011/route.ts               # 19 FK constraints
        │   └── community-deals/
        │       ├── pending/route.ts
        │       ├── flagged/route.ts
        │       └── moderate/route.ts
        ├── deals/
        │   ├── feed/route.ts
        │   ├── [id]/route.ts
        │   ├── [id]/redeem/route.ts
        │   ├── [id]/save/route.ts
        │   ├── saved/route.ts
        │   ├── redemptions/route.ts
        │   └── search/route.ts
        ├── community-deals/
        │   └── posts/
        │       ├── route.ts
        │       ├── [id]/route.ts
        │       ├── [id]/vote/route.ts
        │       ├── [id]/save/route.ts
        │       ├── [id]/flag/route.ts
        │       ├── [id]/comments/route.ts
        │       └── [id]/comments/[commentId]/vote/route.ts
        ├── brand/deals/
        │   ├── route.ts
        │   ├── [id]/route.ts
        │   ├── [id]/publish/route.ts
        │   ├── [id]/pause/route.ts
        │   └── [id]/analytics/route.ts
        └── cron/
            ├── community-deals-moderation/route.ts      # 04:00 UTC
            └── deals-expiry/route.ts                    # 05:00 UTC
```
