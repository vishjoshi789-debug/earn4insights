# CLAUDE_HISTORY.md — Historical Reference

> Archive of Earn4Insights project history, completed phase decisions, and detailed feature narratives that have been moved out of the lean `CLAUDE.md`.
>
> **Purpose** — Keep `CLAUDE.md` under 30k chars so Claude Code stays fast and focused on daily work, while preserving every line of historical context here for deep reference.
>
> **Sister docs:**
> - `CLAUDE.md` — current invariants, footguns, sprint status (lean)
> - `ARCHITECTURE.md` — authoritative technical reference
> - `docs/PRELAUNCH_AUDIT_FIX_LOG.md` — 6-pass audit + Phase 1–3.5 fix narratives
> - `docs/FEATURE1–9_*.md` — per-feature deep dives
> - `docs/SCHEMA.md` — all DB table definitions
> - `docs/CRON_JOBS.md` — full cron schedule
> - `docs/SOCIAL_PLATFORM_SETUP.md` — per-platform listener setup

---

## Table of Contents

1. [Phase Status — Completed Features](#1-phase-status--completed-features)
2. [Production Migration Index (Full Detail)](#2-production-migration-index-full-detail)
3. [Key Decisions — Full Archive](#3-key-decisions--full-archive)
4. [Recent Feature Notes](#4-recent-feature-notes)
   - 4.1 [Email Verification System (EV.1) — `c4b1dce`](#41-email-verification-system-ev1--c4b1dce)
   - 4.2 [Password UX — Checklist, Strength, Confirm, Show/Hide — `a38f85b`](#42-password-ux--checklist-strength-confirm-showhide--a38f85b)
   - 4.3 [Email Verification Auto-Wire (EV.2.1) — `da93b39`](#43-email-verification-auto-wire-ev21--da93b39)
   - 4.4 [Email Verification UI + 5-Layer Nudge System (EV.2.2 + EV.3.1 + EV.3.2)](#44-email-verification-ui--5-layer-nudge-system-ev22--ev31--ev32)
   - 4.5 [Migration 027 — `user_profiles` FK CASCADE — `11b6840`](#45-migration-027--user_profiles-fk-cascade--11b6840)
   - 4.6 [Role Boundaries (ER.1 + ER.2) — `faf1bfb` + `4394304`](#46-role-boundaries-er1--er2--faf1bfb--4394304)
   - 4.7 [Verify-email Transition Error — Defensive Engineering — `dbf5c6b` + `dd4e536` + `799bd52`](#47-verify-email-transition-error--defensive-engineering--dbf5c6b--dd4e536--799bd52)
5. [Pre-Launch Audit Cross-Reference](#5-pre-launch-audit-cross-reference)

---

## 1. Phase Status — Completed Features

> Verbatim from the "Phase Status — All Complete" table of CLAUDE.md (May 2026 v8). Every row below is a shipped feature.

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
| Two-Factor Authentication — TOTP (migration 019 — 3 tables: `user_totp_secrets`, `user_recovery_codes`, `trusted_devices` + `users.two_factor_enabled`; RFC 6238 TOTP via `otpauth`, QR via `qrcode`; 9 API routes; `requires2FA` JWT→middleware interlock with `e4i-2fa` proof cookie + `e4i-trusted-device` cookie; 3-step setup wizard + `/auth/two-factor` challenge page; 5 security emails; `cleanup-trusted-devices` cron; credentials accounts only; wizard sign-out after enable so the next session is freshly minted with `twoFactorPending`) | ✅ COMPLETE |
| WhatsApp Notifications Disabled for Launch (`NEXT_PUBLIC_WHATSAPP_ENABLED` flag default false; onboarding Step 5 removed, Step 4 Interests is the final step with "Final step!" label; settings WhatsApp card + brand alert-rules WhatsApp column + consumer survey-notifications copy all gated on the flag; `DEFAULT_NOTIFICATION_PREFS.whatsapp.enabled=false`; Twilio env vars, migration 014 / 018, `whatsappOtpService` all retained; flipping flag to `true` in Vercel + rebuild re-exposes everything) | ✅ COMPLETE |
| LinkedIn OAuth — OIDC Migration + Admin Auto-Grant (scopes migrated from retired `r_liteprofile r_emailaddress` → `openid profile email`; settings page reads `NEXT_PUBLIC_LINKEDIN_CLIENT_ID`; callback gets userinfo `sub` → stored as `verified_subject` for Phase 4 attribution; admin role auto-grants social consent so platform owner can exercise the same Connect flow without separate UI hop; differentiated error reasons in callback redirect: `no_consent` / `token_exchange_failed` / `oauth_not_configured` / `server_error`; connection-list + disconnect APIs opened to `consumer OR admin` role; success toast on `?social=connected`/`?social=already_connected` cleans the URL via `history.replaceState`) | ✅ COMPLETE |
| Social Listening v2 — Honest UI + Multi-Platform Cron + Telegram + Attribution (migration 020 — `telegram_bot_state` single-row offset cursor + 3 verified-handle columns on `consumer_social_connections` + 2 partial indexes; UI filter dropdown shows status badges per platform — `working` / `configure` / `coming_soon` — with explanatory cards replacing empty results for non-working; `process-social-mentions` cron rewritten as env-gated registry covering Reddit (always on) + YouTube (`YOUTUBE_API_KEY`) + Google Reviews (`GOOGLE_PLACES_API_KEY`) + Telegram (`TELEGRAM_BOT_TOKEN`); `TelegramAdapter` uses Bot API `getUpdates` with offset cursor — Bot API scope only, channels the bot has been added to; `handleAttributionService` resolves social-post authors back to E4I users via OAuth-captured `verified_subject` / `verified_handle` with case-insensitive exact match + `LIMIT 2` duplicate detection + write-time consent recheck; signal-write hook in `socialIngestionService` appends `consumer_signal_snapshots` rows with `triggered_by='attributed_social_post'` and `signal_category='social'`; `docs/SOCIAL_PLATFORM_SETUP.md` documents every platform end-to-end) | ✅ COMPLETE |
| Community Trending Banner (`/api/community/trending` aggregates `social_posts.keywords` jsonb arrays over rolling window via `UNNEST jsonb_array_elements_text`; in-memory TTL cache 10 min per `days|category`; `TrendingSocialBanner` client component renders chips above community feed, hides on empty/error; clicking flows into community search via `setQueryInput`+`setSearchQuery`; optional `category` filter uses `products.profile->>'categoryName'`) | ✅ COMPLETE |
| Email Verification System (EV.1) — migration 026; `users.email_verified_at` + `email_verification_tokens` table; service generates/verifies tokens with SHA-256 hash + one-active-token-per-user rule; `requireEmailVerified` guard wired into 6 critical routes (feedback submit, rewards redeem, marketplace apply, payouts accounts, brand campaigns, payments create-order); resend rate-limit 3/1h/userId; cleanup cron 04:00 UTC daily; Google users auto-backfilled. | ✅ COMPLETE |
| Password UX — Single SSOT in `passwordPolicy.ts` (5 rules: length, upper, lower, number, special); reusable `PasswordInput` component (eye/eye-off toggle, optional 4-segment strength bar, optional live checklist); signup adds confirm-password field with live match indicator; login uses toggle-only PasswordInput; server enforcement tightened in `auth.actions.ts` Zod + `reset-password` route via `assertPasswordPolicy()`. | ✅ COMPLETE |
| Email Verification Auto-Wire (EV.2.1) — `signUpAction` auto-sends verification email at signup (try/catch, doesn't block); Google `signIn` callback flips `email_verified_at` for both new AND existing-NULL users via `markEmailVerified(userId, via)` helper; `sendVerificationEmail` extended with `trigger: 'signup_auto' \| 'resend' \| 'admin'` audit metadata. | ✅ COMPLETE |
| Migration 027 — `user_profiles.id` FK CASCADE → `users(id)` + orphan cleanup; closes leak that defeated test-account resets + left PII / consent data for "deleted" users. Drizzle schema updated to declare `.references(() => users.id, { onDelete: 'cascade' })`. | ✅ COMPLETE |
| Email Verification UI (EV.2.2) — `/verify-email` page (5 states), `EmailVerificationBanner` (Layer 1), `EmailVerificationCard` (settings), global `EmailNotVerifiedModal` (Layer 5), api-client `send()` 403 peek + `e4i:email-not-verified` window event dispatch. | ✅ COMPLETE (with known issue — see §4.7) |
| Email Verification 5-Layer Nudge System (EV.3.1 + EV.3.2) — Shared `EmailVerificationProvider` (60s poll + tab-focus revalidation), Layer-2 context banners on 6 hard-blocked pages, Layer-3 sidebar 🔒 locks with `requiresEmailVerified` flag, Layer-4 click intercepts via `openEmailVerificationPrompt()` helper; deal redemption hard-block added (`POST /api/deals/[id]/redeem`) — now 7th hard-blocked route. | ✅ COMPLETE |
| Role Boundaries (ER.1 + ER.2) — Sidebar `requiresCapability: 'isInfluencer' \| 'isBrand'` filter (closes "pure consumer sees influencer items" leak from 3.5B-fix); server-side layout guards at `/dashboard/influencer/layout.tsx` + `/dashboard/brand/layout.tsx` (admin bypass); `UpgradePromptCard` with influencer / brand variants mounted on `/dashboard?upgrade=…`. | ✅ COMPLETE |
| Verify-email Defensive Engineering — three commits (try/catch fallback, HTML meta refresh replaces `SuccessRedirect` client component, `force-dynamic` + plain `<a>`); end-to-end verification works through meta-refresh path; SuccessPanel transition error root cause unresolved (parked pending Vercel function logs). | ⚠️ Parked — works end-to-end via defensive paths; root cause TBD |

---

## 2. Production Migration Index (Full Detail)

> Verbatim from CLAUDE.md "Production migrations" section. All idempotent, require `x-api-key: <ADMIN_API_KEY>`. Run in numeric order.

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
21. `POST /api/admin/run-migration-020` — Social Listening cron expansion (single-row `telegram_bot_state` for Bot API offset tracking; adds `consumer_social_connections.verified_handle / verified_subject / handle_verified_at` plus partial indexes `idx_csc_platform_handle` / `idx_csc_platform_subject` for the Phase 4 handle-attribution lookup — only OAuth-verified handles are populated, no self-declared values)

> Migrations 022 / 023 / 024 (Phase 3.5 — influencer multi-role, role CHECK expansion, 6-step wizard) are documented in `docs/PRELAUNCH_AUDIT_FIX_LOG.md`.
> Migration 026 (Email Verification — EV.1) is described in section 4.1 below.

---

## 3. Key Decisions — Full Archive

> Verbatim from CLAUDE.md "Key Decisions" table. Active invariants/footguns relevant to daily work were extracted into `CLAUDE.md §5 Recurring Rules`; this table preserves the **full** ~80-row archive including historical implementation narratives.

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
| **2FA wizard force-signs-out on enable** | `TwoFactorSetupWizard`'s "Done" button calls `signOut({ callbackUrl: '/login' })` rather than `router.push('/dashboard/settings')`. `requires2FA` is computed once at `authorize()` time; a session minted BEFORE 2FA was enabled carries no `twoFactorPending` and would never be challenged. Signing out forces the next login to mint a fresh JWT with the flag set. Same pattern GitHub uses. |
| **CSRF cookie minted via dedicated `/api/csrf/init` route, not just middleware** | Next.js middleware did not reliably set the `e4i-csrf` cookie on redirect paths (observed in production on `/onboarding` and `/dashboard/settings` after auth redirects). Rather than debug Next internals, `/api/csrf/init` mints the cookie directly from a route handler — middleware is still primary, this is the safety net. Client callsites that need to be certain (chat widget, OAuth redirects, mutating POSTs from redirected pages) `await fetch('/api/csrf/init')` before the first mutating request. |
| **WhatsApp UI gated behind `NEXT_PUBLIC_WHATSAPP_ENABLED`, code retained** | Twilio trial silently drops messages to numbers that haven't joined the sandbox. Until a production Twilio account is in place we ship email-only and hide the WhatsApp UI: onboarding Step 5 removed, settings WhatsApp card / alert-rules column / survey-notifications copy all wrapped in `{WHATSAPP_ENABLED && ...}`. `whatsappOtpService`, `whatsappNotifications`, Twilio env vars, migrations 014/018, and the `whatsapp_otp_verifications` table are all preserved — flipping the flag + rebuild re-exposes the UI with no code change. |
| **LinkedIn admin auto-grants social consent in callback** | `/api/consumer/social/callback` calls `grantConsent(userId, 'social', ...)` (idempotent via `onConflictDoUpdate`) when `role === 'admin'`, instead of `enforceConsent` which would throw. Admin is data subject + controller for their own account, GDPR-compliant; the grant is still written to `consent_records` for the audit trail. Consumers still hit the normal `enforceConsent` path. |
| **LinkedIn callback returns specific `?reason=...`, not generic `server_error`** | Catch block matches the thrown message: `has not consented` → `no_consent`, `LinkedIn token exchange failed` → `token_exchange_failed`, `OAuth env vars not configured` → `oauth_not_configured`. Previously every throw collapsed to `server_error` and hid the real cause. `[LinkedIn-Callback]` step-by-step logs supplement the URL reason for deeper diagnosis in Vercel logs. |
| **Social listening platform status is honest in the UI** | `PLATFORM_OPTIONS` carries a `status: 'working' \| 'configure' \| 'coming_soon'` and a `message`. Filter dropdown shows a badge per non-working entry; selecting a non-working platform replaces the empty grid with an explanatory card. Previously all 10 platforms were filterable equally and stubbed ones silently returned zero results — misleading "no mentions yet". |
| **`process-social-mentions` cron is env-gated registry, not hard-coded** | `POLL_PLATFORMS` array entries: `{ key, envOk, envVar, make }`. Reddit is always on (free public JSON); YouTube / Google / Telegram activate when their env var is set in Vercel — **no redeploy needed** (server env, not `NEXT_PUBLIC_`). Run-log prints `[Social-Cron] Active: ... | Skipped: ... (no <ENV_VAR>)`. Adding a future platform is one entry. |
| **Telegram is Bot API only — MTProto is out of scope** | Bot API can only read messages from channels/groups where the bot has been added as member/admin; there's no public-channel search. MTProto would unlock broad monitoring but needs phone-number auth, carries ban risk, and is ToS-grey. Documented in `docs/SOCIAL_PLATFORM_SETUP.md#future-considerations`. The `TelegramAdapter` uses `getUpdates` with an offset cursor stored in single-row `telegram_bot_state` (enforced by `CHECK (id = 1)`). |
| **Handle attribution accepts ONLY OAuth-verified identifiers** | `verified_handle` / `verified_subject` columns on `consumer_social_connections` are populated **exclusively** by OAuth callbacks after a successful `userinfo` / `/me` fetch on the platform — never user-declared. Lookup in `handleAttributionService` does case-insensitive exact match + `LIMIT 2` duplicate detection (refuses to pick a winner on data anomaly) + `checkConsent` re-verification at write-time. False positives are structurally impossible — an anonymous Reddit `u/whoever` cannot accidentally match an E4I user unless that user has connected Reddit and we captured `whoever` at OAuth time. |
| **Attribution hook is inline (post-insert) and try/catch-wrapped** | `socialIngestionService.ingestSocialForProduct` runs the attribution loop AFTER `insertSocialPosts` returns successfully. Any failure (DB hiccup, malformed row, consent revoke) is caught and logged — the post insert is already committed and is never affected. Hook produces zero matches today by design (LinkedIn-OAuth is the only platform that populates `verified_subject`, and LinkedIn listening is still a stub); activates the moment any user-OAuth + working listener intersection comes online. |
| **`'attributed_social_post'` is a `triggered_by` value, not a `signalCategory`** | `consumer_signal_snapshots.triggered_by` is plain `TEXT NOT NULL` — only the TS union restricts it. We widened the union (no schema change). `signal_category` stays `'social'` (matches the consent category — required for the consent recheck to be meaningful). The distinguishing tag is `triggered_by`, so future queries can filter `WHERE triggered_by = 'attributed_social_post'` without JSONB extraction. |
| **Community trending: jsonb UNNEST + 10-min in-process cache** | `social_posts.keywords` is `jsonb` (not `text[]`), so the aggregate uses `jsonb_array_elements_text(keywords)` in a LATERAL join. Cache is keyed `${days}|${category}` with 10-min TTL. Vercel serverless means each warm instance has its own cache — best-effort, not global, but still amortises rapid repeat hits. Banner returns `null` on empty / loading / error so the community feed is unaffected by any aggregate failure. |

---

## 4. Recent Feature Notes

### 4.1 Email Verification System (EV.1) — `c4b1dce`

**Date:** 2026-06-05
**Status:** EV.1 shipped; EV.2 next sprint
**Reference:** `src/server/emailVerificationService.ts`, `src/server/emailVerificationGuard.ts`, `src/lib/email/templates/email-verification.ts`

**What shipped (EV.1):**
- Migration 026 (`POST /api/admin/run-migration-026`):
  - `users.email_verified_at TIMESTAMP NULL`
  - `email_verification_tokens` table (id, user_id FK CASCADE, token_hash, expires_at, used_at, created_at) + 3 indexes (token_hash for verify lookup, user_id for resend invalidation, expires_at for cleanup cron)
  - Google backfill: `UPDATE users SET email_verified_at = created_at WHERE google_id IS NOT NULL AND email_verified_at IS NULL` (OAuth providers verify email before issuing tokens — `google_id IS NOT NULL` is a sound proxy).
  - Idempotent throughout
- Schema (`src/db/schema.ts`): `users.emailVerifiedAt` column + `emailVerificationTokens` table with type exports
- Service (`emailVerificationService.ts`):
  - `generateVerificationToken(userId)` — `randomBytes(32).toString('hex')` → SHA-256 hash → insert. Atomic transaction also marks prior unused tokens for the same user as used (one-active-token rule). Mirrors `password_reset_tokens` pattern.
  - `sendVerificationEmail({userId, email, name})` — builds branded HTML via the new email-verification template, dispatches via Resend, audit-logs (`action='email_verification_sent'`, email PII-masked)
  - `verifyEmailToken(plainToken)` — hash + lookup + validate (not used, not expired) → transaction: mark used + flip `users.email_verified_at` → audit log (`action='email_verified'`). Returns `{ ok: false, reason: 'not_found'|'expired'|'already_used' }` on failure. Enumeration-safe: `not_found` reused for "no matching row" (could mean bogus token OR cron-deleted).
  - `resendVerificationEmail(userId)` — caller rate-limits; service returns silent no-op if already verified
  - `cleanupExpiredTokens()` — deletes rows past expiry + 7-day grace
  - `getEmailVerifiedAt(userId)` — lookup helper for the guard
- Guard (`emailVerificationGuard.ts`):
  - `EmailNotVerifiedError` class (mirrors `PayoutAccountRequiredError` pattern from A10)
  - `requireEmailVerified(userId)` — throws if not verified
  - `emailNotVerifiedResponseBody()` — structured 403 shape: `{ error, code: 'EMAIL_NOT_VERIFIED', cta: '/dashboard/settings' }`
- Rate limit (`src/lib/rate-limit-upstash.ts`): `verificationResendRateLimit` — 3 tokens / 1h window, userId-keyed (not email — avoids reverse email-enumeration via rate-limit response)
- Email template (`email-verification.ts`):
  - `buildVerificationEmailHTML({firstName, verifyUrl})`
  - Subject: "Verify your email for Earn4Insights"
  - Branded HTML mirroring welcomeNotifications + forgot-password styles. 24h expiry copy. Plain-URL fallback. "Didn't sign up? Ignore" copy. Mobile responsive, inlined styles
  - `escapeHtml()` for the user-controlled firstName (defence in depth)
- API routes:
  - `POST /api/auth/resend-verification` — CSRF-gated, auth-gated, rate-limited 3/1h/userId. Neutral response shape regardless of "user not found / already verified / send succeeded" — caller can't infer state. 429 on rate limit hit.
  - `GET /api/auth/check-verification` — auth-gated, polling helper for the EV.2 client-side "did I just verify in another tab" UX
  - `GET /api/cron/cleanup-expired-verification-tokens` — Bearer `$CRON_SECRET` auth, daily at 04:00 UTC (vercel.json registered alongside cleanup-trusted-devices)
- Hard-block wiring (6 of 7 routes per user spec Q5; the 7th — `/api/influencer/verification/request` — ships in 3.6.1):
  1. `POST /api/feedback/submit` — analytics input
  2. `POST /api/consumer/rewards/redeem` — financial
  3. `POST /api/marketplace/campaigns/[id]/apply` — legal/contractual
  4. `POST /api/payouts/accounts` — financial
  5. `POST /api/brand/campaigns` — financial
  6. `POST /api/payments/create-order` — financial
  - Each: `try { await requireEmailVerified(userId) } catch (EmailNotVerifiedError → NextResponse.json(structuredBody, 403))` inserted at the head, after auth+role checks. Client UI (EV.2) intercepts the `EMAIL_NOT_VERIFIED` code → opens "verify email" modal — same interceptor pattern as `PAYOUT_ACCOUNT_REQUIRED` from A10.

**Post-deploy steps:**
1. `POST /api/admin/run-migration-026` with `x-api-key: $ADMIN_API_KEY`
2. Verify column + table + Google backfill in Neon
3. Smoke: log in as a non-Google email/password user — request resend via `/api/auth/resend-verification` (DevTools) — verify email lands — click link → hits `GET /verify-email` which EV.2 will build (page doesn't exist yet — link works once EV.2 ships)
4. EV.2 ships the `/verify-email` page, banner, settings card, signup integration (auto-send on `createUser`, auto-verify Google in `signIn` callback). EV.2 wires everything user-facing.

**Out of scope (EV.2):**
- `/verify-email` page (server-side token consumption + 4 states)
- `EmailVerificationBanner` mounted on dashboard layout
- `EmailVerificationCard` on `/dashboard/settings`
- `signUpAction` auto-send hook
- Google `signIn` callback auto-verify hook
- Client interceptor for `EMAIL_NOT_VERIFIED` code

---

### 4.2 Password UX — Checklist, Strength, Confirm, Show/Hide — `a38f85b`

**Date:** 2026-06-07
**Status:** Shipped — typecheck clean; recommend signup with a real inbox for full EV.1 end-to-end before relying in prod
**Reference:** `src/lib/auth/passwordPolicy.ts`, `src/components/auth/PasswordInput.tsx`, `src/app/(auth)/signup/page.tsx`, `src/app/(auth)/login/page.tsx`, `src/lib/actions/auth.actions.ts`, `src/app/api/auth/reset-password/route.ts`

**Single source of truth in `src/lib/auth/passwordPolicy.ts`:**
- 5 rules (length ≥ 8, upper, lower, number, special)
- `validatePassword` / `getPasswordStrength` / `assertPasswordPolicy`
- `PASSWORD_SPECIAL_CHARS_REGEX` shared by client + server

**Reusable `PasswordInput` (`src/components/auth/PasswordInput.tsx`):**
- Eye/EyeOff toggle (`aria-label` + `aria-pressed`, focusable)
- Optional 4-segment strength bar (red → amber → green)
- Optional live checklist (rules turn green with check icon as met)
- Forwards refs + standard input props

**Signup page (`src/app/(auth)/signup/page.tsx`):**
- `PasswordInput` on primary password with checklist + meter
- New Confirm Password field below
- Live match indicator: red "Passwords don't match" / green "Passwords match"
- Submit gated on policy met AND passwords match (in addition to T&C)
- `aria-describedby` wires error to field for screen readers

**Login page (`src/app/(auth)/login/page.tsx`):**
- `PasswordInput` toggle-only (no nag for returning users)

**Server enforcement tightened to match UI exactly:**
- `auth.actions.ts` Zod: ≥ 8 + upper + lower + number + special
- `/api/auth/reset-password`: bare length check → `assertPasswordPolicy()` (closes the gap where reset-password let through 8-char letters-only)

**`ARCHITECTURE.md` Security Batch 1 #17 line synced to the new policy** (docs previously claimed "uppercase + digit" but code only enforced letter + digit — fixed honestly here).

**Note:** This sits in front of EV.1's email-verification path (a user can sign up with a strong password, then trigger EV.1's resend flow to receive the verification email).

---

### 4.3 Email Verification Auto-Wire (EV.2.1) — `da93b39`

**Date:** 2026-06-10
**Status:** Shipped
**Reference:** `src/lib/actions/auth.actions.ts`, `src/lib/auth/auth.config.ts`, `src/server/emailVerificationService.ts`

EV.2.1 connected EV.1's verification backend to the two real signup paths. The change is small in LOC but closes a meaningful gap — before this, EV.1 had a `requireEmailVerified` guard on 6 critical routes but no automatic way for a user to actually become verified (they'd hit the guard, get a 403, then have to manually request a verification email).

**Three coordinated edits:**

1. **`signUpAction` auto-send** — captures the `createUser` return value (`newUser`), then `await`s `sendVerificationEmail({ userId, email, name, trigger: 'signup_auto' })` inside a try/catch. Resend outage logs but doesn't block signup. Mirror of the `sendWelcomeNotifications` pattern in `createUser` (CLAUDE_HISTORY noted Vercel kills fire-and-forget promises — must await).

2. **Google OAuth auto-verify** — `signIn` callback in `auth.config.ts` calls `markEmailVerified(user.id, 'google_oauth')` for BOTH the new-user-create branch AND the existing-user-sign-in branch. The existing-user branch covers the Q4 edge case: a credentials user signs up with email/password (unverified), later signs in via Google with the same email → without this their `email_verified_at` would stay NULL forever despite Google having verified them. `markEmailVerified` uses an `isNull(emailVerifiedAt)` WHERE guard so the call is idempotent for already-verified rows.

3. **`sendVerificationEmail` `trigger` param** — new optional `trigger: 'signup_auto' | 'resend' | 'admin'` written into audit `metadata.trigger`. Defaults to `'resend'` for backward compat with existing callers. Lets the audit timeline distinguish auto-send-at-signup from manual-resend from admin-backfill.

**`markEmailVerified(userId, via)` helper added** — used by both the Google OAuth path and potential future admin-backfill paths. Returns `{ updated: boolean }` so callers can know whether an actual flip happened (only writes the audit row if so).

**Smoke test (2026-06-10):** real-inbox signup → received both welcome email AND verification email (with subject "Verify your email for Earn4Insights").

---

### 4.4 Email Verification UI + 5-Layer Nudge System (EV.2.2 + EV.3.1 + EV.3.2)

**Date:** 2026-06-10 → 2026-06-11
**Commits:** `622e7fa` (EV.2.2), `f00e725` (EV.3.1), `cb1d766` (EV.3.2)
**Status:** Shipped (with one known issue — see §4.6 verify-email defensive engineering)

The end-to-end user-facing email-verification surface spans three commits but is best read as one feature.

#### EV.2.2 — Initial UI (`622e7fa`)

**8 new files / surfaces:**
- `src/app/verify-email/page.tsx` — server component reading `?token=…`, calls `verifyEmailToken`, renders one of 5 panels (success / expired / already-used / invalid / missing-token). Original SuccessPanel used `SuccessRedirect` client component with `useRouter().push('/dashboard')` after 3s countdown — this turned out to be the source of the bug in §4.6.
- `src/app/verify-email/SuccessRedirect.tsx` — client component with countdown + manual "Go to dashboard" button. Later replaced by HTML meta refresh in the defensive engineering phase.
- `src/components/EmailVerificationBanner.tsx` (Layer 1) — amber prompt at top of dashboard. Dismissable per session via sessionStorage (mirrors `BrandOnboardingBanner`).
- `src/components/EmailVerificationCard.tsx` — settings card with verified/unverified branches.
- `src/components/EmailNotVerifiedModal.tsx` (Layer 5) — global modal listening on `e4i:email-not-verified` window event. ESC + backdrop close, focus management, ARIA-modal.
- `src/lib/api-client.ts` — `send()` interceptor that peeks 403 responses, clones the body, dispatches the event if `body.code === 'EMAIL_NOT_VERIFIED'`. Transparent to callers (original `res` returned unchanged).
- Mounted in `dashboard/layout.tsx` (banner + modal) and `dashboard/settings/page.tsx` (card).

#### EV.3.1 — Foundation refactor + sidebar locks + deal hard-block (`f00e725`)

**Provider unification** — `EmailVerificationProvider` (Context + `useEmailVerification` hook) consolidates the previously-3-independent polls (banner, card, future surfaces) into one shared fetch. 60s poll + tab-focus revalidation via `visibilitychange` + `refresh()` exposed for explicit revalidation after resend. Fail-open (endpoint error → treated as verified → no nag).

**Reusable building blocks** added:
- `EmailVerificationContextBanner` (Layer 2) — compact non-dismissable amber banner with `[Verify now]` resend button.
- `openEmailVerificationPrompt()` helper (`src/lib/email-verification-prompt.ts`) — dispatches the same window event as the api-client interceptor. For Layer 4 buttons that want to short-circuit to the modal without making a doomed network call.

**Sidebar locks (Layer 3)** — `MenuItem.requiresEmailVerified?: boolean` triggers an amber 🔒 + tooltip. 7 items marked at EV.3.1 (Cash Out Points later removed in EV.3.2 because `/api/payouts` isn't actually hard-blocked).

**Deal redemption hard-block** — `POST /api/deals/[id]/redeem` joined the 6 EV.1 routes as the 7th hard-blocked endpoint. Pattern identical to feedback/submit.

**Existing components refactored to consume the shared context** — removes ~3x redundant polls.

#### EV.3.2 — Wire-up across 6 surfaces (`cb1d766`)

Layer-2 context banners + Layer-4 click intercepts on the 6 hard-blocked client pages:

| Page | Layer-2 copy | Layer-4 intercept location |
|---|---|---|
| `/dashboard/submit-feedback` | "Verify your email to start submitting feedback and earn rewards." | `handleSubmit` form handler |
| `/dashboard/rewards` | "Verify your email to redeem rewards." | `handleConfirmRedemption` |
| `/dashboard/deals` (`DealsClient.tsx`) | "Verify your email to claim deals and earn points." | `handleRedeem` (raw fetch, so manual intercept) |
| `/dashboard/influencer/marketplace` | "Verify your email to apply for campaigns." | `handleApply` in `CampaignDetailPanel.tsx` (child component) |
| `/dashboard/influencer/payouts` | "Verify your email to add payout details." | (uses `apiPost` — api-client 403 peek handles it) |
| `/dashboard/brand/campaigns` | "Verify your email to publish campaigns." | `handleCreate` |

**Cash Out Points correction** during EV.3.2: un-marked `requiresEmailVerified` because the underlying `/api/payouts` route doesn't have `requireEmailVerified` (only `/api/payouts/accounts` does, which is the influencer side). Honest-UI principle — don't show a lock on a feature that isn't actually gated.

**Quality:** typecheck clean, dark theme tokens throughout, ARIA on banners/modal/buttons, mobile responsive (stack on <sm, side-by-side on ≥sm).

---

### 4.5 Migration 027 — `user_profiles` FK CASCADE — `11b6840`

**Date:** 2026-06-10
**Status:** Shipped
**Reference:** `src/app/api/admin/run-migration-027/route.ts`, `src/db/schema.ts`

**Discovered during EV.3 smoke testing.** Running `DELETE FROM users WHERE lower(email) = '…'` to reset a test account left orphan rows in `user_profiles` because `user_profiles.id` was declared as `text('id').primaryKey()` with no actual FK to `users(id)` — just a code comment "Will match user ID from auth". The next signup with the same email triggered `ensureUserProfile`'s non-destructive reconciliation, which carried over `onboarding_complete=true` from the orphan, defeating the test-account reset.

The bigger concern was the GDPR-adjacent leak: "deleted" users left behind their `user_profiles` row with demographics, interests, consent records, signals, sensitive data. Not actually deleted, just orphaned in the DB.

**Migration steps (idempotent):**

1. `DELETE FROM user_profiles WHERE id NOT IN (SELECT id FROM users)` — orphan cleanup. Reports `affected` count.
2. `ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_id_users_fkey FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE` — wrapped in DO-block `pg_constraint` check for re-run safety.

**Drizzle schema sync** — `userProfiles.id` declaration updated to include `.references(() => users.id, { onDelete: 'cascade' })` so future regenerations match the live DB.

**Smoke test (2026-06-10):** first run reported `affected: 1` (the orphan from the original test). Second run reported `affected: 0`. After migration, future `DELETE FROM users WHERE …` correctly cascades to `user_profiles` and downstream user-content tables.

**Pattern parallel:** mirrors migration 011 (Deals/Community FK CASCADE hardening — 19 FKs added with orphan cleanup first), which was a similar retrofit on tables that started without proper CASCADE declarations.

---

### 4.6 Role Boundaries (ER.1 + ER.2) — `faf1bfb` + `4394304`

**Date:** 2026-06-13
**Status:** Shipped
**Reference:** `src/app/dashboard/DashboardShell.tsx`, `src/app/dashboard/influencer/layout.tsx` (NEW), `src/app/dashboard/brand/layout.tsx` (NEW), `src/components/UpgradePromptCard.tsx` (NEW), `src/app/dashboard/page.tsx`

**Discovered during EV.3 smoke testing.** Pure consumer test account was seeing influencer items in the sidebar (Influencer Profile, Marketplace, My Campaigns, etc) AND `/dashboard/brand/*` URLs were accessible by direct navigation. Two pre-existing bugs that EV.3's sidebar lock icons accidentally highlighted (locks on items that shouldn't even show for this user).

#### Bug A — sidebar capability filter

Phase 3.5B-fix had added array-form `role: ['consumer', 'influencer']` to support dual-role consumer-with-isInfluencer users. The sidebar filter:
```ts
if (Array.isArray(item.role)) return item.role.includes(activeView as Role)
```
…checks only that `activeView` is in the allowed list. For a pure consumer with `activeView='consumer'`, every influencer item passed (because the array includes 'consumer'). The intent was to also gate on the `isInfluencer` capability flag — but the filter never read it.

#### Bug B — brand routes had only inconsistent client-side guards

`/dashboard/brand/campaigns/page.tsx` had a `useEffect` that called `router.push('/dashboard')` if `role !== 'brand'` — client-side, flashes content, only protects this one page. Other brand pages (`/dashboard/brand/icps`, `/dashboard/brand/deals`, etc) had nothing.

#### ER.1 — Sidebar `requiresCapability` + server-side layout guards (`faf1bfb`)

**Sidebar filter:** new `MenuItem.requiresCapability?: 'isInfluencer' | 'isBrand'` field. Filter reads `session.user.isInfluencer` / `isBrand`. Admin bypasses. 6 influencer items + 17 brand items marked.

**Layout guards:**
- `src/app/dashboard/influencer/layout.tsx` — allows `role==='influencer'` OR `isInfluencer===true` OR `role==='admin'`. Else `redirect('/dashboard?upgrade=influencer')`.
- `src/app/dashboard/brand/layout.tsx` — allows `role==='brand'` OR `isBrand===true` OR `role==='admin'`. Else `redirect('/dashboard?upgrade=brand')`.

Server components, so redirect fires before any client paint. Replaces the inconsistent `/dashboard/brand/campaigns` client-side guard.

#### ER.2 — UpgradePromptCard (`4394304`)

`src/components/UpgradePromptCard.tsx` — server component, two variants:

| Variant | Title | Icon | Primary CTA |
|---|---|---|---|
| `?upgrade=influencer` | "Become an Influencer" | Amber Sparkles | `/onboarding?path=influencer` (3.5F cross-role upgrade) |
| `?upgrade=brand` | "Brand Account Required" | Red ShieldAlert | `mailto:hello@earn4insights.com?subject=Brand%20account%20access` |

Brand variant has NO auto-upgrade — brand accounts require business verification + billing setup.

Mounted in `src/app/dashboard/page.tsx` ABOVE the role-specific dashboard component. `searchParams: Promise<{ upgrade?: string }>` await wrapped in try/catch defaulting to `undefined` (shipped in defensive patch `dbf5c6b`) — a malformed Promise can't take down the dashboard render.

**Smoke test (2026-06-13):** pure consumer sidebar now shows only consumer items. Direct nav to influencer URLs → influencer upgrade card. Direct nav to brand URLs → brand restriction card. No content flash.

---

### 4.7 Verify-email Transition Error — Defensive Engineering — `dbf5c6b` + `dd4e536` + `799bd52`

**Date:** 2026-06-12 → 2026-06-13
**Status:** Parked (low-impact). End-to-end verification works through the defensive paths. Root cause unresolved.

**Symptom.** Clicking the verification email link rendered SuccessPanel briefly, then the branded `error.tsx` boundary appeared with `Error ref: 2626478451` (a Next.js server-error digest). The verification itself succeeded server-side (`email_verified_at` was set), but the user saw an error page instead of being redirected to the dashboard.

**Diagnosis chain:**
- `/dashboard` accessed directly worked fine → error was specific to the verify-email → dashboard transition
- Error has a digest → server-side error → most likely the `router.push('/dashboard')` from `SuccessRedirect` was triggering some RSC render-time exception
- No Vercel function logs accessible during the debugging session → couldn't see the actual stack

**Three escalating mitigations:**

1. **`dbf5c6b` — Defensive try/catch.** Wrapped `router.push('/dashboard')` in `SuccessRedirect` with `window.location.assign` fallback. Wrapped `DashboardPage`'s `searchParams` await in try/catch defaulting to `undefined`. **Result:** error persisted — `router.push` wasn't throwing into the try block (either succeeded silently then failed in flight, or the error originated elsewhere).

2. **`dd4e536` — Replace `SuccessRedirect` with HTML meta refresh.** `<meta http-equiv="refresh" content="3;url=/dashboard">` drives the redirect declaratively. Pure HTML primitive — no JavaScript, no hydration to fail, no RSC fetch transition. `SuccessRedirect.tsx` left as dead code (kept for backwards compat / future restoration). **Result:** the user's first re-test happened to hit the AlreadyUsedPanel path (their old test tokens were already consumed by earlier broken-but-server-side-succeeded clicks), so we couldn't confirm the fix cleanly.

3. **`799bd52` — `force-dynamic` + plain `<a>`.** `export const dynamic = 'force-dynamic'` on `/verify-email/page.tsx` eliminates Vercel CDN / browser cache as a suspect — token state changes between requests (`used_at` flips). Success and AlreadyUsed panels switched from `<Link>` to plain `<a>` for full-page-reload nav, identical to direct URL-bar navigation. **Result:** end-to-end verification confirmed working through the AlreadyUsedPanel + middleware-redirect-to-login path AND through the meta-refresh path. SuccessPanel-from-fresh-token path STILL untested cleanly because the user's test cycles kept hitting AlreadyUsedPanel.

**Final state.** Verification works for users end-to-end. The dashboard reflects verified state (L1 banner gone, L2 banners gone, sidebar 🔒 locks gone, settings card shows green check + verified date). The bug is invisible to users.

**Parked items.**
- **Root cause** for digest `2626478451` requires Vercel function logs. Will revisit when logs become accessible.
- **Polished UX** — the JS countdown (3 → 2 → 1) is replaced by static "Redirecting in a few seconds…". Progressive-enhancement plan exists (CountdownDisplay client component layered on the meta refresh — meta refresh drives nav, JS only ticks the visible number) but parked until root cause is known.

**Quality cost.** The actual quality compromise is shipping with an unknown bug, not the meta refresh itself. Meta refresh is the right tool for post-action confirmation redirects (Stripe / Auth0 / GitHub all use server-side redirects for similar flows). Verification flow is one-time-per-user — the ~200ms latency difference vs RSC navigation is invisible and the white flash is barely perceptible. Documented in `docs/FEATURE10_EMAIL_VERIFICATION_AND_ROLE_GUARDS.md §Known issue`.

---

## 5. Pre-Launch Audit Cross-Reference

The 6-pass pre-launch audit (Phases 1, 2, 3, 3.5, 4) is documented in full in:
- **`docs/PRELAUNCH_AUDIT_FIX_LOG.md`** (102k chars) — running journal, per-phase narratives, smoke-test sign-offs, and a "Docs to sync when Phase 6 ships" punch list at the bottom

Sub-phase commit map (abridged):

| Phase | Sub-phase | Description | Commit |
|---|---|---|---|
| 1 | 1A | Marketplace handshake — atomic accept + `campaign_influencers` insert | `f4d909d` |
| 1 | 1B | Google signup role bug — signed intent cookie | `c29dad3` |
| 2 | 2A | Security quick wins — delete orphan signup route + admin key URL leak | `5080d87` |
| 2 | 2B | Points system — atomic `deductPoints` + unified UI minimum | `573da7e` |
| 2 | 2C | Scheduled launch timezone — TZ-aware via `date-fns-tz` | `b2749a3` |
| 3 | 3A.1 | Brand onboarding — schema (`brand_profiles`) + actions + Zod | `4de21c8` |
| 3 | 3A.2 | Brand onboarding — wizard UI + OnboardingGuard role split + backfill banner | `186442f` |
| 3 | 3B | Brand dashboard — scope feedback + surveys by owner; brand empty states | `ead68f9` |
| 3 | 3C | Campaign publish — CSRF + confirm modals + pre-publish validation + audit | `40d443d` |
| 3 | 3D | Brand campaign edit — Edit dialog + status gate + paymentType lock | `6ea441c` |
| 3 | 3D-fu | Edit dialog X close + Escape key (custom Dialog has no built-in dismiss) | `ee9fe98` |
| 4 | 4A | Marketplace draft exclusion — apply guard + listing/recommended/detail filters | `6c7d80b` |
| 4 | 4B | Payout-account prompt — banner + inline notice + guards + friendly modal | `bdc0f01` |
| 4 | 4C | Influencer verification flow (A9) — **deferred pending EV.2 + 3.6.1** | — |
| 3.5 | 3.5A | Multi-role flags + influencer in auth (migration 022 + 023 hot-fix) | `23ee50e` + `028c075` |
| 3.5 | 3.5B | First-class influencer signup option (3 hot-fixes) | `cb66586` + `cf78ea7` + `cd52f57` |
| 3.5 | 3.5C | 6-step influencer onboarding wizard (migration 024 + 3 hot-fixes) | `c101bbc` + `31a0f03` + `f6f49a4` + `4348fa5` |
| 3.5 | 3.5D | Influencer dashboard home + profile completeness breakdown | `8e963d8` + `c297244` |
| 3.5 | 3.5E | Role-aware sidebar + dual-role view-switcher | `f78f80c` |
| 3.5 | 3.5F | Cross-role upgrade entry from `/settings` (2 hot-fixes) | `7862312` + `9f25adf` + `513d21d` |
| 3.5 | 3.5G | Grandfather banner | **intentionally skipped** — moot after 3.5C humane prefill + 3.5F cross-role upgrade |

> Full per-bug root-cause + fix narratives live in `docs/PRELAUNCH_AUDIT_FIX_LOG.md`. This table is a cross-reference index only.
