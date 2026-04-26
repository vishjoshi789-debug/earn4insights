# CLAUDE.md — Earn4Insights Developer Guide

> Last updated: April 2026 (v5 — Deals Discovery + Community Platform + Admin Sidebar Nav). Read at the start of every session.

## Project Overview

Earn4Insights is a **B2B2C consumer-insights platform** (India-first, DPDP Act 2023 + GDPR-compatible).
- **Consumers** complete surveys/feedback and earn points/rewards.
- **Brands** pay for consumer feedback, survey responses, and targeted audience insights.
- Consent is explicit, granular, and independently revocable per data category.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, RSC) |
| Language | TypeScript (strict) |
| Database | Neon PostgreSQL (serverless, pgBouncer pooler) — Drizzle ORM |
| Auth | NextAuth v5 (`@/lib/auth/auth.config`) |
| Styling | Tailwind CSS + shadcn/ui |
| Real-Time | Pusher WebSocket (cluster `ap2` — Mumbai) |
| Email/SMS | Resend + Twilio |
| AI | OpenAI GPT-4o via Genkit |
| Hosting | Vercel (Edge + Serverless) · Dev port `9002` |

Key packages: `postgres` v3 (raw driver for DDL), `drizzle-orm` (all app queries), `dotenv-cli` (tsx scripts).

---

## Architecture Patterns

**Layer order (strict):** `src/db/repositories/` → `src/server/` → `src/app/api/`
- Repositories: DB queries only. No business logic, no auth.
- Services: Business logic, consent gating. Never import from `app/`.
- API routes: Auth check → call service → return JSON. Never query DB directly.
- All server-only files: `import 'server-only'` at top.

**Auth pattern in API routes:**
```ts
const session = await auth()
if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
const userId = (session.user as any).id
const role = (session.user as any).role   // 'consumer' | 'brand' | 'admin'
```

**Consent enforcement:**
```ts
await enforceConsent(userId, 'behavioral', 'operation_name')        // throws on denied
const { allowed } = await checkConsent(userId, 'behavioral')        // returns { allowed, reason }
await enforceConsentByOperation(userId, 'collect_behavioral_signals') // looks up required categories
```

**Drizzle vs raw postgres.js:**
- App queries → `db` (Drizzle ORM) from `@/db`
- DDL migrations only → `pgClient` (raw postgres.js) from `@/db`
- Strip `BEGIN`/`COMMIT` before `pgClient.unsafe()` — pooled connections block transaction control.

**CRITICAL — Migration routes must inline SQL:**
`fs.readFileSync()` throws `ENOENT` on Vercel serverless (`.sql` files not bundled). Always use template literals:
```ts
const sql = `CREATE TABLE IF NOT EXISTS ...`
await pgClient.unsafe(sql)
```

---

## Phase Status — All Complete

| Feature | Status |
|---------|--------|
| Schema + Repositories (Phase 1–7) | ✅ COMPLETE |
| Security Hardening (8 issues fixed) | ✅ COMPLETE |
| Bulk Score API + rate limiting | ✅ COMPLETE |
| GDPR Erasure Flow | ✅ COMPLETE |
| Brand ICP Builder UI | ✅ COMPLETE |
| Social OAuth (LinkedIn stub; Instagram pending App Review) | ✅ COMPLETE |
| Consumer Dashboard UI (privacy, signals, data-export) | ✅ COMPLETE |
| Influencers Adda (11 tables, full marketplace) | ✅ COMPLETE |
| TypeScript Build Fixes (12 errors resolved) | ✅ COMPLETE |
| Migration Route Fix (SQL inlined) | ✅ COMPLETE |
| Cron Hardening (15 total cron entries) | ✅ COMPLETE |
| Landing Page + ProductTour update | ✅ COMPLETE |
| Real-Time Connection Layer (Pusher, 6 tables, 23 events) | ✅ COMPLETE |
| Influencer Earnings Dashboard (multi-currency, audience analytics) | ✅ COMPLETE |
| Campaign Content Approval System (SLA, auto-approve, audit log) | ✅ COMPLETE |
| @ Mention Tag System (influencer content — brands, products, categories, influencers) | ✅ COMPLETE |
| Media type select visibility fix + dialog scroll fix | ✅ COMPLETE |
| Campaign Marketplace (influencer discovery, applications, brand review) | ✅ COMPLETE |
| Razorpay Payment Integration (escrow, payouts, consumer rewards, admin queue) | ✅ COMPLETE |
| Deals Discovery + Community Platform (9 tables, Reddit-style feed, brand deals, moderation) | ✅ COMPLETE |
| Admin Role Fix + Admin Sidebar Nav (OnboardingGuard bypass + 7 admin nav items) | ✅ COMPLETE |

