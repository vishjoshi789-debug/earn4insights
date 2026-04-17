# Feature 2 — Influencers Adda

Influencer marketing marketplace. 12 DB tables, full campaign lifecycle, milestone-based payments, dispute resolution. Extended with Content Approval (migration 006), Influencer Earnings Dashboard, @ Mention Tags, and Campaign Marketplace (migration 007).

## Campaign Lifecycle

```
draft → proposed → negotiating → active → completed
                                      ↘ cancelled
                                      ↘ disputed → active (after resolution)
```

## Payment Flow

```
1. Brand creates campaign with budget
2. Brand adds milestones (total must not exceed budget)
3. Brand escrows funds for milestone → payment status: 'escrowed'
4. Influencer submits deliverable → milestone status: 'submitted'
5. Brand approves milestone → milestone: 'approved', payment: 'released'
   Brand rejects → milestone: 'rejected' (influencer can resubmit)
```

Platform fee calculated at escrow time: `Math.round(amount * platformFeePct / 100)`

## Key Design Decisions

| Decision | Why |
|----------|-----|
| **Consumers can register as influencers** | `is_influencer` flag on users table. Same auth, extended profile. No separate user type. |
| **Milestone payments don't exceed budget** | Hard validation at milestone creation. Prevents over-commitment. |
| **Status transitions are validated** | `VALID_TRANSITIONS` map prevents invalid state changes (e.g., draft→completed). |
| **Disputes auto-set campaign to 'disputed'** | Makes dispute status visible in campaign listings. Reverts to 'active' when all disputes resolved. |
| **Reviews only on completed campaigns** | Prevents premature reviews. One review per reviewer per campaign (UNIQUE constraint). |

## Known Gaps

| Item | Notes |
|------|-------|
| **Influencer earnings dashboard** | ✅ DONE — `/dashboard/influencer/earnings`. Multi-currency, audience intelligence panel, CSV export. |
| **Campaign content approval flow** | ✅ DONE — SLA-based review, 75%/90%/100% cron reminders, auto-approve, audit log. See Content Approval section below. |
| **Razorpay integration** | ✅ DONE — Order creation, HMAC verification, escrow, release, refund, webhooks, payout accounts, influencer payouts page, admin queue. See Razorpay Payment Integration section below. |
| **Social stats API verification** | Stats are self-declared. Need platform API integrations to verify. |
| **Campaign search for influencers** | ✅ DONE — `/dashboard/influencer/marketplace`. Public browse, filters, recommended, apply/withdraw, brand accept/reject. See Campaign Marketplace section below. |

---

## Influencer Earnings Dashboard

Full multi-currency earnings breakdown at `/dashboard/influencer/earnings`.

- **Summary cards:** total earned, pending, campaign count, avg per campaign — grouped per currency
- **Audience intelligence:** ICP-matched audience demographics (consent-gated — only consumers with active 'demographic' consent), min cohort 5 to prevent re-identification
- **Campaign deep-dive:** lazy-loaded per-campaign breakdown with performance metrics
- **CSV export** from `EarningsTable` component
- **Currency utility** at `src/lib/currency.ts` — 10 currencies (INR, USD, EUR, GBP, AED, SGD, AUD, CAD, JPY, BRL), `formatCurrency()`, `convertToMajor/Minor()`

API routes: `GET /api/influencer/earnings`, `GET /api/influencer/earnings/analytics`, `GET /api/influencer/earnings/[campaignId]`

---

## Campaign Content Approval

SLA-based review workflow for influencer content before it goes live.

### Status Lifecycle

```
draft → pending_review → approved → published
              ↘ rejected → (edit) → pending_review (resubmit)
```

### SLA Flow (cron every 2 hours)

```
75% of SLA elapsed  → remind brand (75_pct reminder)
90% of SLA elapsed  → urgent reminder (90_pct reminder)
100% elapsed + autoApproveEnabled=true  → auto-approve + publish
100% elapsed + autoApproveEnabled=false → escalation notification to brand
```

