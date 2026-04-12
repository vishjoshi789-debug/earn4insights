# Feature 2 — Influencers Adda

Influencer marketing marketplace. 11 DB tables, full campaign lifecycle, milestone-based payments, dispute resolution. Extended with Content Approval (migration 006), Influencer Earnings Dashboard, and @ Mention Tags.

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
| **Razorpay integration** | Records store Razorpay IDs but order creation + webhook handling not implemented. |
| **Social stats API verification** | Stats are self-declared. Need platform API integrations to verify. |
| **Campaign search for influencers** | No public campaign marketplace/browse — only invited campaigns visible. |

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
│   ├── schema.ts                                  # MODIFIED — 11 new tables + is_influencer flag on users
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
│       └── campaignDisputeRepository.ts           # NEW — dispute CRUD, resolution
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
├── server/
│   ├── influencerProfileService.ts                # NEW — registration, discovery, public profiles
│   ├── campaignManagementService.ts               # NEW — campaign lifecycle, invitations, status transitions
│   ├── campaignPaymentService.ts                  # NEW — milestone + escrow payment flows
│   ├── campaignPerformanceService.ts              # NEW — metrics recording, campaign analytics
│   ├── disputeResolutionService.ts                # NEW — dispute lifecycle, admin resolution
│   ├── contentApprovalService.ts                  # NEW — submitForReview, approve, reject, resubmit, processAutoApprovals
│   └── influencerEarningsService.ts               # NEW — getEarningsSummary, getAudienceAnalytics, getCampaignDeepDiveData
│
└── app/
    ├── dashboard/
    │   ├── DashboardShell.tsx                     # MODIFIED — influencer + brand campaign nav + Content Review entry
    │   ├── influencer/
    │   │   ├── profile/page.tsx                   # NEW — register/edit influencer profile
    │   │   ├── campaigns/page.tsx                 # NEW — list campaign invitations
    │   │   ├── campaigns/[campaignId]/page.tsx    # NEW — campaign detail, accept/reject, submit milestones
    │   │   ├── content/page.tsx                   # MODIFIED — status badges, Submit for Review, Edit & Resubmit
    │   │   └── earnings/page.tsx                  # NEW — earnings dashboard (summary, charts, audience, CSV)
    │   └── brand/
    │       ├── campaigns/page.tsx                 # MODIFIED — added Content Review SLA + auto-approve fields
    │       ├── campaigns/[campaignId]/page.tsx    # NEW — campaign detail, milestones, payments, influencers
    │       ├── content-review/page.tsx            # NEW — pending review queue, SLA badges, approve/reject UI
    │       └── influencers/page.tsx               # NEW — discover/search influencer profiles
    └── api/
        ├── admin/
        │   ├── run-migration-004/route.ts         # NEW — apply Influencers Adda migration
        │   ├── run-migration-006/route.ts         # NEW — apply Content Approval migration (2 ALTERs + 1 table)
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
        │   │       └── disputes/route.ts          # NEW — GET/POST brand disputes
        │   └── content/
        │       ├── pending/route.ts               # NEW — GET brand's pending posts with SLA status
        │       ├── [id]/approve/route.ts          # NEW — POST brand approve (ownership-checked)
        │       └── [id]/reject/route.ts           # NEW — POST brand reject with reason (min 10 chars)
        ├── cron/
        │   └── process-content-reviews/route.ts   # NEW — every 2h: SLA reminders + auto-approve/escalate
        ├── campaigns/[campaignId]/
        │   ├── reviews/route.ts                   # NEW — GET/POST campaign reviews
        │   └── disputes/route.ts                  # NEW — GET/POST/PATCH disputes (influencer + admin)
        └── consumer/follows/[influencerId]/route.ts  # NEW — GET/POST/DELETE follow/unfollow
```