**Production migrations (run in order — all idempotent, require `x-api-key: <ADMIN_API_KEY>`):**
1. `POST /api/admin/run-migration-002` — 6 new tables + 3 ALTERs
2. `POST /api/admin/migrate-consent-records` — backfill legacy JSONB consent
3. `POST /api/admin/run-migration-003` — FK constraints + partial UNIQUE index
4. `POST /api/admin/run-migration-004` — Influencers Adda (11 tables)
5. `POST /api/admin/run-migration-005` — Real-Time layer (6 tables)
6. `POST /api/admin/run-migration-006` — Content Approval (2 ALTERs + `content_review_reminders` table)
7. `POST /api/admin/run-migration-007` — Campaign Marketplace (3 ALTERs on `influencer_campaigns` + `campaign_applications` table)
8. `POST /api/admin/run-migration-008` — Razorpay Payment (4 tables: `razorpay_orders`, `campaign_payments`, `payout_accounts`, `reward_redemptions`)
9. `POST /api/admin/run-migration-009` — Deals + Community (9 tables: `deals`, `community_deals_posts`, `community_deals_post_votes`, `community_deals_post_saves`, `community_deals_comments`, `community_deals_comment_votes`, `deal_saves`, `deal_redemptions`, `community_deals_flags`)
10. `POST /api/admin/run-migration-011` — Deals/Community FK CASCADE hardening (GDPR Art. 17 — adds 19 FKs to migration 009 tables; cleans orphans first; CASCADE on user content, SET NULL on staff/audit refs)
11. `POST /api/admin/run-migration-012` — DSAR Requests table (GDPR Art. 15 — `dsar_requests` with FK CASCADE → users)

---

## Environment Variables

```bash
# Database
POSTGRES_URL=                          # or DATABASE_URL
ADMIN_API_KEY=                         # for /api/admin/* routes

# Encryption (versioned key rotation)
CURRENT_ENCRYPTION_KEY_ID=v1
ENCRYPTION_KEY_v1=                     # 32-byte hex or base64 AES key
# ENCRYPTION_KEY_v2=                   # add when rotating

# Signal retention
SIGNAL_RETENTION_DAYS=365              # default 365 days
SIGNAL_CRON_BATCH_SIZE=                # max users per signal cron run
ICP_SCORE_CRON_BATCH_SIZE=200          # max stale scores per ICP cron run

# Cron auth
CRON_SECRET=                           # Bearer token Vercel injects into cron requests

# Social OAuth (LinkedIn)
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
SOCIAL_OAUTH_REDIRECT_URI=
NEXT_PUBLIC_LINKEDIN_CLIENT_ID=

# Pusher (Real-Time)
PUSHER_APP_ID=
PUSHER_KEY=
PUSHER_SECRET=
PUSHER_CLUSTER=ap2
NEXT_PUBLIC_PUSHER_KEY=
NEXT_PUBLIC_PUSHER_CLUSTER=ap2
SOCIAL_MENTION_WEBHOOK_SECRET=         # HMAC secret for POST /api/webhooks/social-mention

# Razorpay (Payments)
RAZORPAY_KEY_ID=                       # Razorpay dashboard → Settings → API Keys
RAZORPAY_KEY_SECRET=                   # Keep secret — never expose client-side
RAZORPAY_WEBHOOK_SECRET=               # Dashboard → Webhooks → Secret
NEXT_PUBLIC_RAZORPAY_KEY_ID=           # Same as RAZORPAY_KEY_ID — safe for client
```

Other env vars (Resend, Twilio, OpenAI, NextAuth, Stripe, etc.) are in `ARCHITECTURE.md`.

---

## Key Decisions