### Key Design Decisions

| Decision | Why |
|----------|-----|
| **Reminder deduplication via DB + catch-23505** | UNIQUE index on `(post_id, reminder_type)` + pre-check + constraint catch. Belt-and-suspenders to prevent double-notifying. |
| **Role validation at two layers** | Route: checks role. Service: brand → `isBrandCampaignOwner()`, admin → bypass. Prevents cross-brand approval. |
| **Audit log on every approval/rejection** | Writes to `audit_log` with action, postId, actorId, metadata. Admin actions included. |
| **Rejection reason min 10 chars** | Enforced in service layer (not just UI). Ensures actionable feedback to influencer. |
| **Resubmission increments counter** | `resubmissionCount` lets brand see revision history context in review UI. |

---

## @ Mention Tags (Influencer Content Creation)

Influencer content posts support `@mention` tags for discoverability across 4 entity types.

### API: `GET /api/search/mentions?q=searchTerm`

- Auth required
- Returns max 3 results per type (12 total): `categories[]`, `brands[]`, `products[]`, `influencers[]`
- Categories from static platform taxonomy (no DB query)
- Brands: `users` table WHERE `role='brand'` AND `name ILIKE %q%`
- Products: `products` table WHERE `name ILIKE %q%`
- Influencers: `influencer_profiles` table WHERE `displayName ILIKE %q%`

### `TagMentionInput` component (inside `influencer/content/page.tsx`)

| Behaviour | Detail |
|-----------|--------|
| Type `@` | Popover opens immediately |
| Type letters | 300ms debounced API call |
| Keyboard nav | ↑↓ navigate, Enter select, Escape close |
| Click result | Inserts `@Label` as pill, clears input |
| Plain text + Enter | Adds as plain tag (no @) |
| Pill colors | @ tags = blue; plain tags = grey |
| Remove tag | × button on each pill |
| Max results | 12 shown (3 per type) |

Tags stored as `string[]` in `influencerContentPosts.tags` (existing JSONB column — no schema change needed).

---

## Campaign Marketplace

Public marketplace where influencers discover and apply to brand campaigns.

### Schema (Migration 007)

ALTER `influencer_campaigns`: add `is_public` (BOOLEAN), `max_influencers` (INTEGER), `application_deadline` (DATE).

New table `campaign_applications`: id, campaign_id, influencer_id, proposal_text, proposed_rate, proposed_currency, status (`pending|reviewing|accepted|rejected|withdrawn`), brand_response, applied_at, responded_at. UNIQUE(campaign_id, influencer_id) + 4 indexes.

### Application Flow

```
Influencer browses marketplace → Views campaign detail → Submits proposal (min 50 chars + rate)
  → Brand receives real-time notification
  → Brand accepts or rejects (with optional response)
  → Influencer receives real-time notification
```

### Recommended Campaigns

- Fetches influencer's `niche[]` from `influencer_profiles`
- Queries 3x limit of public campaigns, filters by niche overlap in JS
- Excludes already-applied and already-invited campaigns
- Returns top 6

### ICP Match Badge

- Only shown when campaign has `icpId` AND `icp_match_scores` row exists for the influencer
- Score thresholds: ≥80 = "Great Match" (green), 60-79 = "Good Match" (yellow), <60 = "Fair Match" (grey)
- Hidden entirely when no ICP or no score — no misleading labels

### Key Design Decisions

| Decision | Why |
|----------|-----|
| **is_public default false** | Existing campaigns remain invite-only. Brand explicitly opts in. |
| **UNIQUE(campaign_id, influencer_id) + 23505 catch** | Belt-and-suspenders duplicate prevention. |
| **Niche match in JS, not SQL** | Array-to-text overlap matching is cleaner in JS than SQL. Fetch 3x, filter, slice. |
| **Applications tab inside campaign detail** | Brand stays in campaign context. Consistent with Milestones/Payments pattern. |
| **Application deadline checked in service** | Not just UI — service validates `new Date() > deadline` before creating. |
| **Max influencers checked against non-withdrawn count** | Withdrawn applications don't count toward the cap. |

