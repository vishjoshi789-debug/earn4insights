# CLAUDE.md — Earn4Insights Developer Guide

> **Last updated:** June 2026 (v10 — EV.2 + EV.3 shipped, ER.1/ER.2 role guards; verify-email UX bug parked; A9 next).
> Read at the start of every session. Designed to fit in context without crowding daily-work prompts.

---

## 1. Project Overview

Earn4Insights is a **B2B2C consumer-insights platform** (India-first, DPDP Act 2023 + GDPR-compatible).
- **Consumers** complete surveys/feedback and earn points/rewards.
- **Brands** pay for consumer feedback, survey responses, and targeted audience insights.
- **Influencers** (consumers with `is_influencer=true`) accept brand campaigns and receive escrow-managed payouts.
- Consent is explicit, granular, and independently revocable per data category.

---

## 2. Quick Reference

| | |
|---|---|
| **Production URL** | https://www.earn4insights.com (always with `www.` — Vercel domain) |
| **Repo** | https://github.com/vishjoshi789-debug/earn4insights |
| **Dev port** | `9002` (`npm run dev`) |
| **Active model** | Claude Opus 4.7 (and any newer 4.x); previous sessions used Opus 4.5+ |
| **Git branch** | `main` (single-branch workflow; PRs optional) |
| **Admin role** | Stored as `role='admin'` in DB; `UserRole` TS type only covers `'brand'|'consumer'` so cast `(session.user.role as string) === 'admin'` |
| **Vercel cron limit** | Hobby plan = **daily only**; sub-daily cadence driven externally by **cron-job.org** with `Authorization: Bearer $CRON_SECRET` |
| **Migration auth** | `x-api-key: $ADMIN_API_KEY` for `/api/admin/run-migration-*` routes |

---

## 3. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, RSC) |
| Language | TypeScript (strict) |
| Database | Neon PostgreSQL (serverless, pgBouncer pooler) — Drizzle ORM |
| Auth | NextAuth v5 (`@/lib/auth/auth.config`) |
| Styling | Tailwind CSS + shadcn/ui |
| Real-Time | Pusher WebSocket (cluster `ap2` — Mumbai) |
| Email/SMS | Resend + Twilio (Verify + WhatsApp) |
| AI | OpenAI GPT-4o / 4o-mini via Genkit |
| Hosting | Vercel (Edge + Serverless) |
| Rate limiting | Upstash Redis (sliding-window, fail-open) |
| File storage | Vercel Blob (DSAR PDFs, feedback media) |

Key packages: `postgres` v3 (raw driver for DDL), `drizzle-orm` (all app queries), `dotenv-cli` (tsx scripts), `otpauth` + `qrcode` (2FA).

---

## 4. Architecture Patterns

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

## 5. Recurring Rules & Footguns

These are the daily-work invariants. Full historical rationale for each one is in `docs/CLAUDE_HISTORY.md §3 Key Decisions`.

### Database / SQL
- **NEVER pass `Date` objects to `pgClient` template literals.** Always pre-compute `.toISOString()` into a local string variable before SQL interpolation — postgres.js's binary encoder can throw "The string argument must be of type string. Received an instance of Date." Drizzle's `gte`/`lte`/`eq` on `date` columns also require strings (`yyyy-MM-dd`).
- **`pgClient.unsafe()` for DDL only.** Drizzle's `db.execute()` is DML-only. Pooled connections also block transaction control — strip `BEGIN`/`COMMIT`.
- **Migrations are idempotent.** Use `IF NOT EXISTS` everywhere; routes can be re-run safely.

### Vercel / Cron
- **Vercel Hobby = daily crons only.** Anything sub-daily (e.g. `publish-scheduled-launches` at 15-min cadence, `process-social-mentions`) is driven externally by **cron-job.org** hitting the route with `Authorization: Bearer $CRON_SECRET`. The Vercel daily entry remains as a 24h safety-net backstop.
- **Vercel function timeout = 60s (Pro plan).** Long-running operations (bulk score, DSAR PDF, FAQ seed) cap their batch size to stay under this.

