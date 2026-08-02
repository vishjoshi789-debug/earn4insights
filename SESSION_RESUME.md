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