### Real-Time Events (3 new)

| Event | Target | Trigger |
|-------|--------|---------|
| `influencer.campaign.applied` | Brand | Influencer submits application |
| `brand.application.accepted` | Influencer | Brand accepts application |
| `brand.application.rejected` | Influencer | Brand rejects application |

---

## Razorpay Payment Integration

Full escrow-based payment flow for milestone campaigns. Migration 008 adds 4 tables: `razorpay_orders`, `payout_accounts`, `influencer_payouts`, `reward_redemptions`.

### Escrow & Release Flow

```
Brand escrows milestone funds:
  POST /api/payments/create-order  →  Razorpay creates order (status: 'created')
  Brand pays in browser (Razorpay checkout)
  POST /api/payments/verify        →  HMAC-SHA256 signature verified → order status: 'paid'
                                       campaign_payments record: 'escrowed'

Brand releases payment after milestone approval:
  POST /api/payments/release/[campaignId]  →  campaign_payments: 'released'
                                               influencer_payouts record: 'pending' (admin queue)

Admin processes payout manually at /admin/payouts:
  POST /api/admin/payouts/[id]/process     →  status: 'processing'
  POST /api/admin/payouts/[id]/complete    →  status: 'completed' (includes transfer reference)
  POST /api/admin/payouts/[id]/fail        →  status: 'failed'
```

### Refund Flow

```
POST /api/payments/refund/[orderId]
  Guards: order must be 'paid', not 'refunded', and milestone payment not already 'released'
  Calls Razorpay Refund API → order status: 'refunded'
  campaign_payments: status reverted to 'escrowed' → admin handles reversal
```

### Webhook (`POST /api/webhooks/razorpay`)

- HMAC-SHA256 signature verified with `crypto.timingSafeEqual()` (constant-time, no timing attack)
- **Awaited synchronously** (not fire-and-forget) — Vercel serverless would terminate before async processing completes
- Handles: `payment.captured` → escrow, `order.paid`, `refund.created` → refund lookup by `razorpayPaymentId`
- Idempotent: already-paid orders return 200 without double-processing

### Payout Accounts

Influencers and consumers register payout destinations at `/dashboard/influencer/payouts`.

- Account types: `bank_account` (IFSC), `upi`, `wise`, `paypal`
- Sensitive fields AES-256-GCM encrypted (`accountNumber`, `ifscCode`, `upiId`, `wiseEmail`, `paypalEmail`)
- Admin view: decrypts then masks to last-4 digits (`••••1234`) — never exposes full plaintext
- Primary account: PARTIAL UNIQUE constraint (one primary per user per currency), swap wrapped in `db.transaction()` to prevent race condition

### Payout Method Resolution

```ts
currency === 'INR' + accountType === 'bank_account'|'upi'  → 'razorpay_payout'  (manual now, auto when RAZORPAYX_ENABLED=true)
accountType === 'wise'    → 'wise_manual'
accountType === 'paypal'  → 'paypal_manual'
else                      → 'bank_manual'
```

### Platform Fee Schedule

| Context | Fee |
|---------|-----|
| Milestone escrow | 8% |
| Direct escrow | 10% |
| Order-level | 12% |

`influencerAmount = amount - platformFee` stored alongside `amount` on both `razorpay_orders` and `campaign_payments`.

### Consumer Reward Redemptions

Consumers redeem points at `POST /api/consumer/rewards/redeem`:
- Minimum 500 points per redemption; `POINTS_PER_INR = 10` (10 pts = ₹1 = ₹0.10/pt)
- Types: `platform_credits` (instant), `voucher` (pending), `cash_payout` (pending, requires payout account)
- Race condition prevention: duplicate-pending check runs BEFORE balance deduction; `deductPoints()` has atomic internal guard as final layer

### Security Hardening

