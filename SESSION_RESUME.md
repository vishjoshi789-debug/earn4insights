# SESSION_RESUME — Tier B Group 1 (Security ✅ + Money/Data Phase 1·1b·3 ✅)

> Security batch + CSRF enforcement shipped. Money + Data Integrity batch: migrations **029/030/031 done** (CHECK constraints + FK integrity + GDPR deletion rework). Phase 2 (B14/B35) is the remaining code-side work. See "Money + Data Integrity batch" below.

## Status

**Phase:** TIER B — Group 1, Part 1: **Security Batch — COMPLETE + CSRF ENFORCED ON PROD.**
**Branch:** `main`. Security-batch (6 commits) + `fix/middleware-edge-split` (middleware-was-dead fix: moved to `src/middleware.ts`, Edge-safe auth/csrf split) both merged & pushed.
**Enforcement:** B1 CSRF is **LIVE/enforcing** in production — `CSRF_ENFORCE=true`, Production-scoped, durability-verified (403 survives a fresh redeploy). The toggle remains as a kill-switch (unset/Instant-Rollback → log-only).

## What shipped (6 commits)

| Commit | Item | Summary | Verification |
|---|---|---|---|
| `62b8592` | B6+B7 | Fail-closed encryption key (no dev fallback) + mandatory 2FA `loginNonce` (verify route 401 + middleware fail-closed) | tsc ✓ · encrypt round-trip ✓ |
| `5366565` | B4 | `diag-openai`/`diag-resend` gated on `ADMIN_DIAGNOSTICS_ENABLED` (404 before auth, mirrors `test-db`) | tsc ✓ · live 404/401 both ways ✓ |
| `acd3773` | B8 | Exact migration allowlist Set (replaces `startsWith` wildcard) — 26 routes 002–024,026–028 | tsc ✓ · enumerated from disk |
| `275c570` | B2+B3 | Server-signed OAuth state (`src/lib/oauthState.ts`, HMAC AUTH_SECRET, 10-min expiry) + `returnTo` open-redirect guard; new `/api/consumer/social/oauth-url`; settings page fetches signed URL | tsc ✓ · 14/14 unit tests ✓ |
| `1319259` | B1 | Middleware CSRF enforcement (Edge-safe comparator, Option 2 behavioral rule) **log-only default** + global `CsrfFetchProvider` interceptor; `CSRF_ENFORCE` toggle | tsc ✓ |
| `41794b8` | B9 | Playwright CSRF meta-tag/cookie test; `playwright.config.ts` honors `PLAYWRIGHT_BASE_URL` for remote runs | tsc ✓ |

**B5 deferred** (16-byte AES-GCM IV). Accepted deviation — backward-compat trap (would break all existing ciphertext). Revisit at next key-rotation pass.

## B1 design notes (for whoever flips enforcement)

