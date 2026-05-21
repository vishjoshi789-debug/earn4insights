# CLAUDE.md — Earn4Insights Developer Guide

> Last updated: May 2026 (v8 — Customer Support System: AI chatbot, ticket workflow, FAQ knowledge base, admin dashboard, real-time notifications). Read at the start of every session.

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
| Cron Hardening (26 total cron entries) | ✅ COMPLETE |
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
| Competitive Intelligence Dashboard (9 tables, 6-dimension scoring, AI insights, alert detection, 5 cron jobs) | ✅ COMPLETE |
| DSAR System — GDPR Art. 15 (OTP verification, PDF generation via pdfkit + Vercel Blob, 30-day rate limit) | ✅ COMPLETE |
| Security Batch 1 (upload auth, products.owner_id backfill, emailService migration, password complexity, admin role guards) | ✅ COMPLETE |
| Upstash Redis Distributed Rate Limiting (17 limiters across 21 routes, sliding-window, fail-open, env-prefixed keys) | ✅ COMPLETE |
| CSRF Double-Submit Cookie Protection (17 high-risk routes protected; `e4i-csrf` cookie + `X-CSRF-Token` header; middleware mints token) | ✅ COMPLETE |
| WhatsApp OTP Phone Verification (migration 014, bcrypt OTP, 15-min TTL, 3 attempts, onboarding step 5, gate on phone save) | ✅ COMPLETE |
| Admin Diagnostics Feature Flag + PII Log Sanitization (`ADMIN_DIAGNOSTICS_ENABLED`, `maskEmail`/`maskPhone` in logger) | ✅ COMPLETE |
| Cookie Consent Banner + UX Polish (GDPR consent gates analytics; branded 404/500; login polish; mobile tab responsiveness) | ✅ COMPLETE |
| Customer Support System (migration 015 — 5 tables; GPT-4o-mini chatbot with pgvector semantic FAQ matching + 18-pattern abuse filter; floating widget; 19 API routes; /help SEO pages; admin dashboard; 6 transactional emails + daily reminder cron; 5 eventBus events with Pusher real-time admin/user notifications) | ✅ COMPLETE |
| Scheduled Product Launch (migration 016 — 2 columns + partial index; `LaunchForm` launch-type radio + datetime picker; server action branches instant vs scheduled; `/api/cron/publish-scheduled-launches` flips due rows to live and fires the same side-effects as instant — Vercel Hobby registers a 06:00 UTC daily safety-net, cron-job.org drives the real 15-min cadence externally; `getAllProducts()` and `searchProductsByName()` filter scheduled by default; brand sees their queue at `/dashboard/launch`) | ✅ COMPLETE |
| Platform Analytics — Founder Dashboard (migration 017 — 5 tables: `platform_metrics_daily`, `revenue_metrics_daily`, `retention_cohorts`, `platform_costs`, `financial_snapshots_monthly`; 24-fn repo + 7-fn service incl. `computeHealthScore` + OLS `computeGrowthPrediction`; 8 admin API routes (CSRF-gated CRUD on costs); 12 dashboard components (recharts); `/admin/platform-analytics` 9-row layout with `safely()`-wrapped sub-panels; 3 crons — daily metrics 01:00 UTC, weekly retention Sun 02:00 UTC, monthly financial 1st 03:00 UTC) | ✅ COMPLETE |
| Phone OTP → Twilio Verify (migration 018 — replaces hand-rolled bcrypt OTP with Twilio Verify; Twilio owns code generation/delivery/expiry/attempts; delivery channel set by `TWILIO_VERIFY_CHANNEL` — `sms` at launch, `whatsapp` once a Twilio WhatsApp sender is approved, no code change; `whatsapp_otp_verifications` relaxed to verified-phone markers; needs `TWILIO_VERIFY_SERVICE_SID`) | ✅ COMPLETE |
| Two-Factor Authentication — TOTP (migration 019 — 3 tables: `user_totp_secrets`, `user_recovery_codes`, `trusted_devices` + `users.two_factor_enabled`; RFC 6238 TOTP via `otpauth`, QR via `qrcode`; 9 API routes; `requires2FA` JWT→middleware interlock with `e4i-2fa` proof cookie + `e4i-trusted-device` cookie; 3-step setup wizard + `/auth/two-factor` challenge page; 5 security emails; `cleanup-trusted-devices` cron; credentials accounts only) | ✅ COMPLETE |

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
10. `POST /api/admin/run-migration-010` — Competitive Intelligence (9 tables: `competitor_profiles`, `competitor_products`, `competitor_price_history`, `competitive_insights`, `competitive_benchmarks`, `competitive_scores`, `competitor_alerts`, `competitive_reports`, `competitor_digest_preferences`)
11. `POST /api/admin/run-migration-011` — Deals/Community FK CASCADE hardening (GDPR Art. 17 — adds 19 FKs to migration 009 tables; cleans orphans first; CASCADE on user content, SET NULL on staff/audit refs)
12. `POST /api/admin/run-migration-012` — DSAR Requests table (GDPR Art. 15 — `dsar_requests` with FK CASCADE → users)
13. `POST /api/admin/run-migration-013` — Backfill `products.owner_id` for orphan products (legacy launches before commit 99925e3 had `owner_id=null`; backfills from `created_by` then `claimed_by`; reports `stillOrphaned` count for manual triage)
14. `POST /api/admin/run-migration-014` — WhatsApp OTP verifications table (`whatsapp_otp_verifications` with FK CASCADE → users; required before saving a WhatsApp phone via `/api/user/notification-settings`)
15. `POST /api/admin/run-migration-015` — Customer Support System (5 tables: `support_tickets` + `support_ticket_seq` sequence for E4I-XXXX numbering, `support_ticket_messages`, `chat_conversations`, `faq_articles` with `search_vector tsvector` trigger + `embedding vector(1536)` pgvector index, `support_analytics`; enables `vector` extension; FK CASCADE → users on user-content, SET NULL on admin/audit refs)
16. `POST /api/admin/seed-faq` — Idempotent FAQ seed (31 articles); requires `OPENAI_API_KEY` to generate embeddings. Skips slugs that already exist
17. `POST /api/admin/run-migration-016` — Scheduled Product Launch (adds `products.launch_status TEXT NOT NULL DEFAULT 'live'` + `products.scheduled_launch_at TIMESTAMP NULL` + partial index `idx_products_scheduled_due` on scheduled rows only)
18. `POST /api/admin/run-migration-017` — Platform Analytics / Founder Dashboard (5 tables: `platform_metrics_daily`, `revenue_metrics_daily`, `retention_cohorts` + UNIQUE(cohort_date, role, period_type), `platform_costs` with FK SET NULL → users, `financial_snapshots_monthly` incl. `cash_balance` paise column for runway calc; all money columns in paise)
19. `POST /api/admin/run-migration-018` — WhatsApp OTP → Twilio Verify (drops NOT NULL on `whatsapp_otp_verifications.otp_hash` + `expires_at`; Twilio Verify owns the OTP, so the table now stores verified-phone markers only — rows of `(user_id, phone_number, verified_at)`)
20. `POST /api/admin/run-migration-019` — Two-Factor Authentication (3 tables: `user_totp_secrets` incl. `encryption_key_id`, `user_recovery_codes`, `trusted_devices`; adds `users.two_factor_enabled`; all FK CASCADE → users)

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