### CSRF
- **Mutating requests need `X-CSRF-Token`.** Cookie is `e4i-csrf` (sameSite=lax, httpOnly=false). Token is distributed via `<meta name="csrf-token">` in the root layout.
- **`/api/csrf/init` is the safety-net.** Next.js middleware does not reliably set `e4i-csrf` on redirect paths (observed on `/onboarding`, `/dashboard/settings` post-auth). Client callsites that need certainty `await fetch('/api/csrf/init')` before the first mutating request. Middleware is still primary; the init route is belt-and-suspenders.
- **Per-route validation, not middleware-wide.** Cron routes use Bearer auth instead.

### Privacy & Analytics
- **MIN_COHORT_SIZE = 5.** Same floor in ICP scoring, audience intelligence, competitive intelligence, retention cohorts. Repo helpers return `null` (not 0) below the floor — callers handle null explicitly.
- **ICP weights must sum to 100.** Hard throw on misconfiguration.
- **Normalise upward for missing/unconsented criteria.** Never penalise consumers for sparse data.

### Money & Points
- **All money in paise** (Razorpay, `campaign_payments`, `reward_redemptions`, `platform_metrics_daily`, etc.). Columns are `INTEGER`, never `NUMERIC` — exact arithmetic, no float drift. UI converts via `formatCurrency()`.
- **Points rate: 10 pts = ₹1** (`POINTS_PER_INR = 10` server, `POINTS_TO_INR = 0.10` UI).

### Auth & Identity
- **Admin role cast required.** `(session.user.role as string) === 'admin'` everywhere — TS type doesn't include admin; runtime DB value does.
- **2FA wizard force-signs-out on enable.** `requires2FA` is computed once in `authorize()`; the session minted before 2FA was enabled carries no `twoFactorPending` and would never be challenged. Sign-out forces a fresh JWT next login. Same pattern GitHub uses.
- **Phone save gated on OTP verification.** `hasVerifiedPhone(userId, phone)` before persisting a WhatsApp number.
- **Non-destructive profile reconciliation.** `ensureUserProfile.ts` carries over every field on id-mismatch (OAuth sub change, re-signup) — fixes the "onboarding loop" bug from the past.
- **Sidebar capability filter (ER.1).** Items targeting multiple roles via `role: ['consumer', 'influencer']` MUST also declare `requiresCapability: 'isInfluencer' | 'isBrand'`. The filter reads `session.user.isInfluencer` / `isBrand`; without the capability flag a pure consumer would see every influencer item just because the role list includes 'consumer'. Admin bypasses the capability check.
- **Role-specific server layout guards (ER.1).** `/dashboard/influencer/layout.tsx` redirects non-influencers to `/dashboard?upgrade=influencer`; `/dashboard/brand/layout.tsx` redirects non-brands to `/dashboard?upgrade=brand`. Admin bypasses both. Replaces per-page client-side `router.push('/dashboard')` patterns that flashed content.
- **Email verification provider (EV.3).** Single shared `EmailVerificationProvider` mounted in `dashboard/layout.tsx` powers L1 banner, L2 context banners, L3 sidebar locks, L4 button intercepts, settings card. 60s background poll + tab-focus revalidation + `refresh()` after resend. Fail-open: endpoint errors → treated as verified → no nag (server hard-block is still source of truth).
- **EV `openEmailVerificationPrompt()` helper.** Dispatches the same `e4i:email-not-verified` window event that the api-client 403 interceptor dispatches. Lets Layer 4 disabled-style buttons short-circuit to the modal WITHOUT making a doomed network call.

### Encryption
- **TOTP/account-number/IBAN use versioned encryption.** Store `encryption_key_id` alongside ciphertext so `decryptFromStorage()` finds the right key. Env carries only versioned keys (`ENCRYPTION_KEY_v1`), not a bare `ENCRYPTION_KEY`.
- **Decrypt before slicing.** `accountNumber.slice(-4)` on ciphertext leaks ciphertext, not last-4. Always `decryptFromStorage()` first.

### VS Code / Session Recovery
- Session crashed mid-task → restart VS Code, re-run `npm run dev` on port `9002`, run `git status` before continuing.
- Lock-file / unfamiliar files → investigate before deleting; may be in-progress work.
- Never `git push --force` without explicit user instruction.