| Issue | Fix |
|-------|-----|
| Timing attack on HMAC | `crypto.timingSafeEqual()` with constant-time buffer comparison |
| Webhook fire-and-forget | `await processWebhookAsync()` before returning 200 |
| Double-refund | Guard checks `order.status !== 'paid'` before calling Razorpay |
| Refund after release | Guard checks `campaign_payments.status !== 'released'` before refunding |
| Payment verification ownership | `existingOrder.brandId !== brandId` check on idempotent re-verify path |
| Primary account deletion | Blocked — must set another account as primary first |
| Decrypt before masking | `decryptFromStorage()` → then slice(-4), not `encryptedValue.slice(-4)` |
| Mark-failed on completed payout | Guard: `if (payout.status === 'completed') throw` |
| setPrimaryAccount race | Wrapped unset+set in `db.transaction()` |

### Admin Queue (`/admin/payouts`)

`GET /api/admin/payouts/pending` — returns `pending`, `processing`, `failed` payouts with masked account details.

### Key API Routes

| Route | Auth | Purpose |
|-------|------|---------|
| `POST /api/payments/create-order` | brand | Create Razorpay order for milestone escrow |
| `POST /api/payments/verify` | brand | Verify HMAC signature, record escrow |
| `POST /api/payments/release/[campaignId]` | brand | Release escrowed payment after milestone approval |
| `POST /api/payments/refund/[orderId]` | brand | Refund a paid order |
| `POST /api/webhooks/razorpay` | HMAC | Handle Razorpay payment/refund webhooks |
| `GET /api/payouts/accounts` | influencer/consumer | List own payout accounts |
| `POST /api/payouts/accounts` | influencer/consumer | Add payout account |
| `PATCH /api/payouts/accounts/[id]/primary` | influencer/consumer | Set primary account |
| `DELETE /api/payouts/accounts/[id]` | influencer/consumer | Delete non-primary account |
| `GET /api/admin/payouts/pending` | admin | View admin payout queue (masked accounts) |
| `POST /api/admin/payouts/[id]/process` | admin | Mark payout as processing |
| `POST /api/admin/payouts/[id]/complete` | admin | Mark payout completed (add transfer ref) |
| `POST /api/admin/payouts/[id]/fail` | admin | Mark payout failed with reason |
| `POST /api/admin/payouts/[id]/retry` | admin | Retry failed payout (max 3) |
| `GET /api/cron/process-payouts` | CRON_SECRET | Daily: create missing payouts, retry failed |
| `GET /api/cron/sync-razorpay-status` | CRON_SECRET | Daily: sync RazorpayX payout status (placeholder) |

---

## UI Fixes

| Fix | File | Detail |
|-----|------|--------|
| Media type select invisible | `influencer/content/page.tsx` | Added `bg-background text-foreground border-input` to native `<select>` — options now visible in all themes |
| Campaign dialog SLA section hidden | `brand/campaigns/page.tsx` + `components/ui/dialog.tsx` | Dialog backdrop now uses `overflow-y-auto` + inner box `my-auto`; tall forms fully scrollable |

---

## File Map