- **Encoding = Option 2 (behavioral rule):** middleware `requiresCsrf()` enforces on mutating `/api/*` EXCEPT 6 exempt prefixes (`/api/auth/ /api/webhooks/ /api/cron/ /api/jobs/ /api/pusher/ /api/csrf/`) AND auto-skips any request carrying `Authorization: Bearer` / `x-admin-api-key` / `x-api-key` (token-authed = no cookie-CSRF surface). Self-maintaining for future migrations.
- **Allowlist audit:** 196 mutating routes · 50 already-CSRF · 146 missing → 52 exempt (Category A, all token/secret/unauth), 94 cookie-authed get enforced. `authenticateAdmin` verified Bearer/x-api-key only; `social/cron` verified CRON_SECRET.
- **Breakage fix:** 104 raw `fetch()` mutations across 52 files, none attached the token. Instead of editing all, `CsrfFetchProvider` (mounted in root `layout.tsx`) patches `window.fetch` to attach `x-csrf-token` on same-origin mutating `/api` non-exempt requests (skips externals/GETs/exempt; `ensureCsrfCookie` first; won't clobber apiPost). Covers all 104.
- **Edge-safe comparator:** `csrf.ts` validator uses node:crypto (would crash Edge middleware) → middleware uses a pure-JS constant-time compare `validateCsrfEdge`.

## Rollout status — DONE ✅

All steps complete and verified on prod:
1. ✅ Security batch + `fix/middleware-edge-split` merged to `main`, deployed.
2. ✅ Middleware confirmed *running* on Vercel (`x-mw-ran: 1`, `[MW]` logs) — it was dead before (wrong location).
3. ✅ Log-only prod smoke: only gap found was `POST /api/analytics/track` (sendBeacon telemetry) → exempted (`c97dde5`). All authed mutations (vote, feedback, notification, profile, consent, redeem, community post, full payment lifecycle) clean.
4. ✅ Enforcement flipped: `CSRF_ENFORCE=true` (Production, durability-verified). Negative curl → `403 csrf-403`; positive curl → `continue`; real browser vote works; B9 Playwright 2/2 passed; watch window clean.

**Kill-switch / rollback:** fastest is Vercel **Instant Rollback** to the prior log-only deployment (alias re-point, near-instant). Otherwise unset `CSRF_ENFORCE` + redeploy (→ log-only), or `git revert`. No schema/data changes anywhere in the batch — reverts are clean.

**Payment-path coverage (code-verified, not just smoke-tested):** create-order, verify/capture (`RazorpayCheckout.tsx`), release, refund all use `apiPost` → token attached natively. The Razorpay webhook (`/api/webhooks/razorpay`, exempt) remains the capture source-of-truth.

## Verification constraint (carry forward)

Local `npm run dev` has pathological compile times (142–208s) → middleware HTTP tests are unreliable locally (requests hit before middleware compiles; no `x-mw-ran`, NextAuth default redirect, `[CSRF_META_EMPTY]`). **Verify on Vercel, not local.** Static checks (tsc, code review, `tsx` unit scripts) preferred locally. Dev log from PowerShell redirect is UTF-16 — decode with `tr -d '\000'`.

## Money + Data Integrity batch — status

| Phase | Migration | What | Status |
|---|---|---|---|
| 1 | 029 | money≥0 CHECKs (campaign_payments amounts, reward_redemptions.points_spent, rewards.points_cost) + B18 proposed_rate range (0..₹10L = 100,000,000 paise cap) + campaign_applications.status enum | ✅ landed + verified |
| 1b | 030 | status/enum CHECKs (campaign_payments.status + payment_type, reward_redemptions.status) | ✅ landed + verified |
| 3 | 031 | **FK integrity + GDPR deletion rework (B33)** | ✅ landed + verified |
| 2 | — | B14 redemption rounding + B35 refund→campaign_payments (code-side) | ✅ landed (`5b40ecf`; tsc clean; audits 0, no backfill) |

**B19 dropped** — audit showed 0 orphan reviewers + `fk_influencer_reviews_reviewer` already exists.
**Deferred backlog:** `payment_redemptions` status CHECK (separate table from reward_redemptions; its own value set incl. `completed`).
**Commits:** `43d1169` (029) · `19ce890` (030) · `ad1d2d9` (031 + cron rewrite) · `ee62a36` (rule_id type fix).

### Phase 3 (migration 031) — what it did
- Added the audit-confirmed missing FKs with GDPR on-delete policy. Final `confdeltype` across all `fk_%`: **CASCADE=104, SET NULL=38, RESTRICT=7** (RESTRICT=7 is exactly the designed set: `reward_redemptions.reward_id` + the 6 product-content `product_id` FKs).
- Policy: **CASCADE** = PII/operational + owned children; **SET NULL** = money/ledger history + analytics + admin-actor refs (retain-anonymized erasure); **RESTRICT** = catalog reward + product-content (block accidental loss); **SKIP** = external/opaque + polymorphic + `competitive_insights.generated_by` (system/ai sentinel) + `audit_log.*` (decoupled).
- 5 `user_id` columns made nullable (`point_transactions`, `payout_requests`, `reward_redemptions`, `user_events`, `email_send_events`) so SET NULL can fire.
- Fixed `brand_alerts.rule_id` type (text→uuid; it references a uuid PK) via Step 1b in the route + schema.ts.
- **Rewrote `process-deletions` cron:** single `delete(users)` drives CASCADE + SET NULL; manual deletes reduced to email-keyed (feedback/survey_responses) + FK-less cache (icp_match_scores); audit_log retained. Closes the old admin-deleted-orphan gap. No users-referencing FK is RESTRICT → cron can't brick.
- **Pre-flight prod cleanup:** orphan scan found 13 sets (deleted-user remnants from the *old* cron gap) → anonymized SET-NULL tables, deleted CASCADE orphans child-first (community_posts + contribution_events), created a `demo` placeholder product for 6 seed surveys (66 responses preserved). Re-scan empty.
- Null-audit (tsc-driven): 2 guards — payouts denial-refund skips erased users; analytics batch skips null-user events.

## Pre-beta HARD GATES (must pass before launch)

1. **CRON E2E TEST — ✅ PASSED (2026-06-23).** Ran the rewritten `process-deletions` against a throwaway user (`zzz-cron-test`) with scattered data + expired grace. Verified: CASCADE erased PII/operational (users, user_profiles via 027, user_points), manual step deleted email-keyed feedback, SET NULL anonymized money/analytics (point_transactions + user_events survived with `user_id` NULL), audit_log retained. The GDPR erasure path works end-to-end on prod.
2. **ADMIN 2FA RECOVERY + prod 2FA verification — ✅ DONE (2026-06-23).** vishjoshi789 was locked out (TOTP-only, no authenticator/recovery codes). Did a DB-level reset (cleared `user_totp_secrets` + `user_recovery_codes` + `trusted_devices`, set `two_factor_enabled=false`) → logged in fresh → re-enrolled a new authenticator + **saved the recovery codes** → logged out → completed a real `/auth/two-factor` challenge into admin. Prod 2FA interlock verified end-to-end.

## Next work
**Money + Data Integrity batch is COMPLETE** (Phases 1, 1b, 2, 3 all landed + verified; B19 dropped). Phase 2 detail:
- **B14** (`consumer/rewards/redeem/route.ts`): `valueInPaise = points * 10` (exact; was `Math.round(points/10)*100` rounding to whole rupees). Flows into `payment_redemptions.value` + payout amount.
- **B35** (`razorpayService.refundPayment`): on a FULL refund of a milestone order, flips the escrowed `campaign_payments` row → `refunded` (+ `refundedAt`), mirroring `capturePayment`. Route passes `razorpayOrderId`. Partial refunds unchanged; sync is non-fatal.

Remaining before beta: `CRON_SECRET`/`AUTH_SECRET` rotation (Housekeeping below). Next major work item: TBD (Tier B Group 1 money+data done — pick the next group).

## Housekeeping
- **`ADMIN_API_KEY` rotated ✅** — was `test123` (weak + exposed); now a strong value, Production scope, redeploy-bound (new key works, old key 401).
- **`CRON_SECRET` rotation — 🔄 IN PROGRESS (doing now). Hard pre-beta gate.** The Bearer secret used for the `process-deletions` cron test was exposed in transcript. Rotating: generate a new value → update `CRON_SECRET` in Vercel (Production) **AND** the Bearer header in **every** cron-job.org job → redeploy → verify (new secret 200, old 401). ⚠️ if the bearer is actually `AUTH_SECRET`, switch to a dedicated `CRON_SECRET` (rotating `AUTH_SECRET` invalidates all sessions).
- **Disk space on C: — ⏭ NEXT (right after `CRON_SECRET`).** ~1.2 GB free after clearing `.next` (regenerates on next build); a near-full disk **truncated a file mid-write this session** (recovered via `git checkout`). Free real space on C: before more heavy work.
- `[MW]`/`[2FA-DEBUG]` middleware logs now **gated behind `MW_DEBUG=true`** (off by default — no per-request log noise/cost at steady state; set the Vercel env var to re-enable for debugging). The `enforce=` diagnostic was already removed.
- `db-diag.mjs` + `playwright-report/` are now gitignored. `db-diag.mjs` kept locally as the 2FA-reset scaffold (reads `.env.local`; can't connect from this box — `:5432` firewalled — but works from a network with DB egress).

## Survey / notifications — known gaps (post-launch, deliberate — not bugs to fix now)
Context: B23 fixed survey→points; the bell-revival wired "new survey" notifications to fan out directly from `surveyService.createSurvey` (one `findIdealConsumers(productId)` resolve → email via `notifyNewSurvey({ targetUserIds })` + in-app bell via `dispatchToUsers`, CTA `/survey/[id]`). The dead `BRAND_SURVEY_CREATED` eventBus handler was removed.
1. **No real survey draft/publish lifecycle — surveys are live-on-create.** `toggleSurveyActive` is dead (zero callers); the `/survey/[id]` page renders regardless of status; `isActive` is derived (`status==='active'`) but ignored on write (created rows persist `status:'draft'`). Build a real publish step post-launch and **reconcile `isActive` ↔ `status` to one source of truth**. (This is why "notify on activate" was impossible — there's no activate.)
2. **Email channel previously sent to NOBODY on create** — `notifyNewSurvey` was called with no `targetUserIds` and early-returned (its real targeting is a Phase-2 `// TODO` stub). Now fixed via the shared resolver; **this behavior change is intentional** (surveys now actually notify on create).
3. **`notifyIdealConsumers` / `survey-distribute` route likely dead** (no UI caller found; writes the email *queue*, not the bell). Left untouched — **verify + remove in cleanup.**

## Payment ledger — KNOWN GAP, deferred post-launch-week-1, GATED
**Status: latent — zero paid orders in prod, never triggered. Investigated 2026-06-24 (INVESTIGATE-only); no fix written, no payment code changed.**

1. **The gap (proven statically; consistent with empty prod data).** A brand paying **campaign-level** via Razorpay — `createPaymentOrder` → `create-order` with **NO `milestoneId`** (page.tsx:181) — ends with `razorpay_orders='paid'` but **no `campaign_payments` row ever created.** None of the money-path steps create one: `create-order` writes `razorpay_orders` only; `capturePayment`/verify (razorpayService:334) and the webhook `payment.captured` (`/api/webhooks/razorpay`:81) only **UPDATE** a row, and only `if (order.milestoneId)` + a pre-existing row — which the campaign-level path never has. `escrowForMilestone` (campaignPaymentService:159, via `PATCH /milestones/[id]` `action:'escrow'`) is the **only** creator — manual, milestone-only, **no money movement**. The webhook's `status==='pending'` update guard is **dead** (nothing ever creates a `'pending'` row). **Consequence:** B35 refund-sync + escrow totals (`getTotalEscrowedForCampaign`) have no row to act on.

2. **The fix (design-first — NOT done).** Not merely "create the row in capture." Must **reconcile the two mechanisms** (`escrowForMilestone` vs Razorpay capture — including the `DuplicatePaymentError` interplay at razorpayService:151) **and decide `campaign_payments` granularity** (campaign-level vs milestone-level). Scope before implementing; the fix differs by that decision.

3. **Schedule — deferred to POST launch week-1.** Week 1 is demos / training / product showcasing — brands are NOT creating campaigns or paying, so the gap has **zero exposure** that week. Fix to be scoped + shipped before any real brand payment.

4. **Env finding — LIVE keys, no test env.** App runs on Razorpay **LIVE** keys (`rzp_live_…`, both `RAZORPAY_KEY_ID` + `NEXT_PUBLIC_RAZORPAY_KEY_ID`). **No test/staging env with `rzp_test_` keys exists**, so payment flows can't be exercised without real charges. Need a **preview env + test keys** before any end-to-end rehearsal.

5. **HARD GATE (enforced regardless of the schedule above).** **No brand makes a real payment until** (a) the ledger fix is shipped **and** (b) an end-to-end rehearsal passes (test env + `rzp_test_` keys + test card `4111 1111 1111 1111`; optionally one small ₹ live self-payment by us — **never a real brand as the test**). If a brand attempts to pay during week 1, the gate still applies. Demo-first week 1 makes that unlikely, but the **gate — not the schedule — is the safety net.**