### Scheduled launches
- Cron flips status with a `WHERE launch_status='scheduled'` guard, so a concurrent retry returns null and skips side-effects.
- All launch side-effects (brand email, smart distribution, watchlist fan-out) fire **only when the cron publishes** — not at schedule time.
- Datetime input `min` = now + 1h (cron cadence is ~15 min; 1h floor sets the "planning tool, not delayed-launch button" expectation).

### Verify-email page (token-callback rendering)
- **`export const dynamic = 'force-dynamic'`** on `/verify-email/page.tsx` — token state changes between requests (`used_at` flips), and a cached HTML response would replay stale "success" or "expired" panels for other users. Also defends against Vercel CDN / browser cache replaying broken HTML after a deploy.
- **HTML meta refresh for post-verification redirect.** Uses `<meta http-equiv="refresh" content="3;url=/dashboard">` instead of a `useRouter` client component. Pure HTML primitive — no hydration to fail, no RSC fetch transition. Discovered while debugging an unexplained `error.tsx` digest that fired specifically on the SuccessPanel → `/dashboard` `router.push` transition (root cause TBD; see Known Gaps).
- **Plain `<a>` not `<Link>`** on success/already-used panels — forces full page reload, identical to a direct URL-bar nav. Avoids any client-side router transition that might trip the same unidentified bug.

> Full archive of all ~80 decisions (including historical implementation narratives) → `docs/CLAUDE_HISTORY.md §3`.

---

## 6. Current Sprint

**Active:** **A9 — Influencer Verification Flow** (next).

A9 was the 7th hard-block route from EV.1 (`POST /api/influencer/verification/request`) that was deferred pending the broader user-facing email-verification surface. With EV.2 + EV.3 + ER.1 + ER.2 all shipped, the influencer verification flow is the natural next item — it slots into the existing 5-layer nudge system (banner / sidebar lock / button intercept / modal / hard-block) and uses the same `requireEmailVerified` + `requiresCapability: 'isInfluencer'` patterns.

**Parked (low-impact, no user blocker):** verify-email SuccessPanel UX bug — the `error.tsx` boundary was firing on the `router.push('/dashboard')` transition after a successful verification. Defensive fixes (meta refresh, `force-dynamic`, plain `<a>`) shipped to sidestep the failure mode; verification works end-to-end. Root cause requires Vercel function logs (`digest 2626478451`). See `docs/FEATURE10_EMAIL_VERIFICATION_AND_ROLE_GUARDS.md` for the full debugging trail.

---

## 7. What's NEW (since last doc sync)

Single-glance view of every commit since the previous doc sync (`9b3bd1b` on 2026-06-13 captured everything below). Older changes have rolled into `docs/CLAUDE_HISTORY.md §4`.

