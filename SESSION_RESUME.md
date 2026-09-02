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
- **Static assets + Next metadata routes redirected to `/login` — ✅ FIXED (2026-06-30, `741583d`).** Found while validating the OG share card: the LinkedIn inspector reported "image not found" on `/opengraph-image`. Root cause was **not** the OG meta (tags were correct, pointing at `/opengraph-image?<hash>` 1200×630) — the middleware auth gate had **no allowlist entry** for Next's build-generated metadata routes or static public files, so **every anonymous request** to `/opengraph-image`, `/twitter-image`, `/manifest.webmanifest`, `/favicon.svg`, `/favicon-*.png`, `/icon-app-*.png` got a `307 → /login` (`x-mw-decision: redirect`). Impact for logged-out visitors + social/link scrapers: **no OG/Twitter share image, broken favicons, broken PWA manifest** — all live in prod. Fix: `isPublic()` now allowlists the metadata routes (`/opengraph-image` `/twitter-image` `/manifest.webmanifest` `/robots.txt` `/sitemap.xml`) + any static asset by extension via a shared `isStaticOrMetadata()` helper (also reused in `isAllowedDuringTwoFactor`). CSRF on `/api` unchanged (these are GET, non-`/api`, no cookie-CSRF surface). **Verified live:** `/opengraph-image` → `200 image/png`. Also padded the share description past the inspector's 100-char floor (`1efe55c`). **GOTCHA for future asset/metadata routes:** the middleware `config.matcher` only excludes `_next/static|_next/image|favicon.ico`, so ANY new top-level asset or metadata route (icons, sitemap, OG variants, `robots.txt`) is **gated-by-default** → add it to `isPublic` (or `isStaticOrMetadata`) or it 307s anonymous fetchers to `/login`.
- **Public auth callbacks + marketing pages redirected to `/login` — ✅ FIXED (2026-07-25, `bf6c9f5`).** 4th instance of this family. Reported symptom: password-reset link landed on `/login` instead of the reset form. Root cause: the reset email links to `/reset-password?token=…` (`api/auth/forgot-password/route.ts:72`), a reset is **always clicked logged-out**, and `/reset-password` was **not** in `isPublic()` → auth gate `307 → /login`. Audited the **entire logged-out surface** (not a one-off) — every gap was a page that renders with **no `auth()` gate** (user-scoped writes still self-guard in their actions/API routes, so allowlisting the GET exposes nothing). **`PUBLIC_PATHS` +=** `/reset-password`, `/verify-email` (email auth callbacks — verify worked when clicked logged-in, bounced logged-out), `/top-products`, `/public-products`, `/community-features`; **`PUBLIC_PREFIXES` +=** `/survey/` (emailed survey link `/survey/[surveyId]`), `/top-products/`, `/public-products/`, `/submit-feedback/` (public feedback link `/submit-feedback/[productId]`). Additive only — no CSRF change (none are `/api/*`), no authed route touched (`/submit-feedback/` ≠ `/dashboard/submit-feedback`; `/survey/` ≠ `/dashboard/surveys`). Reset submit `/api/auth/reset-password` was already public + CSRF-exempt via the `/api/auth/` prefix, so the flow completes end-to-end. Also **removed the stale `/rankings` allowlist entry** (no such route — the real public rankings page is `/top-products`). tsc clean; live click-through pending founder verification. **GOTCHA:** `PUBLIC_PATHS` is hand-maintained and keeps drifting — whenever a new anonymous-renderable page is added (auth callback, emailed link target, marketing page), add it to `isPublic()` or it 307s logged-out visitors to `/login`.
- **Watch for similar:** other middleware redirect/guard interactions were dormant while middleware was dead and could surface the same way — smoke-test each role's **first-login** path before relying on it. **The asset-gating + public-page-gating bugs above are the canonical examples** — anything fetched without a session (scrapers, anonymous browsers, webhooks, health checks, email-link targets) must be on a public allowlist. This family has now bitten 4×: onboarding loop, OG/asset gating, public auth callbacks + marketing pages.

## Brand-flow live-test fixes (2026-06-25, `3eefa3a`) — combined commit
Found while live-testing brand flows (no payments — payment HARD GATE still in force). One commit, three fixes:
1. **Survey product picker.** The "Create Survey" CTA hardcoded `?productId=demo`, so every brand survey attached to the unowned `demo` seed product and was invisible in the brand's own list (which scopes by `products.owner_id`). Fix: CTA drops `?productId=demo`; `surveys/create/page.tsx` now `auth()`s + fetches `getProductsByOwner(userId)`, redirects to the list if the brand owns no product, and passes the owned products + a validated `defaultProductId` to the form; `survey-creation-form.tsx` prop `productId: string` → `products[]` + `defaultProductId?` with a `<Select>` dropdown feeding `createSurvey`.
2. **GSTIN field errors.** Brand onboarding showed a generic "Validation failed" on an invalid GSTIN. Fix: shared `actionErrorMessage()` helper in `BrandOnboardingClient` surfaces `res.fieldErrors` (joined) instead of `res.error`, applied to all 4 step handlers. The actions already returned `fieldErrors` via `flattenZodErrors`.
3. **Product double-submit guard.** `LaunchForm` had a plain submit button → double-click created the product twice. Fix: `SubmitButton` child component using `useFormStatus()` to `disabled={pending}` while the server action is in flight (shows "Launching…/Scheduling…").