| Decision | Why |
|----------|-----|
| **Hard throw if ICP weights ≠ 100** | Silent misconfiguration produces meaningless scores. |
| **Normalise upward for unconsented ICP criteria** | Penalising consumers for not sharing sensitive data creates perverse incentive for brands. |
| **Append-only signal snapshots** | Enables drift analysis, GDPR Art. 15 export, debugging. Managed by `SIGNAL_RETENTION_DAYS` rolling window. |
| **Sensitive attributes in separate table** | GDPR Art. 17: revoking `sensitive_health` deletes only that attribute, not the whole profile. |
| **Consent records as rows, not JSONB** | Independent revocability, queryability, and auditability are impossible with a JSONB blob. |
| **30-day physical deletion delay** | Grace period for accidental revocations. Soft-delete + cron physical delete. |
| **pgClient.unsafe() for DDL** | Drizzle's db.execute() is DML-only. DDL needs raw postgres.js. Strip BEGIN/COMMIT for pooled connections. |
| **Admin API route for migrations** | Local firewall/ISP blocks port 5432. API route sidesteps this. IF NOT EXISTS ensures idempotency. |
| **Bulk score capped at 200** | Sequential scoring, 200 × ~100ms ≈ 20s — safe within Vercel 60s Pro limit. |
| **`confirm: true` on DELETE /api/consumer/account** | Prevents accidental erasure from stray DELETE calls. |
| **Min cohort size 5 in analytics** | Prevents re-identification by brands querying small audience segments. |
| **LinkedIn implemented, Instagram deferred** | Instagram Basic Display API deprecated 2025; Graph API requires App Review (4–6 weeks). |
| **Content approval role validation at two layers** | Route checks role ('brand'/'admin'), service checks campaign ownership for brands. Admin always bypasses ownership. Other roles → 403. |
| **Content review reminder deduplication** | UNIQUE index on `(post_id, reminder_type)` + pre-insert `hasReminder()` check + 23505 catch. Belt-and-suspenders to prevent double-notifying brands. |
| **Earnings aggregated per currency, not summed** | Campaigns may use different currencies. Summing across currencies is meaningless; each currency shown separately with `formatCurrency()`. |
| **Min cohort 5 in audience intelligence** | Same re-identification floor as brand analytics. Audience demographics panel shows privacy notice below threshold. |
| **Dialog backdrop scrolls, not inner div** | Custom `DialogContent` uses `overflow-y-auto` on the backdrop + `my-auto` on inner box. Flex child `min-height: auto` prevents inner-div scroll from firing; backdrop scroll is reliable across browsers. |
| **`influencer.post.published` emitted only on approval** | Previously emitted on draft creation (bug). Now only in `contentApprovalService.approveContent()`. Draft creation emits nothing. |
| **@ tag type stored in string, not metadata** | Tags stored as `["@Beauty", "@Nike"]`. Type color derived from @ prefix (all blue). Type metadata not persisted — avoids schema change for tag storage. |
| **ICP match badge only when score exists** | Marketplace cards show Great/Good/Fair Match badge only when campaign has `icpId` AND `icp_match_scores` row exists for that influencer. No badge otherwise — avoids misleading "Unknown Match" labels. |
| **Marketplace is_public default false** | Existing campaigns remain invite-only. Brand explicitly opts in to marketplace visibility. No retroactive exposure. |
| **Application UNIQUE(campaign_id, influencer_id)** | DB constraint + 23505 catch in service. Belt-and-suspenders prevents duplicate applications. |
| **Recommended campaigns: niche-match in JS** | DB fetches 3x limit, JS filters by niche overlap. Avoids complex SQL text-matching on arrays; niche is the reliable proxy since ICP scores map consumer→brand, not influencer→campaign. |
| **Applications tab inside campaign detail** | Not a standalone page. Brand stays in campaign context while reviewing. Consistent with existing Milestones/Payments tab pattern. |
| **`RAZORPAYX_ENABLED = false` (launch)** | All payouts go to admin manual queue. When RazorpayX Payouts API is activated, set to `true` for automatic India INR payouts. International remain manual. |
| **Points rate: 10 pts = ₹1** | `POINTS_PER_INR = 10` in API, `POINTS_TO_INR = 0.10` in UI. Both aligned — ₹0.10 per point. |
| **Encrypted account masking: decrypt then slice** | `accountNumber` and `iban` are AES-256-GCM ciphertext. Must `decryptFromStorage()` before `slice(-4)` — raw ciphertext `slice(-4)` leaks encrypted data. |
| **Webhook processed synchronously** | Razorpay webhook handler `await`s DB writes before returning 200. Fire-and-forget dies on Vercel serverless. |
| **Platform fee schedule** | milestone → 8%, direct → 12%, escrow/standard → 10%. Calculated in `razorpayService.createOrder()`. |
| **Refund blocked after release** | Cannot refund a paid order if the linked `campaign_payments` has been released to influencer. Prevents double-spend. |
| **No partial payouts at launch** | Admin process route accepts `body.amount` but ignores it — all payouts are full amount. Partial payout support deferred until RazorpayX activation. |
| **Deals search via tsvector DB trigger** | `search_vector` column on `deals` and `community_deals_posts` is managed by a Postgres trigger (not Drizzle) — full-text search without adding a column to the ORM schema. |
| **Community posts default to `pending`** | All posts require admin/moderator approval before public visibility. Auto-approve runs in moderation cron after configurable time window. |
| **Flag auto-hide threshold** | Posts with ≥ 5 flags are auto-hidden (status → `removed`) by moderation cron without admin action. Prevents viral spread of flagged content. |
| **Deal redemption points: 10 pts flat** | Every deal redemption (promo copy or redirect click) awards 10 points regardless of deal value. Simple and predictable for consumers. |
| **Admin role skips OnboardingGuard** | `(session.user.role as string) === 'admin'` cast required — `UserRole` type only includes `'brand'|'consumer'`. Runtime DB value is `'admin'`. |
| **Admin sidebar uses role-specific nav items** | `DashboardShell` `MenuItem.role` now supports `'admin'`. Admin sees 7 `/admin/*` links + 8 shared tabs; no consumer/brand noise. |