# Rate limiting (Upstash Redis)
UPSTASH_REDIS_REST_URL=                # Upstash console → REST API URL
UPSTASH_REDIS_REST_TOKEN=              # Upstash console → REST API token
# If unset, falls back to in-memory rate limiting (not shared across serverless instances)

# Feature flags
ADMIN_DIAGNOSTICS_ENABLED=true         # Set to 'true' to enable /api/admin/diagnostics/* routes; bare 404 otherwise

# Customer Support System (Phase 9)
SUPPORT_ADMIN_EMAIL=                   # Defaults to contact@earn4insights.com — destination for all admin support notifications
CHATBOT_MODEL=                         # Optional override; defaults to gpt-4o-mini
CHATBOT_CLASSIFY_MODEL=                # Optional override for chat→ticket category classifier; defaults to gpt-4o-mini
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
| **CI routes return 404 (not 403) on ownership failures** | Prevents competitor existence leakage — brands cannot infer whether a competitor profile exists for another brand. |
| **MIN_COHORT_SIZE=5 enforced at CI repo level** | Same privacy floor as ICP scoring. Repo helpers return `null` (never 0) below the floor — callers must handle null explicitly. |
| **CI dimension scores normalise upward** | Dimensions below cohort threshold are excluded from the denominator, not zeroed. Same pattern as ICP scoring — brands not penalised for sparse data. |
| **Score not persisted if effective weight < 40** | Below 40% effective weight, the score is too driven by missing data to be meaningful. Returns `{ score: null, reason: 'insufficient_data' }` — no row written. |
| **Competitive alert 24h dedup window** | Alert detector checks for existing alerts of the same type within 24h before firing. Prevents alert flood from recurring competitive conditions. |
| **AI insights cap: 3 per brand per day** | Prevents runaway GPT-4o cost. `competitiveAIService` checks count before generating; 24h idempotency key per brand + insight type. |
| **gpt-4o-mini for daily digest, gpt-4o for weekly report** | Cost optimisation. Daily summaries don't need full reasoning capacity; weekly strategic reports do. |
| **DSAR requires OTP identity verification** | 6-digit OTP emailed via Resend, bcrypt-hashed in DB, 15-minute TTL, max 3 attempts. Prevents unauthenticated data dumps — `/api/consumer/my-data` (JSON) requires only session; DSAR PDF requires OTP. |
| **DSAR PDF stored in Vercel Blob, not returned inline** | PDFs can be several MB. Blob storage with a 7-day TTL URL decouples generation from download and allows emailing the link. |
| **DSAR PDF TTL: 7 days** | Balances access window with storage cost. `dsar-cleanup` cron deletes expired blobs from Vercel Blob and sets `status='expired'` in DB. |
| **DSAR rate limit: 1 request per 30 days** | Prevents abuse of expensive PDF generation. If an active OTP-sent request exists and OTP is still valid, the existing `requestId` is returned so the user can retry without starting over. |
| **DSAR PDF attached to delivery email if < 10 MB** | Convenience — user gets the PDF directly in their inbox. Falls back to download link only if PDF exceeds 10 MB. |
| **Upstash sliding-window, fail-open** | `@upstash/ratelimit` sliding window is shared across all Vercel serverless instances (unlike the old in-memory limiter). Upstash errors fail-open (`[RATE_LIMIT_FAIL_OPEN]` log prefix) so a Redis outage never locks users out. Falls back to in-memory if env vars are unset. |
| **Rate-limit keys prefixed `e4i:{env}:{limiter}:{caller-key}`** | One Redis DB can serve prod/preview/dev without cross-contamination. `env` derived from `VERCEL_ENV` / `NODE_ENV`. |
| **CSRF double-submit cookie, `sameSite: lax`, `httpOnly: false`** | Double-submit is viable because cross-origin requests cannot read the `e4i-csrf` cookie (Same-Origin Policy). `sameSite:lax` blocks cross-site form posts while allowing top-level navigations. `httpOnly:false` intentional — the client reads the token from `<meta name="csrf-token">` injected by root layout; the meta tag is the distribution channel, not JS cookie read. |
| **CSRF meta tag in root layout, not dashboard layout** | Root layout covers all routes including `/admin/*`, `/settings/*`, `/api/*` callsites in marketing pages. Dashboard layout is a child — injecting there would miss those callsites. One meta tag, one source of truth. |
| **CSRF validation per-route, not in middleware** | Middleware runs on every request (including GET, static assets, crons). Per-route validation targets only state-mutating endpoints (POST/PATCH/PUT/DELETE on user-facing routes), avoiding performance overhead and false-positives on cron routes that use Bearer auth instead. |
| **Phone OTP via Twilio Verify (not hand-rolled)** | The Twilio WhatsApp Sandbox silently drops messages to numbers that haven't joined it. Twilio Verify owns code generation, delivery, expiry (~10 min), and the check-attempt cap. Delivery channel is `TWILIO_VERIFY_CHANNEL` — `sms` at launch (WhatsApp sender approval pending), switch to `whatsapp` later with no code change. `whatsappOtpService` no longer generates/hashes/stores OTPs; `whatsapp_otp_verifications` keeps only verified-phone markers for the `hasVerifiedPhone()` gate. Needs `TWILIO_VERIFY_SERVICE_SID` (migration 018). |
| **2FA challenge gated in middleware (`requires2FA` + proof cookie)** | NextAuth JWT sessions are stateless, so 2FA can't be a mutable session flag. `authorize()` sets `twoFactorPending` (2FA enabled AND device not trusted) → `session.requires2FA`. Middleware confines a `requires2FA` session to `/auth/two-factor` until it presents a valid `e4i-2fa` proof cookie (HMAC-`AUTH_SECRET`, httpOnly, bound to a per-login `loginNonce`). `/api/auth/2fa/{setup,disable,regenerate-codes}` are NOT reachable mid-challenge — disabling 2FA can't be used to bypass it. Fail-closed: a proof-cookie verify error → confined. |
| **TOTP secret uses versioned encryption; `encryption_key_id` stored** | `user_totp_secrets` uses `encryptForStorage`/`decryptFromStorage` — the env carries only versioned keys (`ENCRYPTION_KEY_v1`), not a bare `ENCRYPTION_KEY`, so the key id is stored next to the ciphertext. Recovery codes are bcrypt-hashed; the trusted-device fingerprint is a SHA-256 of a random cookie token. |
| **2FA proof cookie TTL = 30 days (once per login)** | `e4i-2fa` lasts the session length, so 2FA is challenged once per login — the `loginNonce` binding still forces a fresh challenge on every genuine new login. "Trust this device" (`e4i-trusted-device`, 30 days) skips even that next login. |
| **2FA is credentials-accounts only** | Google-OAuth users rely on Google's own 2FA. `twoFactorPending` is set only in `authorize()` (credentials path); the Settings card hides "Enable 2FA" for password-less accounts. `auth.config` lazy-imports the 2FA service inside `authorize()` so its Node-only deps (qrcode/bcrypt/DB) stay out of the Edge middleware bundle. |
| **Phone save gated on OTP verification** | `PATCH /api/user/notification-settings` calls `hasVerifiedPhone(userId, phone)` before persisting a WhatsApp number. Prevents brands/consumers from saving an arbitrary phone number they don't own. Onboarding step 5 is optional — existing users without a verified phone can still use the platform. |
| **Cookie consent via `localStorage`, not cookie** | Consent preference is UI state, not a tracking cookie. Using `localStorage` avoids creating a cookie-for-cookies meta-irony and keeps the consent state client-side and instantly readable without a round-trip. `CONSENT_VERSION=1` — bumping to `2` in `cookie-consent.ts` treats all v1 consent as expired and re-shows the banner. |
| **Analytics gated on `hasAnalyticsConsent()`** | `analytics-tracker.tsx` checks consent before every `queueEvent()` call. First page_view is dropped on first visit (GDPR-correct — no tracking before consent). |
| **PII masked in logs with `maskEmail` / `maskPhone`** | `j***@example.com` and `***1234` patterns prevent PII leakage in Vercel log drain, third-party APM, or log storage. Exports from `logger.ts` so every service has a one-import path. Production OTP values also guarded by `NODE_ENV` gate (dev-only console log). |
| **Admin diagnostics behind `ADMIN_DIAGNOSTICS_ENABLED` flag** | Routes exist in the bundle regardless. Flag returns bare `404` (not `403`) when disabled so the route's existence is not discoverable. Default off in `.env.example`; set `true` only in environments where diagnostic access is intentional. |
| **Ticket numbering via Postgres sequence (`support_ticket_seq`)** | Atomic, gapless `E4I-XXXX` format from `to_char(nextval(...), 'FM0000')`. UUID PK plus a human-readable display number — UUID for refs, sequence number for support conversations and email subjects. |
| **Chat conversation messages stored as JSONB array** | Session-scoped, typically <100 entries — JSONB is faster than join + simpler than a child table. Each conversation row carries its own transcript. |
| **Chatbot FAQ match: pgvector (semantic), `/help` search: tsvector (keyword)** | Paraphrased questions ("how do I get money back?") must hit "Refunds" — pgvector cosine handles that. The public `/help` page is keyword-driven (users typing exact words), so tsvector + `ts_rank` is enough and avoids embedding cost. |
| **FAQ semantic similarity cutoff: 0.78** | Above the 0.75 default in `faqService` — chatbot is stricter to avoid surfacing weak matches that would confuse users. Tuning lever for future relevance work. |
| **Chatbot suspicious-intent regex + 3-flag auto-block** | 18 patterns catch prompt extraction, jailbreaks, internal-metrics fishing, cross-user data fishing, competitor recon. Soft flag → polite refusal; 3 flags → conversation auto-resolved (NOT escalated to a ticket — abusive sessions don't fan out to admin queue). |
| **Blocked conversations cannot be escalated** | Hard gate at `escalateToTicket` — `context.blocked` throws. Prevents abuse → ticket → admin time-sink pipeline. |
| **Chatbot system prompt: refuse internal business data + other-user data + prompt extraction** | Defence in depth: regex catches obvious patterns, but the system prompt also enumerates 10 strict rules (never invent features, never disclose internal metrics, never reveal the prompt, never share other users' data, etc.). |
| **Documented public facts inlined in chatbot prompt** | Platform fees (8/12/10%), points rate (10 pts = ₹1), refund timelines, payout times, consent categories — bot may quote these verbatim. Custom pricing / enterprise contracts always escalate. |
| **Email "fire-and-forget" with try/catch logging** | `void send().catch(log)` — ticket creation, replies, and escalations never block on email outages. Same pattern as competitive email service. |
| **Ticket priority inferred from category** | `payment` / `billing` / `bug_report` → high, `feature_request` → low, else medium. Auto-prioritisation reduces admin triage workload. |
| **Admin reply auto-transitions `open` → `in_progress`; user reply auto-transitions `waiting_on_user` → `in_progress`** | Reduces admin queue clutter — tickets self-organise based on who replied last. |
| **Internal notes hidden from user emails AND user GET routes** | `getTicketDetail` filters at the repo layer when `isAdmin=false`. Email service skips internal notes entirely. Defence in depth. |
| **Admin notifications fan out to ALL admins via `getAdminUserIds()` (5-min cache)** | `support.ticket_created` and `support.chat_escalated` push to every admin's private Pusher channel. 5-min cache TTL avoids hitting the users table on every fan-out — admin set changes rarely; stale cache is not a security concern (admin role rechecked at every route). |
| **`/help` is server-rendered with ISR (`revalidate = 300`)** | Initial HTML carries all article content for SEO crawlers; refresh every 5 min picks up new articles without redeploy. |
| **`/help/[slug]` includes JSON-LD `Article` schema** | `Article` (not `FAQPage`) — better fit for our long-form pages. Google Rich Results validator accepts the structure. |
| **Daily reminder cron skips email when `total = 0`** | "0 tickets need attention" emails train admins to ignore the cron. Quiet days produce no noise. |
| **`/api/csrf/init` — safety-net route, not primary path** | Next.js middleware failed to set `e4i-csrf` cookie on redirect paths (observed on `/onboarding` in production). Rather than debug Next.js internals, a dedicated `GET/POST /api/csrf/init` route mints the cookie directly from its handler. `ChatWidget` fetches it on first open and gates the panel until cookie is confirmed. Primary flow still through middleware; init route is belt-and-suspenders. |
| **Non-destructive profile reconciliation on id-mismatch** | `ensureUserProfile.ts` previously deleted the orphan profile and inserted a blank replacement — wiping `onboardingComplete`, demographics, consent, and all signals every time an id-mismatch occurred (OAuth sub change, re-signup). Now snapshots and carries over all fields in a single DB transaction. This fixed the "onboarding loop" where users were re-routed to `/onboarding` on every login despite having completed it. |
| **`checkCsrf()` tagged result alongside `validateCsrfToken()`** | Chat routes switched to `checkCsrf()` to embed `reason + detail` in the 403 body and `X-CSRF-Fail-Reason` header. 15 other routes keep the boolean `validateCsrfToken()` (unchanged). Two-tier API: callers that need diagnosis use `checkCsrf`; callers that don't use `validateCsrfToken`. |
| **Support analytics `safely()` pattern — always 200 with partial data** | `GET /api/admin/support/analytics` wraps each of ~14 sub-queries in `safely(label, run, fallback, errors)`. A single failing query returns its fallback ([], null, 0) instead of sinking the whole response. `_errors` field lists failed queries. UI renders available charts; skeleton freeze eliminated. |
| **Admin diagnostic routes always return 200** | `diag-resend` and `diag-openai` return 200 even on failure — outcome in `body.ok`. PowerShell's `Invoke-RestMethod` throws on non-2xx and hides the body, so returning 500 on failure hid the diagnosis from PS operators. |
| **ChatWidget mounted on `/onboarding` layout** | Users stuck in the onboarding loop are the ones who most need support. `ChatWidget` now mounted in `onboarding/layout.tsx` in addition to `dashboard/layout.tsx`. All chatbot APIs work normally since `/onboarding` requires authentication. |
| **Scheduled launch hidden via repo-layer filter, not UI suppression** | `getAllProducts()` and `searchProductsByName()` add `WHERE launch_status='live'` unless an explicit `{ includeScheduled: true }` opt-in is passed. This means rankings, top-products, the public products list, the recommendations cron, and `/api/products/search` all transparently exclude scheduled products — no per-callsite checks to forget. The brand-side counterpart is `getScheduledProductsByOwner()`, used only in `/dashboard/launch`. |
| **Scheduled launch publish cron: Vercel daily safety-net + cron-job.org 15-min cadence** | Vercel Hobby plan only allows daily crons, so `vercel.json` registers `0 6 * * *` as a once-a-day backstop and the actual 15-min cadence is driven externally by cron-job.org hitting the route with `Authorization: Bearer $CRON_SECRET`. Brand picks a wall-clock time; up to 15 min of drift before the actual flip is acceptable (called out in the form helper text). If the external scheduler fails entirely, the Vercel safety-net still picks up any backlog within 24h. Tighter than 15-min granularity (e.g. `*/5`) would burn 3× the cron-job.org invocations for a feature most brands schedule hours/days in advance. |
| **Publish cron flips status before firing side-effects (race-safe)** | `publishScheduledProduct()` does `UPDATE … SET launch_status='live' WHERE id=? AND launch_status='scheduled' RETURNING *`. The WHERE-clause guard means a concurrent cron run (e.g. retried Vercel invocation) returns null and we skip the side-effects. Without this, two concurrent passes would double-fire the brand confirmation email + smart distribution + watchlist fan-out. |
| **Scheduled launches skip ALL launch side-effects until publish** | The server action for the scheduled branch writes the row and redirects with `?scheduled=1`. No brand confirmation email, no smart distribution, no watchlist fan-out — the cron fires those at the scheduled time so consumers don't get "launched!" notifications for products they can't see yet. |
| **`min` on the datetime input = now + 1h, not now** | Prevents the common UX failure of brands picking the current minute and being confused when the cron takes up to 15 min to fire. 1h floor sets the expectation that this is a planning tool, not a delayed-launch button. The server action also enforces strictly-future with a 30s skew to forgive clock drift. |
| **Platform analytics — all money in paise** | Same convention as Razorpay integration and `campaign_payments` / `reward_redemptions`. UI converts via `formatCurrency()` (paise → ₹ display). DB columns are `INTEGER` (not `NUMERIC`) — Math is exact, no float-precision drift over millions of rupees. |
| **`safely()` defensive wrapper in `getDashboardData`** | Every sub-block (overview, growth, retention, revenue, engagement, financial, predictions, support) is wrapped so a single panel failure populates `_errors[]` instead of sinking the dashboard response. Mirrors the support-analytics pattern. Banner in the UI shows "N panels could not load — showing partial data." |
| **MRR proxy = monthly netRevenue** | E4I doesn't have a true subscription product yet — fees are billed per-campaign. When subscriptions ship, redefine MRR as recurring-subscription revenue and treat per-campaign fees as one-time. Documented in `docs/FEATURE8_PLATFORM_ANALYTICS.md`. |
| **Health score: 6-factor weighted 0–100** | DAU/MAU 20% + Day-7 retention 20% + MoM user growth 15% + MoM revenue growth 15% + engagement events/MAU 15% + support CSAT 15%. Bands: ≥70 healthy (green), 40–69 attention (amber), <40 critical (rose). Trend = recompute factors 7d back, diff totals. `null` CSAT and unmatured retention fall back to neutral 50, not 0 — avoids penalising no-signal as "bad". |
| **Cohort retention reports null for unmatured cells** | A 10-day-old cohort can't have a Day 30 number. We report `null` (UI renders `—`) instead of misleading 0%. Without this, the heatmap silently shows the right edge as red even for healthy products. |
| **Feature adoption denominator = today's per-role DAU** | Numerator = distinct users who touched the feature in the window. Known approximation — true "active across window" would need a role-split MAU column we don't have yet. For 30d window it's roughly accurate; for 7d slightly inflated. |
| **Cohort retention queries branch per role, not via mid-query SQL composition** | `buildCohortRetention()` runs one of four explicit `pgClient\`...\`` blocks based on the role param. Tried `pgClient\`...${roleClauseSqlFragment}...\`` originally — postgres.js template tags don't compose like Drizzle's `sql\`\``. Cleaner to duplicate the 4 queries than to wrestle with mid-query composition. |
| **NEVER pass Date objects to pgClient template literals** | postgres.js's binary encoder can throw "The string argument must be of type string. Received an instance of Date" in some code paths. ALWAYS pre-compute via `.toISOString()` into a local string variable before SQL interpolation. Applied to every Date interpolation in `platformAnalyticsRepository.ts` and `platformAnalyticsService.ts`. Drizzle ORM's `gte`/`lte`/`eq` on `date` columns also require strings (`yyyy-MM-dd`) — Drizzle types them as `string` not `Date`. |
| **3 analytics crons all natively Vercel Hobby-friendly** | None are sub-daily (daily 01:00 / weekly Sun 02:00 / monthly 1st 03:00), so no cron-job.org redundancy layer needed for analytics — unlike `publish-scheduled-launches` which needs 15-min cadence. All idempotent — service compute fns upsert on UNIQUE keys, so cron retries are no-ops. |
| **Daily metrics cron never computes today** | Always snaps to yesterday's UTC day so the row reflects a complete 24h window. Eliminates the "11pm cron run shows half a day" footgun. `?backfill=N` (cap 30) walks back N days from yesterday for one-shot historical seed. |
| **`cash_balance` carried over by default** | Financial cron reads existing snapshot row and preserves `cash_balance` unless `?cashBalance=PAISE` override is passed. Founder updates cash by hitting the route directly with the override — avoids needing a separate "treasury edit" UI. |
| **Costs use `apiPost/apiPut/apiDelete` from api-client (auto-CSRF)** | `CostManagement.tsx` calls the shared `apiPost/apiPut/apiDelete` helpers, which read `e4i-csrf` cookie and attach `X-CSRF-Token` header automatically. No per-component CSRF code, no manual cookie reads. |
| **Renamed existing `/admin/analytics` → "Traffic Analytics" in nav** | The new `/admin/platform-analytics` (founder dashboard) took the "Platform Analytics" label, so the older raw-events tool needed a more accurate name to avoid confusion. Routes unchanged — only the nav label moved. |

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
| **DSAR system** | ✅ DONE — OTP verification, pdfkit PDF, Vercel Blob, 7-day TTL, 30-day rate limit, `dsar-cleanup` cron |
| **Signal snapshots in process-deletions cron** | Admin-deleted profiles may leave orphaned snapshots |

### Deals & Community
| Item | Notes |
|------|-------|
| **Deal ICP targeting** | `icpTargetData` JSONB column on `deals` stored but not yet wired to ICP scoring — brands can store targeting criteria, consumer filtering not implemented |
| **Community post points system** | `pointsAwarded` column exists; awarding logic is in moderation approval flow but not wired to the consumer points ledger yet |
| **Brand deal analytics** | `/api/brand/deals/[id]/analytics` route exists; full analytics dashboard page not yet built |
| **Wise / PayPal payout stubs** | `wiseService.ts` and paypal payout path are stubs pending API credentials |

### Competitive Intelligence
| Item | Notes |
|------|-------|
| **Real competitor data ingestion** | `competitor_products` and `competitor_price_history` populated manually or via brand input; no automated scraping or third-party data feed connected |
| **Market share dimension** | Computed from relative feedback volume within category — proxy metric only; actual GMV/unit-share not available |
| **Consumer-switching alert cohort gate** | `consumer_switching` alert type uses 3-condition check + cohort ≥ 5; conditions without sufficient data silently skip the check (won't fire false alerts) |

### Platform Analytics (Founder Dashboard)
| Item | Notes |
|------|-------|
| **MRR is a proxy** | Defined as monthly netRevenue, not true subscription MRR. Replace when a recurring-subscription product exists. |
| **Consumer LTV is a payout-cost proxy** | `avg(points_spent × 10 paise)` per consumer — what we've paid out per consumer, not the value of their contribution to brands. Replace once a value-per-feedback model exists. |
| **Brand LTV doesn't weight by churn** | `avg(SUM(platform_fee))` per brand. When brand-active-since-last-payment is tracked, weight by survival probability. |
| **Feature adoption denominator is today's DAU per role** | Need a role-split MAU column to compute true "active across window" denominator. |
| **No CAC / LTV:CAC ratio** | Requires attribution data we don't currently capture (UTM cohorts × payment outcomes). |
| **All cost lines visible to all admins** | If non-founder admins are added (ops, support managers), gate `salaries` / `legal` behind a `role: 'founder'` distinction. |
| **Health score trend recomputes 6 factors every render** | Cheap today (3 small queries) but if it becomes a hotspot, persist `health_score_history` and read instead of recomputing. |

---

## Reference Docs

- **`ARCHITECTURE.md`** — Full technical architecture (authoritative)
- **`docs/SCHEMA.md`** — All DB table definitions (migrations 002–017)
- **`docs/FEATURE1_HYPERPERSONALIZATION.md`** — Encryption, consent system, ICP scoring algorithm, security hardening, file map
- **`docs/FEATURE2_INFLUENCERS_ADDA.md`** — Campaign lifecycle, payment flow, earnings dashboard, content approval, @ tags, file map
- **`docs/FEATURE3_REALTIME.md`** — Pusher setup, event bus (31 events), notification/presence architecture, file map
- **`docs/FEATURE4_COMPETITIVE_INTELLIGENCE.md`** — 9 tables, 6-dimension scoring, AI insights, alert detection, email digests, 5 crons, file map
- **`docs/FEATURE5_DEALS_COMMUNITY.md`** — 9 deals/community tables, FK CASCADE hardening (migration 011), moderation, file map
- **`docs/FEATURE6_DSAR.md`** — DSAR table, OTP flow, PDF generation, Vercel Blob, cleanup cron, file map
- **`docs/FEATURE7_SUPPORT_SYSTEM.md`** — Schema (5 tables), services, API routes, chatbot architecture, KB seeding, admin dashboard, file map
- **`docs/FEATURE8_PLATFORM_ANALYTICS.md`** — Migration 017 (5 tables), service methodology (DAU/MAU, cohorts, MRR, LTV, ARPU, health score, OLS forecast), 8 API routes, 12 UI components, 3 crons, runbook
- **`docs/FEATURE9_TWO_FACTOR_AUTH.md`** — Migration 019 (3 tables), TOTP service, 9 API routes, setup wizard + `/auth/two-factor` challenge, `requires2FA` middleware interlock, trusted devices, 5 emails, cron, file map
- **`docs/CRON_JOBS.md`** — Full cron schedule (32 entries), auth pattern, batch size notes
- **`docs/FEATURE7_SUPPORT_SYSTEM.md`** — Schema (5 tables), services, API routes, chatbot architecture, KB seeding, admin dashboard, file map