Deferred: survey **objective tagging** (#1b — feature, not a bug).

## STRATEGY — influencer content value prop / native hosting (idea, 2026-06-28)

**Trigger:** founder questioned whether logging cross-post **URLs** in My Content is a strong value prop — especially for brands. It isn't: a URL is a deliverable *record*; the brand still consumes the reel on Instagram, in the clutter, with Instagram's metrics. Platform's real current value is the **transaction + intelligence layer** (ICP-matched discovery, escrow/milestone payments, managed approval workflow, consumer feedback/sentiment) — which works *without* native content hosting.

**The idea (NOT a generic reels feed):** host brand-promotion content **natively, tied to the platform's unique asset** — show it to that brand's **ICP-matched consumers** and capture **first-party engagement + structured feedback/sentiment on the content itself**. That's something Instagram structurally can't offer ("your promo, in front of your exact target consumers, with real reactions + intent signals"), and it fits the "consumer intelligence infrastructure" positioning. A generic native reels feed is the WEAK version — cold-start audience (consumers come for feedback/rewards, not to watch reels), competes with Insta where creators' followers already are, big cost.

**Build reality (resolves the "is it already built?" question):** the `feedback_media` pipeline gives the **ingestion half** for free — **✅ upload (Vercel Blob `put`), ✅ storage, ✅ Whisper transcription/captions, 🟡 basic in-dashboard player, 🟡 manual moderation metadata + admin moderate action, ✅ retention cron.** The **"big build" / NOT done half** = **transcode (HLS/multi-res), streaming-grade CDN, feed/discovery surface, ranking, automated/scaled moderation** + real long-term video storage/bandwidth cost (feedback_media is tuned for short capped clips, 30–90d retention). Transcription ≠ transcode.

**Recommendation / sequencing:** (1) DON'T pivot pre-launch — beta validates the transaction layer. (2) Position beta brand value prop on intelligence + ICP-matched, payment-protected collaboration, not "we host content." (3) Let the 10–20 beta brands reveal whether they want a native content destination or just find+pay+measure creators. (4) If validated → build a **thin MVP first** (reuse upload/store/player/feedback to show one clip to ICP-matched consumers + collect reactions — proves the loop WITHOUT transcode/feed/ranking), then the heavy half only if it lands. Post-beta, post-runway.

**DECISION (2026-06-28): native hosting DEFERRED; shipped the cheap pre-launch alternative instead** — make the cross-post link *tangible* via inline preview. New `ContentLinkPreview` component: **YouTube → real inline iframe embed** (no API key); **all other platforms → a clickable thumbnail card** (uses the influencer's `thumbnailUrl`; deliberately avoids auth-gated Instagram/LinkedIn oEmbed). Wired into My Content cards (replaces the plain "View content ↗" link). Why this over the thin-slice MVP: the MVP's value loop ("content → ICP-matched consumers → reactions") **needs a consumer audience that doesn't exist at launch** — can't validate it pre-launch; the beta is what builds that audience. Reusable component can also drop into the **brand content-review** page later. CSP checked — no `Content-Security-Policy` set anywhere (next.config.ts has no `headers()`, middleware sets none), so the YouTube iframe renders fine.

**Roadmap teaser banners shipped (all 3 stakeholders, roadmap-framed, dismissible).** New reusable `RoadmapBanner` (localStorage-persisted dismiss, NO dates — deliberately not a repeat of the false 14-day-trial promise). Placed: **influencer** → My Content, **brand** → Content Review, **consumer** → Dashboard. Each teases native content hosting in that stakeholder's context (influencer = host reels, get discovered by matched audiences; brand = content shown to ICP-matched consumers + first-party reactions; consumer = discover via creator videos + earn for reactions).

**POST-LAUNCH enhancement — richer link embeds (incremental):** TikTok + X can render inline **without approval** (free public oEmbed + their widget JS) → add those first. **Instagram** needs a **Meta app + access token (app review)** — its own small project, worth it since it's the dominant creator platform. **LinkedIn** has no general public embed → stays a thumbnail card. Trade-off accepted for beta: the uniform thumbnail card avoids per-platform third-party widget JS (fragile, tracking, layout-shift), so richer embeds are a deliberate later add, not a launch need.

**CORE-OBJECTIVE framing (founder, 2026-06-28):** native-hosted brand-promo content (influencers promoting brand products via reels/shorts/stories, + longer brand campaigns) is a stated core objective. **The gating blocker is DATA in the sense of the consumer-audience + first-party-engagement flywheel — NOT the tech.** Chain: engaged ICP-segmentable consumers → they watch/react to brand content → engagement+intent+sentiment data → *that* is what brands pay for. No audience → no viewers → no data → no value, regardless of hosting quality. Blocker ranking: (1) consumer audience [the real one], (2) data quality/trust [ICP scoring + verification + fraud flags already exist, must scale], (3) content supply [solved by paid campaigns], (4) tech build [transcode/feed/ranking — solvable, not the blocker]. **Sequencing:** the beta IS the audience/data-building phase (feedback+rewards = consumer acquisition; campaigns pull both sides); native content is the **payoff once the audience exists**, not a build-first bet.

**TECH-COST model for native video (when built, post-audience):** split into two buckets. **Bucket A — same as any feature (dev time, ~no new infra):** feed/discovery (Next + Neon), ranking (reuse existing ICP scoring), upload UI / campaign linkage / notifications / analytics, manual moderation. **Bucket B — genuinely new cost (video serving scales with VIEWS, unlike current text/JSON features where serving cost ≈ 0):** transcode (adaptive bitrate), CDN/streaming delivery, storage, optional automated moderation. **KEY: don't DIY video on Vercel Blob** — egress ~$0.05–0.15/GB → a 50 MB reel × 10k views ≈ 500 GB ≈ $25–75/mo for ONE reel. **Use a managed video service (Cloudflare Stream cheapest fit; Mux pricier/nicer)** — it bundles transcode+CDN+adaptive+player (so you DON'T build Bucket B) for a usage-based bill: Cloudflare Stream ~$5/1,000 min stored + ~$1/1,000 min delivered (indicative — verify). At beta scale: ~$0.50/mo store 100 reels, ~$10/mo for 10k views — trivial, scales linearly/predictably with watch-minutes. `feedback_media` (Blob + Whisper) is fine for the low-view validation MVP; **move the video layer to a managed streaming service at scale.** Net: feed/ranking = normal dev cost; the only NEW recurring line item is a view-scaled video bill (modest at start).

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

**🟡 "My Content" was metadata-only — wired media links (option #1).** `/dashboard/influencer/content` create form collected title/body/mediaType/tags but **NOT the actual media** — picking `video`/`image` only set a type label; there was no upload/URL field. The API + `influencer_content_posts` model already supported `mediaUrls` / `thumbnailUrl` / `platformsCrossPosted`, but the form never sent them. **Decision: it's a cross-post / portfolio tracker (link-based), NOT a native uploader** — influencers post on their own channels and log the link(s) here. Wired into the form: **Content link(s)** (textarea, one URL/line → `mediaUrls`), **Thumbnail URL**, and **Posted on** platform pills (`platformsCrossPosted`); card now shows platform pills + a "View content ↗" link. (Commit pending tsc.) **Standalone reviewer gap — RESOLVED (auto-publish, founder decision).** A standalone post (no `brandId`/`campaignId`) was stuck: "Submit for Review" → `pending_review` with no brand to approve. Now `submitForReview` publishes standalone posts directly (`updatePostStatus(postId, 'published', now)`); the draft button reads **"Publish"** (vs "Submit for Review" for campaign-linked) and the toast says "Post published!". Campaign/brand-linked posts still go through brand review unchanged. Moderation stays reactive (`status='removed'`). **Profile vs Content clarity also added:** My Content link field → "a specific post/video, not your profile — set channel handles in My Profile"; My Profile "Social Handles" card → "your channels… to log individual posts use My Content". Native file upload (option #2) remains a future option if links aren't enough.

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

## Pre-launch landing + public-surface audit (2026-06-29, `17216f6`)

**Branch `chore/prelaunch-public-surface-audit` — pushed; PR open via the GitHub web "compare" URL (the `gh` CLI is NOT installed on this box + no `GH_TOKEN`/`GITHUB_TOKEN` in env, so PRs can't be opened programmatically — open from `https://github.com/vishjoshi789-debug/earn4insights/pull/new/<branch>`).** Assess-first audit of the public/marketing surface (landing, root layout/meta, pricing, auth, legal pages, footer), then approved fixes applied. `tsc --noEmit` clean. 13 files, +616/−614.

### Must-fix (shipped)
1. **Pricing redirect was a 404.** `dashboard/pricing/page.tsx` did `redirect('/auth/signin')` for unauthenticated/no-id sessions — **that route doesn't exist** (`src/app/auth/` only has `two-factor/`) → 404. Now `/login` (both occurrences). NOTE: this is the *concrete* fix for the "unauth redirect inconsistency" flagged as cosmetic discrepancy #3 in the Tier-B readiness audit above — but `OnboardingGuard` + `onboarding/page.tsx` still use the NextAuth-default `/api/auth/signin` (harmless bounce, left as-is).
2. **Legal pages unreadable on the dark theme.** `privacy-policy`, `terms-of-service`, `refund-policy`, and the `top-products` "How Rankings Work" card used Tailwind `prose` **without `dark:prose-invert`** → near-black text on the dark (`<html class="dark">`) background. Added `dark:prose-invert` to all four. (The help-article page already had it — that's the reference pattern.)
3. **OG/Twitter share card.** `layout.tsx` `openGraph.images` pointed at the **square 512×512 app icon** → letterboxes in LinkedIn/X/WhatsApp previews. Added `src/app/opengraph-image.tsx` (dynamic 1200×630 `next/og` `ImageResponse` — brand near-black bg, indigo glow, wordmark, gold rule, tagline, "NOW IN BETA · FREE" pill; no binary asset to maintain) + `src/app/twitter-image.tsx` (re-exports it → Next auto-sets `twitter:card=summary_large_image`). `layout.tsx` metadata gained `metadataBase`, og `url`/`siteName`/`type`, a `twitter` block, and the square-icon image was removed so the convention card takes over.

### Should-fix (shipped)
- **Hero badge** "Now Live" → "Now in Beta" (matches the honest-beta copy everywhere else).
- **One shared footer on every public page.** Previously only the landing page had a footer (inline); about/contact/privacy/terms/etc. had none. Repurposed the dead `src/components/site-footer.tsx` into a real `SiteFooter` (client component, hides on `/dashboard` + `/admin`, mirrors `SiteHeader`); rendered once in `layout.tsx`; removed the landing-only inline footer. Expanded to 3 columns (Explore / Company / Legal), added the previously-unlinked **Refund Policy** + **Transparency** pages, dynamic copyright year. **Social links intentionally omitted — pending handle URLs** (LinkedIn / X / Instagram / Telegram; FB pending a login-block check). The footer has a clean slot for them.
- **Legal auto-date.** `privacy`/`terms` showed `Last updated: {new Date().toLocaleDateString()}` (always "today" + hydration-mismatch risk) → fixed string "June 2026".
- **Mailbox consolidation → `contact@earn4insights.com`.** Founder confirmed only `contact@` exists. Swept user-facing mailto: `sales@` (pricing Enterprise), `legal@` (terms), `privacy@` (privacy policy + `my-data`), `support@` (influencer payouts), and the `Contact@` casing on the contact page. **Left alone:** send-from addresses (`notifications@` in forgot-password `EMAIL_FROM`, `support@` fallback in the admin diag route) — outbound "from" headers on a verified domain, not inboxes.

### Judgment calls (founder-delegated)
- **Feature grids mined from the real sidebar + expanded.** Source of truth = `menuItems` in `src/app/dashboard/DashboardShell.tsx`. Refactored `page.tsx` from ~600 lines of hand-written cards into typed arrays (`BRAND_FEATURES`/`CONSUMER_FEATURES`/`INFLUENCER_FEATURES`) + a `FeatureCard` renderer with a per-audience `THEME` map (full static Tailwind class strings — no dynamic class interpolation, which Tailwind can't see). **Counts: Consumer 12→23, Brand 15→18, Influencer 6→10**, every card mapped to a real route/capability. Consumer CTA changed from the mismatched "Book a Demo → /contact-us" to "Learn More → /signup?role=consumer".
  - **`<ComingSoon />` badge** (amber pill, defined once in `page.tsx`) marks not-live-at-launch features via a `comingSoon: true` flag — **flip the flag as features go live.** Currently badged: Brand → **Social** (listening env-gated), **Category Intelligence** (manual/proxy data only), **Discover Influencers** (brand-side search not yet mounted); Consumer → **Social** (friend graph / social inference pending Instagram OAuth); Influencer → **Performance Analytics** (social stats self-declared, no platform-API verification). This split is the founder's to tune.
- **Privacy policy** (`privacy-policy/page.tsx`): the 5-section stub → **14-section DPDP Act 2023 + GDPR draft** grounded in real data flows (data categories incl. feedback media + behavioral signals + encrypted payout details, granular revocable consent, min-cohort anonymization brands see, the real processor list — Razorpay/Resend/Twilio/OpenAI/Pusher/Vercel/Neon/Upstash — retention windows, full data-subject rights incl. the one-click export, **Grievance Officer** at `contact@`). ⚠️ **NOT lawyer-reviewed.** Deliberately left blank: exact retention days, legal entity name/address — fill before relying on it.

### Open follow-ups / manual checks (not blockers)
- **Open the PR** (web URL above) — branch is pushed, not merged.
- **Founder eyes-on:** OG preview render after deploy (LinkedIn Post Inspector / X validator / a WhatsApp DM); expanded grids at mobile/tablet (Consumer is now 23 cards = more rows); legal pages now readable on dark — confirm.
- **Social links** for the footer once handle URLs are available (+ optional `twitter:site` in meta).
- **Pricing is login-gated** (`/dashboard/pricing` requires a session) — NOT publicly viewable pre-signup. Flagged; founder decision whether to expose a public pricing route.
- **Pricing "Upgrade to Pro" → `/dashboard/settings`** remains the known freemium dead-end (deferred per the freemium-discovery section above — not touched).
- **Privacy policy** → legal review + fill entity/address/retention blanks.

### Landing live-test follow-ups (2026-06-29, on `main` after the audit merge)
The audit branch was merged to `main` (fast-forward) + pushed → production. While live-testing as an **influencer** account, three follow-up fixes shipped straight to `main`:

1. **`7a5d27f` — feature-card CTAs no longer bounce.** The per-card secondary links ("Learn More"/"Book a Demo") on consumer + influencer grids pointed at `/signup?role=…`; for a **logged-in** user the middleware (`src/middleware.ts:242` — `/signup` redirect-if-authed) bounced them to `/dashboard`. Brand cards already used `/contact-us`. Now **all three audiences' card CTAs → `/contact-us`** (public, no bounce). The big section "Get Started Free" buttons stay the signup path.
2. **`1d37ee5` — copy + first-class influencer signup.** (a) Consumer grid subtext "Free while in beta — no credit card" implied consumers might pay → **"Always free for consumers — earn rewards, never pay a thing"** (consumers never pay; the beta/paid framing is brand-only). (b) Influencer CTAs (hero + section) → `/signup?role=influencer` (were `?role=consumer`) + subtext "Free to join — set up your influencer profile in a quick onboarding" (dropped the stale "sign up as a consumer, register from your dashboard" — there's a first-class influencer signup → `/onboarding`). (c) **Bug fix: the signup page ignored `?role=`** (always defaulted to consumer). Now reads `?role=` to preselect (wrapped in `<Suspense>` for `useSearchParams`, mirroring login), so every hero/section role button lands on the right preselected role.
3. **`0087c19` — session-aware landing CTAs** (founder picked option A). New `src/components/landing-ctas.tsx` (`HeroCtas` + `SectionCta`, client components using `useSession`): logged-in users see a single **"Go to Dashboard"** instead of the signup buttons; logged-out users see the full conversion CTAs. Landing page stays a static server component — only the buttons are client-side.

**Account-model clarification (code-verified, drove the option-A decision).** `createUser` (`userStore.ts:87`) sets capability flags directly from the signup role: `isBrand/isConsumer/isInfluencer = (role === …)`. So an account created **directly as influencer** has `role='influencer'`, `isInfluencer=true`, **`isConsumer=false`** → **no consumer view**. The header `RoleSwitcher` (`RoleSwitcher.tsx`) only renders for accounts with **≥2** capability flags (e.g. a consumer who later did "Become an Influencer" keeps `isConsumer=true` + gains `isInfluencer=true`). One email = one account; there is **no in-app influencer→consumer capability-add** today (only consumer→influencer). So a pure influencer clicking a consumer CTA genuinely has no consumer side to reach — "Go to Dashboard" is the honest behavior rather than implying a consumer login exists.

**Deferred (option C):** an in-app "Become a Consumer" path (mirror of "Become an Influencer") that adds `isConsumer=true` to a pure-influencer account → would surface the role switcher + consumer features without a second account. Bigger build; revisit if influencers-as-consumers is wanted. **Note:** these three follow-ups are on `main` and NOT on the merged `chore/prelaunch-public-surface-audit` branch (which is now behind `main`).

### Demo booking → Calendly + on-page contact fallback (2026-06-30, `f675b1b`)
Wired demo booking to one consistent Calendly path + surfaced direct contact **on-page** (not just the footer, since hesitant visitors don't scroll). Calendly: `https://calendly.com/vishjoshi789/30min` (`CALENDLY_URL` const inlined in both `page.tsx` + `site-header.tsx`).
1. **Header "Book a demo" button** (`site-header.tsx`) → Calendly (new tab, `rel="noopener noreferrer"`): **desktop** top-right outline button (`hidden md:inline-flex`, shown regardless of auth state); **mobile** in the hamburger Sheet under "Explore" (deliberately NOT a 3rd button in the compact 375px bar — founder-approved). Global header → appears on all public pages, hidden on `/dashboard` (intentional).
2. **Feature-card + bottom-CTA "Book a Demo" → Calendly.** `THEME.brand.ctaHref` (drives all **18 brand cards**) + the bottom-CTA outline button now open Calendly in a new tab. `FeatureCard` branches on `t.ctaHref.startsWith('http')` → external `<a target=_blank rel=noopener noreferrer>` vs internal `<Link>`. **Consumer (23) + influencer (10) cards KEPT on `/contact-us`** — they say "Learn More", not "Book a Demo", and the Calendly event is a *brand* demo, so routing a consumer/influencer there is wrong (founder-confirmed).
3. **`ContactFallback`** line beneath the hero CTAs + the bottom CTA: "Prefer to reach us directly? contact@earn4insights.com · +91-8830403955" (`mailto:` + `tel:+918830403955`, `text-xs text-muted-foreground`, each link `whitespace-nowrap` so email/phone never split mid-token; styled quiet so it doesn't compete with the buttons).
`contact-us` page + footer "Contact" link untouched. tsc clean. **Eyeball live:** hero contact-line wrap @375px; the desktop "Book a demo · Sign In · Get Started" trio next to the wordmark at the `md` (~768px) breakpoint.

---

## 🔴 Feedback/export access-control security batch (2026-07-28, `61b31af`)

Found by the brand-facing feedback **viewing / filtering / export** audit (diagnose-only pass that preceded this batch). All 4 were **live in production** with real-brand onboarding imminent. Scope was deliberately narrow: **ownership checks only** — no tier/freemium work, no filters, no export build, no refactors. Typecheck clean.

### (a) What this closed — 4 defects

| # | Surface | Defect | Fix |
|---|---|---|---|
| 1 | `server/surveys/responseService.ts` → `exportResponsesToCSV` | **`'use server'` action with NO `auth()` and NO ownership check.** Server actions are directly-invokable endpoints, not just the button's callback — any authenticated caller could POST an arbitrary `surveyId` and get every respondent's **name + email**. | Private `assertSurveyOwnedByCaller()`: `auth()` → survey → product → `owner_id`. All failure modes (no session / unknown survey / no product / null owner / mismatch) throw **one generic error** so survey ids can't be probed. |
| 2 | `/dashboard/products/[productId]/feedback` | Had `auth()` but **no owner check** → any logged-in user (consumer, influencer, competing brand) could read a product's full feedback incl. consumer names, emails, transcripts, media. | Gate moved **out of the `Promise.all`** so it runs *before* any feedback is read; `notFound()` not 403, so the product isn't confirmed to exist. |
| 3 | `/api/dashboard/feedback-media/[id]/download` | `requireRole('brand')` proves the caller is *a* brand, **not the owner** → any brand could stream any other brand's consumer audio/video by id. | New `getBrandIdForMediaOwner()` in `feedbackRepository`. `feedback_media.owner_id` is **polymorphic** (`feedback` / `survey_response`) and deliberately has **no FK** (migration 032 dropped the one 031 wrongly added — it had broken ALL uploads), so the join is resolved **in code per `owner_type`**. Unknown `owner_type` → fail closed. 404 to prevent id enumeration. |
| 4 | `lib/analytics/segmentedAnalytics.ts` | **Zero consent checks** — demographic segmentation ran over all profiles regardless of whether `demographic` consent was granted or **revoked**. k-anonymity limits re-identification but does **not** establish a lawful purpose (DPDP §6 / GDPR Art. 5(1)(b)). | New batch `getUsersWithConsentForCategory()` in `consentRepository` (per-user `hasConsentForCategory` would be an N+1 over hundreds of profiles); profiles filtered **before any demographics are read**. |

**K=5 confirmed intact.** Suppression is applied at `segmentedAnalytics.ts:110` / `:163` from `segment.userCount`, computed *after* grouping. The consent filter runs *pre*-grouping, so bucket counts are recomputed from the reduced set — a bucket dropping below 5 is suppressed exactly as before. Dropped profiles fall through as "no profile" into the existing `'Unknown'` bucket (no new code path). Both entry points (`getSegmentedAnalytics`, `getConsumerIntelligence`) share `getFeedbackWithProfiles`, so one gate covers both.

**⚠️ Deliberate deviation — fail-closed on null `owner_id` (founder-approved, do NOT "consistency-fix" back).** All three ownership checks **deny** when `owner_id` is null, unlike the existing pattern at `api/analytics/segments/[productId]/route.ts:47` (`if (ownerId && ownerId !== session.user.id)`) which **allows** it. `products.owner_id` is **nullable by design** (`schema.ts:72` — *"null for unclaimed placeholders"*, consumer-created products pending verification), so fail-open would expose every unclaimed product's feedback to every logged-in user. Copying the permissive check into 3 new callsites would have widened the hole being closed.

**Legitimate paths verified unaffected:** Feedback Hub links come from owner-scoped `getBrandProductIds()` (`eq(products.ownerId, brandId)`); own product / own media / own survey export all still resolve; unclaimed products never appeared in a brand's own list (`getProductsByOwner` filters by ownerId). One *intended* behavior change: a brand clicking from the shared catalog into **another** brand's product feedback now gets a 404 instead of data.

### (b) OPEN SECURITY DEBT — follow-up batch (queued, NOT started)

Found by the same sweep. **Severity context:** middleware *does* gate `/dashboard/*` to logged-in users (`middleware.ts:309-316`), so these are **authenticated-user IDORs**, not anonymous. Priority order is founder-set:

1. **`dashboard/products/[productId]/profile/actions.ts` — HIGHEST.** `'use server'` **WRITE** mutations (`saveStep1–6` + `completeProfile`) with **no auth and no owner check** → any authenticated user can **overwrite another brand's product profile**. Same class as Defect 1 but write-side.
2. **`dashboard/surveys/[id]/responses/page.tsx`** — no auth, no owner check; renders the **full responses table with names + emails**. ⚠️ **This blunts the Defect-1 fix** — the CSV export is closed but the table beside the button still shows the same data.
3. **`dashboard/surveys/[id]/page.tsx`** — same, no auth.
4. **Read exposures, all no-auth/no-owner:** `[productId]/page.tsx` (renders `RecentFeedback` — 5 items + media + names/emails), `[productId]/profile/page.tsx` (full brand profile: audience, channels, goals, branding, testimonials), `[productId]/themes/page.tsx` (AI-extracted feedback themes).
5. **`api/analytics/segments/[productId]/route.ts:47`** — flip the fail-**open** null check to fail-**closed**, matching the batch above.

**Clean / no risk (checked, no action):** `[productId]/nps/page.tsx` + `[productId]/social/page.tsx` are static placeholders with no data; `products/product/*` are redirect shims; `[productId]/actions.ts` checks auth correctly.

**Enumeration source worth knowing:** `/dashboard/products/page.tsx` calls `getProducts()` — **all** products, not owner-scoped (shared catalog; copy branches by role at line 100). So productIds don't need guessing, they're listed — which makes the routes above trivially reachable rather than theoretical.

### (c) Blob media is PUBLIC-READ — investigation only, nothing changed

**Confirmed genuinely public.** Both upload paths call `put(pathname, file, { access: 'public' })` — `api/uploads/feedback-media/server/route.ts:178` and `api/feedback/upload-media/route.ts:169`. Vercel Blob serves these from a public CDN URL with **no auth check of any kind**. `storageKey` stores that URL and the players render it **directly**, so the ownership check added to the download proxy in Defect 3 **is bypassed by the pages that should use it**.

**Only mitigations today:** `addRandomSuffix: true` on both paths (prefix is predictable — `feedback-media/{surveyId}/{responseId}/audio.webm` — the suffix isn't), plus `feedbackMediaRetentionService` deleting raw media on the tier retention window (30/60/90d). That is **security-by-obscurity**: the URL is unauthenticated and permanent until retention fires, and anything leaked via logs, referrers, or a shared screenshot stays live.

**Options (by cost):**
1. **Proxy-only rendering** — point `<audio>`/`<video>`/`<img>` at `/api/dashboard/feedback-media/[id]/download` (already ownership-checked) instead of `storageKey`. Small: ~4 render sites (both `FeedbackMediaSection` copies, `RecentFeedback`, responses table). Proxy already sets `content-disposition: inline` + streams upstream body → drop-in for the players. **Caveat: does NOT close existing exposure** — every already-issued blob URL stays live forever. Stops *new* leakage only.
2. **Proxy + re-upload existing media to fresh random paths, deleting old blobs.** Closes the back catalogue. Needs a one-off migration over `feedback_media` + `storageKey` rewrites; I/O-heavy in proportion to corpus size. **➡️ CHEAPEST NOW, while the media corpus is still small — cost grows monotonically with every upload. Do this before beta volume arrives, or it gets materially more expensive.**
3. **Signed/expiring URLs.** Vercel Blob has no presigned-read for public blobs → means moving the store to S3/R2 with presigned GETs. Largest: new provider + env, migration of all objects, plus changes to upload, retention (`del()`), and the moderation/processing services that read `storageKey`. Separate project.

---

## ✅ Follow-up security batch — sweep findings CLOSED (2026-07-28, `e939199`)

Closes the **OPEN SECURITY DEBT** list logged above under `61b31af`. All 5 items done, in the founder-set priority order. Ownership checks only — no tier work, no filters, no export build. Typecheck clean.

| # | Surface | Was | Now |
|---|---|---|---|
| 1 | `products/[productId]/profile/actions.ts` | 7 `'use server'` **WRITE** actions (`saveStep1–6` + `completeProfile`) with **no auth, no owner check** → any authenticated user could **overwrite another brand's product profile** | Private `assertProductOwnedByCaller()` as the first statement in all 7. Verified this file is the **SOLE** entry point to those `productService` writes (`ProfileClient` imports from `./actions`), so the surface is fully covered |
| 2 | `surveys/[id]/responses/page.tsx` | No auth/owner check; rendered the full responses table with **names + emails** — this **blunted the `61b31af` export fix**, since the table still showed what `exportResponsesToCSV` no longer handed out | Gate runs **BEFORE** `getResponsesBySurveyId` |
| 3 | `surveys/[id]/page.tsx` | No auth | Owner-gated (questions, embed code, config) |
| 4 | `products/[productId]/{page,profile/page,themes/page}.tsx` | Read exposures: feedback + names/emails/media, brand profile, AI themes | Gated — see the exposure-vs-page decision below |
| 5 | `analytics/segments/[productId]/route.ts` | Fail-**OPEN** null owner check | Fail-closed. **Plus its twin:** a sweep of every `ownerId` comparison found `analytics/consumer-intelligence/[productId]/route.ts:35` carrying the *identical* bug — both are entry points into `segmentedAnalytics` (the surface consent-gated in `61b31af`). Fixed the same way |

### Decision 1 — UNIFORM ADMIN BYPASS (founder-directed)

New **`src/lib/auth/roles.ts`** exports `isAdminSession()` — the single home for the `(role as string) === 'admin'` cast CLAUDE.md §5 requires. **Every** ownership check created or touched by both batches consults it (**10 files**), rather than a patchwork of per-route exceptions:

`analytics/consumer-intelligence/[productId]/route.ts` · `analytics/segments/[productId]/route.ts` · `products/[productId]/feedback/page.tsx` · `products/[productId]/page.tsx` · `products/[productId]/profile/actions.ts` · `products/[productId]/profile/page.tsx` · `products/[productId]/themes/page.tsx` · `surveys/[id]/page.tsx` · `surveys/[id]/responses/page.tsx` · `server/surveys/responseService.ts`

**Rule: admins bypass ownership checks platform-wide.** Deliberately includes the profile **WRITE** actions, so an admin can edit any brand's product profile — narrow it in `roles.ts` if admin access should ever be read-only. Concretely required because `/dashboard/surveys` gives admins a platform-wide list (`getAllSurveys`) whose links would otherwise **all 404**.

⚠️ **If you add a new ownership check, consult `isAdminSession()` — do not reintroduce a local cast.**

### Decision 2 — EXPOSURE-GATED, not page-gated, on `products/[productId]/page.tsx`

**Do NOT "fix" this into a blanket owner gate.** `/dashboard/products` is a **SHARED catalog**: `products-list.tsx:129` renders "View details" → `/dashboard/products/[id]` for **every role**, and the consumer copy is *"Browse products and share your feedback to earn rewards."* An owner-only page gate **breaks consumer browsing** (this was caught during path verification, after being implemented that way first).

So the **exposure** is gated, not the page: `<RecentFeedback>` (consumer names, emails, media) renders only for owner/admin; `ProductOverview` stays public. Fails closed on a null `owner_id`, so an unclaimed product never renders feedback to anyone.

The same `canManage` flag also gates **`ProductOverview`'s brand-management Quick-actions card** (View All Feedback / AI Themes / Edit product profile / Unified Analytics, + the two "Soon" placeholders). That card previously rendered for every role; once the target routes were gated it would have handed browsing consumers buttons that 404. Whole card gated rather than the four live buttons — a Quick-actions card containing only disabled placeholders is worse than no card.

### Still open / known (not fixed — decide later)

- **`/api/dashboard/feedback-media/[id]/download` is admin-INACCESSIBLE.** `requireRole('brand')` (`lib/auth/server.ts:44`) throws for `role='admin'` *before* the ownership check runs, so the uniform bypass can't reach it. Pre-existing, not introduced by these batches; fixing it means touching the shared `requireRole` primitive.
- **Three pre-existing ownership checks outside both batches have no admin bypass** (all already fail-closed, so no leak — just inconsistent with the new policy): `api/contribution/brand-config/route.ts:74`, `api/notifications/product-launch/[productId]/route.ts:39`, `api/notifications/survey-distribute/[surveyId]/route.ts:55`.
- **`/dashboard/products` remains a shared catalog listing every product** (`getProducts()`, not owner-scoped). Intentional — it's the consumer discovery surface — but it means productIds are enumerable by any logged-in user, which is what made the now-closed IDORs trivially reachable.
- **Blob media is still public-read** — unchanged by either batch. See the Blob section under `61b31af`; option 2 remains cheapest while the corpus is small.

---

## 📣 CLAIMS POLICY — what we may advertise, and when (2026-07-28, `92f7d7b`)

Founder-approved policy, written down so it survives to the freemium build. Grew out of the export/filtering copy fix (`92f7d7b`) and the earlier false-trial fix (`9181d49`) — the same mistake twice means it needed a rule, not another one-off patch.

### The rule

The question is never "remove vs. mention". It is **what kind of claim** you are making:

| Claim type | Example | Rule |
|---|---|---|
| **Present-tense capability** in a priced feature list | "Export all feedback to CSV" under Pro | Only if it **works today**. An unlabeled item in a priced list is *a reason to pay* — treat it as contractual. |
| **Labeled roadmap** | `detail: 'Roadmap'`, `comingSoon: true` | **Legitimate — keep doing this.** Context, not obligation. Needs a rough horizon; if you can't name a quarter, it's a hope, not a roadmap item. |
| **Vision / positioning** | The site tagline | Fine. Nobody reads a tagline as a feature list. |

**The mechanism already exists — use it instead of inventing new copy patterns:** `pricing/page.tsx` supports `detail: 'Roadmap'` (live on "Custom branding", "SSO / SAML"); the landing feature grids support `comingSoon: true` (live on Social, Category Intelligence, Discover Influencers).

### Timing

- **Reason-to-buy feature** (why someone picks Pro over Free) → **build first, then claim.**
- **Tiebreaker** → claim as **badged roadmap** with a horizon.
- **No horizon** → don't claim it.

⏰ **The deadline is the first real payment, not launch.** While nothing is billable the pricing page's job is credibility, not conversion, so cutting an unbuilt claim costs nothing. The moment money changes hands every unbadged line is something a customer can reasonably say they paid for. Same gate as the payment-ledger blocker in `CLAUDE.md` §6.

### Why `92f7d7b` CUT rather than badged

Not a precedent for "always delete". Specific to those two items: (1) badging implies commitment, and an undated "coming soon" repeated across three surfaces decays into noise; (2) both are **cheap and near** — the survey-response filter UI and CSV export already exist as working templates to copy — so the gap is days, not a quarter. For genuinely distant/expensive items (REST API, webhooks) **badged roadmap is the better call**, especially on Enterprise where the CTA is already "Contact Sales".

Also decisive for export specifically: the one export that exists (survey responses CSV) is **ungated**, so rewording the Pro line to describe it would have created a *new* false claim — selling as an upgrade something every free user already has. Same trap applies to filtering. **Check gating before rewording a claim to "the true capability".**

### Backlog created by this policy (claim only after building)

| Item | Effort | Plan |
|---|---|---|
| **Direct-feedback filtering** | **Low** — copy `surveys/[id]/responses/ResponseFilters.tsx`; `getFeedbackByProduct` already accepts `status`/`sentiment` with **zero callers** | Build, then re-add the claim. Best value/hour on this list. |
| **Direct-feedback export** | **Low** — `exportResponsesToCSV` is a working template | Build, then re-add. It's what brands actually ask for. |
| **REST API / webhooks** | High | Re-add as **badged roadmap** on Enterprise. `canAccessAPI`/`canUseWebhooks` unimplemented. |
| **Usage metering** | Medium | Blocks every limit line (transcription min / upload GB / product count / retention) from being honest. Do it **with** freemium, not before. `tierMiddleware` still has zero callers. |

⚠️ **The mirror-image problem — do not forget this one.** The Free plan's `included: false` rows are *also* untrue: tier gating is **cosmetic**, so free users currently see individual feedback, transcripts and media playback exactly as Pro does. We are **under**-claiming Free while over-claiming Pro. A brand who upgrades to unlock something they already had is the worst version of this. Resolves only when tier enforcement is wired — i.e. the parked freemium build (constraint at line ~200 above still stands: do NOT touch `subscriptionService` / `tierMiddleware` / `brand_subscriptions` until greenlit).

### What `92f7d7b` changed (14 strings, 3 files, copy only)

**Export (10):** Pro tagline "and export"; Pro export row + "Up to 100 exports/month"; Free "Export feedback data (CSV / JSON)"; Enterprise "Unlimited CSV & JSON exports"; Pro "Export data to share..." value prop; all three `limits.exports` values + the `exports` interface field + the Exports comparison row; export lines in **both** UpgradePrompts (`dashboard/feedback` and `products/[productId]/feedback` — the latter a third instance beyond the two originally reported).

**Filtering (4):** pricing Pro + Free rows, and the filter lines in both UpgradePrompts. Direct feedback has **no filter UI at all** — neither page reads `searchParams`.

**Verified TRUE, left alone —** all consumer DSAR copy (landing "My Data Export", `transparency` ×2, privacy policy, `ConsentRenewalModal`, privacy settings): `/api/user/export-data` genuinely returns the user's own data as JSON. Landing brand grid (18 cards), onboarding, email templates and meta carried **no** export claims.

---

## 🔍 Direct-feedback filtering — BUILT (2026-07-29)

First item off the claims-policy backlog above. Filtering now exists on `/dashboard/products/[productId]/feedback` across **7 dimensions**: date from/to, rating min/max, sentiment, modality, review status, language. URL-driven (`?sentiment=negative&modality=audio`), so filtered views are shareable and bookmarkable.

**Files:** `db/repositories/feedbackRepository.ts` (`FeedbackFilters` type, shared `buildFeedbackConditions()`, filter-aware `getFeedbackByProduct` + `countFeedbackByProduct`, new `getFeedbackLanguagesForProduct`) · `products/[productId]/feedback/FeedbackFilters.tsx` (new client panel, modeled on the survey `ResponseFilters`) · `products/[productId]/feedback/page.tsx` (searchParams parsing + wiring).

### Decisions worth preserving

- **SQL filtering, NOT in-memory — this is correctness, not preference.** The survey responses page fetches all rows then `.filter()`s in JS. Copying that here would be **wrong**: the feedback query is `limit: 100`, so in-memory filtering searches only the newest 100 rows. Filter to "audio" on a product with 500 responses and most silently vanish. Don't "simplify" this back to the survey pattern.
- **One predicate builder for list + count.** `buildFeedbackConditions()` feeds both `getFeedbackByProduct` and `countFeedbackByProduct`, so "Showing 12 of 340" can't drift from the rows rendered.
- **Query params validated against enums**, not passed through. Drizzle parameterises anyway, so this isn't injection defence — it stops a hand-edited URL yielding a silently empty result that reads as "no feedback". Ratings clamp to 1–5.
- **NO demographic filters (age/gender/geo).** They need the `feedback.userEmail → user_profiles` join **and** the `demographic` consent gate. The `FeedbackFilters` type carries a comment saying don't add them without routing through `lib/analytics/segmentedAnalytics.ts`'s consent path.
- **NOT tier-gated** — consistent with the rest of the product, and the freemium constraint (line ~200) still stands.
- **Feedback Hub (`/dashboard/feedback`) deliberately untouched** — aggregate cards per product, not a list; filters don't map onto it.

### Two bugs fixed in passing

1. **"Unreviewed" stat card** was derived from the item list, so once filters existed, filtering to "reviewed" would render **Unreviewed: 0**. Now a product-wide count via `countFeedbackByProduct(productId, { status: 'new' })`, consistent with the other four cards.
2. **Empty state** now distinguishes "no feedback yet" (share your link) from "no feedback matches these filters" (N responses exist — widen them). Without this an over-narrow filter reads as data loss.

### ⚠️ Copy deliberately NOT re-added

Filtering now exists, so by the claims policy it is claimable — **but it is ungated**, so listing it as a **Pro** feature would repeat exactly the trap that caused `92f7d7b` (selling as an upgrade something every free user already has). Founder decision: **leave the copy out until tier enforcement lands.** Same reasoning applies to feedback export when that gets built.

---

## 🐛 Survey CSV export — `dateTo` end-of-day fix (2026-07-29)

`exportResponsesToCSV` (`server/surveys/responseService.ts`) compared `submittedAt <= new Date(dateTo)`. A `type="date"` input yields **midnight**, so any single-day range excluded everything submitted that day.

**Why it mattered more than it looks:** the responses **page** already widened correctly (`toDate.setHours(23,59,59,999)`), so page and export **disagreed** — a brand filtered to one day, saw N rows on screen, clicked Export CSV, and got an empty file. Now matched to the page's behaviour.

📌 **Correction to an earlier note in this session:** the responses *page* never had this bug — only the export service did. If you read a claim that both were affected, that was wrong.

---

# 🚨 INCIDENT — consumer media served from unauthenticated public URLs

**Opened:** 2026-07-31 · **Exposure closed:** 2026-07-31 · **Status: ✅ REMEDIATED** (Phase 1 `a66cb16` + Phase 2 rotation executed) — one item still open, see the notification question at the end.

> **Rotation executed 2026-07-31** against production. All 8 objects re-uploaded to `feedback-media-v2/`, `storage_key` updated, originals deleted. `rotated: 8 · skipped: 0 · failed: 0`, no orphaned blobs.
>
> **Verified** via `scripts/verify-feedback-media-rotation.mjs --check`:
> - `on rotated prefix : 8/8`
> - `new object reachable : 8/8` (HTTP 206 — media intact and range-capable)
> - **`old URLs still reachable: 0`** — all 8 pre-rotation URLs now return **HTTP 404**
>
> That last line is the security claim: every URL emitted during the exposure window is dead, including any captured from page source or via the ownership hole. `pre-rotation-urls.json` was deleted after verification (its gitignore rule is kept deliberately, so a future `--snapshot` can't be committed by accident).
>
> ⚠️ **Not verified programmatically:** in-browser playback through the proxy (audio, video seeking, images) for the owning brand. Requires a real browser session against the deployed app — worth one manual pass, especially seeking, since Range forwarding is new.
**Severity:** Moderate — real personal data exposed, low likelihood of access, no evidence of any.
**Discovered by:** the brand-facing feedback viewing/filtering/export audit (the same pass that produced the two access-control batches above).

## What was exposed

Consumer **audio recordings and images** submitted as product feedback, reachable by **anyone with the URL, with no authentication of any kind**.

Vercel Blob objects are uploaded with **`access: 'public'`** (`api/uploads/feedback-media/server/route.ts:178`, `api/feedback/upload-media/route.ts:169`) — Vercel Blob has **no private-read mode**, so this was not a misconfiguration but a property of the storage choice. `feedback_media.storage_key` therefore holds a permanent, unauthenticated CDN URL.

The dashboard **rendered `storage_key` directly** into `<audio>`, `<video>` and `<img>` tags across 3 pages (12 sites). So the ownership check on the download proxy — added in `61b31af` — was **bypassed by the very pages it was meant to protect**. Any URL that appeared in page source works forever and cannot be revoked.

A quieter variant of the same leak: the survey responses page passed `storage_key` as a **prop into `ResponsesTable`, a `'use client'` component**. The field was never rendered, but client props are serialized into the RSC payload, so every image's permanent URL sat in page source regardless of any `src` attribute.

## Scope — 8 objects, 2 submitters

Established by `scripts/count-feedback-media.mjs` (read-only):

| Submitter | Rows | Uploaded | Products |
|---|---|---|---|
| `vishweshwar@startupsgurukul.com` (founder test data) | 6 — 3 audio + 3 image | 2026-06-26 | Computational, Step by step, Metacog |
| **`pooranprasad@gmail.com` — GENUINE ORGANIC USER** | **2 — 1 audio + 1 image** | **2026-07-20** | Earn4Insights |

⚠️ **One affected record belongs to a real external user, not a tester.** Their voice recording and image were reachable at an unauthenticated URL from **2026-07-20 until rotation**. This is the fact that makes this an incident rather than a hygiene task, and the reason the data was **rotated, not purged** — it is feedback the brand legitimately received and the user intended to give.

## Exposure window

- **Founder rows:** 2026-06-26 → rotation
- **Organic user row:** **2026-07-20 → rotation**
- Phase 1 (`a66cb16`, 2026-07-31) stopped **new** URLs reaching browsers. It could not un-publish URLs already emitted — hence Phase 2.

## Mitigating factors (why severity is moderate, not high)

- **URLs are unguessable.** Both upload paths set `addRandomSuffix: true`. The path prefix is predictable (`feedback-media/{surveyId}/{responseId}/audio.webm`) but the suffix is not, so enumeration is impractical — exposure required someone to *obtain* a URL, not guess one.
- **No evidence of unauthorized access.** Also no proof of absence: Vercel Blob public reads are not attributable per-object in our tooling. Treat as "no evidence", not "did not happen".
- **Narrow audience.** Pre-beta; the pages carrying the URLs were the brand dashboard, and the ownership hole that widened reach (`61b31af`) was open for a bounded period.
- **Retention limits the tail.** `feedbackMediaRetentionService` deletes raw media on the tier window (30/60/90d) — but a permanent URL outliving a short window is precisely the problem, so this bounds rather than solves it.

## Remediation

**Phase 1 — `a66cb16` (shipped, deployed).** All playback moved to the ownership-checked proxy via `feedbackMediaUrl()` (`src/lib/media/mediaUrl.ts`); 12 sites across 3 files. Proxy hardened in three ways it needed before it could be the *only* path to media: session auth replacing `requireRole('brand')` (which threw for admins before any ownership check), **Range forwarding** (the old proxy always returned 200 with the whole object — switching players to it without this would have broken video seeking, a regression not a fix), and `cache-control: private, no-store`. Dead `storage_key` client prop removed from the survey responses page.

**Phase 2 — `3585ce0` (tooling ready, EXECUTION PENDING).** `scripts/rotate-feedback-media-urls.mjs` re-uploads each object to a fresh random path under `feedback-media-v2/`, updates `storage_key`, then deletes the original — after which every previously-leaked URL 404s. Ordering is **upload → update → delete per row**, so a crash always leaves the row pointing at an object that exists. Idempotent via the prefix; `--dry-run` verified against all 8.

Deliberately a one-off script, **not** the batched admin route first proposed — that machinery exists to survive partial failure across thousands of objects; here it would be more code than data.

## Verification (required after running rotation)

1. `--snapshot` **before** rotating (pre-rotation URLs are unrecoverable afterwards) — already captured to `pre-rotation-urls.json`, which is **gitignored**: committing it would permanently publish, in version control, the exact URLs the rotation exists to kill.
2. `verify-feedback-media-rotation.mjs` — all 8 rows on the `v2` prefix, new objects reachable.
3. `--check pre-rotation-urls.json` — **old URLs must all return 404/403**. This is the actual security claim; everything else is housekeeping.
4. Manual: media still plays in-dashboard for the owning brand (and seeks, given the Range work).

## Residual risk / follow-ups

- **Blob objects remain `access: 'public'` after rotation.** Vercel Blob offers no private mode. Post-rotation the URLs are fresh, unguessable, and — crucially — **never rendered to a browser**, so they function as secrets rather than published links. Truly access-controlled storage means signed URLs on S3/R2 (option 3): new provider, env, migration of all objects, plus changes to upload, retention (`del()`) and the processing services that read `storage_key`. **Not scheduled.**
- **`/api/admin/feedback-media/[id]/download`** authenticates via `ADMIN_API_KEY` Bearer header — unusable from a media tag, so admin UI playback goes through the dashboard proxy (which now permits admins).
### ⚖️ OPEN — external-user notification (UNRESOLVED, do not close without legal input)

**Status: UNRESOLVED founder decision. This is deliberately left open — do not record it as settled.**

The affected external user (`pooranprasad@gmail.com`) has **not** been notified. The working position is that unguessable URLs plus no evidence of access put this below a DPDP notification threshold — but that is a **provisional technical read, not a legal determination**, and whether it crosses the threshold is a **legal judgment, not a technical one**.

📌 **Queued for legal review alongside the privacy-policy lawyering** (`CLAUDE.md` §7 — the 14-section DPDP+GDPR policy is still an **un-lawyered draft** pending review, with entity name/address and exact retention windows deliberately blank). Same reviewer, same pass: ask explicitly whether this incident required notification under DPDP Act 2023, and whether the answer changes now that rotation has closed the exposure.

⚠️ **Wording that must survive future edits:** *no evidence of access is not the same as no access* — Vercel Blob public reads **are not attributable per-object in our tooling**, so we cannot demonstrate that nobody fetched these objects. A future session must **not** upgrade this into "assessed as no breach", "confirmed no access", or similar. If the wording gets stronger, the evidence must have gotten stronger first — and it hasn't, because the access logs to prove it never existed.

---

## 📤 Direct-feedback CSV export — BUILT (2026-07-31, `f303155`)

Second item off the claims-policy backlog, after filtering. **This is the capability the pricing page used to falsely advertise** — the claim was removed in `92f7d7b`, and the feature now genuinely exists.

Brands export a product's direct feedback from `/dashboard/products/[productId]/feedback`.

**Files:** `lib/feedback/filterParams.ts` (shared parser) · `lib/feedback/feedbackCsv.ts` (pure builder) · `server/feedback/feedbackExportService.ts` (`'use server'` action) · `products/[productId]/feedback/ExportFeedbackButton.tsx` · `scripts/verify-feedback-export.ts`.

### Decisions worth preserving

- **⚠️ MEDIA URLs ARE DELIBERATELY EXCLUDED — do not "helpfully" add them.** `feedback_media.storage_key` is a public, unauthenticated Blob URL. Putting it in a downloadable CSV would re-publish exactly what the 2026-07-31 rotation destroyed (see the incident record above), in a form that can never be revoked once it's in someone's Downloads folder. The CSV reports media presence as **per-type counts** + transcript text — the analysable content — and media itself stays behind the ownership-checked proxy. `verify-feedback-export.ts` asserts zero Blob URLs in the output, so a regression fails the check.
- **ONE filter parser, shared by page and export** (`parseFeedbackFilters` in `lib/feedback/filterParams.ts`). The survey side is the cautionary tale: page and export had separate date logic, so a single-day range showed rows on screen and exported an empty file (fixed in `b22ea11`). Keeping one function makes that drift structurally impossible. The verification script asserts `dateFrom=dateTo` returns that day's rows.
- **The action takes RAW query params and parses them server-side**, rather than accepting pre-parsed filters from the client — the client can't be trusted to have validated them, and it guarantees export and page run identical logic.
- **Filters apply in SQL**, so the export covers every matching row, not the page's first 100. `MAX_EXPORT_ROWS = 10000` bounds memory + the 60s function limit.
- **CSV builder lives outside the `'use server'` file** (`lib/feedback/feedbackCsv.ts`). That file can only export async functions, which would have made the builder untestable and forced every check through an authenticated request.
- **Security:** `assertProductOwnedByCaller` inside the action (it's a directly invokable endpoint, not just the button's callback), admin bypass per `lib/auth/roles.ts`, single generic error so product ids can't be probed.
- **UTF-8 BOM on the client blob** so Excel renders non-English feedback correctly — first-class here, since feedback text is auto-translated from any language.

### Verified (`scripts/verify-feedback-export.ts`, read-only, against production data)

Run on a text-only product **and** one with attachments:
- 19 rows exported; header + 17 columns consistent
- sentiment/modality filters narrow correctly in SQL; invalid enum values dropped
- `dateFrom=dateTo` returns that day's rows — **regression guard for the survey-export bug**
- **zero Blob storage URLs**; media reported as counts (`1,0,1` verified on a row with audio + image)
- rows containing `,` `"` or newline stay well-formed (3 such rows)

**Not verified:** the in-browser click-to-download path (needs a real browser). Data path, filters, escaping and security are all verified.

### ⚠️ Pricing copy deliberately NOT added — founder decision (2026-07-31)

**Export is UNGATED by design for now** — no `canExportCSV` check, consistent with the rest of the product while tier enforcement stays parked.

Because it's ungated, **listing it under Pro would repeat the exact trap that caused `92f7d7b`**: advertising as an upgrade something every free user already has. Adding it to the **Free** list was also rejected — it would be honest today, but *"reversing 'it's free' later is worse than announcing 'we've added export' later."*

📌 **Revisit when tier enforcement lands.** Same standing decision as filtering (see the claims-policy section above).

Note for whoever writes that copy: the old strings would **still** be wrong even now. They promised **"CSV or JSON"** (we have CSV only) and **"up to 100 exports/month"** (there is no metering of anything). Confirmed removed — the Pro feature list has no export row, the `exports` field is gone from the `PricingPlan` interface and all three plans' `limits` blocks, the limits-comparison row is gone, and both UpgradePrompts carry no export claim.

---

## 🖥️ KNOWN LOCAL-DEV ISSUES (2026-07-31) — neither is a code bug

Both hit while trying to smoke-test media playback + CSV export locally. **Production is unaffected by both.** Recorded so a future session doesn't spend an hour rediscovering them.

### 1. Local login fails: `AUTH_URL` points at production → Secure-cookie rejection

`.env.local` sets **`AUTH_URL` to the production URL**, so NextAuth v5 mints
`__Host-authjs.csrf-token` and `__Secure-authjs.callback-url=https%3A%2F%2Fearn4insights.com`
— cookies flagged `Secure`. A browser **will not send `Secure` cookies over plain HTTP**, so on `http://localhost:9002` sign-in bounces straight back to `/login` with no error message. `/api/auth/session` also returns 404 locally for the same root cause.

**Fix for local dev:** point `AUTH_URL` at `http://localhost:9002` in `.env.local` (local-only; never commit — the file is gitignored).

**Not fixed here** — `.env.local` holds live credentials and is the founder's file; changing it was explicitly declined. Founder's call: test against production (which has HTTPS, so the problem doesn't exist there) rather than fight the local environment.

### 2. Near-full disk corrupted the `.next` routing manifest → route-group-specific 404s

**Symptom (worth memorising — it's misleading):** a route **compiles successfully and then renders `/_not-found`**.

```
○ Compiling /login ...
✓ Compiled /login in 2.3s (638 modules)
○ Compiling /_not-found ...
GET /login 404
```

Concretely: **`/login` and `/signup` returned 404** — both routes in the `(auth)` route group — while `/`, `/about-us` and `/contact-us` all returned **200**. Since every dashboard route 307-redirects to `/login`, this blocks local testing entirely.

**Ruled out** before landing on the cache: middleware (response carried `x-mw-decision: continue`), missing files (`src/app/(auth)/login/page.tsx` exists, no conflicting route), and compile errors (the route compiled cleanly).

**Fix:** `rm -rf .next` and restart. `/login` + `/signup` → 200 immediately after. `.next` is pure build cache (~140 MB) and regenerates.

⚠️ **Second time a near-full disk has caused file corruption on this machine** — `CLAUDE.md` §6 already records *"a near-full disk truncated a file mid-write this session."* The disk was at **95% / 7.2 GB free** when this happened; clearing the pip cache (3.4 GB) and npm `_cacache` (0.5 GB) brought it to ~10 GB. **Keep headroom above ~10 GB.** Below that, expect silent corruption of written files — not just slowness.

### Bonus observation: local dev compile times on this machine are pathological

`Ready in 171s` on a warm cache, **`366s` after clearing `.next`**; 28–71s to compile a single 21-module route. This is the disk, not the code — Vercel builds are unaffected. It is the standing reason to **prefer static verification (typecheck + read-only DB scripts) over live HTTP smoke tests** locally, and to test UI against the deployed app instead.

---

## 🎙️ INCIDENT — silent recordings accepted, Whisper hallucinations stored as consumer feedback (2026-07-31, `68bd1d3`)

Found while testing media playback in production: the organic user's 18-second voice note was inaudible.

### What was wrong

Four production recordings (**two different users, two months apart**) contained **digital silence** — valid WebM/Opus containers, correct duration, correct 20ms Opus frame cadence, but **12 bytes per frame**, the DTX/comfort-noise floor (~1.7 kbps vs 24-32 kbps for real speech). Verified by parsing the WebM cluster timecodes directly, which also ruled out truncation: real duration matched the recorded duration.

**The recorder code was NOT at fault.** `getUserMedia({audio:true})` → `new MediaRecorder(stream, {mimeType})` → `start(1000)` is textbook-correct on every surface, with no AudioContext, analyser, `track.enabled` manipulation or constraints that could mute input. *(An earlier claim in this session that "voice feedback has never captured audio / is shipping broken" was an overreach made before the code was read — the evidence does not support a recorder defect.)*

The real defect was **the absence of any signal to the user** that their mic was dead, plus a pipeline that accepted the result:
1. **No level meter** — a muted mic produced a normal-looking timer and pulsing icon.
2. **No silence check before upload.**
3. **Whisper hallucinated.** It does not return empty text for silence — it invents stock phrases. All four transcribed to `"you"`.

### ⚠️ The contamination was REAL, not hypothetical

Media processing did not only write `transcript_text`. It **also overwrote `normalized_text`** — the field sentiment analysis and the CSV export actually read — so the consumer's genuine written feedback was replaced by `"you"` in every downstream path.

**2 of the 4 sentiments were WRONG**: genuinely positive reviews were scored `neutral`, because sentiment ran on the hallucination instead of what the customer wrote. The brand's sentiment breakdown was understating positives by two.

Downstream checks:
- `consumer_intents` — **0** rows referencing these feedback ids (clean)
- `contributions`, `product_themes` — tables do not exist
- 🚩 **`consumer_signal_snapshots` (302 rows) — NOT id-linked, so contamination could not be attributed either way. This is UNVERIFIABLE, not confirmed clean. Do not upgrade this wording to "confirmed unaffected" without an actual trace.**

### The fix (`68bd1d3`)

**Client — all 6 capture paths across 4 files** (4 audio + 2 video): `survey-response-form.tsx`, `DirectFeedbackForm.tsx`, `dashboard/submit-feedback/page.tsx`, and **`submit-feedback/page.tsx`** — a fifth surface not in the original report; missing it would have been a half-fix. New `createAudioLevelMonitor()` (`lib/media/audioLevelMonitor.ts`) taps the stream read-only via `AnalyserNode` (never connected to `destination` — that would cause howl) and drives `<AudioLevelMeter>`.

**Threshold: PEAK amplitude 0.015 across the whole take** — peak not average, because speech is bursty and one syllable anywhere should pass. Digital silence ≈ 0.000 · room tone 0.005-0.02 · whisper 0.05+ · normal speech 0.2-0.8. That's ~3x below a whisper, deliberately biased toward **false acceptance**: a blocked real user is feedback lost forever. **FAILS OPEN** — no AudioContext ⇒ monitor is null ⇒ recording always kept.

**AUDIO blocks · VIDEO WARNS** — founder's call, deliberately asymmetric. Silent audio contains nothing, so rejecting loses nothing. A silent video still carries its **visual** content, which is often the entire point (a product defect, damaged packaging, how something looks in use). Destroying that to enforce an audio rule would throw away real feedback. ⚠️ **Do not "consistency-fix" video into a hard block** — the code carries this note too.

**Server — defence in depth** (`feedbackMediaProcessingService.ts`), because the client gate can be bypassed, fail, or be absent on an old browser. Discards a transcript only when **BOTH** signals agree: text matching a known Whisper silence hallucination **AND** encoded bitrate below the **6 kbps** DTX floor. Either alone is insufficient — a user might genuinely say "thank you", and some quiet recording might sit low on bitrate. Also added `silent_audio` to `NON_RETRYABLE_ERROR_CODES`: `isTransientError()` treats *unlisted* codes as transient, so without it every silent recording would retry to the cap, burning an OpenAI call each time on audio that can never transcribe.

**Backfill** — `scripts/backfill-silent-audio-transcripts.ts`, applied and idempotent (re-run: 0 affected). Nulled `transcript_text`, restored `normalized_text` from `feedback_text`, recomputed sentiment. `feedback_text` itself was never touched — it always held the genuine text.

> Note for running that script: `sentimentService` imports `server-only`, which throws outside RSC. Run with `NODE_OPTIONS=--conditions=react-server` so the package resolves to its empty stub.

### Still open

- **Not verified in a browser**: the level meter and the audio block/video warn behaviour. Needs a real mic (and a muted one) against the deployed app.
- Whether the four originals were user error (didn't speak / muted OS input) or something environmental remains unknown. Four-for-four across two users is suspicious, but with the code exonerated there is nothing further to trace from here.

---

## 🔁 `.next` corruption — THIRD occurrence (2026-07-31)

Recorded again because it produced a **completely different symptom** this time and cost real debugging.

**Symptom this time:** `tsc --noEmit` failed with **76 errors, all in `.next/types/routes.d.ts`**, ending in `TS1002: Unterminated string literal`. Zero errors in actual source. Cause: stopping the dev server interrupted Next.js mid-write of its generated route types.

**Previous symptom (same root cause):** route-group-specific 404s — `/login` and `/signup` 404ing while other public routes returned 200, with the route *compiling successfully* and then rendering `/_not-found`.

**Fix, both times:** delete `.next` and re-run. It's pure build cache.

⚠️ **The pattern to recognise: if generated output under `.next` looks structurally broken — truncated types, routes that compile then 404 — suspect the cache before suspecting source.** Contributing factor is low disk; `CLAUDE.md` §6 and the local-dev section above both record it. **Keep C: headroom above ~10 GB.**

---

## 📧 KNOWN GAP — we have NO visibility into email delivery failures (2026-08-02)

Surfaced while debugging why password-reset emails never arrived for `vishweshwar@startupsgurukul.com`.

### Root cause of that incident (resolved)

The address was on **Resend's suppression list**. Its mailbox had been over storage and hard-bouncing, so Resend suppressed it to protect sending reputation — and **suppression does not lift itself** when the mailbox is fixed. Removed via the Resend dashboard → Suppressions.

### ⚠️ The systemic gap this exposed — worth fixing before beta volume

**A suppressed send returns HTTP 200 with an email id, and is then silently dropped.** Our code only checks Resend's `error` field, which is empty in that case. So:

- `notification_queue` read **21 sent, 0 failed** while delivering nothing to that address
- The forgot-password route returned its normal success message
- Two reset tokens were minted (24 Jul, 31 Jul) and neither was ever used
- Nothing anywhere recorded a problem

**`status='sent'` in `notification_queue` means "Resend accepted the API call", NOT "delivered".** Bounces, suppressions and complaints are entirely invisible to us today.

**Why this matters more than one password reset:** if a beta user's address gets suppressed, they silently stop receiving *everything* — points notifications, brand alerts, and **email verification, which per `CLAUDE.md` HARD-BLOCKS feedback submission (EV.1)**. That user simply cannot participate, neither they nor we get any signal, and they look like an inactive account.

**Fix (not built):** a Resend webhook consuming `email.delivered` / `email.bounced` / `email.complained` and writing real delivery state back to `notification_queue`, plus surfacing suppressed recipients somewhere in admin. There is already a `SOCIAL_MENTION_WEBHOOK_SECRET` pattern to follow for signature verification.

### Diagnostic notes for next time (both cost time here)

1. 🔑 **The production `RESEND_API_KEY` is SENDING-SCOPED.** It returns **401 `restricted_api_key`** on `GET /domains` and `GET /emails/{id}` while `POST /emails` works fine. **A 401 on those endpoints does NOT mean the key is invalid** — this was misdiagnosed as a revoked key during this session. To test the key, attempt an actual send; to read delivery status, use the dashboard (the API key cannot).
2. 📮 Verified working config, for reference: `EMAIL_FROM = Earn4Insights <support@earn4insights.com>`, domain `earn4insights.com` verified, key valid for send. A probe to that address returned `200 {"id":"292afccf-…"}`.

### Unrelated inconsistency spotted

`NEXT_PUBLIC_APP_URL = https://earn4insights.com` (no `www`), while `CLAUDE.md` §2 states production is **always** `www.`. Password-reset links are built from this var, so they currently hit a redirect. Harmless for a GET but worth aligning.

---

## ✅ Silence gate VERIFIED IN PRODUCTION (2026-08-02)

Founder tested against `earn4insights.com` after clearing the Resend suppression that had blocked the password reset:

- **Live level meter works** — moves with real mic input.
- **Muted audio is rejected** — the silence gate fires and the take is discarded with the retry message.

This closes the "not verified in a browser" caveat on `68bd1d3` for the **audio** path. The peak-`0.015` threshold and the fail-open behaviour are therefore confirmed working against a real microphone, not just typechecked.

**Still unverified in a browser** (carried forward, do not mark done):
- **Video WARN path** — that a silent video is *kept* with an amber warning rather than rejected. This is the asymmetry the founder specifically asked for, so it is the one most worth confirming.
- **Blob proxy playback + seeking** — Range forwarding is new code that has never met a real player.
- **Export click-to-download** — the data path, filters, escaping and security are all verified; the DOM download is not.

### How the account was unblocked

`vishweshwar@startupsgurukul.com` could not receive its password reset: the address was on **Resend's suppression list** after its mailbox went over storage and hard-bounced. Suppression does not lift itself once the mailbox is fixed — cleared via the Resend dashboard. A reset token was also minted directly (same scheme as `api/auth/forgot-password`: 32 random bytes, SHA-256 hash stored, 1h single use) to unblock testing while that was diagnosed.

That incident is what surfaced the email delivery-visibility gap recorded above.

---

## 🔔 Real-time loop: status-route IDOR closed + brand notification de-duplicated (2026-08-03)

Two fixes off the real-time-loop trace (which found 3 of the 4 claimed steps genuinely built — see the gap analysis in that trace).

### 1. `PATCH /api/dashboard/feedback/[id]/status` — live WRITE IDOR, closed

Verified a session existed, then updated by id with **no ownership check** — any authenticated user could mark any brand's feedback `addressed`. Same class as the `61b31af`/`e939199` batches; this route was outside that audit's scope.

Fixed with the established pattern: new `getFeedbackById()` in the repository (returns **only** id/productId/status — an ownership check has no business reading the consumer's text or contact details), then feedback → product → `owner_id`, admin bypass via `isAdminSession()`, **fail closed on a null owner**, **404 not 403** so feedback ids can't be enumerated.

### 2. Duplicate brand notification — de-duplicated, Chain A owns it

A brand received **~2 notifications and 2 activity-feed items per feedback** (3 when sentiment was negative). Two chains both targeted the product owner:

- **Chain A** — `alertOnNewFeedback` → `fireAlert`: `brand_alert_rules` matching (global + per-product), **ICP gating** via `minMatchScore`, **slack/whatsapp** channels, the **`brand_alerts` row** powering `/dashboard/alerts` + its sidebar badge, a distinct `negative_feedback` alert, then emits `BRAND_ALERT_FIRED` → `dispatchToUsers`.
- **Chain B** — `emit(CONSUMER_FEEDBACK_SUBMITTED)` → `getProductOwner` → the same `dispatchToUsers`. **No structural capability Chain A lacks** — only better copy and a more specific CTA.

**Chain A kept.** ⚠️ **The dangerous alternative was dropping Chain A's dispatch instead** — `BRAND_ALERT_FIRED` serves **every** alert type (`frustration_spike`, `high_intent`, …), so that would have silenced all of them. Do not "simplify" the alert dispatch away.

Chain B's two advantages were folded in rather than lost: `FireAlertInput` gained an optional **`ctaUrl`** threaded through the emit; the handler now prefers `payload.title` / `payload.ctaUrl`; `alertOnNewFeedback` points both alerts at `/dashboard/products/{id}/feedback` (where the brand acts) instead of the generic alerts page. `CONSUMER_FEEDBACK_SUBMITTED` had exactly one emitter, so removing it cost nothing; its handler remains for any future emitter.

⚠️ **Behaviour change to be aware of:** new brand notifications now carry inbox `type='brand_alert'` instead of `'feedback_received'`. Existing rows keep the old type. **Caveat: I did not exhaustively search for code filtering the inbox on `type === 'feedback_received'`** — none was found, but treat that as "not found", not "does not exist".

**Not verified end-to-end.** Typecheck proves it compiles, not that exactly one notification now arrives. `notification_inbox` currently holds `feedback_received × 2` and `brand_alert × 2` from production; a fresh submission should now produce **only** a `brand_alert` row — a clean checkable signal.

---

## 📋 FOLLOW-UP (not scoped) — `feedback.status='approved'`: the ingestion path accepts unvalidated status

**The 18 rows are the symptom, not the defect.**

Production holds **18 rows with `status='approved'`** and 5 with `new`. `approved` is **not** in `VALID_STATUSES` (`new | reviewed | addressed`). The PATCH route rejects it and `FeedbackStatusButton` can only send those three — so **no current app code path can write it**. `STATUS_CONFIG` has no `approved` key, so those rows fall back to displaying **"new" forever**, regardless of what a brand does.

**The real defect: an ingestion path — most likely `/api/import/csv` or the webhook routes — almost certainly writes `status` straight through with no validation against `VALID_STATUSES`.** (Suspected, not yet confirmed — confirming it is part of the follow-up.)

⏰ **TRIGGER — fix the ingestion validation BEFORE brands import at volume.** "Bring your own customer data" is the core beta wedge, so that path is about to be heavily exercised. **Backfilling before fixing the source just means it recurs**, at greater volume and mixed in with real data.

Order of work when scoped: (1) confirm which ingestion path writes `status` and add validation/normalisation there; (2) *then* one idempotent `UPDATE feedback SET status='reviewed' WHERE status='approved'` — mapping `approved`→`reviewed` is the likely intent, worth a founder decision; (3) consider a DB-level CHECK constraint so the schema enforces the enum rather than relying on every writer.

---

## 🔗 Migration 033 — `feedback.user_id` FK + the PII scrub + import corruption fixes (2026-08-04)

The keystone change: `feedback` had no link to `users`, which simultaneously blocked GDPR erasure, demographic filtering, and the resolution loop.

### 🔴 LIVE data-loss exposure found and closed (not hypothetical)

While designing the FK policy, `process-deletions` turned out to be doing this:

```ts
await db.delete(feedback).where(eq(feedback.userEmail, user.email))
```

**A hard DELETE of every feedback row matching the deleted user's email.** That means the CASCADE danger raised in the FK discussion **was already live via this code path** — it did not need the FK to exist:

- Deleting **any** consumer destroyed feedback a brand paid to collect, rather than anonymising it.
- Worse, `api/import/csv` fell back to `session.user.email` when a CSV had no email column, so **all 18 imported production rows carried the importing BRAND's address**. Deleting that brand account would have **deleted 18 rows of third-party feedback that merely inherited their email**.

**Now closed** — replaced with a scrub (`userName`/`userEmail` → NULL), which is safe in both cases: where the email was wrong it removes a wrong email, and it never destroys content that isn't the erased user's to delete. `user_id` is deliberately NOT set here — 033's `ON DELETE SET NULL` does it automatically, and doing it by hand would break if the code deployed before the migration ran.

`survey_responses` keeps its hard-delete for now: no ingestion path, and 66 of 69 production rows carry no email at all. Revisit if it ever gains an import route.

### ⚠️ `ON DELETE SET NULL` — FOUNDER-APPROVED deviation from migration 031

031's triage says **PII → CASCADE**, and feedback text is consumer PII, so the rule points at CASCADE. **033 deliberately uses SET NULL instead. Do NOT "consistency-fix" this back.**

Reason: feedback is analytics a brand paid for; CASCADE destroys it on one consumer's erasure. Precedent exists in 031 itself under *"analytics (retain anonymised)"* — `user_events.user_id`, `analytics_events.user_id`, `products.owner_id` are all SET NULL.

⚠️ **SET NULL alone is NOT erasure** — `user_name`/`user_email` remain plain text on the row. The `process-deletions` scrub is the other half. **Both are required; neither is sufficient.**

### Backfill is PROVENANCE-AWARE — the headline number was a trap

A naive email join reported **"23/23 backfillable (100%)"**. That was **dangerous**: 18 of those 23 carry the importing brand's own email, so a plain backfill would have made the brand the author of third-party feedback on its own product, fed the brand's demographics into consumer segmentation, and (once the resolution loop ships) notified the brand that its own feedback was addressed.

033 backfills **only** `WHERE multimodal_metadata->>'importSource' IS NULL`. Real coverage is **5 of 23 (~22%)** — and that is the honest number. Imported rows stay NULL because those respondents genuinely are not platform users.

✅ **Verification signal when running 033:** the route returns a coverage line. It must read **`linked=5 imported=18`**. If it reads `linked=23`, the provenance filter failed and mis-attribution happened — stop.

**NEVER add NOT NULL to `user_id`.** Import is the core beta wedge, so NULL is the dominant case, not an edge case.

### Import corruption — all THREE ingestion paths were writing bad data

| Path | Was | Now |
|---|---|---|
| `import/csv` | `status:'approved'` (not in `VALID_STATUSES`), `userEmail` fell back to **`session.user.email`** | `status:'new'`, `userEmail: entry email or NULL` |
| `import/webhook` | `status:'approved'`, synthetic `${source}@webhook.import` email, **no `importSource` at all** | `status:'new'`, NULL email, **`importSource` added** |
| `import/webhook/v2` | `status:'approved'` | `status:'new'` |

Fixing only `import/csv` would have left corruption flowing through the other two. **The missing `importSource` on webhook v1 was the essential catch — without it, webhook-ingested rows look organic to 033's provenance filter, so a respondent's email could be linked to an unrelated platform account that happens to share it.**

`status='approved'` was never "unvalidated passthrough" as first suspected — it was a **hardcoded literal in our own code**, in all three paths. Those rows have no `STATUS_CONFIG` key so they rendered as "new" forever and could not be moved through the review workflow. `scripts/backfill-feedback-approved-status.ts` repairs them (`approved`→`new`), **to be run only after the ingestion fixes deploy**, or it recurs.

### ⏱️ ORDERING DEPENDENCY — migration must precede the new code paths

Three call sites do a **bare `db.select().from(feedback)`**, which Drizzle expands to every column in the schema, now including `user_id`:
`api/user/export-data/route.ts:56` · `server/analytics/unifiedAnalyticsService.ts:458` · `server/dsarService.ts:283`

So once the code deploys, those three **500 until the column exists**. The migration route itself ships *with* that code, so the safe sequence is either (a) apply the `ALTER TABLE` in the Neon console first, then deploy, leaving the route as an idempotent confirming no-op, or (b) deploy and run 033 immediately, accepting a brief window where DSAR export / unified analytics error. Option (a) has no window.

### ✅ APPLIED 2026-08-04 via the **Neon console**, not the migration route (Option A)

The ordering dependency above was resolved by taking **Option (a)**: the DDL + backfill were pasted
into the Neon SQL editor **before** `ffe606b` deployed, so `feedback.user_id` existed the moment the
new schema shipped and the three bare-`select` paths never had a window to 500.

Applied, in order, with these results:

| Statement | Result |
|---|---|
| `ALTER TABLE feedback ADD COLUMN IF NOT EXISTS user_id TEXT` | column added |
| provenance-aware `UPDATE … WHERE importSource IS NULL` | **UPDATE 5** ✅ |
| `ADD CONSTRAINT fk_feedback_user … ON DELETE SET NULL` | created |
| `CREATE INDEX … idx_feedback_user_id` (partial) | created |

Verified: **total 23 · linked 5 · unlinked 18** — exactly the provenance split predicted above.
The 5 organic rows are linked; the 18 imported rows are correctly left NULL rather than
mis-attributed to the importing brand.

⚠️ **So `POST /api/admin/run-migration-033` was NOT the applying mechanism.** A future session
reading the migration index must not assume the route ran. Re-running it is still safe and still
useful — every step is idempotent, the backfill is scoped `WHERE user_id IS NULL` so it reports
`0 row(s) linked`, and step 5 re-prints the coverage line as an independent confirmation.

### 🐛 Follow-on defect in `ffe606b` — migration routes need a MIDDLEWARE ALLOWLIST entry

`ffe606b` added the route but not its path to `PUBLIC_API_ADMIN_PATHS` in `src/middleware.ts`.
That set is a **deliberate exact allowlist** (from security batch B1–B9) so a new
`run-migration-*` route is not silently public until someone adds it — correct policy, but it means
**a missing entry makes the route unreachable**: middleware returns `401 {"error":"Unauthorized"}`
*before* route resolution, for a correct `x-api-key` exactly as for a wrong one.

That failure is **indistinguishable from a bad key**, which is what makes it worth writing down —
the natural next move is to go re-check `ADMIN_API_KEY`, which is not the problem. Diagnostic that
identifies it: probe a migration number that **doesn't exist** (e.g. `run-migration-034`). If that
also returns `401` rather than `404`, the 401 is coming from middleware, not from the handler.

**Rule: creating `run-migration-NNN` is a TWO-file change** — the route *and* the allowlist entry.

---

## 🔁 The resolution loop — step 4 of the "three-way connection" (2026-08-04)

Closes the last missing leg of the core platform claim: consumer submits → brand notified
in real time → brand acts → **the consumer finds out**. Steps 1–3 were built; step 4 had no
event, no handler and no trigger — the status route updated the DB and returned.

Migration 033 supplied the missing identity (`feedback.user_id`). Migration 034 supplies the
delivery bookkeeping. New event `consumer.feedback.addressed`.

### 🔴 B1 — the 033 FK was INERT: nothing populated `user_id` going forward

`api/feedback/submit/route.ts` inserted `user_name` and `user_email` from the session but
**not `user_id`**. 033 created the column and linked 5 historical rows; every *new*
submission still landed NULL.

So before this fix the loop would have reached **5 legacy rows and zero future ones**, and
the coverage number could only ever go down as a proportion. The submit route is the ONLY
path that can populate it — the three import paths write third-party respondents who have no
platform account and stay NULL by design.

**Lesson: adding a column + backfill is not the same as adding a column, backfill, AND the
write path.** 033 was signed off on the backfill number without anyone checking that new rows
would populate it.

### 🔴 B2 — LIVE mis-attribution bug found and fixed (independent of this feature)

`/api/feedback/my` resolved "my feedback" as `WHERE feedback.user_email = session.user.email`.

Because `api/import/csv` used to fall back to `session.user.email` for CSVs with no email
column, **all 18 imported production rows carry the importing brand's address**. Verified live:

| email | rows | linked | imported | role |
|---|---|---|---|---|
| `vishweshwar981+brand@gmail.com` | **18** | 0 | 18 | **brand** |
| `vishweshwar@startupsgurukul.com` | 4 | 4 | 0 | consumer |
| `pooranprasad@gmail.com` | 1 | 1 | 0 | consumer |

That brand account's **My Feedback page was listing 18 pieces of third-party consumers'
feedback as its own** — other people's words, ratings and sentiment, presented as theirs.
This was not a latent risk; it was rendering in production.

Now matched on `user_id`, which also correctly empties that brand's page. This was found while
tracing the loop's CTA target — a wrong match there would have sent a consumer to a page
showing someone else's feedback — but it is **a bug fixed, not merely a prerequisite**.

### ⚖️ FOUNDER-APPROVED consent carve-out — `bypassPersonalizationConsent`

`dispatchToUser` skips any **consumer** without `personalization` consent. Correct for the
events it normally gates (product launches, discounts, ICP-matched suggestions — all target a
consumer by inferred traits). **Wrong for this one:** it reports the outcome of the consumer's
OWN submission to the person who submitted it. No inference, no targeting, no audience — the
recipient is `feedback.user_id` and nothing else. Under **DPDP §7** that is service
communication in performance of the exchange the consumer entered when they submitted feedback
for reward points.

Without the carve-out, the most privacy-conscious consumers — the ones who actually read the
consent screen — would silently never learn a brand acted on their feedback, which is the whole
product promise.

⚠️ **Deliberately NARROW. One event type sets it.** The rejected alternative was relaxing the
global gate, which would have quietly reclassified every marketing event as service. **Do not
"consistency-fix" this away, and do not set the flag on a new event without the same analysis.**
The test: *is the recipient derived from their own prior act, or selected from an audience?*

### Notify ONCE per feedback item — by conditional claim, not by reading `status`

`claimResolutionNotification()` does:

```sql
UPDATE feedback SET resolution_notified_at = now()
WHERE id = $1 AND resolution_notified_at IS NULL RETURNING id
```

and the route emits only if a row comes back. Reading `status <> 'addressed'` in app code
**races** — two brand tabs, a double-click on the status dropdown, or a retry all read the
pre-update value and each send. Same claim-by-conditional-update shape as the scheduled-launch
cron guard (`WHERE launch_status = 'scheduled'`).

Result: `addressed → new → addressed` notifies **once, forever**. `resolution_notified_at` is
also the only durable answer to "was this consumer ever told?" — `notification_inbox` cannot
answer it, since its rows carry `expires_at` and are not written at all when in-app is off.

### Trigger: `addressed` only, and only the TRANSITION

`reviewed` deliberately does not notify — it means someone read it, which is not an outcome,
and `my-feedback` already shows that badge passively. Also: `FeedbackStatusButton` is a flat
dropdown, so a natural `new → reviewed → addressed` would have fired twice for one act of
attention.

### Four deliberate SILENT SKIPS (each is normal, none is an error)

1. status is not `addressed` · 2. previous status was already `addressed` ·
3. `user_id IS NULL` (imported rows — **18 of 23 today**) ·
4. `user_id === product.owner_id` (a brand's own feedback on its own product).

⚠️ **A quiet loop is the expected result when testing against imported data.** Real reach today
is 5 rows across 2 consumers.

### Brand note — column shipped, feature deliberately NOT in v1

`resolution_note` exists (034) and the copy has a slot for it, but **nothing writes it**. It
would be the first user-generated content travelling **brand → consumer**, rendered in-app AND
in email, and that needs a real moderation design rather than a textarea. Founder-approved as
Phase 2; shipping the column now makes Phase 2 UI-only, no migration.

### ⚠️ Notification preferences — enforced but UNREACHABLE. Not shipped.

`dispatchToUser` genuinely consults `getPreference` before every channel, so a stored preference
is honoured, and the new event type is in the `NotifiableEventType` union. **But no page in the
app calls `/api/notifications/preferences`** — there is no settings UI for per-event controls.
Every user is on the defaults (in-app ✓ / email ✓ / SMS ✗) with no way to change them.

**Do not record "respects notification preferences" as a shipped capability.** It is true in the
plumbing and unreachable in practice — precisely the kind of claim the v15 claims policy exists
to stop.

### ⏱️ Email is NOT immediate — `process-notifications` is a DAILY cron

In-app bell + Pusher fire sub-second. The email is queued and drained by
`/api/cron/process-notifications`, scheduled **`0 6 * * *` (06:00 UTC daily)** in `vercel.json`.
Trigger it manually with `Authorization: Bearer $CRON_SECRET` to test without waiting. Note the
open delivery-visibility gap still applies: `sent` means Resend accepted the call, not delivered.

### ✅ VERIFIED IN PRODUCTION — 2026-08-04 12:52 UTC

Deployed as `1f22751` (Vercel auto-deploy on push). Columns applied via the **Neon console before
the deploy** (Option A, the same zero-downtime path as 033) — the three bare
`db.select().from(feedback)` sites would otherwise have 500'd between deploy and migration.
`POST /api/admin/run-migration-034` was then re-run as a confirming no-op.

Column definitions independently checked before testing — all three nullable, **no default**:

| column | type | nullable | default |
|---|---|---|---|
| `resolution_notified_at` | `timestamp` | YES | none |
| `resolution_note` | `text` | YES | none |
| `user_id` | `text` | YES | none |

⚠️ **The absent default on `resolution_notified_at` matters.** A `DEFAULT now()` would have marked
all 23 existing rows already-notified and permanently suppressed the loop for every one of them,
silently and irreversibly.

Baseline before the test: `total=23 reachable=5 addressed=0 already_notified=0`.

**Test:** feedback `a5644db9-7bd1-4ff5-9749-f3a244798519` ("it's great product which helps to
acheive my goal step by step") on product *Step by step*, marked Addressed by the owning brand
`vishweshwar98765@gmail.com`; author `vishweshwar@startupsgurukul.com`. Deliberately NOT tested on
`19f1f02a…` — that row belongs to `pooranprasad@gmail.com`, the genuine external user from the
Blob incident, and would have sent a real stranger a real email.

**Every layer left exactly ONE trace, all within 130ms:**

| layer | evidence |
|---|---|
| `feedback` | `status='addressed'`, `resolution_notified_at = 12:52:40.457` |
| `notification_inbox` | 1 row, `type='feedback_addressed'`, title *"The brand acted on your feedback 🎉"*, `cta_url=/dashboard/my-feedback?highlight=a5644db9…`, **`is_read=true`** |
| `notification_queue` | 1 row, `channel='email'`, `status='pending'` |
| `realtime_events` | `target_entity_type='feedback'`, `target_entity_id=a5644db9…`, `processed_at` set |

Confirmed by that evidence:
- **Notify-once held** — one row in each table, not two.
- **`is_read=true`** means the founder actually opened it: the bell item and the deep link work,
  not just the DB write.
- **`realtime_events` points at the FEEDBACK row**, not the product — the `resolveEntityType` /
  `resolveEntityId` override landed. Without it the audit trail would have identified only which
  product was involved, not which item was resolved.
- **Email correctly `pending`** — `process-notifications` is a **daily `0 6 * * *` cron**, so the
  email is queued, not sent. Not a failure; drain it manually with
  `Authorization: Bearer $CRON_SECRET` when testing. ⚠️ And `sent` would still only mean Resend
  accepted the call — the delivery-visibility gap is unchanged.

**Not yet exercised** (all non-blocking):
- the `addressed → new → addressed` toggle (the claim guard is proven by construction and by the
  single row, but not by an actual second click)
- the admin-bypass path — `feb710e7…` and `3e668c78…` sit on products with a NULL `owner_id`, so
  no brand can reach them and only an admin can fire the loop there
- the delivered email itself
- B2's visible fix: the `vishweshwar981+brand@gmail.com` My Feedback page should now be **empty**
  where it previously listed 18 strangers' feedback

### PowerShell gotcha when calling admin routes

`curl -X POST … -H "x-api-key: $ADMIN_API_KEY"` **fails in PowerShell 5.1** — `curl` is an alias for
`Invoke-WebRequest`, which rejects `-X`/`-H`, and `$ADMIN_API_KEY` is bash syntax (PowerShell needs
`$env:`). Either use `curl.exe` to bypass the alias, or go native:

```powershell
$key = ((Get-Content .env.local) -match '^ADMIN_API_KEY=')[0] -replace '^ADMIN_API_KEY=','' -replace '"',''
$r = Invoke-RestMethod -Method Post -Uri 'https://www.earn4insights.com/api/admin/run-migration-034' -Headers @{'x-api-key'=$key}
$r.results | Format-Table step,status,detail -AutoSize
```

### Checking whether a commit is actually deployed

Vercel auto-deploys on push to `main`, so there is no deploy step to run — but confirming it is
awkward because `vercel ls` needs a CLI login the local machine doesn't have. Probe instead:

```bash
curl -s -D - -o /dev/null -X POST -H "x-api-key: probe-invalid" \
  https://www.earn4insights.com/api/admin/run-migration-NNN | grep -i "x-mw"
```

`X-Mw-Decision: redirect` = middleware blocked it (route missing from the allowlist, or not
deployed). `X-Mw-Decision: continue` = the request reached the handler, so the code is live and the
401 is just the route rejecting the bad key.

---

## 🔒 The AI Feedback Summary leaked verbatim consumer feedback — found pre-pitch, closed (2026-08-06)

Found while checking whether the positioning line *"feedback goes privately to the brand, not
publicly like Amazon reviews"* was actually true before pitching it. It was **partially true**, and
the false part was precisely the part a competitor cares about.

### What was leaking

`/api/analytics/public-summary/[productId]` had **no auth check** (its comment said *"Public route
— no auth required"*), **no ownership check**, **no MIN_COHORT_SIZE floor**, and
`Cache-Control: public, s-maxage=600`. `ProductHealthCard` mounted it **ungated** at
`ProductOverview.tsx:99` — the shared catalog page every role browses.

`generatePublicSummary()` returned verbatim consumer text in two fields: `recentHighlights`
(100 chars × 3) and `example` on each of topPraise/topConcern/emergingIssue (120 chars).

**Actual strings it was serving in production** — pulled from `extracted_themes` before the fix:

> ⚠️ Top Concern — "Downtime issues" — 8 mentions
> *"Earn4Insights downtime is getting frustrating. Third time this month."*

> "Performance" — negative — 15 mentions
> *"StartupsGurukul has been having issues lately. Support response time is slow."*

> "Documentation" — negative — 6 mentions
> *"Had a bad experience with StartupsGurukul integration. Documentation is lacking."*

Readable by **any logged-in user for any product id** — a competing brand, any consumer, any
influencer. And `/dashboard/products` lists every product (already logged in §11 as making ids
enumerable), so nothing had to be guessed.

### It broke three specific sentences of the published privacy policy

| Policy text | Was | Now |
|---|---|---|
| brands receive insights "aggregated and anonymized" | ❌ verbatim excerpts | ✅ non-owners get zero verbatim |
| shown "only above a minimum group size" | ❌ no floor on this path | ✅ MIN_COHORT_SIZE=5, twice |
| content visible only to the brand it was submitted to | ❌ any logged-in user | ✅ owner/admin only |

### The fix — viewer scope, not a 404

`generatePublicSummary(productId, scope)` where `scope` **defaults to `'public'`**, so a caller
that forgets to pass one leaks nothing.

- **owner/admin** → aggregates **+** verbatim quotes + recentHighlights. The consumer submitted to
  that brand; the brand reading their words is the interaction working as designed.
- **everyone else** → theme NAME + mention count + sentiment counts + total. `example` is `null`,
  `recentHighlights` is `[]`. **A theme name is an abstraction over many rows; a quote is one
  identifiable person's words. That is the line.**

⚠️ Deliberately **NOT** a 404 for non-owners, unlike the `/feedback` and `/themes` gates. The
aggregate view is legitimate product information on a shared catalog page, so the payload degrades
instead of the request failing. **The security property lives in the SCOPE, not the status code** —
don't "consistency-fix" this into a 404 gate.

`MIN_COHORT_SIZE` applies **twice** for non-owners: the whole summary is suppressed under 5 total
(on a 2-row product, "1 negative" plus a date is one identifiable person), and per-theme, so a
2-mention theme can't single out a small group. Owners are not floored — it's their own product's
feedback.

`Cache-Control` → `private, no-store`. **This was load-bearing:** the body now differs per caller,
so the old `public, s-maxage=600` would have let a CDN cache an owner-scoped response (with quotes)
and serve it to the next non-owner, defeating the gate entirely. `/api/analytics/health-score` got
the same header — it's aggregate-only so there was no known leak, but it's an authenticated
response and the two routes shouldn't drift.

### Mock products were publicly serving fabricated reviews

`/public-products/prod_001` and `prod_002` were **live, HTTP 200, in the middleware public
allowlist** — anonymous visitors and crawlers could read invented reviews under invented human
names (Alice Johnson, Bob Williams, Charlie Brown) with invented **`Authenticity: N%`** scores, plus
fabricated social-mention engagement counts. The page also rendered a stub form that alerted
*"Feedback submitted (mock)."* and stored nothing.

No real consumer's privacy was affected — but it is content presented as real that isn't, the same
class as the false pricing claims cut in `92f7d7b`. Now gated on `NODE_ENV !== 'production'`
(blocked, not deleted, so local dev keeps the fixtures). The listing page empties in production
too, or it would have rendered a public grid of cards that all 404. The demo form's copy was
corrected regardless of reachability.

### Consent copy reconciled to ONE source

Three surfaces said three different things; one implied a public review site:

| Surface | Was |
|---|---|
| `/dashboard/submit-feedback` | **silent on visibility entirely** |
| `/submit-feedback` + `[productId]` | "may be shared with the product's brand" |
| the mock form | "**Help other users discover quality products**" |

Now all import `lib/feedback/visibilityNotice.ts`:

> **Who sees your feedback** — Your feedback goes to this product's brand. They can see what you
> wrote, your name, and any recordings or photos you attach. Everyone else on Earn4Insights sees
> only anonymised aggregates — overall sentiment and common themes — never your words or your
> identity.

Every clause is checked against the code in that module's header. ⚠️ **If the summary scope ever
changes, that text becomes a false claim** — under the §5 claims policy an unqualified statement in
the submission flow is contractual, because the consumer relies on it when deciding what to write.

**TEXT feedback is now covered for the first time** — it had no disclosure of any kind, despite
being the most common submission type, while the media checkboxes named the brand. Shown as a
prominent panel *before* the form rather than a fourth required checkbox: the media consents are
separately revocable categories, whereas visibility applies to 100% of submissions and is notice,
not a per-category choice. **Founder's call if they want it as a blocking checkbox instead.**

### Still true after the fix — the honest residue

- **Theme NAMES remain visible to non-owners** ("Downtime issues", "Documentation", 8 mentions).
  That is the deliberate design and matches the policy's "aggregated" wording, but a theme name is
  still derived from content. A competitor learns *that* a product has a documentation problem, not
  what anyone said about it. **Founder-approved as the useful/safe split.**
- **Any logged-in user can still read aggregates for any product id.** No per-product access
  control on the aggregate view, by design.
- **Health score is readable for any product by any logged-in user** — aggregate-only (score,
  grade, trend, weighted breakdown, counts), no verbatim content, no cohort floor applied.
- The **breach question does not arise**: leaked strings were feedback text without names or
  emails, and no evidence exists of anyone having read a competitor's summary. Not a determination —
  recording it as unassessed, same posture as the Blob incident's external-user question.

---

## 📧 Email delivery truth — migration 035 + the Resend webhook (2026-08-10)

**Item 1 of 5 in the "real users are arriving" wave.** The gap logged on 2026-08-02 as a
known issue was re-assessed and promoted to blocking: with zero users it was a metrics-quality
problem; with real consumers onboarding it is a **silent onboarding-failure machine**.

### Why it blocks users, not just metrics

`notification_queue.status='sent'` only ever meant *Resend accepted the API call*. A suppressed
recipient returns **HTTP 200** and is dropped silently. Because email verification is a **HARD
BLOCK on feedback submission** (EV.1), the chain is:

> suppressed address → verification mail never lands → user cannot verify → user cannot submit
> feedback → user looks merely inactive to us → we never find out.

### 🔎 Diagnostic first — can Resend tell us who we've already lost? **NO.**

Probed every read endpoint with the production key:

| endpoint | result |
|---|---|
| `GET /domains` | 401 `restricted_api_key` |
| `GET /emails` | 401 `restricted_api_key` |
| `GET /api-keys` | 401 |
| `GET /audiences` | 401 |

*"This API key is restricted to only send emails."* ⚠️ **Expected — this does NOT mean the key is
dead.** `POST /emails` works. But it means **historical bounce data cannot be recovered
programmatically**. The only sources are (a) the Resend dashboard → Emails/Logs, read by a human,
or (b) a new full-access key, which does not exist yet.

**`email_deliveries` therefore starts empty and fills from the webhook forward. There is no backfill.**

### What our own data showed (2026-08-10)

- `notification_queue`: **23 email rows, all `sent`, zero `failed`** — the textbook symptom.
- **18 of 29 users unverified.** brand 6/15 verified · influencer 1/7 · consumer 4/5 · admin 0/2.
- Real external accounts unverified: `waleharshit@gmail.com` (brand, 08-02),
  `atharv.bhute18@gmail.com` (influencer, 08-01), `sanketsable51@gmail.com` (consumer, 08-01),
  `vikas.khude@gmail.com` (brand, 07-15), `atharva@invsel.in` (brand, 07-07).
- **Clearest single case:** `waleharshit@gmail.com` had a token **issued 08-02 and never used** —
  didn't arrive, or arrived and ignored, and *that distinction is exactly what we could not make.*
- ✅ **Counter-evidence the domain is not broken:** `info@neptonhq.com` was issued a token on
  08-03 and **used it**. Delivery works for at least some recipients.

⚠️ **Caveat: only 4 users have ANY verification-token row.** A daily cron deletes expired tokens,
so **absence of a token row is not evidence that no email was sent.** History can't be
reconstructed from this table either.

### What shipped

**Migration 035 — two tables, additive, idempotent.**

- **`email_deliveries`** — one row per send, keyed on Resend's `provider_message_id` (partial
  UNIQUE, since Resend can redeliver events). Statuses: `accepted` (what `sent` used to mean) ·
  `delivered` · `bounced` · `complained` · `delayed` · `suppressed` · `failed`.
- **`email_suppressions`** — bounced/complained addresses, PK on lowercased email, idempotent
  upsert that preserves `first_seen_at` so "how long has this been broken?" stays answerable.

⚠️ **Deliberately NOT columns on `notification_queue`.** The verification email
(`emailVerificationService`) and all six influencer-verification emails
(`influencerVerificationEmailService`) call Resend **directly and never touch the queue** — so
queue columns could never have covered the most important email on the platform. All **three**
send paths now write to `email_deliveries`.

**`/api/webhooks/resend`** — Svix signature verification written directly against `node:crypto`
(~15 lines) rather than adding the `svix` package: a dependency in the request path of a public
unauthenticated endpoint is a supply-chain surface we don't need. 5-minute replay window,
constant-time compare, accepts any of several `v1,` signatures for secret rotation.

⚠️ **Fails closed (503) when `RESEND_WEBHOOK_SECRET` is unset.** `/api/webhooks/` is already in
`PUBLIC_PREFIXES` *and* `CSRF_EXEMPT_PREFIXES`, so **this route's signature check is its entire
access control** — an unsigned version would let anyone suppress any address and cut off their
email. No middleware change was needed, which is precisely why that's worth writing down.

**Suppression is enforced, not just recorded.** All three senders check `isEmailSuppressed()`
first. Recording a bounce and continuing to send is pointless — every further attempt degrades the
sending domain's reputation for **every other user**, which is how one bad address becomes
platform-wide delivery failure. Suppressed sends are **recorded with `status='suppressed'`, never
silently dropped**, so a stuck user is visible.

⚠️ **`isEmailSuppressed` FAILS OPEN by design** — on any error it returns false and we send. A
suppression check that failed closed would silently block real users: the exact failure this
feature exists to eliminate. Everything else in the repository is non-fatal too: observability
breaking must never become the reason an email doesn't send.

**Bug fixed in passing:** `sendEmail` destructured only nothing from `resend.emails.send()` and
**discarded the `error` return entirely**, then the caller marked the row `sent`. A Resend-side
rejection was recorded as a success. Now recorded and rethrown, so the existing retry/backoff
actually applies.

**Both hard and soft bounces suppress.** Resend doesn't reliably distinguish them in the payload,
and the asymmetry is deliberate: over-suppression is recoverable (`unsuppressEmail`),
under-suppression silently burns domain reputation.

**`scripts/email-delivery-report.ts`** — the read side. Suppressed addresses, verification-email
outcomes by type, and unverified users **cross-referenced against suppressions**, which is what
finally separates "never received it" from "ignored it".

### ⚙️ REQUIRED after deploy — the feature is inert until both are done

1. **Resend dashboard → Webhooks → Add endpoint**
   `https://www.earn4insights.com/api/webhooks/resend`
   events: `email.delivered`, `email.bounced`, `email.complained`, `email.delivery_delayed`
   (`email.sent` optional — we already record `accepted` at send time)
2. **Set `RESEND_WEBHOOK_SECRET`** (`whsec_…`) in Vercel, Production scope, then redeploy.
   ⚠️ Env changes only bind on a *fresh deploy after the save* — see the `CSRF_ENFORCE` gotcha.
   Until it's set the route returns **503** and delivery state stays blind.

### Open after this

- **No admin UI** — visibility is the script plus direct SQL. Deliberate: a page was scope the
  founder didn't ask for, and the script answers the question today.
- **No historical backfill is possible** (send-only key). Pre-035 bounces exist only in the Resend
  dashboard.
- **Not yet verified end-to-end** — needs a real webhook delivery from Resend after setup. The
  signature verification in particular has never met a real Svix payload.

---

## 🔔 Notification preferences — the UI, and two bugs it exposed (2026-08-10)

**Item 2 of 5.** The controls were enforced in `dispatchToUser` from the day the real-time layer
shipped, but **no page called the API**, so every user was pinned to the defaults
(in-app ✓ / email ✓ / SMS ✗).

**Why it pairs with item 1:** the only way a consumer could stop email was to press **spam** —
which suppresses their address at Resend, silently breaks their *verification* email (a hard block
on feedback submission), and degrades the sending domain for every other user. The missing opt-out
was actively manufacturing the suppressions the new webhook now detects. It is also a **DPDP
withdrawal-of-consent obligation** that was not being met with live users.

### 🐛 Bug 1 — partial updates silently reinstated withdrawn consent

`upsertPreference`'s conflict branch wrote `prefs.x ?? DEFAULT_EVENT_PREFERENCE.x` for **all three**
fields, so any field the caller didn't mention was **reset to its default** rather than left alone:

> turn email OFF → later toggle anything else → **email silently switches back ON**

A withdrawn consent quietly reinstated — precisely the obligation this feature exists to meet. The
bug survived because the function had **zero callers** until now. Fixed: the `set` object contains
only the supplied keys. Defaults still apply on INSERT, where they're correct.

### 🐛 Bug 2 — the API stored anything

`POST` cast any incoming string to `NotifiableEventType` and wrote it. A typo produced a permanent
row that `getPreference` would never match — so the user's choice did nothing while the UI reported
success. Now validated against a runtime set, and the whole request is rejected rather than
partially applied.

The union also covered only **16 of ~40** event types — every payment, deal, community and support
preference was untyped. Replaced with `NOTIFIABLE_EVENT_TYPES` (a `const` array; the type is derived
from it) so one declaration serves both compile-time and runtime.

⚠️ **Not imported from `PLATFORM_EVENTS`** despite being a duplicate list: `eventBus` imports
repositories, so the reverse import closes a cycle. Keep them in sync by hand.

### Design decisions worth keeping

- **Categories, not ~40 raw event strings.** The table is keyed on exact event strings, but
  `influencer.milestone.completed` is not a choice a human makes. Each category writes every event
  it covers in **ONE request**, so a category can't end up half-applied if the tab closes.
- **A category reads as ON only when EVERY event in it is on.** Mixed state renders as off, so one
  flip re-syncs the group instead of leaving it ambiguous.
- **NO SMS toggle.** `sendSMS` in `notificationService` is a stub that **throws**
  (`'SMS not yet implemented'`). A switch would be a control that silently does nothing — the exact
  false affordance the §5 claims policy exists to stop. Add it when SMS ships.
- **Categories with no emitter are omitted.** `brand.member.active` and `brand.discount.created`
  have handlers wired but nothing emits them (CLAUDE.md §11), so a toggle would govern
  notifications that can never arrive.
- **Optimistic updates with rollback on failure** — a settings switch that lags reads as broken,
  but a switch that stays flipped after a failed save is a lie on screen.
- **Email verification and password reset are deliberately NOT gated** by these preferences. Both
  call Resend directly rather than going through `dispatchToUser`; otherwise an opted-out user
  would be locked out of their own account. **The UI says so explicitly** — that sentence is a
  claim, and it is true only while those two paths bypass `dispatchToUser`.

### ⚠️ Schema drift found

`notification_preferences` has `UNIQUE(user_id, event_type)` in the database (created by migration
005) but **that constraint is not declared in `schema.ts`**. `onConflictDoUpdate` depends on it and
works because Drizzle emits the target from the column list and Postgres resolves it against the
real constraint. Harmless today; would bite anyone rebuilding the schema from `schema.ts` alone —
including the fresh test environment in item 3.

### Not verified

Browser-untested (local login is still broken — item 3). Specifically unproven: the optimistic
toggle + rollback path, and that a saved opt-out actually suppresses the next email end-to-end.
The latter is worth one real check after deploy: turn off "When a brand acts on your feedback",
re-fire the resolution loop, and confirm no row lands in `notification_queue`.

---

## 🧪 Test environment groundwork — migration 036, env-check, local login (2026-08-10)

**Item 3 of 5.** Mostly Vercel/Neon/Razorpay dashboard work, which is the founder's to do. What
shipped is the code that makes that work **correct and verifiable** rather than assumed, plus the
local-login fix.

### 🔴 Hazard found while looking at `.env.local`

Local dev points at the **production Neon database**, with **LIVE Razorpay keys** (`rzp_live_…`)
and the live Resend key. **Local dev is not a sandbox — it is production with a different
frontend.** That was survivable only because login didn't work; fixing login (below) removes the
accident barrier. A click in local dev can now charge a real card, email a real person, or delete
real data.

**Point `.env.local` at the preview Neon branch and `rzp_test_` keys as soon as they exist.**

### Local login — fixed

`AUTH_URL` in `.env.local` was `https://earn4insights.com`. `trustHost: true` is set in both
`auth.config.ts` and `auth.edge.ts`, so NextAuth would otherwise take the host from the request —
but an explicit `AUTH_URL` **overrides** that, and an `https://` URL makes NextAuth mint `Secure`
cookies, which a browser will not send over plain-HTTP localhost. Login was therefore impossible
locally, which is the root cause of most of the **"not verified in a browser"** backlog
(Blob proxy seeking, the export download path, the video WARN path, the summary scope fix, the
notification-preference toggles).

Now `AUTH_URL="http://localhost:9002"`. Revert with `AUTH_URL="https://earn4insights.com"`.
`.env.local` is gitignored; no backup file was left in the repo (a copy of secrets sitting
untracked in the working tree is worse than retyping one line).

### Migration 036 — parity for a fresh database

Both objects exist in production but in **no numbered migration**, so a database built from the
migration routes alone — which is exactly what a fresh preview environment is — would lack them:

1. **`brand_subscriptions`** — created historically by `drizzle push`, then FK'd by migration 031
   (which landed, so it must exist in prod). The only table of ~30 with no CREATE route.
   `getBrandSubscription` is called on two live brand feedback pages, so its absence breaks them.
   Also `ADD COLUMN IF NOT EXISTS feature_overrides` separately, in case an older prod table
   predates that column.
2. **`UNIQUE(user_id, event_type)` on `notification_preferences`** — created by migration 005, but
   never declared in `schema.ts`. `upsertPreference`'s `onConflictDoUpdate` **depends on it**:
   Drizzle emits the ON CONFLICT target from the column list and Postgres resolves it against the
   real constraint. Without it every preference save throws *"no unique or exclusion constraint
   matching the ON CONFLICT specification"* — and the settings UI shipped in this same wave, so a
   fresh env would have had a completely broken settings page. No-op on prod, safety net elsewhere.

### `/api/admin/env-check` — the control that replaces guesswork

⚠️ **Vercel env vars default to "All Environments."** A preview deployment therefore inherits
production's database, blob store and **live payment keys** unless each variable is explicitly
scoped. The failure mode is not a crash — it is a preview deployment quietly **taking real card
payments against real data**. That is not something to verify by reading a dashboard list.

`GET /api/admin/env-check` (admin-key gated, in the middleware allowlist) returns a verdict plus
explicit warnings for:

- LIVE Razorpay keys on a non-production deployment ("a payment made here charges a real card")
- server/client Razorpay key **mode mismatch** (widget and verification in different environments)
- a database host that doesn't look like a branch
- a computed base URL still pointing at `earn4insights.com` — because `getAppBaseUrl()` prefers
  `NEXT_PUBLIC_APP_URL`, an inherited value means **verification links generated on preview point
  at production**, so the token is consumed against the wrong deployment and preview looks broken
- `CSRF_ENFORCE` not `true` in production
- `RESEND_WEBHOOK_SECRET` missing (item 1 inert)

⚠️ **It NEVER returns a secret** — presence booleans, key *mode* (`rzp_live_` vs `rzp_test_`, a
prefix not a key), and a database **hostname with credentials stripped**. Adding a field that
echoes a value would turn a diagnostic into a credential-disclosure endpoint. Keep it that way.

### `docs/PREVIEW_ENVIRONMENT_SETUP.md`

Full dashboard checklist: Neon branch, Razorpay test keys, a per-variable scoping table stating
**what specifically goes wrong if each is shared**, the migration loop (including "run 036"), the
`env-check` verification step, and the payment-rehearsal script whose step 4 — *does a
`campaign_payments` row exist?* — is the scoping input for the ledger fix.

Two entries worth remembering:
- **`BLOB_READ_WRITE_TOKEN` must differ** or preview uploads land in the production blob store,
  mixing test media into the set rotated after the 2026-07-31 incident.
- **`NEXT_PUBLIC_APP_URL` and `AUTH_URL` must be UNSET on preview**, not set — so `VERCEL_URL` wins.

### Still outstanding (founder's, dashboard-only)

Neon branch · Razorpay test keys · env scoping · run migrations against preview · `env-check`
clean · repoint `.env.local`. **None of the code above proves anything until `env-check` returns
`ok: true` on a real preview deployment.**

---

## ⏸️ Survey pause / stop — and five unauthenticated `'use server'` actions (2026-08-10)

**Item 4 of 5.** Surveys are **live-on-create**: `createSurvey` sets `status:'active'` and
immediately fans out email + in-app notifications to matched consumers. `toggleSurveyActive` had
**zero callers**, so a brand who published with the wrong product, a typo, or at the wrong moment
had **no way to stop it** — the notifications had already reached real inboxes.

### 🔴 Found while wiring it: every mutating survey action was unauthenticated

`src/server/surveys/surveyService.ts` is a `'use server'` file, so **every export is a
directly-invokable endpoint** — not just its button's callback. None of them checked anything:

| Action | What an arbitrary logged-in user could do |
|---|---|
| `deleteSurvey` | **destroy any brand's survey** by id |
| `updateSurveyQuestions` | rewrite the questions consumers are answering |
| `toggleSurveyActive` | pause/unpause any survey |
| `createSurvey` | create a survey on **any** product — which fans out email + bell to real consumers, i.e. a spam primitive aimed at our own users |

Same class as the `exportResponsesToCSV` hole closed in `61b31af`. **Wiring the toggle into the UI
without fixing this would have shipped a known hole**, so the batch was widened by one file.

Closed with the established pattern: a private `assertSurveyOwnedByCaller()` /
`assertProductOwnedByCaller()` as the **first statement** of every mutating action, survey →
product → `owner_id`, admin bypass via `isAdminSession()`, **fail closed on a null `owner_id`**,
and **ONE generic error** for every failure mode so survey ids can't be probed.

### 🔴 And: pausing did not actually stop anything

`/survey/[surveyId]` rendered the response form **regardless of status**, with only a
*"currently inactive… responses are for testing only"* banner. A Pause button on top of that would
have been a control that appears to work and doesn't — the exact false-affordance shape the §5
claims policy exists to stop.

Fixed in **both** halves, which is the point:

- **`submitSurveyResponse` now rejects `paused`/`closed`.** This is the enforcement. It's a
  `'use server'` action, so hiding the form would leave the endpoint open and anyone with the tab
  already loaded could keep submitting after Pause. **A control that only hides its own button is
  not a control.**
- **The page shows a plain "no longer accepting responses" panel** instead of a form. The courteous
  half: this link is *emailed*, so people arrive days later, and letting someone fill in a survey
  that the server will reject wastes their time.
- The `draft` banner survives but now says **"not published yet"** — the old wording would have
  been actively misleading for paused/closed, where responses aren't accepted at all rather than
  being "for testing".

### `isActive` ↔ `status` reconciled

`toggleSurveyActive(id, isActive: boolean)` → **`setSurveyStatus(id, status)`**.

`status` was already the source of truth — the repository's insert and update persist **only**
`status`, and `toSurvey` derives `isActive = (status === 'active')`. A boolean parameter had to be
translated into a status anyway and **could not express `closed` at all**. Taking the status
directly makes the writable surface and the stored value the same thing.

**`isActive` stays on the `Survey` type as a DERIVED, read-only convenience for rendering. Nothing
persists it. Do not add a write path for it.**

`toggleSurveyActive` was renamed rather than kept as an alias — it had zero callers, so a
deprecated shim would have been cruft with no migration to ease.

### UI

`SurveyStatusControl` on the survey detail page replaces the read-only Active/Inactive badge:
badge + **Pause / Resume / Close**. Optimistic with rollback on failure, so a rejected change
doesn't leave a wrong badge on screen.

**Close is confirmed via dialog, Pause is not** — deliberately asymmetric. Pause is reversible from
the same control; Close offers no way back (no Resume button once closed). The dialog states that
existing responses are kept and points at Pause for the temporary case.

### Not verified

Browser-untested. Worth one pass once local login works: pause a survey, load `/survey/<id>` in a
private window, confirm the panel replaces the form; then resume and confirm the form returns.

---

## 🔒 The payment gate is now a CONTROL, not a promise (2026-08-10)

**Item 5 of 5.** Assessed first as instructed: **small — about an hour**, so it was built.

### Why it was worth doing

The rule *"no brand pays until the ledger gap is fixed and rehearsed"* lived only in
`SESSION_RESUME.md`. **Nothing in the code stopped a brand clicking "Create Payment Order."** The
app runs on LIVE Razorpay keys (`rzp_live_…`), and the campaign-level path creates **no
`campaign_payments` row** — so a click would have taken real money with no ledger entry, no escrow
total, and nothing for the refund sync to act on.

### The surface is small, which is why this was cheap

- **One** creation entry point: `POST /api/payments/create-order`
- **One** UI caller: the campaign detail page button

So a single check at the route covers everything: no order can be created → no checkout can open →
no card can be charged.

### `PAYMENTS_ENABLED` — default OFF

`lib/payments/paymentsEnabled.ts`. Must be exactly `'true'` to permit orders; **unset, empty,
`'false'`, or a typo all disable payments.** Fail-safe: being wrongly disabled costs us an email
from a brand; being wrongly enabled costs money we cannot account for.

Safe to default off today because **no brand has ever paid** — production has zero
`campaign_payments` rows.

### ⚠️ Only order CREATION is gated — deliberately

`/api/payments/verify` and the Razorpay webhook are **intentionally NOT gated**. If an order was
created before the switch was flipped and the brand has already paid, blocking verification would
**take their money and record nothing** — strictly worse than the problem being prevented.
In-flight payments must be allowed to complete. Do not "consistency-fix" the gate onto verify.

### Two layers, one of which is cosmetic

- **Server (`arePaymentsEnabled`)** — the enforcement. Returns **503** with
  `code: 'payments_disabled'` and a message pointing the brand at manual invoicing. Placed as the
  **first statement** of the route, before auth, so nothing runs.
- **Client (`arePaymentsEnabledClient`)** — hides the button and shows the explanation instead.
  ⚠️ **COSMETIC ONLY.** `NEXT_PUBLIC_*` is inlined into the browser bundle and trivially bypassed;
  it must never be the only thing between a user and a charge. Same "enforce in the action, be
  courteous in the page" split as the paused-survey work in item 4.

### Visible in `env-check`

`/api/admin/env-check` now reports `payments.serverEnabled` / `payments.clientEnabled` and warns:

- when `PAYMENTS_ENABLED` is **true** (the risky state — flagged, not the absence)
- on a **server/client mismatch**, which would either show brands a button that 503s, or permit
  payments while hiding the button

So "are payments actually blocked?" is a curl, not a memory.

### To re-enable — the checklist, not a flag flip

⚠️ **Do not flip this to unblock one eager brand. Invoice them manually.** The gate exists because
of a specific unfixed defect. Re-enable only when:

1. the `campaign_payments` ledger fix has shipped (including the campaign-level vs milestone-level
   granularity decision and the `escrowForMilestone` reconciliation), **and**
2. an end-to-end rehearsal has passed on the preview environment with `rzp_test_` keys
   (`4111 1111 1111 1111`), **and**
3. `env-check` on production is otherwise clean.

Then set **both** `PAYMENTS_ENABLED=true` and `NEXT_PUBLIC_PAYMENTS_ENABLED=true` and redeploy —
env changes only bind on a fresh deploy after the save.

### Not verified

No browser test (local login only just became possible, and this path needs live Razorpay to
exercise fully). What *is* certain by construction: with the flag unset, `create-order` returns 503
before any auth or Razorpay call happens. Worth one curl against production after deploy to see the
503 body.

---

## 🎯 Consumer intent — the diagnosis, three fixes, and the strategic conclusion (2026-08-12)

### The investigation: zero rows in `consumer_intents` was NOT a silent write failure

Reported as a bug — real feedback text that should obviously match, zero rows stored. It turned
out to be **three different states wearing one symptom**, and conflating them would have produced
the wrong fix.

**Decisive test** — the real `extractIntents()` imported and run against the exact production
strings, not read and reasoned about:

```
[imported] 40c42948  price_sensitive(0.8)   "Too expensive for what it offers…"
[imported] 40853974  purchase_ready(0.85)   "…Will buy again."
[imported] e58144e4  price_sensitive(0.8)   "…a bit overpriced compared to…"
[imported] fa6d8bfb  frustrated(0.7)        "…no tracking update. Frustrating."
[imported] e5b96d27  — NO MATCH —           "Stopped working after two weeks…"

[ORGANIC]  19f1f02a  — NO MATCH —  "Product / service Discovery can be more extensive"
[ORGANIC]  c8140b68  — NO MATCH —  "This product is useful"
[ORGANIC]  feb710e7  — NO MATCH —  "it's useful product which solves my problem"
[ORGANIC]  a5644db9  — NO MATCH —  "it's great product which helps to acheive my goal…"
[ORGANIC]  3e668c78  — NO MATCH —  "it's really great product which helps me to introspect…"
```

**imported 4/5 · ORGANIC 0/5.** Provenance confirmed by the founder: all five quoted rows are
`import_source='csv'`, `organic=false`.

| Path | Verdict |
|---|---|
| **Organic feedback** | ✅ **Working correctly.** Five real users wrote five short positive sentences containing no intent language. `extractAndPersistIntents` returns early on `intents.length === 0`, before any insert, so nothing is attempted and nothing throws. **Zero rows was the correct output.** |
| **Imported feedback** | ⚪ Never wired — no import path calls extraction at all |
| **Survey responses** | 🔴 **Genuinely broken** — see below |

⚠️ **Method note worth keeping: insisting on the provenance check before touching code prevented a
fix to a non-bug.** The obvious move — "extraction is broken, go fix the regex/the write" — would
have churned working code and left the actual defect (the survey path) untouched.

**Correction to the earlier verdict.** The prior session's claim that the service *"writes to
production on every feedback submission"* was too strong. It writes only **on a pattern match**,
and no organic submission has ever produced one. The wiring claim was right; the "produces data"
implication was not.

### Fix 1 — the survey-path identity bug (the real defect)

`responseService.ts` passed **`response.userEmail || ''`** as `consumer_intents.user_id`. That
column is **NOT NULL with an FK to `users.id`** (`fk_consumer_intents_user`, migration 031), so an
email address — or an empty string — could **never** satisfy it. Every survey-sourced insert was a
guaranteed FK violation, caught and logged, so the path looked healthy while writing nothing.

**Exactly the same identity confusion as `feedback.user_id` in migration 033: an email is not an
id.** Third occurrence of this family now.

Fixed by reusing `pointsUserId`, already resolved from the session a few lines above for the B23
points award. Anonymous respondents are **skipped** — an intent row must belong to a real account
or it belongs to nobody.

The feedback path's **`session.user.id || ''`** fallback was fixed the same way. It is masked today
only because the id is always present; the moment it wasn't, it would have produced precisely the
silent write failure that was suspected here.

**Rule: never write `''` into an FK'd NOT NULL column to satisfy a type. No id means no row.**

### Fix 2 — consent gate on inference

`intentExtractionService` had **zero** consent checks while deriving commercial/psychological state
("this person is churning", "price-sensitive") from a consumer's words — and `alertOnHighIntent`
ships the **verbatim phrase** to the brand.

Gated with `checkConsent(userId, 'behavioral')` — the category `collect_behavioral_signals →
['behavioral']` already existed at `consent-enforcement.ts:136` and **nothing used it**.

Placed at the **persistence chokepoint**, not the call sites, so a future third caller is covered
automatically. Same shape as the `segmentedAnalytics` fix, and the same lesson: **k-anonymity did
not establish a lawful purpose there, and "the brand can already read the feedback" does not
establish one here.** Reading what someone wrote and inferring their intent from it are different
processing.

⚠️ **This gates the brand alert too, by construction:** `alertOnHighIntent` fires only over the
array this function returns, which is empty without consent. **Do not bypass by calling
`extractIntents()` directly and alerting on the result.**

Denial is a **silent skip**, never an error — declining behavioural processing is normal, and the
feedback must still save.

### Fix 3 — two false affordances REMOVED

`frustration_spike` and `watchlist_milestone` were Settings toggles a brand could switch on that
**could never fire**. Nothing anywhere calls `fireAlert()` with either; every other reference was a
label, an emoji map, a priority branch, or a default-rules seed entry. Handlers with no emitter —
same shape as the removed `BRAND_SURVEY_CREATED` handler, and the same class of claim as the
14-day-trial promise and the phantom CSV export.

Removed from the settings UI **and** from `bootstrapDefaultAlertRules` (which was seeding *enabled*
rules for notifications that can never arrive, making the dead types look deliberate).

**Removed rather than wired, and the reasoning matters:** both are **baseline-relative** — a
"spike" or a "milestone" needs a normal rate to deviate from. At ~23 feedback rows any threshold
either never trips or fires constantly, so wiring them would have replaced a dead toggle with a
noisy one. Retained in the `AlertType` union with a warning comment so existing rows typecheck;
**a type member is not a feature — if you add an emitter, re-add the settings entry in the same
change.**

### 📌 Deliberately NOT done — volume-gated, revisit when input grows

1. **Regex coverage gap.** `"Stopped working after two weeks. Support was slow to respond this
   time."` matches nothing — `frustrated` covers `"doesn't work"` but not `"stopped working"`, and
   nothing covers slow support. Both are churn signals sailing through. **Tuning patterns against
   5 organic rows would be guessing**, and overfitting to a handful of sentences is worse than a
   known gap.
2. **Wiring extraction into the import paths.** It would work — 4 of 5 imported rows match — but it
   would populate `consumer_intents` with **seeded CSV text, not real consumer language**. The
   table would look healthy and teach us nothing, and it would poison any future measurement of the
   false-positive rate.

### 🧭 Strategic conclusion — which intent our data can actually support

**PURCHASE intent is NOT supportable from our data. Do not build on it.**

Our consumers are **post-purchase** — they write about things they already own. The same sentence
means opposite things either side of a purchase: *"I want to buy this"* vs *"I'm glad I bought
this."* When an owner writes *"would definitely pay for this"*, the regex records `purchase_ready`
and a brand is told a consumer is about to buy, when they were paying a compliment. **This is a
semantic mismatch, not a tuning problem** — and the failure is invisible, because a brand chasing a
phantom lead has no way to tell.

Supporting it honestly would need genuinely **pre-purchase** surfaces: browse/search on products
the user does *not* own, watchlist adds, deal saves, comparison behaviour. Those event types exist
and are behavioural rather than textual — that is the honest path if it's ever wanted.

**CHURN / SWITCHING intent IS supportable, and is the honest direction.**

`churning`, `frustrated` and `price_sensitive` fire on exactly the language a dissatisfied *owner*
uses — the context matches the population we have. The corroborating inputs already exist:
sentiment trend across repeat feedback, `extracted_themes` with negative sentiment and counts, NPS
detractor scores, Reddit/YouTube/Google mentions.

Two of those three churn types (`frustrated`, `price_sensitive`) are currently **extracted and
discarded** — the feedback route's alert filter covers only `purchase_ready`, `want_feature`,
`churning`. And `frustration_spike`, the alert designed for exactly this, has no emitter.

⚠️ **Both are blocked on INPUT VOLUME, not plumbing.** 5 organic feedback rows across ~11 products.
Churn detection is architecturally supportable today and statistically not. **Build the supply side
before the inference side** — more consumers writing real feedback is the unlock for all of this,
and no amount of pattern work substitutes for it.

---

## 📡 Social listening — the audit, and stopping seed data being shown as real (2026-08-13)

### The audit: ingestion has never produced a single row

Triggered by `social_posts` holding 459 rows all created 2026-03-21 and nothing since.

⚠️ **First correction: `social_posts` is not the ingestion target.** The cron
(`/api/cron/process-social-mentions`, `30 5 * * *`) writes to **`social_mentions`** — a different
table. So it isn't "ingestion stopped in March"; it is **ingestion has never run**.

```
social_posts       459 rows   all 2026-03-21   ← seeded via import/webhook/v2
social_mentions      0 rows                    ← the cron's real output
social_listening_rules  0 total, 0 active      ← THE IGNITION KEY
```

**Verdict: the cron runs and does nothing**, because `getAllActiveRules()` returns `[]`, so
`platformRules` is empty for every adapter and no adapter is ever invoked. **Structurally identical
to competitive intelligence being gated on `competitor_profiles`** — a complete machine with no
fuel. This is now the third instance of the pattern (also: `BRAND_SURVEY_CREATED`,
`frustration_spike`).

🔴 **And no UI can create a rule.** `/api/brand/social-listening/rules` exists (GET/POST/PATCH,
brand-only) and **no `.tsx` anywhere calls it**. A brand cannot turn on the feature at all; it
would take a hand-crafted POST.

🔴 **The flag brands CAN see is the wrong flag.** `products.social_listening_enabled` is **true on
11 of 12 products** and the cron never reads it. Eleven products displayed "Social listening:
Enabled" for a pipeline that has produced zero rows. Two unconnected switches — one visible and
meaningless, one required and unbuildable from the UI.

**Route reachability was ruled out** — this is NOT the migration-034 family. `/api/cron/` is in
`PUBLIC_PREFIXES` and the route self-authenticates on `Bearer $CRON_SECRET`. (Note its check is
`if (cronSecret && ...)` — if `CRON_SECRET` were ever unset the route would be fully open.)

### 🚩 The false claim — seeded posts rendered as live social listening

`/dashboard/social` and `/dashboard/report/[id]` render `social_posts`. Confirmed seeded on four
independent grounds:

1. all 459 created in one batch on 2026-03-21
2. **`instagram`, `amazon`, `meta`, `twitter` have no adapter** — the registry has four
   (`reddit`, `youtube`, `google`, `telegram`), so those 173 rows could not have been fetched by
   any code in this repo
3. **`url` is null on all of instagram/linkedin/amazon/meta/twitter** — real ingestion always sets
   it (the Reddit adapter builds `https://www.reddit.com${d.permalink}` unconditionally)
4. the cron physically cannot write this table — it calls `createMention()` → `social_mentions`

**Same class as the mock product reviews removed on 2026-08-06**: fabricated content, invented
authors, invented engagement counts, presented as real. Worse in one respect — two paths showed it
to people it wasn't even seeded for:

- **brand fallback:** a brand owning **no** products was shown up to 50 *other* products' posts
  under their own "Social Mentions" heading
- **consumers:** see all social-enabled products' posts unconditionally

### What shipped

**Removed the brand fallback.** Misattribution independent of the seed data — nothing
distinguished other brands' posts from the viewer's own. A brand with no products now gets the
existing "No products found" state, which is the truth.

**Honest empty-state copy.** Was *"Click Refresh data to scan platforms"* — implying automated
scanning that cannot happen. Now says monitoring **is not set up**, because for every product today
that is the accurate answer. ⚠️ The distinction matters: *"nothing found"* and *"never looked"* are
different claims, and only one of them is true.

**`social_listening_enabled` now renders "Setup required"**, not "Enabled". The flag is *not*
deleted — it still controls whether a product appears in the consumer social discovery list — but
it does not and never did enable ingestion.

**`env-check` reports `socialAdapters`** — which adapters would run in THIS environment, with an
explicit note that a key being present does **not** mean ingestion happens, because the rule gate
sits in front of all four.

⚠️ **The empty state only works once the seed rows are gone.** The page cannot tell seed from real
— the seeded Reddit/YouTube/Google rows look legitimate. **Deleting the 459 rows is the part that
does the work**; the code change makes the resulting empty page honest. SQL handed to the founder;
production data not deleted by the agent.

### 📌 NOT done — volume-gated

**The rules UI (~1 day).** Real gap, but pointless until we know the pipeline yields anything for
products nobody discusses. Reddit search with `t=week&limit=25` on a keyword like "Metacog" will
return ~0. ⚠️ **And without run-records we could not distinguish "working, no mentions" from
"broken"** — which is why cron observability comes first.

---

## ⏱️ Cron run-records — migration 037 + `withCronRun` (2026-08-13)

**The durable fix for a pattern, not for an incident.** ~33 scheduled jobs, none of which left any
evidence of execution, so **"did nothing", "crashed", and "never fired" were indistinguishable**.
Two investigations — the intent pipeline and social ingestion — each burned hours on that ambiguity
before finding the actual cause.

### ⚠️⚠️ INSERT-AT-START IS LOAD-BEARING — do not "optimise" it

`withCronRun` writes the `cron_runs` row **before** the handler runs and updates it after. This
looks like a wasted round-trip and is the entire reason the feature works.

Vercel kills functions at 60s and a hard crash never reaches a `finally`. With insert-at-start, a
job that dies mid-run leaves a row with **`status='running'` and `finished_at IS NULL`** — and that
stranded row is the **only** way "fired and died" ever becomes observable. A write-on-completion
design faithfully records every success and **silently loses exactly the failures the table exists
to surface.**

```sql
-- the query that answers "what died?"
SELECT job_name, started_at FROM cron_runs
WHERE status = 'running' AND started_at < now() - interval '15 minutes';
```

There is deliberately **no `'timeout'` status** — nothing is alive to write it. A timeout presents
as a `running` row that never finished, which is why the stale-row query above is the real detector.

### Design decisions

- **Recording never breaks the job.** Every `cron_runs` write is in a try/catch that logs and
  continues. If the table doesn't exist or the DB blips, the job runs normally and simply isn't
  recorded. Same rule as `recordEmailSend` in 035 — observability must not become a new failure
  mode for the thing it observes.
- **The wrapper absorbs the auth check** duplicated across every route, so adopting it **removes**
  more code than it adds.
  ⚠️ It preserves the existing `if (cronSecret && …)` guard verbatim — meaning an **unset
  `CRON_SECRET` leaves every job publicly triggerable**. Preserved deliberately to avoid changing
  security behaviour in the same commit that adds recording; worth closing separately. `env-check`
  reports whether it is set.
- **`triggered_by`** distinguishes `vercel-cron` / `external` (cron-job.org drives the sub-daily
  jobs, since Vercel Hobby is daily-only) / `manual`. Without it, a silently-stopped external
  scheduler is invisible.
- **Handlers may return a plain object or a `NextResponse`** — both supported, so adoption never
  forces a rewrite of a route's return shape. A `NextResponse` is `.clone()`d to read its body,
  leaving the original stream intact.
- **Result JSON is capped at 8 KB**; larger payloads store a truncated preview. The column is for
  diagnosis, not a second copy of the data.
- **Unauthenticated probes are NOT recorded** — a 401 is not a run, and logging them would let
  anyone flood the table.

### 90-day retention — folded into `cleanup-analytics-events`

No new cron. ~33 jobs × 1 row/run ≈ 12k rows/year is hygiene, not pressure, and a dedicated
schedule entry would cost more attention than it saves.

⚠️ **Deletes only FINISHED runs** (`status <> 'running'`). A row still marked `running` after 90
days is a job that died and never reported — **the single most valuable row in the table**.
Sweeping those would delete the evidence the table exists to preserve. The delete is also
try/catch'd so a missing table can't fail the primary cleanup.

### ⏱️ ORDERING — SAFE EITHER WAY (unlike 033/034)

037 adds a **new table**. No code does a bare `select().from(cronRuns)`, so nothing expands to a
missing column, and every write is non-fatal. Deploying before the table exists is harmless: crons
run normally and record nothing. **Neon-first is preferred (no error noise, no blind window) but is
a preference, not a requirement.** Same posture as 035; the opposite of 033/034.

### 🔢 Scope correction: 33 cron routes, not 11

The build plan assumed ~11. `find src/app/api/cron src/app/api/jobs -name route.ts` returns **33**,
matching the 33 `vercel.json` entries. Wrapped so far: **`process-social-mentions`** (the proof
case — daily for months, zero output, no way to tell if it ran).

⚠️ **A blind mechanical wrap of the remaining 32 is NOT safe.** Most share the identical auth
block, but `api/jobs/process-deletions` differs — it has **both GET and POST**, and falls back to
`AUTH_SECRET` when `CRON_SECRET` is unset. Wrapping it without reading it would change its auth
behaviour. The remaining routes need a read-then-wrap pass, not sed.

**Until every job is wrapped, absence of a `cron_runs` row means "not wrapped yet", NOT "did not
run."** That ambiguity is the thing being fixed, so it matters that the half-done state is
recorded rather than assumed away.

---

## ⏱️ All 33 cron routes wrapped for run-recording (2026-08-13)

Completes the observability work started with migration 037. **"No `cron_runs` row" now means
"didn't run", with no asterisk.**

### The adoption pattern — rename + re-export, auth left INLINE

Every route was converted the same way:

```ts
export const GET = withCronRun('job-name', handleGET)

async function handleGET(request: NextRequest) {   // was: export async function GET
  …body unchanged, INCLUDING its auth check…
}
```

⚠️ **Deliberate deviation from the original design.** The plan had the wrapper *absorb* the
duplicated auth check. It doesn't, for 32 of the 33 — the inline check stays exactly where it was.

Reason: the routes turned out to use **three different auth semantics**, and the founder's binding
constraint was *"do NOT change any route's auth behaviour while wrapping."* Rewriting 32 auth
blocks to be equivalent-but-different is exactly the kind of change that looks safe and isn't.
Leaving them untouched makes behaviour preservation **true by construction** rather than by
careful reasoning. It also avoids closing-brace surgery in 32 files.

Cost: the auth check stays duplicated, and the wrapper's own (permissive default) check is
redundant with it. That redundancy is harmless — the wrapper never rejects anything the inline
check would accept — but it is not the tidy end state the design imagined.

**Because the wrapper inserts its row before the handler runs, a rejected probe would have left a
row.** So `withCronRun` now **discards the row when the handler returns 401** — a probe is not a
run, and unauthenticated traffic must not be able to flood the table or masquerade as history.

### The three auth semantics found (all preserved verbatim)

| Pattern | Routes | Behaviour when secret unset |
|---|---|---|
| `if (cronSecret && header !== …)` | 24 | ⚠️ **falls OPEN** — no check at all |
| `verifyAuth()` with `CRON_SECRET \|\| AUTH_SECRET`, always compares | 8 | falls back, else compares to `"Bearer undefined"` |
| `header !== \`Bearer ${process.env.CRON_SECRET}\``, always compares | 1 (`send-time-analysis`) | compares to `"Bearer undefined"` |

`CronAuthOptions` exists on the wrapper to reproduce all three exactly, should auth ever be moved
inward. Only the default is used today — by `process-social-mentions`, the single route whose auth
*was* moved into the wrapper (in the previous commit, where it was behaviourally identical).

### Routes needing special handling (9)

- **`jobs/process-deletions`** — GET **and** POST, `CRON_SECRET || AUTH_SECRET`, and it
  **permanently deletes user accounts**. The most deviant of the 33 and precisely the job that
  should never have run unobserved.
- **`send-time-analysis`** — the ONLY route that does not fall open when the secret is unset.
  ⚠️ Wrapping it with the standard wrapper auth would have *silently opened it*. Caught only by
  reading it; a find-and-replace would have introduced the hole.
- **`process-content-reviews`**, **`support-ticket-reminders`** — GET + POST sharing one handler.
  Both exports wrapped under **one** `job_name`: same job reached two ways, not two jobs.
- **`community-deals-moderation`, `deals-expiry`, `process-payouts`, `sync-razorpay-status`,
  `jobs/dsar-cleanup`** — `verifyAuth` helper with the `AUTH_SECRET` fallback.

### 📌 KNOWN GAP — recorded, not fixed

**`if (cronSecret && …)` means every one of those 24 jobs becomes publicly triggerable if
`CRON_SECRET` is ever unset.** Preserved verbatim rather than mixed into an observability change.

⚠️ **Especially relevant to the new PREVIEW environment**, where a fresh env may not have the
secret copied across — and `docs/PREVIEW_ENVIRONMENT_SETUP.md` lists `CRON_SECRET` as
*"must differ"*, i.e. a value someone has to remember to set. If it is missed, preview's crons —
including **account deletion** — are open to anyone who knows the URL. `env-check` reports whether
it is set; that check is the mitigation until the pattern is fixed.

The `"Bearer undefined"` comparison in the other 9 is a milder version of the same thing: guessable
in principle. Also preserved, also logged.

### Reading the results

```sql
-- last run of every job
SELECT DISTINCT ON (job_name) job_name, status, duration_ms, triggered_by, started_at
FROM cron_runs ORDER BY job_name, started_at DESC;

-- what died (the reason insert-at-start exists)
SELECT job_name, started_at FROM cron_runs
WHERE status = 'running' AND started_at < now() - interval '15 minutes';

-- which jobs have NEVER reported — now a real answer, not an artefact of partial adoption
SELECT unnest(ARRAY['process-social-mentions','process-notifications', …]) AS job
EXCEPT SELECT DISTINCT job_name FROM cron_runs;
```

---

# 📍 STATE OF PLAY — 2026-08-17 (read this first)

Doc sync point: **`593aae9`**. CLAUDE.md is at **v17**; `docs/SCHEMA.md` covers migrations through
**037**; `docs/CRON_JOBS.md` documents run-records and the three auth patterns.

## What the agent could NOT verify this pass — treat as reported, not confirmed

The founder reports having run the Neon SQL for the outstanding migrations. **This was not
independently verified**, because both verification routes were unavailable:

- **Direct Neon connection: `CONNECT_TIMEOUT`** from the dev machine (production HTTP is fine, so
  it is the DB endpoint, not the network — likely a suspended/cold compute).
- **Deployed admin routes: 401.** ⚠️ **The `ADMIN_API_KEY` in `.env.local` is STALE** — it was
  rotated during the Tier B wave and never updated locally. Confirmed it is a *key* problem and not
  a middleware block via the established diagnostic: `X-Mw-Decision: continue` on both
  `run-migration-034` and `-037`, i.e. the request reached the handler and the handler rejected the
  key. (`redirect` would have meant middleware.)

**One command settles it**, using the Vercel value of `ADMIN_API_KEY`:

```powershell
$key = '<from Vercel>'
foreach ($n in @('035','036','037')) {
  $r = Invoke-RestMethod -Method Post -Uri "https://www.earn4insights.com/api/admin/run-migration-$n" -Headers @{'x-api-key'=$key}
  "$n ok=$($r.ok)"; $r.results | % { "   $($_.step) [$($_.status)] $($_.detail)" }
}
```

All three are idempotent, so re-running is a confirming no-op that still prints its state line.

⚠️ **Fix the stale local key too** — until then, no admin route can be exercised from the dev
machine, and every 401 will look ambiguous again.

## Verified true as of this sync

- `593aae9` on `origin/main`, working tree clean, typecheck exit 0.
- **All 33 cron routes wrapped** — confirmed by caller search, not assumed.
- Migration **037 IS deployed and reachable** (`X-Mw-Decision: continue`).

## The honest state

**Code-complete, deployment-incomplete.** Twelve commits of work; several are **inert** until
console steps happen — most importantly the **Resend webhook**, without which email delivery is
still blind despite being built.

**Nothing in v17 has been verified in a browser.** Local login now works, so that is the cheapest
confidence available and should come before any new feature work.

## Suggested order for the next session

1. **Console:** Resend webhook + `RESEND_WEBHOOK_SECRET` → redeploy → `env-check`
2. **Console:** delete the 459 seeded `social_posts` (verify the count first)
3. **15 min:** the social pipeline proof — `cron_runs` now gives it somewhere to report, and after
   a day that table answers *which of the 33 crons Vercel is actually firing*
4. **~1 day:** build the preview environment — it unblocks the payment rehearsal, the ledger fix,
   and every "not verified in a browser" item at once
5. **Then:** scope the payment ledger (campaign vs milestone granularity + `escrowForMilestone`
   reconciliation)


---

## 🎬 Creator notifications — consent carve-out + two missing emitters (2026-08-17)

Found by the influencer/creator audit. **The creator surface turned out to be the best-wired in the
codebase** — 13 of 14 influencer-targeted events had real emitters, all 16 API routes had auth, and
the onboarding actions were properly guarded (unlike the five survey actions). Its problems were
three specific holes on top of one upstream defect.

### 🔴 The delivery-side bug: creators were silently receiving NOTHING

Every influencer notification target is `role: 'consumer'` (eventBus 601, 619, 673, 691, 732, 754,
773, 809, 829, 849). `dispatchToUser` skips consumer-role targets lacking `personalization`
consent — so **a creator who declined personalization got no campaign notifications, no content
decisions, and no "your payment has been released."**

### ⚖️ Why we did NOT just change `target.role` to `'influencer'`

The obvious fix, and the wrong one. Three reasons:

1. **`target.role` has exactly ONE use in the entire dispatcher** — the consent gate at
   `realtimeNotificationService:111`. It is not used for the inbox, the feed, Pusher or email.
   Changing it would not relabel anything; it would **disable the consent check wholesale and
   invisibly.**
2. **It would ungate `BRAND_CAMPAIGN_LAUNCHED`**, which fans out to 100 influencers via
   `getActiveInfluencers()`. That one is genuinely audience-selected and **should** stay gated —
   precisely the case the carve-out test excludes.
3. **The role is not wrong.** A dual-role creator (consumer who did "Become an Influencer") has
   `role: 'consumer'` + `isInfluencer: true`. They *are* a consumer. Relabelling would be
   inaccurate for most creators, and `NotificationTarget.role` has no `'influencer'` member.

**Per-event flag: explicit, auditable, reversible. Role change: implicit, invisible, blunt.**

### The split — applying the resolution-loop test

*Is the recipient derived from their own prior act, or selected from an audience?*

**CARVED OUT (9 existing + 2 new):** content approved · content rejected · application accepted ·
application rejected · **campaign invited** · **review received** · payment escrowed · payment
released · payout initiated · payout completed · payout failed.

**LEFT GATED, correctly:** `BRAND_CAMPAIGN_LAUNCHED` (broadcast to 100) and the ICP-matched
consumer half of `INFLUENCER_POST_PUBLISHED`. Both are audience-selected marketing.

⚠️ **The invitation was the least clear-cut.** A brand does *select* the creator. It was carved out
because the creator published a marketplace profile precisely to be found, and an invitation is a
**direct 1:1 offer of paid work with a decision attached** — not a broadcast. Recorded so the
reasoning can be re-examined rather than assumed.

### 🔴 Two emitters that did not exist

- **`inviteInfluencerToCampaign`** (`campaignManagementService:358`) validated, deduped, wrote the
  invitation row — **and emitted nothing.** A creator learned about a paid-work offer only by
  opening the app. **The single most important creator moment on the platform had no notification
  behind it.** Now emits `influencer.campaign.invited`.
- **`POST /api/campaigns/[campaignId]/reviews`** — a brand rated a creator's work and the creator
  was never told, despite it affecting their marketplace standing. Now emits
  `influencer.review.received`, **only when `isBrand`**: the handler targets `influencerId` and
  carries creator-facing copy and CTAs, so firing it for the creator→brand direction would send a
  brand to an influencer page.

Both emits are non-blocking — a notification failure must not undo a persisted invitation or review.

Both event types were added to `NOTIFIABLE_EVENT_TYPES` (so preferences validate) and to the
influencer **Campaigns** category in `NotificationPreferencesCard`.

### 📌 Same class, deliberately NOT changed (out of scope)

Several **non-creator** consumer-role events are equally transactional and remain gated behind
personalization consent:

- `COMMUNITY_DEAL_APPROVED` / `COMMUNITY_DEAL_REJECTED` — the author's own post
- `SUPPORT_ADMIN_REPLY` / `SUPPORT_TICKET_UPDATED` / `SUPPORT_TICKET_RESOLVED` — their own ticket
- `CONSUMER_REWARD_REDEEMED` — confirmation of their own redemption

Each would pass the same test. Left alone to keep this change reviewable; **flagged here so it is a
decision, not an oversight.**

### Other audit findings — recorded, NOT fixed

| Finding | Severity |
|---|---|
| 🔴 **Earnings + payouts read `campaign_payments`**, which the campaign-level ledger gap leaves empty → **a creator sees ₹0 and is never paid**. `process-payouts` looks for *released* `campaign_payments` and finds none. **The ledger gap is a creator-facing outage, not back-office cleanup.** | Critical |
| 🟠 **Social stats are self-declared** — `sync-social-stats` is a documented placeholder. Brands choose whom to pay on numbers the creator typed, and the **verification badge validates profile completeness, not stat accuracy** — a brand could reasonably read it as validating both. | Medium–High |
| 🟠 **`RAZORPAYX_ENABLED = false` is a hardcoded `const`** (`payoutService.ts:77`), **not an env var** — CLAUDE.md §6 calls it env-flag controlled and `env-check` reads `process.env.RAZORPAYX_ENABLED`, which is always null. Both are wrong; flipping it needs a code change + deploy. | Medium |
| 🟠 `INFLUENCER_MILESTONE_COMPLETED` has **no emitter** — brands are never told a milestone was submitted for review. | Medium |
| 🟡 `/api/influencer/payouts` is **GET only** — there is no creator-initiated payout request. Payouts are created automatically by the cron from released payments. The architecture is fine; the mental model of "requesting a payout" does not match the code. | Low |
| 🟡 `VerifiedBadge` still not mounted on brand-side influencer search. | Low |
| 🟡 `ProductTour.tsx:42` comment contradicts lines 21–24 and the implementation (`tourRole = isInfluencer ? 'influencer' : …`). Code correct, comment misleading. | Low |

### Not verified

Browser-untested. Volume unmeasured — Neon timed out from the dev machine and the local
`ADMIN_API_KEY` is stale, so influencer/application/payout counts are still unknown.


---

## ⚖️ Consent carve-out completed + three decisions recorded (2026-08-17)

### The carve-out is now complete — the gate covers only marketing

Extended `bypassPersonalizationConsent` to the three non-creator transactional events flagged in the
influencer audit:

- **`CONSUMER_REWARD_REDEEMED`** (consumer half) — ⚠️ **this one is money.** A consumer spends their
  own points and, without this, never learns whether the redemption went through. The brand half
  stays as-is (`role: 'brand'`, never gated).
- **`COMMUNITY_DEAL_APPROVED` / `COMMUNITY_DEAL_REJECTED`** — moderation outcome on their own post.
  A suppressed rejection leaves someone believing their post is live when it isn't.
- **`SUPPORT_ADMIN_REPLY` / `SUPPORT_TICKET_UPDATED` / `SUPPORT_TICKET_RESOLVED`** — their own
  ticket. Suppressing these means someone asks for help and never learns they got an answer.

**`personalization` consent now gates only genuinely audience-selected events:**
`BRAND_PRODUCT_LAUNCHED`, `BRAND_CAMPAIGN_LAUNCHED`, `BRAND_MEMBER_ACTIVE`,
`BRAND_DISCOUNT_CREATED`, `DEAL_EXPIRED`, and the ICP-matched consumer half of
`INFLUENCER_POST_PUBLISHED` — i.e. the marketing surface, which is what the gate was always for.

⚠️ **The flag is no longer "narrow" in the sense the resolution-loop note used.** It started as one
event and is now on ~17. That is the correct outcome — the original framing was
*"deliberately NARROW: one event type sets it"*, and a future reader should understand the scope
grew **by applying the stated test**, not by erosion. The test still governs:
*is the recipient derived from their own prior act, or selected from an audience?* Anything failing
that test must stay gated.

---

### 📌 Decision record 1 — the campaign-invitation carve-out is BORDERLINE, on purpose

`INFLUENCER_CAMPAIGN_INVITED` is the weakest member of the carved-out set and should be revisited
rather than inherited.

**The case against carving it out:** a brand genuinely *selects* the creator. That is
audience-selection by the plain reading of the test, and it is the same mechanic as
`BRAND_CAMPAIGN_LAUNCHED`, which we deliberately left gated.

**The case for (what we chose):**
1. The creator **published a marketplace profile precisely to be found** — being discoverable is
   itself a prior act, opted into.
2. It is **1:1, not fan-out.** `BRAND_CAMPAIGN_LAUNCHED` broadcasts to 100 influencers via
   `getActiveInfluencers()`; an invitation targets one person.
3. It carries a **decision with a deadline** — accept or decline paid work. That is transactional in
   substance, not promotional.

**If this is ever reversed**, the consequence is concrete: creators who declined personalization
stop being told about paid work offers, and will appear unresponsive to brands. Weigh that against
the purity of the test.

---

### 📌 Decision record 2 — creator-reviews-brand has NO event, deliberately

`POST /api/campaigns/[campaignId]/reviews` emits `INFLUENCER_REVIEW_RECEIVED` **only when
`isBrand`**. The reverse direction — a creator reviewing a brand — notifies nobody.

**Why not just fire the same event:** the handler targets `payload.influencerId`, its copy says
*"reviewed your work"*, and its CTA points at `/dashboard/influencer/campaigns/…`. Reusing it for a
brand recipient would send a brand to an influencer page with creator-flavoured wording — the same
class of mistake as the consumer product tour on the influencer path.

**If you want it**, it needs its own event (`BRAND_REVIEW_RECEIVED`) with brand-facing copy and a
`/dashboard/brand/campaigns/…` CTA. Small, but a real addition rather than a flag flip.

---

### 📌 Decision record 3 — the ledger gap is a CREATOR-FACING OUTAGE, not back-office cleanup

**This reframes its severity and should change its priority.**

The `campaign_payments` ledger gap has been carried since 2026-06-24 as an accounting/integrity
problem: a brand pays campaign-level, `razorpay_orders` reaches `paid`, and **no `campaign_payments`
row is created**. Framed that way it reads as something to tidy up before audit.

**It is not.** Traced through the creator surface:

- `influencerEarningsRepository` reads **`from(campaignPayments)`** (lines 106, 146) → a creator's
  **Earnings screen shows ₹0**
- `process-payouts` looks for **released `campaign_payments`** with no payout record → finds none →
  **no payout row is ever created**
- No payout row → the (fully working) `PAYMENT_PAYOUT_*` notification chain never fires → **the
  creator is not even told anything is wrong**

**So a creator can complete the work, have the brand pay, and see nothing: no earnings, no payout,
no notification.** Silent, and unrecoverable from their point of view.

⚠️ **Consequence for sequencing:** the creator notification work just completed is correct but
currently announces a payment that cannot happen. **Preview environment → ledger fix** is therefore
the path to creators being paid at all, and it outranks further notification or feature work.

The `PAYMENTS_ENABLED` gate (default OFF) is what keeps this latent rather than live — a brand
cannot currently create an order, so no creator is presently stranded. **That gate is the only thing
standing between this defect and a real unpaid creator.**


---

## 🔒 Cron auth now FAILS CLOSED (2026-08-17)

Closed before building the preview environment, deliberately: the founder's reasoning was
*"I'd rather remove the consequence than rely on getting the env var right."*

### What was open

24 routes carried `if (cronSecret && authHeader !== …)` inline — **no secret configured meant no
check at all.** An environment missing `CRON_SECRET` had every scheduled job triggerable by anyone
with the URL, **including `jobs/process-deletions`, which permanently deletes user accounts.**

`send-time-analysis` was the only route that compared unconditionally. **The standard now matches
IT**, per instruction — not the reverse.

### Fixed at the wrapper, not in 24 files

`withCronRun`'s auth runs **before** each route's inline check, so flipping one default closes the
hole for all 33 routes at once and leaves the inline blocks redundant rather than load-bearing.
`whenUnset` now defaults to **`'enforce'`**.

⚠️ **A second, subtler hole was closed in the same change.** Nine routes "always compared", which
looked fail-closed — but with no secret set they compared against the string
`` `Bearer ${undefined}` ``, so **anyone sending the literal header `Authorization: Bearer undefined`
got in.** They were safe only by nobody guessing it. The wrapper now returns early when no secret
is configured instead of falling through to a comparison, so this is genuinely closed.

`'skip'` is retained ONLY so the old behaviour stays expressible and greppable. **Nothing passes it
and nothing should** — reaching for it re-opens a hole that was closed on purpose.

### ⚠️ AUTH_SECRET fallback PRESERVED, not removed

Seven routes authenticate against `CRON_SECRET || AUTH_SECRET` via their own `verifyAuth`. Each now
passes `secretEnv: ['CRON_SECRET', 'AUTH_SECRET']` so the wrapper accepts **exactly what the inline
check already accepted** — otherwise the wrapper would have rejected a valid `AUTH_SECRET` caller
before the route ever ran.

`community-deals-moderation` · `deals-expiry` · `process-payouts` · `sync-razorpay-status` ·
`process-content-reviews` (GET+POST) · `jobs/dsar-cleanup` · `jobs/process-deletions` (GET+POST)

**Net effect: the same callers are accepted as before; only "no secret at all" changed from
*accept everything* to *reject everything*.** Removing the `AUTH_SECRET` fallback outright would be
a real behaviour change on the most destructive job on the platform, and is left as a separate,
deliberate decision.

### ⚠️ The intended consequence

**An environment without `CRON_SECRET` now gets 401 on every cron and nothing scheduled runs.**
That is the point — a visible, diagnosable failure instead of an invisible open door. `env-check`
now warns explicitly when `CRON_SECRET` is unset, because the symptom (nothing runs, silently) is
otherwise indistinguishable from a scheduler that never fired.

Combined with run-records: a missing secret now shows as **401s and zero `cron_runs` rows**, and
`env-check` names the cause.

### Still inline, still redundant

The 24 inline `if (cronSecret && …)` blocks remain in the route files. They are now dead weight —
the wrapper rejects first — but the *pattern* survives in source where it could be copied into a
new route. Removing them is the auth-absorbing pass, still queued; it is cosmetic now rather than
security-relevant.


---

## 🗄️ DATABASE_URL_OVERRIDE — pointing preview at its own Neon branch (2026-08-19)

### The problem

The **Neon Vercel integration owns both `POSTGRES_URL` and `DATABASE_URL`** and scopes them to all
three environments. Vercel offers no per-environment edit — only "rotate integration secrets". So
there was **no way to point a preview deployment at a different Neon branch** using the canonical
names, which blocked the whole preview environment, which blocks the payment rehearsal, which
blocks the ledger fix, which is why creators can't be paid.

### What the code actually reads (checked, not assumed)

| Reader | Before |
|---|---|
| `src/db/index.ts:6` | `POSTGRES_URL \|\| DATABASE_URL` |
| `drizzle.config.ts:8` | **`POSTGRES_URL` only — no fallback** |

⚠️ **`drizzle.config.ts` was the sharp edge.** Reading `POSTGRES_URL` exclusively meant
`drizzle-kit push` / `studio` would have **silently ignored an override and pushed schema to the
integration-managed database** — running a migration against the wrong branch is precisely the
accident the override exists to prevent. The fallback chain there mattered as much as the app's.

### The fix

Precedence everywhere: **`DATABASE_URL_OVERRIDE` → `POSTGRES_URL` → `DATABASE_URL`**.

**Name is environment-NEUTRAL on purpose.** `PREVIEW_DATABASE_URL` would have solved today's
problem and blocked the next one (staging, branch-per-PR). "Whatever environment sets it, wins."

⚠️ **Disconnecting the integration was the alternative and was REJECTED.** It would mean
re-creating **production's** database configuration by hand on a live product, where a mistake is
an outage. The override touches nothing in production's path. Cost of the override: two lines.

### 🔒 The guard — HARD FAIL, not a warning

**`src/db/index.ts` refuses to boot** when `DATABASE_URL_OVERRIDE` is set and
`VERCEL_ENV === 'production'`.

Reasoning, and it generalises: a misdirected database is **the worst silent-failure shape found
this session**. The cron fail-open let things run that shouldn't. The `sent` email status hid a
truth. This one **corrupts data** — reads return someone else's rows, writes land where nobody
looks — and it can run for days before anyone notices. Some of that is not reversible.

**Loud and down beats quiet and wrong.** A boot failure is visible in seconds and fixed by deleting
one variable, with zero data divergence.

**Escape hatch is a SECOND variable** — `ALLOW_DATABASE_URL_OVERRIDE_IN_PRODUCTION=true`. Two
variables cannot align by accident; you have to mean it. Legitimate uses: emergency failover to a
replica, provider migration. While active it logs at **error** level on every cold start, so it
appears in normal log filters rather than only when someone goes looking.

⚠️ **Accepted tradeoff:** a module-scope throw means **every** request 500s, not just DB-touching
ones. A fat-fingered production env var takes the site down rather than degrading it. Judged
correct given what the alternative costs, but it is a real tradeoff and the one thing to flip if
this ever proves too aggressive.

**No guard in `drizzle.config.ts`** — drizzle-kit is a CLI a human runs deliberately, `VERCEL_ENV`
isn't set there, and the guard belongs where an accident would be *silent*.

### env-check now answers "which connection is in effect"

```json
"database": {
  "host": "ep-xxx.neon.tech",
  "effectiveSource": "DATABASE_URL_OVERRIDE",
  "present": { "DATABASE_URL_OVERRIDE": true, "POSTGRES_URL": true, "DATABASE_URL": true },
  "overrideAllowedInProduction": false
}
```

⚠️ **`connectionSource` is IMPORTED from `@/db`, not re-derived.** A second copy of the precedence
chain is exactly how a diagnostic goes stale and starts confidently reporting the wrong thing.

Warnings added for: override active on production (both the permitted and the should-be-impossible
case) and override active on any non-production environment (expected on preview, suspicious
anywhere else).

### Unblocks

Preview can now point at its own Neon branch. Remaining preview steps are unchanged and all
dashboard-side: Razorpay test keys, scoping the other vars, running the migration loop,
`env-check` until `ok: true`, then repointing `.env.local`.

---

## 🧰 The PowerShell bracket trap — how two findings today were WRONG (2026-08-20)

### The trap

```powershell
Select-String -Path "src\app\dashboard\brand\campaigns\[campaignId]\page.tsx" -Pattern "Activate"
```

returns **nothing**. Not an error — an empty result. PowerShell treats `[` and `]` in `-Path` as a
**wildcard character class**, so `[campaignId]` means "any one of the characters c,a,m,p,i,g,n,I,d",
the path matches no file, and `Select-String` reports no matches exactly as if the pattern were
absent.

⚠️ **Every Next.js dynamic route in this repo has square brackets** — `[campaignId]`, `[productId]`,
`[icpId]`, `[milestoneId]`, `[orderId]`, `[id]`, `[pid]`, `[category]`. Any `-Path` search touching
one silently returns nothing.

### Why it is dangerous rather than annoying

An empty grep result is normally *evidence*: "the pattern isn't there." Here it is
indistinguishable from "the file was never opened." The failure mode is a confident **proof of
absence** — which is the worst possible shape in a codebase whose dominant defect class
(§5 ignition-key pattern) is *things that look built but aren't*. It produces the exact same
conclusion as a genuine ignition-key finding, so it passes the smell test.

### The two wrong findings

| Claim made | Reality |
|---|---|
| "There is **NO** campaign status-transition UI — a live production blocker; no brand can activate a campaign, so no brand can reach payment" | `[campaignId]/page.tsx:545-577` has **Publish / Activate / Complete / Cancel** buttons, a two-step confirm modal, `apiPatch` with CSRF, and a client mirror of `getMissingPublishFields` that disables Publish with a tooltip naming the missing fields |
| "`/api/brand/campaigns/[campaignId]` has no handlers" | It has **GET and PATCH**; PATCH is CSRF-gated and calls `transitionCampaignStatus` |

Both were escalated to the founder as blockers. **Neither was real.** The correct statement is that
a brand reaches payment via **Publish → Activate → Create Payment Order**, and the payment blocker
remains what it always was: the `campaign_payments` ledger gap.

### 🔒 How to search these paths correctly

**Pipe, don't `-Path`.** `Get-ChildItem` passes `FileInfo` objects, which `Select-String` consumes
without wildcard expansion:

```powershell
Get-ChildItem -Path src -Recurse -Include *.ts,*.tsx -File |
  Select-String -Pattern "openStatusConfirm"
```

Other correct forms:
- `Select-String -LiteralPath "...\[campaignId]\page.tsx"` — `-LiteralPath` disables wildcards
- `Get-Item -LiteralPath` / `Get-Content -LiteralPath` — same trap applies to **every** `-Path`
  parameter in PowerShell, not just `Select-String`
- Escape the brackets: `` `[campaignId`] `` (backtick each)
- Prefer the **Grep tool (ripgrep)** with a *narrow* `path` — it has no bracket semantics. It times
  out at 20s on the whole repo, but scoped to one directory it is fast and correct.

### The general rule

**A zero-result search of a SPECIFIC file is not evidence until you have confirmed the file was
read.** Cheap confirmation: search the same file for something certain to be present (`import`,
`export default`) and check you get hits. If that also returns zero, the path never resolved.

Recorded in memory as `powershell-bracket-paths`.

---

## ✅ Preview environment — verified and migrated (2026-08-20)

**URL:** `earn4insights-git-preview-env-joshis-projects-51800fce.vercel.app` · branch `preview-env`

**Both STOP conditions cleared before migrating:** Razorpay `serverKeyMode`/`clientKeyMode` both
read **`test`** (no real card can be charged), and `database.host` is `ep-wild-frog-ahia61pt` —
**not** production's `ep-icy-salad-ahjb9nek` — with `effectiveSource: DATABASE_URL_OVERRIDE`, so the
override wins in a real deployment.

**Migrations:** all 35 (`002`–`024`, `026`–`037`) succeeded. The **entire loop was then run a second
time: 35/35, zero failures** — that second pass is the real idempotency proof. 036 landed
(`uniq_constraint_present=true`), and the state lines confirm `users`, `feedback`,
`notification_queue`, `notification_preferences`, `brand_subscriptions` and `cron_runs` all exist
and are empty.

⚠️ **"Which migrations were no-ops" is NOT answerable** — most routes hardcode
`status: 'created'` from a `CREATE TABLE IF NOT EXISTS` regardless of whether anything was created.
Only 003 distinguishes (`skipped=10, ok=2`). Do not read `created` as "this ran".

### Two corrections to the preview docs

- 🔴 **`env-check` can NEVER return `ok: true` on preview.** The "override is active on a
  non-production environment" warning fires *by design* whenever the override is set. The
  instruction in `docs/PREVIEW_ENVIRONMENT_SETUP.md` to run "`env-check` until `ok: true`" is
  unreachable; the correct target is **"until only the expected warnings remain."**
- 🔴 **The branch-detection heuristic is a FALSE POSITIVE generator.** `env-check` warns when
  `!/dev|test|staging|preview|branch/i.test(host)`, but Neon auto-names branch endpoints
  `ep-wild-frog-…`, matching none of those words. It fires on every correct Neon branch and cannot
  distinguish a branch from production. Reliable check is comparing against the known production
  host.

### Real config gap found

**`PAYMENTS_ENABLED=true` but `NEXT_PUBLIC_PAYMENTS_ENABLED` unset** on Preview → the server accepts
orders while the "Create Payment Order" button stays **hidden**. Both must be set for a UI payment
rehearsal.

### ⚠️ Preview shares the PRODUCTION Vercel Blob store

`BLOB_READ_WRITE_TOKEN` is deliberately unscoped. Writers: `uploads/brand-logo` (in the brand
onboarding path), `uploads/influencer-photo`, the three feedback-media routes, `dsarService`.

🔴 **The two DELETE paths are the landmine:** `feedbackMediaRetentionService` and
`api/jobs/dsar-cleanup` enumerate rows from the DB and delete the matching Blob objects. They are
harmless **only because the preview DB is empty**. If production data is ever cloned into the
preview branch, triggering either on preview would delete **real production media** — the same
objects rotated in the v15 incident, equally unrecoverable. Defuse before any data clone.

---

## 💰 THE LEDGER GAP — proven on a real payment (2026-08-20)

### No longer inference

Live Razorpay **test** payment on preview, completed successfully:

```
razorpay_orders:    order_TS1GoYGUZ5vCwb
                    campaign a98d5a83-347e-4d1b-be30-5d40714e4dbb
                    milestone_id NULL | status 'paid' | amount 5000000 (₹50,000)
campaign_payments:  ZERO ROWS
```

The campaign-level path takes money and writes no ledger row. **Empirically confirmed, not traced.**

### Four findings from the full read that reshape the problem

1. ⚠️ **`capturePayment` never CREATES a ledger row — on ANY path.** It only *updates* one, and
   only inside `if (order.milestoneId)` (`razorpayService.ts:335`). Together with finding 2, that
   means **`campaign_payments` has no reachable writer anywhere in the codebase.** This is not a
   campaign-level gap; the milestone path is equally dead, it just fails one step later.
2. ~~**`escrowForMilestone` has ZERO callers**~~ — ❌ **THIS WAS WRONG. See the correction below.**
   It had one caller, reachable from a button. The claim came from a PowerShell scan that **timed
   out partway** plus two path-scoped greps reported as exhaustive — the same "an unfinished search
   is not evidence of absence" failure as the bracket trap, recorded two sections above.
3. 🔴 **No duplicate guard on campaign-level orders.** `createOrder`'s duplicate check sits inside
   `if (milestoneId)` (`razorpayService.ts:149`). Nothing stops a second charge on the same campaign.
4. 🔴 **The release path is milestone-ONLY.** `/api/payments/release/[campaignId]` requires
   `milestoneId` plus an *approved* milestone. A campaign-level payment has **no route to the
   creator at all** — writing the ledger row does not make the money movable. Separate build.

### The UI state was worse than reported

With zero ledger rows: `allReleased`=false, `isEscrowed`=false, and
`razorpayOrder.status === 'created'` is false (it is `'paid'`). So the Payment Status card fell
through to the **final else** — the *pre-payment* card, **with the Create Payment Order button
live**. Not a false escrow banner: an invitation to pay again, with finding 3 meaning nothing
would have stopped it. Fixed in Phase 0.

The Refund card (`page.tsx:1102`) is gated on `razorpayOrder.status === 'paid'` and was the one
honest surface — it reflects a real order.

### ⚠️⚠️ `escrowForMilestone` IS BEING DELETED — and this does NOT remove escrow

**Read this before reacting to the word "deleted".** Escrow is *Razorpay holding the funds* plus
*a `campaign_payments` row recording that hold*. Both survive; the second one starts working for
the first time. `escrowForMilestone` was a **pre-Razorpay artifact** that would have written
**false ledger entries**, and deleting it removes a corpse, not a capability.

Three independent reasons, any one sufficient:

1. It writes `status:'escrowed'` **without any money having moved.** Wiring it would make the
   ledger assert that funds are held which Razorpay never took — a worse defect than the empty
   table, because an empty table is honestly empty.
2. It never sets `influencerAmount`, and `process-payouts` pays out **exactly that field** — so a
   row it created would produce a **NULL payout**.
3. It computes fees from `campaign.platformFeePct`, while `createOrder` uses `FEE_SCHEDULE`
   (`razorpayService.ts:61`). **Two disagreeing fee sources**; deleting collapses to one.

It also removes the misreading that this is *two mechanisms failing to reconcile*. It is one path
that moves money without writing, and one corpse that writes without moving money.

### Approved design (founder-approved 2026-08-20, pre-build)

- **Granularity: 1:1 with `razorpay_orders`**, copying `milestone_id` (null for campaign-level).
- **Create the row at ORDER CREATION with `status='pending'`**, not at capture. Chosen not merely
  to avoid a migration but because it **turns the webhook's dead `status === 'pending'` guard into
  the idempotency mechanism** — better than adding new machinery beside dead code. The existing
  duplicate check already blocks only on `escrowed`/`released`, so a `pending` row from an
  abandoned checkout correctly does not block a retry.
- **Flip `pending → escrowed` in BOTH `capturePayment` AND the webhook**, via a conditional claim
  (`UPDATE … WHERE status='pending' RETURNING`) — same shape as `claimResolutionNotification` (v16).
  Both currently sit inside `if (order.milestoneId)` and must instead look up by
  `razorpay_order_id` (new repo fn `getPaymentByRazorpayOrderId`).
- **v1 FORBIDS mixing campaign-level and milestone payments on one campaign**, with an explicit
  guard and a clear error. Partial-release machinery (`released_amount` or child rows) is a real
  feature and will not be invented under time pressure.
- ✅ **Migration 030 permits `'pending'`** — verified in the route source:
  `CHECK (status IN ('pending','escrowed','released','refunded','failed'))`. **No migration needed
  for Phase 1.**

### Downstream needs TWO changes — ledger rows alone are not sufficient

- Both `influencerEarningsRepository` (`:107`) and `process-payouts` (`:85`) **inner-join
  `campaign_influencers`**. With no accepted creator on the campaign, a correct ledger row still
  shows the creator nothing.
- 🔴 **`process-payouts` dedups by `campaign_id`, NOT `payment_id`** (`route.ts:71`). For a
  milestone campaign with several released payments, **only the first ever produces a payout** —
  milestone campaigns would silently underpay. Must be fixed alongside.

### Phasing

| Phase | Content | Status |
|---|---|---|
| **0** | Hide the pay button whenever a paid order exists + honest "Payment received — reconciling" state | **shipped to `main`** |
| 1 | Ledger write (create `pending`, flip at capture + webhook); delete `escrowForMilestone` | approved, not built |
| 2 | Campaign-level release path + `process-payouts` per-payment dedup | approved, not built |
| 3 | Backfill + standing invariant script ("every `paid` order has exactly one ledger row") | **scope now known — see below** |

### ❌ CORRECTION — `escrowForMilestone` was REACHABLE, and was a live defect

The Phase 1 build found the caller that the earlier search missed:

```
UI "Escrow" button  (campaigns/[campaignId]/page.tsx:717 and :811, shown when ms.status='pending')
  → PATCH /api/brand/campaigns/{campaignId}/milestones/{milestoneId}  { action: 'escrow' }
  → escrowForMilestone()
  → campaign_payments row, status:'escrowed' — no Razorpay, no money, no influencerAmount
```

**A brand could fabricate an escrow record by clicking a button.** So this was never a corpse; it
was an active false-ledger path, and defect #1 (writes `'escrowed'` with no money moved) was live
rather than hypothetical. The deletion decision is unchanged and strengthened — but the framing
"deleting a function with no callers" was wrong and the deletion required removing the affordance.

Handled in Phase 1: both buttons removed; the route's `'escrow'` action now returns **410** with a
message pointing at the Payment tab, deliberately not falling through to the generic "Invalid
action" so an old client is told what happened.

⚠️ **Method lesson, now twice in one session:** an unfinished or path-scoped search is not evidence
of absence. The first instance (the bracket trap) produced a false "this UI does not exist"; this
one produced a false "this function has no callers" **that was committed to this document as
fact**. Before writing "zero callers" anywhere, the search must be one that demonstrably completed
over the whole tree.

### ✅ Backfill diagnostic — PRODUCTION IS CLEAN (2026-08-20)

Run read-only against production (`ep-icy-salad-ahjb9nek`):

```
TOTALS: orders_total=0  orders_paid=0  orders_refunded=0  ledger_rows=0
PAID/REFUNDED ORDERS WITH NO LEDGER ROW: 0
UNRECORDED (status='paid'): 0 paise = INR 0
```

**`razorpay_orders` is entirely empty on production — no brand has ever paid.** So there is
**no real money anywhere without a record**, and the ledger gap never reached a paying customer.
The pre-beta hard gate ("no real brand payment until the ledger fix ships AND a rehearsal passes")
held in practice, not just on paper. **The urgency does NOT escalate.**

Consequence for Phase 3: the backfill has **exactly one row to reach, and it is on preview**
(`order_TS1GoYGUZ5vCwb`, ₹50,000, from the rehearsal). Production needs no backfill at all — only
the standing invariant script, which becomes a *regression guard* rather than a cleanup tool. If a
future run of this diagnostic ever returns a non-zero count on production, that is real money with
no record and is a different severity of problem.

Also confirmed **live** (not just from the migration source):

```
chk_campaign_payments_status:       status IN ('pending','escrowed','released','refunded','failed')
chk_campaign_payments_payment_type: payment_type IN ('escrow','milestone','direct')
```

Both present, and `'pending'` is permitted — Phase 1's create-at-order design needs **no migration**.


---

## 🚫 RULE — never report row-level specifics without an executed query (2026-08-26)

**Do not state ids, emails, amounts, dates, counts or table contents unless you have actually
run the query and can show it.** If a table might not exist, say so. If a query returns nothing,
say "zero rows" — **a zero-row result is not permission to describe what the rows would look
like.**

### Why this rule exists

A whole cleanup exercise was built on three "orphaned ₹40,000 payouts" that did not exist.
`influencer_payouts` is **empty on both production and preview**. Production SQL — including
`DELETE` statements — was written and handed over on the strength of them.

⚠️ **The specifics originated in the founder's report, not in a query, and were relayed back
without verification.** That is the failure this rule targets: *repeating unverified specifics
is indistinguishable from inventing them* once they enter a document or a SQL statement. The
provenance is invisible to whoever reads it next.

### The compounding error

The report was accepted even though it **contradicted the diagnosis it was offered as evidence
for**. The `campaign_id` dedup defect causes payouts to be *suppressed* — one per campaign, never
more. Three duplicates on one campaign is the **opposite symptom**. "Failing exactly as diagnosed"
should have been challenged on the spot.

**Corroboration that cannot physically follow from your own diagnosis is not corroboration.**

### Related failure: writing SQL that cannot be executed

Neon was unreachable from the dev machine for this entire stretch (pooled and direct, consistent
`ECONNRESET`, while both deployments served HTTP 200). Every query handed over was untested, and
two were broken because the schema was recalled rather than read:
- `payout_requests.created_at` — the column is `requested_at`
- `influencer_payouts.campaign_payment_id` — did not exist yet; migration 038 had not run

**If you cannot run a query, say so and do not hand over destructive SQL.** Reading the column
list out of `schema.ts` costs seconds and was skipped twice.

### What Phase 2 actually rests on

Static analysis only. Nothing in it derives from production data:
- `process-payouts/route.ts:69-72` — `NOT EXISTS` correlating on `campaign_id`
- `schema.ts:1991-2017` — no `campaign_payment_id` column
- `release/[campaignId]/route.ts:47,88` — `milestoneId` was required

The dedup defect is **real in code and has NEVER FIRED** — `influencer_payouts` has 0 rows, so the
job has never successfully created a payout. Do not describe it as observed behaviour.

⚠️ **Correction to `a86345f`/`24da642` commit messages:** migration 038's backfill is described as
"load-bearing". It is **not**. It was justified by pre-existing unlinked payout rows that do not
exist, so it is defensive only and will report `linked 0, still_unlinked 0`. The column, FK and
index are still required for the dedup fix; the backfill is not.

### Still standing on its own merits

- **Campaign-level release** — demonstrable from real preview data: two `escrowed` payments with
  `milestone_id NULL`, and the old route required `milestoneId`. That money had no route out.
- **Dedup fix** — latent defect, still wrong, still worth fixing.
- **`RAZORPAYX_ENABLED`** — three sources disagreed; verified in code.

---

## ✅ PHASE 2 VERIFIED END-TO-END ON PREVIEW (2026-08-27)

**Evidence, not assertion.** Founder-executed on the preview deployment; values below are the
observed rows, not expected ones.

### The run

| Step | Result |
|---|---|
| Release (console `fetch`, campaign-level, `milestoneId` omitted) | succeeded |
| `process-payouts` run 1 | `processed: 1, manual: 1` |
| `process-payouts` run 2 | `processed: 0` — still exactly one payout row |

### The payout row

```
campaign_payment_id : c1819e0a-557a-4141-b9d1-9d1794daa384   ← non-null
amount              : 53640        (NET — not the 59600 gross)
status              : pending      (admin manual queue)
RazorpayX           : off          (build-time constant, correct)
```

### What each value proves

- **`campaign_payment_id` non-null** — the job read the ledger and wrote the link. This is the
  mechanism, not a side effect: it is what the new dedup predicate matches on.
- **53640, not 59600** — paid from `campaign_payments.influencer_amount`, net of the 10% platform
  fee, NOT from the gross order amount and not from `agreed_rate`.
- **Second run `processed: 0`** — dedup by `payment_id` holds. Under the old `campaign_id`
  predicate this row would have been invisible (its `campaign_payment_id` would not exist), so
  this is the specific regression the migration guards.
- **`status: pending`** — RazorpayX correctly off; payout sits in the admin manual queue.

⚠️ **Campaign-level release had NO UI** — done from a browser console. See the missing-release-UI
item; a brand cannot do this today.

### Schema drift, both databases (founder-run)

**Preview and production are identical — 17 rows each.** Not drifted from each other.

- **6 "missing columns" are FALSE POSITIVES** — the generator reads index/constraint names out of
  `schema.ts` comment lines as if they were columns. The extractor needs to skip comments.
- **Extra columns are expected**: `search_vector` / `embedding` (created by raw SQL, deliberately
  not Drizzle-declared) and the `retention_cohorts` day columns.
- 🔎 **One real finding: `feedback.consent_images` exists in BOTH databases but is NOT declared in
  `schema.ts`.** `survey_responses` declares all three consent flags (`schema.ts:158-160`);
  `feedback` declares only `consent_audio` + `consent_video` (`:351-352`). Since the three bare
  `db.select().from(feedback)` callers expand to declared columns only, a recorded image consent
  is currently **absent from the DSAR export and the user data export** — a compliance-relevant
  omission, not just tidiness. Adding it is the SAFE direction (database already has the column,
  unlike `campaign_payment_id` where the schema led the DB and broke production).

---

## 🔴 PAYMENT LEDGER INVARIANT GUARD — escalation rule (2026-08-28)

Lives in **`/api/cron/sync-razorpay-status`**, not a script. A check someone has to remember
to run is a check that stops being run.

### 🔴 THE ESCALATION RULE

**A non-zero result ON PRODUCTION means REAL MONEY MOVED WITHOUT A LEDGER ROW. That is an
ALARM, not a backlog item.** Both invariants are supposed to be structurally impossible;
violating one means the write path is broken and **every subsequent payment is at risk until
it is found**. Stop and investigate before the next payment is taken.

A non-zero result on **preview** is almost always a test artefact — investigate at leisure.

### The two invariants

**(A) Every `paid`/`refunded` razorpay_order has EXACTLY ONE `campaign_payments` row.**
Zero = money moved and was never recorded (the original Phase 1 gap). More than one =
double-count.

**(B) No `released` payment has more than one payout.** Regression guard for the
`campaign_id` → `payment_id` dedup (migration 038). Only became meaningful once the dedup
keyed on payment — under the old predicate a second payout was impossible for a *different*
reason, which is why this check would have been vacuous before.

### Why this host

- Payment domain already; **runs 07:00 UTC, one hour after `process-payouts` at 06:00**, so it
  inspects the ledger immediately after the job that writes to it
- Was otherwise a **no-op** while `RAZORPAYX_ENABLED` is false — an idle cron slot
- Already `withCronRun`-wrapped, so a **500 records `status='error'`** rather than 'ok'
- No 34th `vercel.json` entry (there are already 33)

⚠️ **A guard that cannot run is not a passing guard.** If the invariant queries themselves
throw, that is recorded as a failure rather than allowed to read as a clean ledger.

### Same `success: true` bug found here

`sync-razorpay-status` had the identical hardcoded `success: true` + swallowed-catch pattern
as `process-payouts`. Fixed the same way: `criticalError` flag, `success` computed, **HTTP 500
on crash or violation** so `withCronRun` records `'error'`.

---

## 📋 SCOPED, NOT BUILT — influencer content status PATCH (2026-08-28)

`PATCH /api/influencer/content/[postId]` accepts **any** `body.status` and passes it straight
to `updatePostStatus`. Ownership is checked; **the transition is not.** A creator can set
`published`, `approved`, `archived`, `removed`, or flip a **rejected** post back to
`published`.

⚠️ **This does NOT compromise the release gate** — that keys on `reviewed_at`/`reviewed_by`,
which are absent from the route's allow-list and written only by brand-owned
`markPostApproved`/`markPostRejected`. Fixing the PATCH closes the hole properly; the gate
never depended on it.

Proposed split (founder decision pending):

| Transition | Who |
|---|---|
| `draft → pending_review` | creator (the core submit action) |
| `rejected → pending_review` | creator (`resubmission_count` / `previous_post_id` exist for this) |
| `draft → archived` | creator |
| `pending_review → approved` / `rejected` | **brand only** |
| `→ published` | **brand only** (`markPostApproved` writes it) |
| `approved`/`published` → anything | **brand only** — post-approval state is the payment gate |
| `→ removed` | **brand/admin only** (moderation) |

Two open judgement calls: (1) may a creator withdraw a `pending_review` post — races an
in-progress review, and rejection already gives a path back; (2) may a creator archive an
`approved` post — after Phase 2 an approved post is *payment authorisation*, so archiving one
rewrites the audit trail.

⚠️ **`approved` is DEAD** — nothing in the codebase writes it (`markPostApproved` writes
`'published'`). Either wire it or drop it from the union. Leaving a dead member in a union
that now gates payment is how the next person builds on a value that never occurs.

Implementation when decided: an explicit `ALLOWED_INFLUENCER_TRANSITIONS: Record<from, to[]>`
in the route, 400 naming the attempted transition — same idiom as `VALID_TRANSITIONS` in
`campaignManagementService`, so there is one state-machine pattern rather than two.

---

## 🕵️ cron_runs WAS UNRELIABLE IN TWO DISTINCT WAYS (2026-08-28)

Migration 037 exists so that *did nothing* / *crashed* / *never fired* are distinguishable.
Twice that was silently untrue. **If `cron_runs` is ever wrong again, start here rather than
rediscovering both.**

### Failure 1 — a crashed run returned 200 and recorded 'ok'

`withCronRun` recorded `status='ok'` for anything the handler **RETURNED**, reserving `'error'`
for what **THREW**. Any route that caught its own exception and returned was written as a clean
run.

Observed on preview:
```
success: true, processed: 0,
errors: {Critical: column influencer_payouts.campaign_payment_id does not exist}
```
HTTP 200, `cron_runs.status = 'ok'`. A crash that looked like a clean no-op.

**Closed by** (`94b3ff3`): the wrapper now records `'error'` for a returned **5xx**; and
`process-payouts` returns 500 with `criticalError: true` instead of a hardcoded
`success: true`. Later the same treatment for `sync-razorpay-status` (`e1dc598`), which had
the identical copied idiom.

### Failure 2 — plain-object returns have no status to inspect

⚠️ **The fix above only covers the `NextResponse` branch.** A handler returning a **plain
object** goes through `finishRun(..., 'ok', { result: body })`, where there is no HTTP status,
so a 5xx check cannot see it.

**`cron/process-social-mentions` is in exactly this state and is NOT fixed**: two top-level
catches push into `results.errors`, then it returns `{ success: true, ...results }` as a plain
object. Errors present, recorded `'ok'`.

Deliberately not "fixed" by teaching the wrapper to read `body.success`: the wrapper must not
infer meaning from an arbitrary route's body shape — that is the same reasoning that made
status the only signal it consults. The route should signal failure itself (throw, or return a
`NextResponse` with 500).

### Sweep of all 33 (2026-08-28)

- **28** hardcode `success: true`, but **26 let exceptions propagate** → `withCronRun` records
  `'error'` correctly. Those are fine.
- **2** had the swallow-and-claim pattern: `process-payouts`, `sync-razorpay-status` — **both
  fixed**.
- **1** has it and remains open: **`process-social-mentions`** (plain-object return).
- **3** catch and return 200 without claiming success — `cleanup-notifications`,
  `compute-financial-snapshots`, `compute-platform-metrics`. Still recorded `'ok'` on a caught
  failure. Lower severity, not fixed.

---

## ⚖️ OPEN DESIGN DECISION — the multi-creator 409 is UNTESTED, not validated

`/api/payments/release/[campaignId]` returns **409 `multi_creator_campaign_level`** when a
campaign-level payment has more than one active creator, on the grounds that one payment with
no per-creator split has no defensible allocation.

🔎 **Production evidence (founder-run, 2026-08-28): ZERO multi-creator campaigns, and 107
campaigns with no creator at all.** So the rule has **never been exercised** — the door has
not been used, which is not the same as the door being right.

**Record this as open, not settled.** The first genuine two-creator campaign-level campaign
will hit the 409 and be unable to pay anyone. At that point it needs either a creator picker
or an explicit allocation rule; refusing is only defensible while the case is hypothetical.

That 107 campaigns have no creator at all is worth its own look — it suggests campaigns are
being created far more often than they are being staffed.

---

## ⚠️ THE 500 IS LOAD-BEARING — do not "tidy" it into a 200 (2026-08-31)

**`sync-razorpay-status` returns HTTP 500 when a ledger invariant is violated. That status
IS the alarm.** `withCronRun` decides `cron_runs.status` from the returned HTTP status —
`>= 500` records `'error'`, anything else records `'ok'`. Change the violation path to a 200
with the detail in the body and the run is recorded as **clean**; nothing anywhere would
indicate the alarm had stopped working.

This is not hypothetical. It is exactly the state the wrapper was in before `94b3ff3`:
`process-payouts` caught a missing-column error, returned 200 with the error inside
`errors[]`, and `cron_runs` said `'ok'`. A crashed job was indistinguishable from a clean
no-op run.

So the chain is: **violation → 500 → `withCronRun` records `'error'` → visible in
`cron_runs` without anyone running a query.** Removing any link silences it.

⚠️ The wrapper deliberately does NOT inspect `body.success` — it cannot know what an
arbitrary route's body shape means, so status is the only signal it consults. That is also
why `process-social-mentions` (plain-object return, no status) is still unprotected.

Where to look if it fires:
```sql
SELECT started_at, status, duration_ms, result, error
FROM cron_runs
WHERE job_name = 'sync-razorpay-status' AND status = 'error'
ORDER BY started_at DESC LIMIT 10;
```
Offending rows are under `result.ledgerInvariants`. ⚠️ `result` is **capped at 8000 chars**
by `truncateForStorage` — a mass violation stores `{ truncated: true, preview: … }`, so the
HTTP response is the complete record and `cron_runs` is the durable-but-capped one.

---

## 🔴 RULE — env-check must report EVERY variable a feature needs, not a subset

**Silently omitting a required variable has now cost three separate debugging rounds:**

| Round | Reported | Actually missing | Symptom |
|---|---|---|---|
| 1 | `RAZORPAY_KEY_ID` mode only | **`RAZORPAY_KEY_SECRET`** (not reported at all) | `create-order` 500s; "both keys read test" was true and useless |
| 2 | — | **`RESEND_WEBHOOK_SECRET`** | `/api/webhooks/resend` fails closed (503); delivery state blind |
| 3 | `PUSHER_SECRET` only | **`PUSHER_APP_ID` / `PUSHER_KEY`** | `/api/pusher/auth` 500s; real-time silently down |

⚠️ **The pattern is identical each time and it is worse than reporting nothing:** a partial
report reads as a *clean* report. Round 3's preview had `PUSHER_SECRET` scoped, so env-check
said the secret was present and the environment looked correctly configured — while
`getPusherServer()` was throwing on a different variable it never mentioned.

### The rule

**When a feature requires N variables, env-check reports all N — and warns naming the
missing ones.** A diagnostic that answers "is this configured?" with a subset is not a
diagnostic; it is a false negative generator.

Corollary: **a variable that cannot be read is still worth reporting as a presence
boolean.** `RAZORPAY_KEY_SECRET` has no safe mode to display, but `present: true/false`
would have ended round 1 immediately.

Now enforced for Pusher (all three server vars + `NEXT_PUBLIC_PUSHER_KEY`, with a warning
naming the missing ones) and Razorpay. **Apply it to the next feature that gets an
env-check entry.**

---

## 📋 SHARED RESPONSE TYPES — Tier 1 approved, and what stays unfixed

Root cause of the Content Review crash: a page declared its OWN copy of a route's response
shape, so both sides typechecked green against contradictory definitions.

**Measured across `src/app/dashboard/**/page.tsx`:** 37 files declare 85 local types; 38
files make 105 API calls; **~28 pages both fetch and declare a response shape.** 371 route
handlers exist across 303 files.

**Agreed approach: Tier 1 (≈10 pages) + the defensive pattern everywhere.**

⚠️ **This REDUCES the class, it does not eliminate it.** Recording the position explicitly
so it is a known trade rather than an assumption someone later mistakes for coverage:

- **Tier 1 (~10 pages)** get a shared response type — the pages that dereference nested or
  derived fields, where a mismatch THROWS rather than rendering blank.
- **The remaining ~18** keep their local copies and are protected only by the defensive
  pattern (fallbacks on map lookups, null-guards on nested dereferences). They can still
  silently render *wrong* data on a shape change — they just will not blank the page.
- **The other ~340 handlers** are not retrofitted at all.

⚠️ **The estimate is UNVERIFIED in one respect:** whether these routes return inline object
literals (likely — `NextResponse.json({ ...post, slaStatus })`) or already-typed service
results. If inline, each needs its RETURN ANNOTATED before a shared type means anything;
otherwise the page's guess has merely moved to a new file and the two still cannot disagree
detectably. Read the route before trusting the 1–2 day figure.

**Tier 1, ranked by crash risk** (money-adjacent first — `brand/campaigns/[campaignId]`,
`influencer/payouts`, `influencer/earnings`), then `analytics/consumer-intelligence`,
`competitive-intelligence`, `competitive-intelligence/competitors/[id]`, `rewards`,
`my-signals`, `settings`. `brand/content-review` is already done — it is the one that
surfaced this.

---

## 🔗 SHARED RESPONSE TYPES — the pattern, proven on `payments` first (2026-09-01)

Location: **`src/lib/api-types/`**. A neutral directory, deliberately not `src/server/*`:
a client page importing from a server module is exactly what `'server-only'` exists to
prevent, and a neutral module removes the temptation **structurally** rather than relying
on everyone remembering. Types are pulled in with `import type`, which is fully erased, so
no server code reaches the client bundle.

### ⚠️⚠️ NEVER share a service's return type with a client page directly

The obvious move produces a contradiction that **TYPECHECKS** — quieter and worse than the
untyped `any` it replaces:

```
server:  { createdAt: Date }        ← what the service returns
wire:    { createdAt: "2026-…" }    ← JSON has no Date
client:  page believes Date, calls .toISOString(), throws at runtime
```

TypeScript cannot catch it: the shared type asserts the *server's* shape and nothing checks
it against what crosses the wire. Same class as the Content Review crash — page and route
disagreeing while both compile — but **harder to spot**, because there the mismatch sat in
two files and here it hides inside one shared definition that looks authoritative.

**So: a client page imports `Serialized<ServiceReturn>`, never `ServiceReturn`.**

### Why a mapped type, not a hand-written response type per endpoint

Hand-written types drift from the service the moment someone adds a field, and the drift is
**silent** — precisely the failure being removed. Deriving means a new server field appears
on the client type automatically, and a REMOVED field breaks compilation at the page. The
transform is mechanical, so it is expressed once rather than ~10 times.

`Serialized<T>` handles `Date → string`, `Date | null → string | null` (conditional types
distribute over unions), and arrays/nested objects recursively.

⚠️ **Not modelled:** `undefined`-valued keys are DROPPED by `JSON.stringify`, so a required
field assigned `undefined` is absent on the client. Declared-optional (`?:`) fields already
read correctly; a required field holding `undefined` is a server-side bug worth fixing
there rather than modelling here.

### What `payments` showed

⚠️ This endpoint was **not** a page/route contradiction — the page held `useState<any>` and
`const payments: any[]`. That is the **other** failure mode: no false safety, but no check
at all. Nothing was wrong; nothing was verified either. Both modes are in scope for Tier 1,
and the `any` ones are the easier win.

`getCampaignPaymentSummary` has an **inferred** return type, so the response type is derived
via `Awaited<ReturnType<typeof …>>` rather than requiring the service be annotated first.
That is why the "must annotate every route's return" cost estimate was pessimistic for
routes that return a single service result verbatim (`NextResponse.json(summary)`) — those
are minutes each. Routes composing an inline literal (`{ payouts, balance, reputation }`)
still need a declared type and are the ~30-minute case.

### ✅ The pattern was PROVEN, not assumed (2026-09-01)

A clean typecheck after replacing `any` with a derived type proves nothing on its own: if
`Serialized<T>` had silently collapsed to `any`, tsc would be **equally green** and the
pattern would be worthless — applied to nine more endpoints on false confidence.

So it was checked with an assertion that had to FAIL:

```ts
const good: string | null = ... as CampaignPaymentRow['escrowedAt']   // must pass
const bad:  Date   | null = ... as CampaignPaymentRow['escrowedAt']   // must FAIL
```

Result:
```
__probe.ts(11,7): error TS2322: Type 'string | null' is not assignable to type 'Date | null'.
```

`escrowedAt` resolves to **`string | null`** on the client, from `Date | null` on the
server. That confirms the type is live, `Date → string` works, and conditional-type union
distribution works. Probe deleted; it existed only to make the check falsifiable.

⚠️ **Reuse this before trusting any type-level utility.** A check that cannot fail is not a
check — the same reason the ledger invariant guard must return 500 rather than a 200 with
the violation in the body.

---

## 🧪 STANDING RULE — a check that cannot fail is not a check

**Before trusting any guard, assertion, heuristic or type-level utility, ask: could this
produce the opposite result for the right reason?** If it can only ever pass, or can only
ever fire, it carries no information — and a green run is then indistinguishable from a
broken check.

**Three instances in this session alone**, which is why it is written down rather than
rediscovered a fourth time:

### 1. The ledger invariant guard's 500 (`e1dc598`)

`withCronRun` derives `cron_runs.status` from the returned HTTP status. Had the violation
path returned 200 with the detail in the body, a violated invariant would record `'ok'` —
an alarm that can never fire. That was not hypothetical: it is exactly the state
`process-payouts` was in before `94b3ff3`, returning 200 with a fatal error inside
`errors[]`.

### 2. The env-check branch heuristic (still unfixed)

`!/dev|test|staging|preview|branch/i.test(host)` warns that a database "does not look like
a branch". Neon auto-names branch endpoints `ep-wild-frog-…`, matching none of those words,
so it fires on **every correct Neon branch** and cannot distinguish a branch from
production. **A check that always fires is as useless as one that never does** — both are
ignored within a week. The reliable form is comparing against the known production host.

### 3. `Serialized<T>` — green typecheck was ambiguous (`730576b`)

Replacing `any` with a derived type and getting `TSC_EXIT=0` is consistent with two
opposite realities: the type works, **or** the utility collapsed to `any` and nothing is
checked. Both compile clean. Resolved with an assertion that had to fail:

```
__probe.ts(11,7): error TS2322: Type 'string | null' is not assignable to type 'Date | null'
```

Line 11 (`bad: Date | null`) errored; line 8 (`good: string | null`) did not. The
asymmetry is the proof — and the message naming `string | null` shows the transform and
union distribution both worked. Probe deleted afterwards; it existed only to make the
check falsifiable.

### How to apply it

- **A passing test you have never seen fail is an untested test.** Break it once on purpose.
- **A guard that returns success on the failure path is decoration.** Check the status, not
  just the body.
- **A heuristic that fires on every correct case is worse than none** — it trains people to
  ignore the real one.

---

## 📐 TIER 1 — the three shapes, and the FINAL POSITION on what stays unfixed

### Every endpoint falls into one of three shapes. No fourth was found.

**A — absence of typing.** Page held `useState<any>`. No false safety, but nothing checked
either. **Only `payments`** was in this state; the survey found ZERO `useState<any>` across
the other Tier 1 pages.

**B — duplicate definition.** Page hand-copies the server type; they agree the day it is
written. This is the Content Review shape and **the majority**. Fixed by deriving:
`Serialized<ServiceReturn>`, or `Serialized<Awaited<ReturnType<typeof svc>>>` when the
service return is inferred. Sub-case: routes returning `{ key: serviceResult }` — still
derivable, just wrapped.

**C — composed literal over a REDACTED projection.** ⚠️ **Deriving here is ACTIVELY WRONG.**
`/api/payouts/accounts` decrypts account numbers and returns only masked forms, omitting
`accountNumber`, `iban`, `encryptionKeyId`. A derived type would publish the UNREDACTED
shape as the contract. The response type must describe the **projection**, and the route
must be **ANNOTATED** with it — contextual typing then applies excess-property checking, so
adding an unmasked field becomes a compile error rather than a silent leak of decrypted
banking data.

⚠️ **Hand-writing is safe in C and only in C, because the annotation checks it.** Elsewhere
hand-written types drift silently — that is the failure being removed. The annotation is
the difference; remove it and C degrades into B.

### `Serialized<>` is inert in some files and load-bearing in others

- `influencer-earnings` — **inert**: `CampaignDeepDive` already declares `string | null`
  dates.
- `payouts` — **load-bearing**: `initiatedAt` / `completedAt` / `createdAt` are real `Date`s.

⚠️ **The inert cases are the ones at risk of being removed as dead weight**, and removal is
invisible until someone later adds a `Date` to that service. The reasoning is therefore
written into EACH file rather than stated once centrally.

### 🔻 FINAL POSITION — what is NOT covered

Recorded so a future session does not mistake this for coverage:

- **Tier 1 (~10 pages)** get shared types. Page and route can no longer disagree silently.
- **The remaining ~18 pages that both fetch and declare a response shape keep their local
  copies.** They are protected ONLY by the defensive pattern (fallbacks on map lookups,
  null-guards on nested dereferences). ⚠️ **They can still render WRONG DATA on a shape
  change — they just will not blank the page.** That is a deliberate trade, not an
  oversight.
- **~340 route handlers with no dashboard-page consumer are not retrofitted at all.**
- **Nothing here validates at RUNTIME.** These are compile-time contracts. A route that
  returns something other than its declared type — a hand-built literal in an un-annotated
  branch, say — still reaches the client unchecked. Runtime validation (zod at the fetch
  boundary) was NOT done and would be the next tier if this class recurs.