---

## Known Gaps & Future Work

### Real-Time (Minor — non-blocking)
| Item | Notes |
|------|-------|
| **`ACTIVITY_FEED_UPDATE` Pusher event unused** | Defined but never triggered — `ActivityFeed` component uses polling until wired |
| **`brand.member.active` / `brand.discount.created` emitters missing** | Handlers + ICP targeting correct in `eventBus.ts`; no API route calls `emit()` for these yet |
| **`dispatchToUsers` N+1 at scale** | 2 DB writes + 2 Pusher calls per target; CONCURRENCY=50 cap limits DB pressure today |

### Influencers Adda
| Item | Notes |
|------|-------|
| **Influencer earnings dashboard** | ✅ DONE — `/dashboard/influencer/earnings`, multi-currency, audience intelligence (consent-gated, cohort ≥ 5) |
| **Campaign content approval flow** | ✅ DONE — SLA-based review, 75%/90%/100% reminders, auto-approve, audit log, real-time notifications |
| **Razorpay integration** | ✅ DONE — Full escrow flow, brand checkout, payment verification, refunds, webhook handler, influencer payouts, consumer rewards redemption, admin payout queue, 8 payment events, 2 cron jobs (18 cron entries total) |
| **RazorpayX Payouts API** | `RAZORPAYX_ENABLED = false` — all payouts manual. Activate when RazorpayX account approved |
| **Wise API integration** | `wiseService.ts` is a stub. Needs API key + profile ID to create real transfers |
| **Social stats API verification** | Stats are self-declared; no platform API verification yet |
| **Campaign marketplace for influencers** | ✅ DONE — `/dashboard/influencer/marketplace`, public browse, filters, recommended, apply/withdraw, brand accept/reject |

### Privacy & Compliance
| Item | Notes |
|------|-------|
| **Instagram OAuth** | Table + plumbing exist; needs Facebook App Review |
| **Social interest inference** | `POST /api/consumer/social/sync` built — merges `inferredInterests` into `userProfiles.socialSignals`; real provider API calls pending App Review / OAuth setup |
| **`icp_match_scores` orphan cleanup** | Fixed — `process-deletions` cron now deletes orphaned rows on account deletion |
| **DSAR flow** | Full decrypted sensitive data export requires identity verification; out of scope |
| **Signal snapshots in process-deletions cron** | Admin-deleted profiles may leave orphaned snapshots |

### Deals & Community
| Item | Notes |
|------|-------|
| **Deal ICP targeting** | `icpTargetData` JSONB column on `deals` stored but not yet wired to ICP scoring — brands can store targeting criteria, consumer filtering not implemented |
| **Community post points system** | `pointsAwarded` column exists; awarding logic is in moderation approval flow but not wired to the consumer points ledger yet |
| **Brand deal analytics** | `/api/brand/deals/[id]/analytics` route exists; full analytics dashboard page not yet built |
| **Wise / PayPal payout stubs** | `wiseService.ts` and paypal payout path are stubs pending API credentials |

---

## Reference Docs

- **`ARCHITECTURE.md`** — Full technical architecture (authoritative, 1000 lines)
- **`docs/SCHEMA.md`** — All DB table definitions (migrations 002–009)
- **`docs/FEATURE1_HYPERPERSONALIZATION.md`** — Encryption, consent system, ICP scoring algorithm, security hardening, file map
- **`docs/FEATURE2_INFLUENCERS_ADDA.md`** — Campaign lifecycle, payment flow, earnings dashboard, content approval, @ tags, file map
- **`docs/FEATURE3_REALTIME.md`** — Pusher setup, event bus (31 events), notification/presence architecture, file map
- **`docs/CRON_JOBS.md`** — Full cron schedule (20 entries), auth pattern, batch size notes