| Commit | Date | Summary |
|---|---|---|
| `799bd52` | 2026-06-13 | **fix(auth):** `force-dynamic` + plain `<a>` on `/verify-email` — eliminates Vercel CDN / browser cache + client-router transitions as suspects for the SuccessPanel error. Verify-email path now works end-to-end via meta refresh + full page reload. |
| `dd4e536` | 2026-06-13 | **fix(auth):** verify-email success state uses HTML `<meta http-equiv="refresh">`, no client component. Eliminates hydration / `useRouter` failure modes. `SuccessRedirect.tsx` left as dead code pending root-cause investigation. |
| `dbf5c6b` | 2026-06-13 | **fix(auth):** defensive try/catch in `SuccessRedirect` (`window.location.assign` fallback) + dashboard `searchParams` await guard. First mitigation attempt — did not resolve the issue but added belt-and-suspenders. |
| `4394304` | 2026-06-13 | **feat(roles): ER.2** — `UpgradePromptCard` with influencer / brand variants, mounted on `/dashboard` reading `searchParams.upgrade`. Influencer variant CTA → `/onboarding?path=influencer`; brand variant → `mailto:hello@earn4insights.com` (no auto-upgrade — paid business sign-up). Server component, no client state. |
| `faf1bfb` | 2026-06-13 | **fix(roles): ER.1** — sidebar `requiresCapability: 'isInfluencer' \| 'isBrand'` filter (closes "pure consumer sees influencer items" leak from 3.5B-fix); server-side layout guards at `/dashboard/influencer/layout.tsx` + `/dashboard/brand/layout.tsx`. Admin bypasses both. |
| `cb1d766` | 2026-06-11 | **feat(auth): EV.3.2** — Layer-2 context banners + Layer-4 click intercepts on 6 hard-blocked surfaces (submit-feedback, rewards, deals, marketplace, influencer-payouts, brand-campaigns). Uses shared provider; raw-fetch surfaces gain manual `openEmailVerificationPrompt()` calls. |
| `f00e725` | 2026-06-11 | **feat(auth): EV.3.1** — shared `EmailVerificationProvider` (60s poll + tab-focus revalidation + `refresh()`), reusable `EmailVerificationContextBanner`, `openEmailVerificationPrompt()` helper, sidebar `requiresEmailVerified` lock icon. Includes deal-redemption hard-block — `POST /api/deals/[id]/redeem` now joins the 6 EV.1 routes (financial action, requires verification). Existing L1 banner + settings card refactored to consume the shared context. |
| `622e7fa` | 2026-06-10 | **feat(auth): EV.2.2** — `/verify-email` page (5 states), `EmailVerificationBanner` on dashboard, `EmailVerificationCard` on settings, global `EmailNotVerifiedModal` listening on `e4i:email-not-verified` window event, api-client `send()` peeks 403 responses and dispatches the event. |
| `11b6840` | 2026-06-10 | **fix(schema): migration 027** — `user_profiles.id` FK CASCADE → `users(id)` + orphan cleanup. Closes the "deleted user leaves orphan profile" leak that defeated test-account resets. |
| `da93b39` | 2026-06-10 | **feat(auth): EV.2.1** — auto-send verification email at signup (try/catch, doesn't block); Google OAuth `signIn` callback flips `email_verified_at` for both new AND existing-NULL users (Q4 edge case — credentials user later linked Google). `markEmailVerified(userId, via)` helper added with `via: 'google_oauth' \| 'admin_backfill'` audit metadata. |

**Older changes that have moved to history:** the signup UX (`a38f85b`) and EV.1 (`c4b1dce`) entries are now in `docs/CLAUDE_HISTORY.md §4 Recent Feature Notes`.

---

## 8. Production Migrations (numbered index)

All migrations are **idempotent** and gated by `x-api-key: $ADMIN_API_KEY`. Run in numeric order.

| # | Route | One-liner |
|---|---|---|
| 002 | `run-migration-002` | 6 new tables + 3 ALTERs |
| — | `migrate-consent-records` | Backfill legacy JSONB consent into rows |
| 003 | `run-migration-003` | FK constraints + partial UNIQUE index |
| 004 | `run-migration-004` | Influencers Adda (11 tables) |
| 005 | `run-migration-005` | Real-Time layer (6 tables) |
| 006 | `run-migration-006` | Content Approval (2 ALTERs + `content_review_reminders`) |
| 007 | `run-migration-007` | Campaign Marketplace (3 ALTERs + `campaign_applications`) |
| 008 | `run-migration-008` | Razorpay Payment (4 tables) |
| 009 | `run-migration-009` | Deals + Community (9 tables) |
| 010 | `run-migration-010` | Competitive Intelligence (9 tables) |
| 011 | `run-migration-011` | Deals/Community FK CASCADE hardening (19 FKs) |
| 012 | `run-migration-012` | DSAR Requests table (GDPR Art. 15) |
| 013 | `run-migration-013` | Backfill `products.owner_id` for orphan products |
| 014 | `run-migration-014` | WhatsApp OTP verifications table |
| 015 | `run-migration-015` | Customer Support System (5 tables + `vector` extension) |
| — | `seed-faq` | Idempotent FAQ seed (31 articles, embeddings) |
| 016 | `run-migration-016` | Scheduled Product Launch (2 columns + partial index) |
| 017 | `run-migration-017` | Platform Analytics / Founder Dashboard (5 tables) |
| 018 | `run-migration-018` | WhatsApp OTP → Twilio Verify (relax NOT NULL) |
| 019 | `run-migration-019` | Two-Factor Authentication (3 tables + `users.two_factor_enabled`) |
| 020 | `run-migration-020` | Social Listening cron expansion (telegram + handle attribution) |
| 022 | `run-migration-022` | Multi-role flags + influencer in auth (Phase 3.5A) |
| 023 | `run-migration-023` | Expand `users.role` CHECK for influencer (3.5A hot-fix) |
| 024 | `run-migration-024` | 6-step influencer onboarding wizard (Phase 3.5C) |
| 026 | `run-migration-026` | Email Verification (EV.1 — `users.email_verified_at` + `email_verification_tokens`) |
| 027 | `run-migration-027` | `user_profiles.id` FK CASCADE → `users(id)` + orphan cleanup (closes leak that defeated test-account resets + left PII for "deleted" users) |

> Full per-migration detail: `docs/CLAUDE_HISTORY.md §2` and `docs/SCHEMA.md`.

---

## 9. Cron Jobs

**Total: 32 entries** (full schedule + auth pattern + batch-size notes → `docs/CRON_JOBS.md`).

Recurring categories:
- Analytics (3): daily metrics 01:00 UTC, weekly retention Sun 02:00 UTC, monthly financial 1st 03:00 UTC
- Cleanup (4): trusted devices, DSAR blobs, expired verification tokens (04:00 UTC daily), signal retention
- Social listening (env-gated): `process-social-mentions` — Reddit always-on, YouTube/Google/Telegram activate when env var is set
- Content review reminders, marketplace digests, competitive intelligence, support daily summary, etc.

Sub-daily crons (e.g. `publish-scheduled-launches` at 15-min cadence) are driven by **cron-job.org**; Vercel registers a daily safety-net backstop. See §5 Recurring Rules.

---

## 10. Environment Variables

> Names only — actual values + commentary in `ARCHITECTURE.md §22`. Copy template from `.env.example`.

**Database & admin:** `POSTGRES_URL` (or `DATABASE_URL`), `ADMIN_API_KEY`

**Encryption (versioned):** `CURRENT_ENCRYPTION_KEY_ID`, `ENCRYPTION_KEY_v1` (add `_v2` when rotating)

**Auth:** `AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_URL`

**Signal retention:** `SIGNAL_RETENTION_DAYS`, `SIGNAL_CRON_BATCH_SIZE`, `ICP_SCORE_CRON_BATCH_SIZE`

**Cron auth:** `CRON_SECRET`

**Social OAuth (LinkedIn — OIDC):** `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`, `SOCIAL_OAUTH_REDIRECT_URI`, `NEXT_PUBLIC_LINKEDIN_CLIENT_ID`

**Pusher (real-time):** `PUSHER_APP_ID`, `PUSHER_KEY`, `PUSHER_SECRET`, `PUSHER_CLUSTER` (`ap2`), `NEXT_PUBLIC_PUSHER_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`, `SOCIAL_MENTION_WEBHOOK_SECRET`

**Razorpay (payments):** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`

**Rate limiting (Upstash):** `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` (falls back to in-memory if unset)

**Email / SMS / WhatsApp:** `RESEND_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`, `TWILIO_VERIFY_CHANNEL` (`sms` at launch, `whatsapp` when sender approved)

**AI:** `OPENAI_API_KEY`, `CHATBOT_MODEL`, `CHATBOT_CLASSIFY_MODEL`

**Storage:** `BLOB_READ_WRITE_TOKEN` (Vercel Blob)

**Feature flags:** `ADMIN_DIAGNOSTICS_ENABLED`, `NEXT_PUBLIC_WHATSAPP_ENABLED`, `YOUTUBE_API_KEY` (activates YouTube social listener), `GOOGLE_PLACES_API_KEY` (Google Reviews), `TELEGRAM_BOT_TOKEN` (Telegram)

**Support:** `SUPPORT_ADMIN_EMAIL` (defaults to `contact@earn4insights.com`)

---

## 11. Known Gaps & Future Work

### Real-Time (Minor)
- `ACTIVITY_FEED_UPDATE` Pusher event defined but unused (`ActivityFeed` polls)
- `brand.member.active` / `brand.discount.created` emitters missing (handlers wired, no `emit()` callers)
- `dispatchToUsers` N+1 at scale — 2 DB + 2 Pusher per target; capped at CONCURRENCY=50

### Influencers Adda
- **RazorpayX Payouts API** — `RAZORPAYX_ENABLED = false`; activate when account approved (then auto INR payouts)
- **Wise API integration** — `wiseService.ts` is a stub pending API key + profile ID
- **Social stats verification** — currently self-declared; no platform API checks yet

### Privacy & Compliance
- **Instagram OAuth** — plumbing ready; needs Facebook App Review
- **Social interest inference** — `POST /api/consumer/social/sync` route built; provider API calls pending OAuth setup
- **Signal snapshots in process-deletions cron** — admin-deleted profiles may leave orphans

### Deals & Community
- Deal ICP targeting — `icpTargetData` JSONB stored but not yet wired to consumer filtering
- Community post points ledger — `pointsAwarded` column exists; not wired to consumer points yet
- Brand deal analytics page — `/api/brand/deals/[id]/analytics` exists; UI not built

### Competitive Intelligence
- Real competitor data ingestion — manual / brand-input only; no automated scraping
- Market share — proxy via relative feedback volume, not true GMV / unit-share

### Platform Analytics
- MRR is a `netRevenue` proxy (no recurring subscriptions yet)
- Consumer LTV is a payout-cost proxy
- Brand LTV doesn't weight by churn
- Feature adoption denominator is today's per-role DAU (need role-split MAU column)
- No CAC / LTV:CAC ratio (need UTM cohort × payment attribution)

### Auth
- **Verify-email SuccessPanel transition error** — `error.tsx` boundary fires on `/verify-email` after a successful token verification when the page tries to `router.push('/dashboard')`. Defensive fixes (HTML meta refresh, `force-dynamic`, plain `<a>`) sidestep the failure mode and verification works end-to-end. Root cause unknown — needs Vercel function logs to investigate digest `2626478451`. Currently parked as low-impact.
- **A9 — Influencer Verification Flow** — 7th hard-block route from EV.1, deferred pending broader email-verification surface. Now ready as current sprint.

---

## 12. Reference Docs

- **`docs/CLAUDE_HISTORY.md`** — full history: Phase Status table, ~80-row Key Decisions archive, feature notes (EV.1, password UX), audit cross-reference
- **`ARCHITECTURE.md`** — authoritative technical reference (22 sections, all phases)
- **`docs/PRELAUNCH_AUDIT_FIX_LOG.md`** — 6-pass audit journal, Phase 1–3.5 fix narratives
- **`docs/SCHEMA.md`** — all DB table definitions (migrations 002–027)
- **`docs/CRON_JOBS.md`** — full cron schedule (32 entries), auth pattern, batch sizes
- **`docs/SOCIAL_PLATFORM_SETUP.md`** — per-platform listener setup (status, API, cost, approval, env vars)
- **`docs/FEATURE1_HYPERPERSONALIZATION.md`** — encryption, consent, ICP scoring
- **`docs/FEATURE2_INFLUENCERS_ADDA.md`** — campaign lifecycle, payments, earnings, content approval, @ tags
- **`docs/FEATURE3_REALTIME.md`** — Pusher, event bus (31 events), notifications / presence
- **`docs/FEATURE4_COMPETITIVE_INTELLIGENCE.md`** — 9 tables, 6-dimension scoring, AI insights, alerts, 5 crons
- **`docs/FEATURE5_DEALS_COMMUNITY.md`** — 9 tables, FK CASCADE hardening, moderation
- **`docs/FEATURE6_DSAR.md`** — DSAR table, OTP flow, PDF + Vercel Blob, cleanup cron
- **`docs/FEATURE7_SUPPORT_SYSTEM.md`** — 5 tables, chatbot architecture, KB seeding, admin dashboard
- **`docs/FEATURE8_PLATFORM_ANALYTICS.md`** — methodology (DAU/MAU, cohorts, MRR, LTV, ARPU, health score, OLS forecast)
- **`docs/FEATURE9_TWO_FACTOR_AUTH.md`** — TOTP service, 9 routes, setup wizard, `requires2FA` interlock
- **`docs/FEATURE10_EMAIL_VERIFICATION_AND_ROLE_GUARDS.md`** — EV.1 backend + EV.2 UI + EV.3 5-layer nudge system + ER.1 role guards + ER.2 upgrade prompt. Architecture + file map + smoke test + known issue (verify-email transition).