```
src/
├── db/
│   ├── schema.ts                                  # MODIFIED — 12 tables + is_influencer flag on users
│   ├── migrations/
│   │   └── 004_influencer_adda.sql                # NEW — 11 tables, 15 indexes, ALTER users
│   └── repositories/
│       ├── influencerProfileRepository.ts         # NEW — profile CRUD, search, verification
│       ├── influencerSocialStatsRepository.ts     # NEW — per-platform stats upsert
│       ├── influencerContentPostRepository.ts     # NEW — content post CRUD
│       ├── contentApprovalRepository.ts           # NEW — pending posts, SLA queries, reminders, audit log
│       ├── influencerEarningsRepository.ts        # NEW — earnings summary, per-currency, audience (consent-gated)
│       ├── influencerCampaignRepository.ts        # NEW — campaign CRUD, brand/influencer queries
│       ├── campaignInfluencerRepository.ts        # NEW — invitation management
│       ├── campaignMilestoneRepository.ts         # NEW — milestone CRUD, amount totals
│       ├── campaignPaymentRepository.ts           # NEW — payment CRUD, escrow/release totals
│       ├── campaignPerformanceRepository.ts       # NEW — metrics recording, aggregation
│       ├── influencerFollowRepository.ts          # NEW — follow/unfollow, counts
│       ├── influencerReviewRepository.ts          # NEW — reviews, average rating
│       ├── campaignDisputeRepository.ts           # NEW — dispute CRUD, resolution
│       └── campaignMarketplaceRepository.ts      # NEW — public listings, recommended, applications, ICP match
│
├── lib/
│   └── currency.ts                                # NEW — 10-currency support, formatCurrency(), convertToMajor/Minor()
│
├── components/influencer/earnings/
│   ├── EarningsOverviewCards.tsx                  # NEW — 6-card summary grid, multi-currency
│   ├── PaymentBreakdown.tsx                       # NEW — per-currency breakdown, disabled payout button
│   ├── EarningsTable.tsx                          # NEW — sortable/filterable table, CSV export
│   ├── AudienceIntelligencePanel.tsx              # NEW — ICP gauge + charts, privacy notice < cohort 5
│   ├── PerformanceCharts.tsx                      # NEW — 5 chart wrappers + PlaceholderChart
│   └── CampaignDeepDive.tsx                       # NEW — lazy-loaded, self-fetching per campaign
│
├── components/influencer/marketplace/
│   ├── CampaignCard.tsx                          # NEW — campaign card with match badge, platform pills, apply CTA
│   ├── CampaignDetailPanel.tsx                   # NEW — slide-out panel with full brief + apply form
│   └── ApplicationsTracker.tsx                   # NEW — "My Applications" tab with status filters
│
├── server/
│   ├── influencerProfileService.ts                # NEW — registration, discovery, public profiles
│   ├── campaignManagementService.ts               # NEW — campaign lifecycle, invitations, status transitions
│   ├── campaignPaymentService.ts                  # NEW — milestone + escrow payment flows
│   ├── campaignPerformanceService.ts              # NEW — metrics recording, campaign analytics
│   ├── disputeResolutionService.ts                # NEW — dispute lifecycle, admin resolution
│   ├── contentApprovalService.ts                  # NEW — submitForReview, approve, reject, resubmit, processAutoApprovals
│   ├── influencerEarningsService.ts               # NEW — getEarningsSummary, getAudienceAnalytics, getCampaignDeepDiveData
│   └── campaignMarketplaceService.ts             # NEW — marketplace browse, apply, respond, ICP enrichment
│
└── app/
    ├── dashboard/
    │   ├── DashboardShell.tsx                     # MODIFIED — influencer + brand campaign nav + Content Review + Marketplace
    │   ├── influencer/
    │   │   ├── profile/page.tsx                   # NEW — register/edit influencer profile
    │   │   ├── campaigns/page.tsx                 # NEW — list campaign invitations
    │   │   ├── campaigns/[campaignId]/page.tsx    # NEW — campaign detail, accept/reject, submit milestones
    │   │   ├── content/page.tsx                   # MODIFIED — status badges, Submit for Review, Edit & Resubmit
    │   │   ├── earnings/page.tsx                  # NEW — earnings dashboard (summary, charts, audience, CSV)
    │   │   └── marketplace/page.tsx               # NEW — browse campaigns, recommended, filters, apply
    │   └── brand/
    │       ├── campaigns/page.tsx                 # MODIFIED — SLA + auto-approve + marketplace fields (isPublic, maxInfluencers, deadline)
    │       ├── campaigns/[campaignId]/page.tsx    # MODIFIED — campaign detail with Applications tab (accept/reject inline)
    │       ├── content-review/page.tsx            # NEW — pending review queue, SLA badges, approve/reject UI
    │       └── influencers/page.tsx               # NEW — discover/search influencer profiles
    └── api/
        ├── admin/
        │   ├── run-migration-004/route.ts         # NEW — apply Influencers Adda migration
        │   ├── run-migration-006/route.ts         # NEW — apply Content Approval migration (2 ALTERs + 1 table)
        │   └── run-migration-007/route.ts         # NEW — apply Campaign Marketplace migration (3 ALTERs + 1 table)
        │   └── content/
        │       ├── pending/route.ts               # NEW — GET all pending posts (admin)
        │       ├── [id]/approve/route.ts          # NEW — POST admin approve (bypasses ownership)
        │       └── [id]/reject/route.ts           # NEW — POST admin reject with reason
        ├── influencer/
        │   ├── profile/route.ts                   # NEW — GET/POST/PATCH own profile
        │   ├── discover/route.ts                  # NEW — GET search/browse influencers
        │   ├── social-stats/route.ts              # NEW — GET/POST platform stats
        │   ├── content/route.ts                   # NEW — GET/POST content posts
        │   ├── content/[postId]/route.ts          # NEW — GET/PATCH/DELETE single post
        │   ├── posts/[id]/submit-review/route.ts  # NEW — POST submit draft for brand review
        │   ├── posts/[id]/resubmit/route.ts       # NEW — POST resubmit rejected post with edits
        │   ├── earnings/route.ts                  # NEW — GET earnings summary
        │   ├── earnings/analytics/route.ts        # NEW — GET audience analytics (consent-gated, cohort≥5)
        │   ├── earnings/[campaignId]/route.ts     # NEW — GET per-campaign deep-dive
        │   ├── applications/route.ts              # NEW — GET influencer's marketplace applications
        │   └── campaigns/
        │       ├── route.ts                       # NEW — GET influencer's campaigns
        │       └── [campaignId]/route.ts          # NEW — GET detail, PATCH accept/reject/submit
        ├── brand/
        │   ├── campaigns/
        │   │   ├── route.ts                       # NEW — GET/POST brand campaigns
        │   │   └── [campaignId]/
        │   │       ├── route.ts                   # NEW — GET/PATCH/DELETE campaign
        │   │       ├── influencers/route.ts       # NEW — GET/POST/DELETE manage influencers
        │   │       ├── milestones/route.ts        # NEW — GET/POST milestones
        │   │       ├── milestones/[milestoneId]/route.ts # NEW — PATCH approve/reject/escrow, DELETE
        │   │       ├── payments/route.ts          # NEW — GET payment summary
        │   │       ├── performance/route.ts       # NEW — GET analytics, POST record metrics
        │   │       ├── disputes/route.ts          # NEW — GET/POST brand disputes
        │   │       └── applications/route.ts     # NEW — GET applications for campaign (brand)
        │   ├── applications/
        │   │   └── [id]/respond/route.ts          # NEW — POST brand accept/reject application
        │   └── content/
        │       ├── pending/route.ts               # NEW — GET brand's pending posts with SLA status
        │       ├── [id]/approve/route.ts          # NEW — POST brand approve (ownership-checked)
        │       └── [id]/reject/route.ts           # NEW — POST brand reject with reason (min 10 chars)
        ├── cron/
        │   └── process-content-reviews/route.ts   # NEW — every 2h: SLA reminders + auto-approve/escalate
        ├── marketplace/campaigns/
        │   ├── route.ts                           # NEW — GET public campaign listings with filters
        │   ├── recommended/route.ts               # NEW — GET top-6 recommended for influencer
        │   └── [campaignId]/
        │       ├── route.ts                       # NEW — GET campaign detail for marketplace
        │       └── apply/route.ts                 # NEW — POST apply + DELETE withdraw
        ├── campaigns/[campaignId]/
        │   ├── reviews/route.ts                   # NEW — GET/POST campaign reviews
        │   └── disputes/route.ts                  # NEW — GET/POST/PATCH disputes (influencer + admin)
        └── consumer/follows/[influencerId]/route.ts  # NEW — GET/POST/DELETE follow/unfollow
```
