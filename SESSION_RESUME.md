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
- **`CRON_SECRET` rotation — ✅ DONE (2026-06-24).** Case A — it was a dedicated `CRON_SECRET` (not `AUTH_SECRET`), so sessions were untouched (no logout). Rotated to a fresh value in Vercel (Production) + updated the Bearer in **every** cron-job.org job + redeployed. Verified: new secret → 200, old leaked `77eadc…` → 401. **Last pre-beta security gate cleared.**
- **Disk space on C: — ⚠️ RECURRING, partly mitigated (2026-06-26).** Hit **0 bytes free** mid-session → an ENOSPC **truncated `feedback/upload-media/route.ts` to 0 bytes** (2nd corruption this session; 1st was `contributionPipeline.ts`). Recovered via `git checkout` (original safe in git object store). Uninstalled **anaconda3 (~9.7 GB)** → now **~6 GB free**. `.next`/`node_modules/.cache` cleared; `npm cache`/`%TEMP%`/AppData are harness-protected (user must clear those manually). **Keep ≥2 GB free** — writes/`git` fail and files corrupt at 0. If it recurs: `Clear-RecycleBin -Force -Confirm:$false`, `npm cache clean --force`, then inspect `$env:LOCALAPPDATA` for big caches.
- `[MW]`/`[2FA-DEBUG]` middleware logs now **gated behind `MW_DEBUG=true`** (off by default — no per-request log noise/cost at steady state; set the Vercel env var to re-enable for debugging). The `enforce=` diagnostic was already removed.
- `db-diag.mjs` + `playwright-report/` are now gitignored. `db-diag.mjs` kept locally as the 2FA-reset scaffold (reads `.env.local`; can't connect from this box — `:5432` firewalled — but works from a network with DB egress).

## Survey / notifications — status + known gaps
Context: B23 fixed survey→points; the bell-revival wired "new survey" notifications to fan out directly from `surveyService.createSurvey` (one `findIdealConsumers(productId)` resolve → email via `notifyNewSurvey({ targetUserIds })` + in-app bell via `dispatchToUsers`, CTA `/survey/[id]`). The dead `BRAND_SURVEY_CREATED` eventBus handler was removed.

1. **Survey lifecycle — `status='active'` on create — ✅ FIXED (2026-06-25, `4fd56e2`).** Root cause: `createSurvey` never set `status`; the `createNPSSurvey`/`createCSATSurvey` type helpers set only `isActive: true` (not `status`), and the repo insert wrote `status: survey.status || 'draft'` → **every survey was born `draft`** → `toSurvey` derives `isActive = status==='active'` → permanently "Inactive" badge + the consumer `/survey/[id]` "responses are for testing only" banner, even though the bell+email fan-out told consumers to complete it. Decision (founder): **live-on-create** (NPS/CSAT have fixed questions; there's no review/draft workflow). Fix sets `status:'active' + isActive:true` in `createSurvey`. **Backfill:** existing pre-fix drafts stay `draft` — flip them in Neon: `UPDATE surveys SET status='active', updated_at=now() WHERE status='draft' AND product_id <> 'demo';` (skips unowned demo seed surveys; idempotent).
2. **Pause/Activate UI — TIER-B FOLLOW-UP (deferred).** `toggleSurveyActive(surveyId, isActive)` exists in `surveyService` but has **zero callers** — no UI control on the survey detail page (`/dashboard/surveys/[id]`) or list. So once live, a brand can't pause/resume a survey. Acceptable for beta (live-on-create). Post-launch: add an Activate/Pause toggle on the detail page wired to `toggleSurveyActive`, and **reconcile `isActive` ↔ `status` to one source of truth** (currently `isActive` is a derived read, ignored on write).
3. **Email channel previously sent to NOBODY on create** — `notifyNewSurvey` was called with no `targetUserIds` and early-returned (its real targeting is a Phase-2 `// TODO` stub). Now fixed via the shared resolver; **this behavior change is intentional** (surveys now actually notify on create).
4. **`notifyIdealConsumers` / `survey-distribute` route likely dead** (no UI caller found; writes the email *queue*, not the bell). Left untouched — **verify + remove in cleanup.**

## Payment ledger — KNOWN GAP, deferred post-launch-week-1, GATED
**Status: latent — zero paid orders in prod, never triggered. Investigated 2026-06-24 (INVESTIGATE-only); no fix written, no payment code changed.**

1. **The gap (proven statically; consistent with empty prod data).** A brand paying **campaign-level** via Razorpay — `createPaymentOrder` → `create-order` with **NO `milestoneId`** (page.tsx:181) — ends with `razorpay_orders='paid'` but **no `campaign_payments` row ever created.** None of the money-path steps create one: `create-order` writes `razorpay_orders` only; `capturePayment`/verify (razorpayService:334) and the webhook `payment.captured` (`/api/webhooks/razorpay`:81) only **UPDATE** a row, and only `if (order.milestoneId)` + a pre-existing row — which the campaign-level path never has. `escrowForMilestone` (campaignPaymentService:159, via `PATCH /milestones/[id]` `action:'escrow'`) is the **only** creator — manual, milestone-only, **no money movement**. The webhook's `status==='pending'` update guard is **dead** (nothing ever creates a `'pending'` row). **Consequence:** B35 refund-sync + escrow totals (`getTotalEscrowedForCampaign`) have no row to act on.

2. **The fix (design-first — NOT done).** Not merely "create the row in capture." Must **reconcile the two mechanisms** (`escrowForMilestone` vs Razorpay capture — including the `DuplicatePaymentError` interplay at razorpayService:151) **and decide `campaign_payments` granularity** (campaign-level vs milestone-level). Scope before implementing; the fix differs by that decision.

3. **Schedule — deferred to POST launch week-1.** Week 1 is demos / training / product showcasing — brands are NOT creating campaigns or paying, so the gap has **zero exposure** that week. Fix to be scoped + shipped before any real brand payment.

4. **Env finding — LIVE keys, no test env.** App runs on Razorpay **LIVE** keys (`rzp_live_…`, both `RAZORPAY_KEY_ID` + `NEXT_PUBLIC_RAZORPAY_KEY_ID`). **No test/staging env with `rzp_test_` keys exists**, so payment flows can't be exercised without real charges. Need a **preview env + test keys** before any end-to-end rehearsal.

5. **HARD GATE (enforced regardless of the schedule above).** **No brand makes a real payment until** (a) the ledger fix is shipped **and** (b) an end-to-end rehearsal passes (test env + `rzp_test_` keys + test card `4111 1111 1111 1111`; optionally one small ₹ live self-payment by us — **never a real brand as the test**). If a brand attempts to pay during week 1, the gate still applies. Demo-first week 1 makes that unlikely, but the **gate — not the schedule — is the safety net.**

## Middleware-revival follow-ups (latent bugs the now-live middleware exposed)
- **Brand onboarding redirect loop — ✅ FIXED (2026-06-25).** New brands hit `ERR_TOO_MANY_REDIRECTS` on login: `OnboardingGuard` redirects *incomplete* brands → `/onboarding`, but the middleware `/onboarding` handler bounced **all** brands → `/dashboard` → infinite loop. The bounce predated us but only *ran* once the middleware went live (fix/middleware-edge-split). Fix: removed the `if (role==='brand') → /dashboard` block from the middleware `/onboarding` handler — brands now reach `BrandOnboardingClient`, and `onboarding/page.tsx:37` still redirects *completed* brands to `/dashboard`. Found via the brand-flow smoke test. Consumers/influencers/admin were unaffected (block only matched `role==='brand'`).
- **Watch for similar:** other middleware redirect/guard interactions were dormant while middleware was dead and could surface the same way — smoke-test each role's **first-login** path before relying on it.

## Brand-flow live-test fixes (2026-06-25, `3eefa3a`) — combined commit
Found while live-testing brand flows (no payments — payment HARD GATE still in force). One commit, three fixes:
1. **Survey product picker.** The "Create Survey" CTA hardcoded `?productId=demo`, so every brand survey attached to the unowned `demo` seed product and was invisible in the brand's own list (which scopes by `products.owner_id`). Fix: CTA drops `?productId=demo`; `surveys/create/page.tsx` now `auth()`s + fetches `getProductsByOwner(userId)`, redirects to the list if the brand owns no product, and passes the owned products + a validated `defaultProductId` to the form; `survey-creation-form.tsx` prop `productId: string` → `products[]` + `defaultProductId?` with a `<Select>` dropdown feeding `createSurvey`.
2. **GSTIN field errors.** Brand onboarding showed a generic "Validation failed" on an invalid GSTIN. Fix: shared `actionErrorMessage()` helper in `BrandOnboardingClient` surfaces `res.fieldErrors` (joined) instead of `res.error`, applied to all 4 step handlers. The actions already returned `fieldErrors` via `flattenZodErrors`.
3. **Product double-submit guard.** `LaunchForm` had a plain submit button → double-click created the product twice. Fix: `SubmitButton` child component using `useFormStatus()` to `disabled={pending}` while the server action is in flight (shows "Launching…/Scheduling…").

Deferred: survey **objective tagging** (#1b — feature, not a bug).

## Pre-launch readiness audit — Tier B blast radius + 4-role smoke (2026-06-26)

**Scope (deliberately narrow — NOT a re-run of the Tier A 6-pass audit).** Verified only what Tier B changed (middleware now live, Edge auth split, CSRF enforced, migration-031 FK policy, EV hard-block) + the 4-role beta critical path. Feature internals already audited in Tier A (analytics math, consent engine, competitive-intel, points) were **intentionally not re-checked** — Tier B didn't touch them.

### Code-side results — ✅ NO launch blocker
- **Middleware redirects (4 roles):** no loops. Only role logic = `/admin/*` → non-admin → `/dashboard`, and `/login`·`/signup` redirect-if-authed. `/onboarding` open to all logged-in roles (brand-loop fix holds).
- **OnboardingGuard ↔ `/onboarding` page agree on the completion source per role** (brand→`brand_profiles.onboarding_completed`, influencer→`influencer_profiles.onboarding_completed`, consumer→`user_profiles`, admin→bypass both sides) → no oscillation for any role.
- **CSRF:** cookie minted on every middleware response; `CsrfFetchProvider` confirmed mounted in root `layout.tsx` (covers ~104 raw-fetch mutations); `apiPost` attaches natively; exempt list = true non-surfaces only. No legit brand mutation should 403 once a page GET has seeded the cookie.
- **EV hard-block (`emailVerificationGuard.ts`):** graceful structured `403 EMAIL_NOT_VERIFIED` → client modal (no crash). Gates only the 7 money/contractual routes **+ `feedback/submit`**. Core brand journey (launch product, create survey, import, analytics) is **NOT** blocked pre-verification.
- **Brand dashboard:** graceful no-products empty state + `.catch(()=>true)`, no dead-end.

### Discrepancies found
1. **Stale public meta tag — ✅ FIXED (this session).** Root `layout.tsx` `<title>` + OpenGraph still used the *retired* "Intelligence OS / The Intelligence Operating System…" tagline (what shows in browser tab, Google, social shares). Reverted to the brand-spec line: title "Earn4Insights — Consumer Intelligence Infrastructure", description "The consumer intelligence infrastructure where brands, consumers, and influencers meet." (Commit pending.)
2. **Legacy tagline sprawl — ✅ FIXED (`d5d9202`).** The retired "The Intelligence Operating System for Brands, Consumers and Influencers" tagline was live in ~11 user-facing spots `386055e` missed: landing hero + footer, every transactional email (welcome ×3, email-verification, forgot-password, support, product, influencer-verification) + WhatsApp. All swept to the brand-spec line "The consumer intelligence infrastructure where brands, consumers, and influencers meet". Verified zero `Intelligence OS`/`Operating System` occurrences remain in `src/**`.
3. **Minor (note only):** unauth redirect inconsistency — middleware → `/login`, but `OnboardingGuard`/`onboarding/page.tsx` → `/api/auth/signin` (NextAuth default, bounces to `/login`). Cosmetic.

### Prod smoke (Vercel — in progress)
Per-role checklist handed over (all 4 roles). **Highest-value single check: the email-verification email (Resend) actually delivers** — `feedback/submit` is EV-gated, so consumers can't submit feedback in beta without it. Watch DevTools Network for any `403 csrf-403` on brand import/launch/campaign first actions.

**🔴 BUG FOUND during consumer smoke (2026-06-26) — fixed (migration 032).** Consumer feedback text saved, but voice + image uploads failed: `insert on feedback_media violates fk_feedback_media_owner`. **Root cause:** migration 031 wrongly added `fk_feedback_media_owner: feedback_media.owner_id → users.id`, but `owner_id` is **polymorphic** (`owner_type` = 'feedback' | 'survey_response'; `owner_id` = the parent feedback/survey_responses row id, never a users.id) — so it violated on EVERY media insert and broke ALL audio/video/image uploads for both feedback AND survey responses. Only `feedback_media.owner_id` slipped the "polymorphic → SKIP" policy (verified `products.owner_id→users` is the only other owner_id FK and is correct). **Fix:** (1) prod unblock — `ALTER TABLE feedback_media DROP CONSTRAINT IF EXISTS fk_feedback_media_owner;` in Neon; (2) durable — new `run-migration-032` route (idempotent drop) + 031 source corrected (line removed + skip-comment) + schema.ts `ownerId` documented FK-less + middleware allowlist + CLAUDE.md §8 index. **Re-test:** re-submit consumer feedback with audio + image → both upload (status `uploaded`), then transcription cron processes audio.

**🟡 Multimodal points gap — presence bonus SHIPPED (`f40390e`), content-scoring deferred.** Same smoke run: media submission earned only 25 (flat `feedback_submit`). Root cause: base points are flat 25; the async AI bonus (`contributionPipeline`) scores **text only** (`rawContent: trimmedText`); the media-upload route awarded nothing — so audio/video/image earned 0, while the submit-feedback **quality meter** (`submit-feedback/page.tsx`) *shows* media raising the score (audio +20, video +20, image +5 each ≤2) and the ProductTour promises "earn points for every submission". Live promise the backend didn't honor. **Decision (option b, presence-first):** `feedback/upload-media` route now awards a per-modality presence bonus (`MEDIA_BONUS_POINTS` in pointsService, source `media_bonus`, deduped by `hasPointsAwarded` per feedbackId+modality[+image index]) → multimodal feedback now earns ~45–55 vs 25 text-only. **Deferred to post-launch:** feed transcript (post-transcription cron) + image (vision model) into the AI quality scorer for a true content-quality top-up (must recompute the bonus AFTER transcription; account for the already-awarded presence bonus to avoid double-pay). **Also worth verifying:** whether the existing async text AI bonus (`ai_bonus_feedback_submit`) actually fires at all, or balances always stay at flat 25 + media bonus.

**🟢 Influencer-experience fixes (found in influencer smoke, 2026-06-28) — all shipped:**
1. **First-time privacy framing (`0c55d16`).** `ConsentRenewalModal` showed "It's been over a year since you last updated" whenever `consentGrantedAt` was null — i.e. to every brand-new user (e.g. an influencer who just onboarded), wrong on a weeks-old platform. Now `isFirstTime = !consentGrantedAt` → "Set Your Privacy Preferences" + welcome copy; "re-confirm" GDPR wording dropped for first-timers. Genuine >12mo renewal copy unchanged.
2. **Influencer consent copy (`078cafb`).** Influencers (role=`consumer` + `isInfluencer`) saw consumer-flavoured consent descriptions. Threaded `isInfluencer` layout→`ConsentRenewalWrapper`→`ConsentRenewalModal`; all 4 descriptions now branch to influencer context (campaign matching by niche/audience, "let brands discover you", payout/campaign emails).
3. **Influencer product tour (`c4a8bab`).** Influencers got the generic consumer tour (filter only knew `'brand'|'consumer'`). Added `role:'influencer'` to `TourStep`, map `isInfluencer`→influencer set (own storage key), authored: Welcome, Creator Dashboard, Profile, Marketplace, My Campaigns, My Content, Earnings, Payout Accounts, Get Verified. Re-tagged the 3 pre-existing influencer steps consumer→influencer + added the 4 missing — also stops pure consumers getting steps pointing at influencer nav items their sidebar lacks.

**🟡 "My Content" was metadata-only — wired media links (option #1).** `/dashboard/influencer/content` create form collected title/body/mediaType/tags but **NOT the actual media** — picking `video`/`image` only set a type label; there was no upload/URL field. The API + `influencer_content_posts` model already supported `mediaUrls` / `thumbnailUrl` / `platformsCrossPosted`, but the form never sent them. **Decision: it's a cross-post / portfolio tracker (link-based), NOT a native uploader** — influencers post on their own channels and log the link(s) here. Wired into the form: **Content link(s)** (textarea, one URL/line → `mediaUrls`), **Thumbnail URL**, and **Posted on** platform pills (`platformsCrossPosted`); card now shows platform pills + a "View content ↗" link. (Commit pending tsc.) **⚠️ OPEN gap (deferred, not built):** a **standalone post (no `brandId`/`campaignId`) has an ambiguous reviewer** — "Submit for Review" → `pending_review` with no brand to approve it. Decide one of: auto-publish standalone, admin-review, or require a campaign. Native file upload (option #2) also remains a future option if links aren't enough.

## Brand freemium / subscription — discovery + honest-beta copy fix (2026-06-26)

**Context:** discovery-only pass before designing the free-trial model. Original mental model ("trial = first campaign") doesn't match what's built. NO trial logic was built — copy only.

### What ALREADY exists (don't rebuild — activate/extend)
- **Pricing page** `/dashboard/pricing` (`src/app/dashboard/pricing/page.tsx`): 3 plans — **Free $0 / Pro $79/mo ($66 annual) / Enterprise custom ($299+)**. Plan *definitions* are a static `PLANS` array (marketing copy); the page reads the brand's **real tier from DB** via `getBrandSubscription()` and shows a "Current plan" badge. Upgrade CTA → `/dashboard/settings`, which has **no billing UI** → dead-end.
- **Schema** `brand_subscriptions` (`schema.ts:319`, "Phase 4: Tier System"): `tier` (free/pro/enterprise), `status` (active/cancelled/past_due/**trialing**), Stripe cols (unused), `currentPeriod*`, **`trialStart`/`trialEnd`**, `featureOverrides` JSONB (per-brand grants). ⚠️ **No `CREATE TABLE` migration route** — table exists via drizzle push + an FK in migration 031 (which landed). Verify in Neon; consider backfilling an idempotent CREATE route for parity with the other 28 tables.
- **`subscriptionService.ts`** — complete: `TIER_FEATURES` matrix (authoritative free/pro/enterprise capabilities + limits, richer than page copy), `getBrandSubscription` (free default + applies `featureOverrides`), `create/update/cancelBrandSubscription`, feature-check helpers.
- **`auth/tierMiddleware.ts`** — full gating toolkit (`requireFeature`/`requirePaidTier`/`checkProductLimit`/`checkExportLimit`/typed errors).

### What is NOT wired (the real gap — measured by caller search)
- **`tierMiddleware.ts` = ZERO external callers.** Dead infrastructure.
- **`create/update/cancelBrandSubscription` = ZERO callers.** No path anywhere creates/upgrades/downgrades/cancels a sub or **starts a trial**. Every brand is the hard-coded free default unless a row is hand-inserted.
- **Only live enforcement:** 2 feedback pages (`/dashboard/feedback`, `/dashboard/products/[id]/feedback`) read `getBrandSubscription()` + soft-render `UpgradePrompt`/gate individual-feedback for free tier. Render-time only, not server-enforced.
- **No usage metering** for any advertised limit (transcription min, GB, exports, products).
- **`TIER_FEATURES` only models the feedback/media/export/API slice.** The big brand value (campaigns, competitive-intel, import/ingestion, ICPs, community, social listening) is NOT in the tier matrix.
- Don't confuse the **subscription** "upgrade" with the **ROLE** upgrade (consumer→brand/influencer, ER.2 `?upgrade=…`) — different systems.

### Brand feature inventory (the menu a plan would gate)
Feedback (multimodal+multilingual, schema `modalityPrimary`/transcription/translation) ✅ · export (survey responses + feedback, **ungated**) ✅ · community ✅ · analytics: **feature intelligence** = `/dashboard/analytics/feature-insights`, **audience** = `consumer-intelligence`/`category-intelligence`/`brand/icps` ✅ · **data ingestion** `/dashboard/import` + `api/import/{csv,jobs,products,webhook,webhook/v2}` + `import_jobs` table ✅ robust · campaigns (`brand/campaigns`, escrow — payment-ledger gap lives here) ✅ · notifications-to-audience 🟡 event-triggered only (`notifyNewSurvey`+`dispatchToUsers`+`smartDistributionService`; no brand-composed broadcast tool; WhatsApp parked) · plus competitive-intel, deals, influencer search, content-review, rankings, recommendations, watchlist, alerts, social listening.

### Honest-beta copy fix — ✅ SHIPPED (`9181d49`)
The **public landing page was promising a "14-Day Free Trial — no credit card required"** that the product does **not** implement (no trial mechanism exists). Reframed to "free during beta, paid plans coming soon" — **copy/UI only, no logic**: landing CTAs ×3 → "Get Started Free", removed all trial-length claims, beta notice banner on pricing + trial FAQ reframed to "How much does it cost during beta?", and nudged 2 present-tense billing lines to future tense ("you'll only pay", "Brands will pay … once paid plans launch"). Left alone (future-safe w/ banner): annual-billing note, quota "next billing cycle", proration FAQ; and non-our-trial hits (Twilio comments, intent-extraction regex).

### Decision / next
- **The trial mechanism is a future build, not promised yet** — no specific trial length appears anywhere on the live site by design until it's real.
- When building: activate/extend the existing infra (wire `tierMiddleware` callers + a tier-change/trial-start path + usage metering + broaden `TIER_FEATURES`), don't rebuild. Reconcile the eventual self-serve trial with the (now-removed) public promise. Decide the **trial-start trigger** (candidates: first product launched / first survey / first import / first analytics view / onboarding completion — first campaign is late-funnel + payment-adjacent). "Free during beta" message naturally lives at `/dashboard?welcome=brand` (post-onboarding) or a `DashboardShell` banner.
- **Constraint preserved:** do NOT touch `subscriptionService` / `tierMiddleware` / `brand_subscriptions` until the freemium build is greenlit + planned.
