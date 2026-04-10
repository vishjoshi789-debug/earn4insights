# Feature 2 — Influencers Adda

Influencer marketing marketplace. 11 DB tables, full campaign lifecycle, milestone-based payments, dispute resolution.

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
| **Influencer earnings dashboard** | UI page needed at `/dashboard/influencer/earnings`. Data exists in `campaign_payments`. |
| **Razorpay integration** | Records store Razorpay IDs but order creation + webhook handling not implemented. |
| **Campaign content approval flow** | No brand-side review/approval workflow for content before publishing. |
| **Social stats API verification** | Stats are self-declared. Need platform API integrations to verify. |
| **Campaign search for influencers** | No public campaign marketplace/browse — only invited campaigns visible. |

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
│       ├── influencerCampaignRepository.ts        # NEW — campaign CRUD, brand/influencer queries
│       ├── campaignInfluencerRepository.ts        # NEW — invitation management
│       ├── campaignMilestoneRepository.ts         # NEW — milestone CRUD, amount totals
│       ├── campaignPaymentRepository.ts           # NEW — payment CRUD, escrow/release totals
│       ├── campaignPerformanceRepository.ts       # NEW — metrics recording, aggregation
│       ├── influencerFollowRepository.ts          # NEW — follow/unfollow, counts
│       ├── influencerReviewRepository.ts          # NEW — reviews, average rating
│       └── campaignDisputeRepository.ts           # NEW — dispute CRUD, resolution
│
├── server/
│   ├── influencerProfileService.ts                # NEW — registration, discovery, public profiles
│   ├── campaignManagementService.ts               # NEW — campaign lifecycle, invitations, status transitions
│   ├── campaignPaymentService.ts                  # NEW — milestone + escrow payment flows
│   ├── campaignPerformanceService.ts              # NEW — metrics recording, campaign analytics
│   └── disputeResolutionService.ts                # NEW — dispute lifecycle, admin resolution
│
└── app/
    ├── dashboard/
    │   ├── DashboardShell.tsx                     # MODIFIED — added influencer + brand campaign nav items
    │   ├── influencer/
    │   │   ├── profile/page.tsx                   # NEW — register/edit influencer profile
    │   │   ├── campaigns/page.tsx                 # NEW — list campaign invitations
    │   │   ├── campaigns/[campaignId]/page.tsx    # NEW — campaign detail, accept/reject, submit milestones
    │   │   └── content/page.tsx                   # NEW — manage content posts
    │   └── brand/
    │       ├── campaigns/page.tsx                 # NEW — list/create campaigns
    │       ├── campaigns/[campaignId]/page.tsx    # NEW — campaign detail, milestones, payments, influencers
    │       └── influencers/page.tsx               # NEW — discover/search influencer profiles
    └── api/
        ├── admin/run-migration-004/route.ts       # NEW — apply Influencers Adda migration
        ├── influencer/
        │   ├── profile/route.ts                   # NEW — GET/POST/PATCH own profile
        │   ├── discover/route.ts                  # NEW — GET search/browse influencers
        │   ├── social-stats/route.ts              # NEW — GET/POST platform stats
        │   ├── content/route.ts                   # NEW — GET/POST content posts
        │   ├── content/[postId]/route.ts          # NEW — GET/PATCH/DELETE single post
        │   └── campaigns/
        │       ├── route.ts                       # NEW — GET influencer's campaigns
        │       └── [campaignId]/route.ts          # NEW — GET detail, PATCH accept/reject/submit
        ├── brand/campaigns/
        │   ├── route.ts                           # NEW — GET/POST brand campaigns
        │   └── [campaignId]/
        │       ├── route.ts                       # NEW — GET/PATCH/DELETE campaign
        │       ├── influencers/route.ts           # NEW — GET/POST/DELETE manage influencers
        │       ├── milestones/route.ts            # NEW — GET/POST milestones
        │       ├── milestones/[milestoneId]/route.ts # NEW — PATCH approve/reject/escrow, DELETE
        │       ├── payments/route.ts              # NEW — GET payment summary
        │       ├── performance/route.ts           # NEW — GET analytics, POST record metrics
        │       └── disputes/route.ts              # NEW — GET/POST brand disputes
        ├── campaigns/[campaignId]/
        │   ├── reviews/route.ts                   # NEW — GET/POST campaign reviews
        │   └── disputes/route.ts                  # NEW — GET/POST/PATCH disputes (influencer + admin)
        └── consumer/follows/[influencerId]/route.ts  # NEW — GET/POST/DELETE follow/unfollow
```
