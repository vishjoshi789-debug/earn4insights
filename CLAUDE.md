# CLAUDE.md — Earn4Insights Developer Guide

> **Last updated:** June 2026 (v14 — pre-launch landing + public-surface audit shipped on top of v13: pricing `/login` redirect fix, legal-page dark-mode readability, real 1200×630 OG/Twitter share card, shared footer on every public page, `contact@`-only mailbox consolidation, data-driven landing feature grids [Consumer 23 / Brand 18 / Influencer 10 with `ComingSoon` badges], expanded DPDP+GDPR privacy policy [pending legal review]. Branch `chore/prelaunch-public-surface-audit`, commit `17216f6` — now merged to `main`. Live-test follow-ups on `main` (`7a5d27f`/`1d37ee5`/`0087c19`): session-aware landing CTAs, consumer always-free copy, first-class influencer signup + `?role=` preselect. v13 — Tier B beta-hardening wave: middleware revival + CSRF enforced on prod, security batch B1–B9, money + data integrity migrations 029/030/031, secret rotation, admin 2FA recovery, brand-flow + survey-lifecycle fixes. Live working detail in `SESSION_RESUME.md`. v12 = E-Lens brand fully wired; ALL TIER A COMPLETE).
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
- **CSRF is enforced in middleware, not per-route.** `src/middleware.ts` runs the double-submit check on every mutating `/api/*` request. `CSRF_ENFORCE=true` is set (Production-scoped, durability-verified — see gotcha below); a forged/tokenless mutation gets a `403` (`x-mw-decision: csrf-403`) *before* the handler runs. (Was log-only during rollout; the `CSRF_ENFORCE` toggle still exists as a kill-switch.)
- **Mutating requests need `X-CSRF-Token`.** Cookie is `e4i-csrf` (sameSite=lax, httpOnly=false). Token is distributed via `<meta name="csrf-token">` in the root layout. `apiPost`/`apiPatch`/etc. attach it natively; the global `CsrfFetchProvider` patches `window.fetch` to cover the ~104 raw-fetch mutations that don't.
- **Middleware MUST live at `src/middleware.ts`.** It was previously at the project root, so Next.js never registered it — middleware was silently *dead* on Vercel (the root cause the whole `fix/middleware-edge-split` branch addressed; CSRF, the 2FA edge interlock, and auth redirects were all no-ops until this moved). If middleware behavior ever "isn't running," check its location first.
- **Edge-safe split is mandatory — middleware runs on the Edge runtime.** `node:crypto`/`postgres`/the full NextAuth config crash the Edge bundle. So: auth is split into `src/lib/auth/auth.edge.ts` (+ `authCallbacks.ts`) for the middleware's `auth()`, `validateCsrfEdge` is a pure-JS constant-time compare (the shared `csrf.ts` validator pulls in `node:crypto`), and `csrf.ts` token gen/compare uses **Web Crypto**, not `node:crypto`. Don't import node-only modules into anything middleware touches.
- **Behavioral exempt rule (Option 2).** Middleware enforces on mutating `/api/*` EXCEPT the exempt prefixes (`/api/auth/ /api/webhooks/ /api/cron/ /api/jobs/ /api/pusher/ /api/csrf/`) and auto-skips any request carrying `Authorization: Bearer` / `x-admin-api-key` / `x-api-key` (token-authed = no cookie-CSRF surface). Self-maintaining for future routes.
- **`/api/analytics/track` is exempt; `/api/track-event` is NOT — do not "consistency-fix" this.** `analytics/track` is **unauthenticated** fire-and-forget telemetry sent via `navigator.sendBeacon`, which structurally cannot carry an `X-CSRF-Token` header and has no per-user side effect (IP rate-limited anonymous insert) → not a CSRF surface → exempt. `track-event` is **session-authed** (writes user-scoped `userEvents`) and is called via a normal `fetch` the interceptor patches → it stays enforced. The rule: unauthed/beacon → exempt; authed mutation → keep enforced + ensure the callsite uses a patchable `fetch`/`apiPost`.
- **`/api/csrf/init` is the safety-net.** Middleware does not reliably set `e4i-csrf` on some redirect paths (observed on `/onboarding`, `/dashboard/settings` post-auth). Client callsites that need certainty `await fetch('/api/csrf/init')` before the first mutating request. Belt-and-suspenders; middleware is primary.
- **Cron routes use Bearer auth, not CSRF.** Covered by the exempt-prefix + token-authed skip above.
- **GOTCHA — `CSRF_ENFORCE` "vanished" in the Vercel UI during rollout.** Had to re-set it a few times before it persisted, and an env-var change only binds on a *fresh deploy after the save*. Durability check that proved it stuck: confirm `CSRF_ENFORCE=true` is listed at project level with **Production** ticked, then run the tokenless curl again **after an unrelated redeploy** — a surviving `403` means it's durably bound, not a one-deployment fluke. Re-run this if enforcement ever silently regresses.

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
- **Signup role → capability flags (3.5B).** `createUser` (`userStore.ts`) sets exactly one flag from the chosen role: `isBrand/isConsumer/isInfluencer = (role === …)`. So a **pure influencer** (signed up directly as influencer → `/onboarding`) has **`isConsumer=false` and no consumer view**; the header `RoleSwitcher` only renders for accounts with **≥2** capability flags (e.g. a consumer who later did "Become an Influencer" → both `isConsumer`+`isInfluencer`). One email = one account; there is currently **no in-app influencer→consumer capability-add** (only the consumer→influencer direction). The public landing CTAs are **session-aware** (`src/components/landing-ctas.tsx`): logged-in users see "Go to Dashboard" instead of role "Get Started Free" (avoids the middleware `/signup`→`/dashboard` bounce dumping them somewhere unrelated), and the signup page honors `?role=` to preselect the role.
- **Role-specific server layout guards (ER.1).** `/dashboard/influencer/layout.tsx` redirects non-influencers to `/dashboard?upgrade=influencer`; `/dashboard/brand/layout.tsx` redirects non-brands to `/dashboard?upgrade=brand`. Admin bypasses both. Replaces per-page client-side `router.push('/dashboard')` patterns that flashed content.
- **Email verification provider (EV.3).** Single shared `EmailVerificationProvider` mounted in `dashboard/layout.tsx` powers L1 banner, L2 context banners, L3 sidebar locks, L4 button intercepts, settings card. 60s background poll + tab-focus revalidation + `refresh()` after resend. Fail-open: endpoint errors → treated as verified → no nag (server hard-block is still source of truth).
- **EV `openEmailVerificationPrompt()` helper.** Dispatches the same `e4i:email-not-verified` window event that the api-client 403 interceptor dispatches. Lets Layer 4 disabled-style buttons short-circuit to the modal WITHOUT making a doomed network call.
- **Admin pages MUST be wrapped in `/admin/layout.tsx`.** Without it, admin pages fall back to the root layout (no sidebar). The layout mounts `ActiveViewProvider defaultView='admin'` + `DashboardShell` + `EmailVerificationProvider` + `ChatWidget`, plus a role guard redirecting non-admins to `/dashboard`. Mirror of `dashboard/layout.tsx` minus OnboardingGuard / banner / ConsentRenewal (admin doesn't need consumer-onboarding chain).
- **Sidebar count badges follow one pattern.** Brand alerts (`/dashboard/alerts`) + admin Verification Queue (`/admin/verification-requests`) both poll every 30s, gated on `userRole !== <role>`, paused while tab hidden via `isVisible.current` ref. Read by `SidebarNav` via props. Adding a third count-badged item = add state + poller in `DashboardShell` + pass through to `SidebarNav` + render branch in the map.
- **Influencer verification = 3-tier auto-decision + 8 checks.** `evaluateVerificationRequest(userId)` is pure read-only. Tier 1 auto-approve flips `influencer_profiles.verification_status = 'verified'` atomically with the request row insert. Tier 2 lands in admin queue. Tier 3 hard-floor failures auto-reject (no cooldown — user fixes + re-submits). Tunable via `VERIFICATION_THRESHOLDS` in `src/lib/config/verificationThresholds.ts`.

### Encryption
- **TOTP/account-number/IBAN use versioned encryption.** Store `encryption_key_id` alongside ciphertext so `decryptFromStorage()` finds the right key. Env carries only versioned keys (`ENCRYPTION_KEY_v1`), not a bare `ENCRYPTION_KEY`.
- **Decrypt before slicing.** `accountNumber.slice(-4)` on ciphertext leaks ciphertext, not last-4. Always `decryptFromStorage()` first.

### Styling / Dark theme
- **The app is FORCE-DARK** — `<html className="...dark">` in `layout.tsx` (no theme toggle). Default text is light. So **never ship a light-theme component** without an explicit dark treatment, or it renders unreadable (light-on-light). Two recurring forms:
  - **Light card/row backgrounds** (`bg-white`, `bg-*-50`, `bg-*-100`) with no text color → titles/labels fall back to the light default foreground → **white-on-white**. Either give the element explicit dark text (`text-gray-900` etc.) OR — preferred — use the dark card pattern the app already uses: `border-*-700 bg-*-900/50` cards, `bg-muted` / `bg-background/40` rows, default light text, `*-200`/`*-400` accents. (Bit twice: the `/transparency` GDPR card `d60178e`, and the legal `prose` pages — see next bullet.)
  - **Tailwind Typography `prose`** needs **`dark:prose-invert`** or it sets near-black text on the dark bg → unreadable. Every `prose` block must carry it (privacy/terms/refund/top-products were missing it, fixed in `17216f6`).
- **Brand palette, not raw colors.** Use `text-primary`/`bg-primary` (indigo), `accent`, and the brand CSS tokens in `globals.css` over hardcoded `purple-700`/`blue-600` where a brand color is meant.

### VS Code / Session Recovery
- Session crashed mid-task → restart VS Code, re-run `npm run dev` on port `9002`, run `git status` before continuing.
- Lock-file / unfamiliar files → investigate before deleting; may be in-progress work.
- Never `git push --force` without explicit user instruction.

### Scheduled launches
- Cron flips status with a `WHERE launch_status='scheduled'` guard, so a concurrent retry returns null and skips side-effects.
- All launch side-effects (brand email, smart distribution, watchlist fan-out) fire **only when the cron publishes** — not at schedule time.
- Datetime input `min` = now + 1h (cron cadence is ~15 min; 1h floor sets the "planning tool, not delayed-launch button" expectation).

### Surveys
- **Surveys are live-on-create.** `createSurvey` sets `status:'active'` (+ `isActive:true`). The schema column `surveys.status` defaults to `'draft'`, and the `createNPSSurvey`/`createCSATSurvey` type helpers set only `isActive` — so before the fix every survey was born `draft` → permanently "Inactive" badge + the consumer `/survey/[id]` "responses are for testing only" banner, even though `createSurvey` fans out bell + email telling consumers to complete it. NPS/CSAT have fixed questions and there's no review step, so create = publish.
- **`status` is the source of truth; `isActive` is a derived read.** `toSurvey` maps `isActive = (status === 'active')`. Writes go through `status` (the repo insert/update only persists `status`). Don't treat `isActive` as independently writable — reconcile to `status` if you touch this.
- **No Pause/Activate UI yet (Tier-B gap).** `toggleSurveyActive(surveyId, isActive)` exists in `surveyService` but has zero callers — there's no toggle on the survey detail/list pages. Acceptable for beta (live-on-create); adding the toggle is the Tier-B follow-up (see §11).
- **Survey notifications fan out on create**, not on a separate publish step (there is none). `createSurvey` does one `findIdealConsumers(productId)` resolve → email (`notifyNewSurvey({ targetUserIds })`) + in-app bell (`dispatchToUsers`), CTA `/survey/[id]` (singular — the only real survey route). The dead `BRAND_SURVEY_CREATED` eventBus handler was removed.
- **Surveys attach to a brand-owned product.** The create page fetches `getProductsByOwner(userId)` and offers a `<Select>`; the brand surveys list scopes by `products.owner_id`. (Was hardcoded to `?productId=demo` → surveys vanished from the brand's list.)

### Verify-email page (token-callback rendering)
- **`export const dynamic = 'force-dynamic'`** on `/verify-email/page.tsx` — token state changes between requests (`used_at` flips), and a cached HTML response would replay stale "success" or "expired" panels for other users. Also defends against Vercel CDN / browser cache replaying broken HTML after a deploy.
- **HTML meta refresh for post-verification redirect.** Uses `<meta http-equiv="refresh" content="3;url=/dashboard">` instead of a `useRouter` client component. Pure HTML primitive — no hydration to fail, no RSC fetch transition. Discovered while debugging an unexplained `error.tsx` digest that fired specifically on the SuccessPanel → `/dashboard` `router.push` transition (root cause TBD; see Known Gaps).
- **Plain `<a>` not `<Link>`** on success/already-used panels — forces full page reload, identical to a direct URL-bar nav. Avoids any client-side router transition that might trip the same unidentified bug.

> Full archive of all ~80 decisions (including historical implementation narratives) → `docs/CLAUDE_HISTORY.md §3`.

---

## 6. Current Sprint

**Active:** **Tier B beta-hardening — Group 1 COMPLETE** (security + money/data + middleware revival), now closing out live-test follow-ups. See `SESSION_RESUME.md` for the working detail and the remaining gates.

Shipped this wave: middleware revival (moved to `src/middleware.ts`, Edge-safe auth/CSRF split, **CSRF enforced on prod**); security batch B1–B9; money + data integrity (migrations 029/030/031 — money CHECKs + FK on-delete GDPR policy + `process-deletions` rewrite); `ADMIN_API_KEY` + `CRON_SECRET` rotation; admin 2FA recovery + prod 2FA interlock verified; brand-flow fixes (survey product picker, GSTIN field errors, product double-submit guard); survey lifecycle (live-on-create). A9 (influencer verification) was the final Tier A item.

**Pre-beta HARD GATES still in force:**
- **Payment ledger** — campaign-level Razorpay pay creates no `campaign_payments` row; fix deferred to post-launch week-1, **gated**. App is on **LIVE** Razorpay keys (`rzp_live_`) with no test env — **no real brand payment until the ledger fix ships AND an end-to-end rehearsal passes**. (Detail in `SESSION_RESUME.md`.)

**Beta-launch open items (non-blocking):**
- **Survey Pause/Activate toggle (Tier-B)** — `toggleSurveyActive` exists, no UI caller (see §11)
- **Existing-survey backfill** — flip pre-fix drafts: `UPDATE surveys SET status='active', updated_at=now() WHERE status='draft' AND product_id <> 'demo';` (Neon console; idempotent)
- Disk space on C: — clear AppData/anaconda3 bloat (a near-full disk truncated a file mid-write this session)
- Beta-launch announcement + outreach
- Brand-side influencer search (`/dashboard/brand/influencers`) — VerifiedBadge component exists, mount on cards as polish
- Verify-email SuccessPanel UX bug — defensive fixes shipped, verification works end-to-end via meta refresh; root cause `digest 2626478451` parked pending Vercel function-log access
- Broader admin notification bell (verifications + payouts + revenue alerts + support) — currently typed `'brand' | 'consumer'` only; Tier B candidate

**Parked features (intentional, env-flag controlled):**
- WhatsApp UI (`NEXT_PUBLIC_WHATSAPP_ENABLED=false`)
- RazorpayX automatic payouts (`RAZORPAYX_ENABLED=false` — all manual via admin queue)
- Wise / PayPal integrations (stubs pending API credentials)

---

## 7. What's NEW (since last doc sync)

Single-glance view of commits since the previous doc sync. The 2026-06-14/15 rows ship the E-Lens brand wiring; the 2026-06-23→25 rows are the **Tier B beta-hardening** wave (security batch, money + data integrity, middleware revival, brand-flow + survey fixes). Live working detail for the Tier B wave is in **`SESSION_RESUME.md`**; all earlier A9 / EV / ER / Phase-3.5 work is archived in `docs/CLAUDE_HISTORY.md §4`.

| Commit | Date | Summary |
|---|---|---|
| `0087c19`,`1d37ee5`,`7a5d27f` | 2026-06-29 | **fix(landing) — live-test follow-ups (on `main`, after the audit merge):** (1) `7a5d27f` — feature-card secondary CTAs ("Learn More"/"Book a Demo") all → `/contact-us` so a logged-in user browsing another audience's features isn't bounced to their dashboard (consumer/influencer cards had pointed at `/signup`). (2) `1d37ee5` — consumer grid subtext → "Always free for consumers — earn rewards, never pay a thing" (consumers never pay); influencer CTAs → `/signup?role=influencer` + "set up your influencer profile in a quick onboarding" (dropped stale "sign up as a consumer"); **signup now honors `?role=`** (was always defaulting to consumer, ignoring the hero buttons). (3) `0087c19` — **session-aware landing CTAs** (`src/components/landing-ctas.tsx`): logged-in users get "Go to Dashboard" instead of the signup buttons. Account-model note: a pure influencer = `isConsumer=false`, no consumer view (see §5). Detail in `SESSION_RESUME.md`. |
| `17216f6` | 2026-06-29 | **fix(public):** pre-launch landing + public-surface audit (branch `chore/prelaunch-public-surface-audit`, PR open). **Must-fix:** pricing redirected unauth users to `/auth/signin` (a 404) → `/login`; legal pages (privacy/terms/refund/top-products) had `prose` without `dark:prose-invert` → near-black text on dark theme; OG share image was the square 512² app icon → added 1200×630 `next/og` `opengraph-image` + `twitter-image` + `metadataBase`/og `url`/`siteName`/`type`/twitter card. **Should-fix:** hero badge "Now Live"→"Now in Beta"; one shared `SiteFooter` on every public page (was landing-only; +Refund/Transparency links, dynamic year, hidden on `/dashboard`+`/admin`); fixed legal "Last updated" auto-date; all user-facing mailto consolidated to `contact@` (sales/legal/privacy/support were unstaffed). **Feature grids** mined from `DashboardShell` nav → data-driven arrays + `FeatureCard` renderer; Consumer 12→23, Brand 15→18, Influencer 6→10; `ComingSoon` badge on not-live features. **Privacy policy** stub → 14-section DPDP+GDPR draft (⚠️ pending legal review + entity/retention specifics). Detail in `SESSION_RESUME.md`. |
| `4fd56e2` | 2026-06-25 | **fix(survey):** publish surveys on create (`status='active'`). `createSurvey` never set `status`; helpers set only `isActive`, so every survey was born `draft` → permanently "Inactive" + the consumer "for testing only" banner, despite the bell+email fan-out. Founder decision: live-on-create. Backfill SQL for pre-fix drafts in SESSION_RESUME. |
| `3eefa3a` | 2026-06-25 | **fix(brand-flow):** combined commit — (1) survey **product picker** (Create CTA no longer hardcodes `?productId=demo`; create page fetches owned products + `<Select>`, so surveys attach to an owned product and show in the brand list); (2) **GSTIN field errors** surfaced via `actionErrorMessage()` (was generic "Validation failed"); (3) **product double-submit guard** via `useFormStatus()` on `LaunchForm`. |
| `9fc8f2d` | 2026-06-25 | **fix(middleware):** removed the brand-bounce in the `/onboarding` handler that caused `ERR_TOO_MANY_REDIRECTS` for new brands (OnboardingGuard ↔ middleware loop, exposed once middleware went live). |
| _(multiple)_ | 2026-06-23→24 | **Tier B beta-hardening wave** (commit-by-commit detail in `SESSION_RESUME.md`): middleware revival + Edge-safe auth/CSRF split (moved to `src/middleware.ts`; CSRF now **enforced** on prod, `CSRF_ENFORCE=true`); security batch (B1–B9: fail-closed encryption, 2FA loginNonce, diag gating, signed OAuth state, migration allowlist); money + data integrity (migrations 029/030/031 — money CHECKs, FK on-delete GDPR policy, `process-deletions` rewrite); secret rotation (`ADMIN_API_KEY`, `CRON_SECRET`); admin 2FA recovery. |
| `6b941c9` | 2026-06-15 | **fix(brand):** stacked SVG tagline font 9.5→12px + display 160→200 on 6 auth/error/404 callsites — effective on-page tagline ~10px (was ~6.3px), within brand-spec §4 range. |
| `386055e` | 2026-06-15 | **fix(brand):** replace legacy "Intelligence Operating System" tagline with brand-spec positioning statement ("The consumer intelligence infrastructure where brands, consumers, and influencers meet") + bump tagline to `text-sm` across 6 callsites. |
| `99f484e` | 2026-06-15 | **fix(brand):** stacked SVG was missing INFRASTRUCTURE — split tagline into 2 lines (`CONSUMER INTELLIGENCE` / `INFRASTRUCTURE`), bumped tagline letter-spacing to keep within 240 viewBox. |
| `266d291` | 2026-06-15 | **feat(brand):** new E-Lens assets in `public/branding/` — `favicon.svg`, `icon-app-{192,512}.png`, `logo-{horizontal,stacked,primary}-{dark,light}.svg`, `icon-mono-{dark,light}.svg`, `brand-spec.md`. Two-step rename to fix `Branding/` (capital) → `branding/` case mismatch (fatal on Vercel Linux FS, fine locally on Windows). |
| `f8b198d` | 2026-06-14 | **feat(brand): LOGO.2** — favicons + PWA manifest + brand CSS variables. New `src/app/manifest.ts` (Next 15 `MetadataRoute.Manifest`), `viewport.themeColor = '#4F46E5'`, 8 brand CSS variables in `globals.css` (indigo start/end/light, gold tri-tone, ink, near-black, gradient), full `metadata.icons` with svg + apple-touch + 16/32 png. |
| `44b0b99` | 2026-06-14 | **feat(brand): LOGO.1** — variant-aware `Logo` component (4 variants: `icon` / `horizontal` / `stacked` / `primary`; 2 themes: dark/light) + 10 callsites flipped to appropriate variant. Uses `<img>` not `next/image` to avoid `dangerouslyAllowSVG`. Back-compat `size` prop preserved for legacy `<Logo size={48}>` callers. |
| `2051a5c` | 2026-06-14 | **docs:** final sync — A9 + admin layout + Tier A complete milestone. |
| `4c8864d` | 2026-06-14 | **fix(admin):** new `src/app/admin/layout.tsx` (restores sidebar on every `/admin/*` page — previously fell back to root layout with no nav) + Verification Queue unread count badge in sidebar (mirrors brand-alerts pattern, polls every 30s). |
| `cd74a79` | 2026-06-14 | **fix(admin):** `/dashboard` redirects admin role to `/admin/platform-analytics` (founder dashboard) instead of falling through to ConsumerDashboard. |
| `417cfa6` | 2026-06-14 | **feat(auth): A9.2** — `/dashboard/influencer/verification` page (live 8-check checklist + submit form), `/admin/verification-requests` admin queue (Approve / Reject / Request-info dialogs), `VerifiedBadge` component, 6 branded email templates. |
| `d4f7c67` | 2026-06-13 | **feat(auth): A9.1** — migration 028 (`influencer_verification_requests` table + 3 indexes + partial UNIQUE on open requests); `verificationThresholdService` (8-check evaluator + 3-tier decision); `profileCompleteness` extracted into shared module. |

**Older changes that have moved to history:** EV.2/EV.3/ER.1/ER.2 commits + the verify-email defensive trio + the doc-sync stage commits are archived in `docs/CLAUDE_HISTORY.md §4` and `docs/PRELAUNCH_AUDIT_FIX_LOG.md`. The signup UX (`a38f85b`) and EV.1 (`c4b1dce`) entries are in `docs/CLAUDE_HISTORY.md §4.1–4.2`.

### Brand wiring at a glance (LOGO.1 + LOGO.2 + fixes)

- **Component:** `src/components/logo.tsx` — `<Logo variant="icon|horizontal|stacked|primary" theme="dark|light" />` + back-compat `size` prop
- **Assets:** `public/branding/*` (8 SVGs + brand-spec) + `public/favicon.svg` + `public/icon-app-{16,32,192,512}.png` + `public/favicon-{16,32}.png`
- **Metadata:** `src/app/layout.tsx` icons array + Open Graph + `viewport.themeColor`; `src/app/manifest.ts` for PWA
- **CSS tokens:** 8 brand variables in `src/app/globals.css` (indigo start/end/light, gold tri-tone, ink, near-black, gradient)
- **Callsite map:** sidebar header → `horizontal`; landing hero → `primary`; auth (login/signup/forgot/reset) + 404 + 500 → `stacked` (200×167) with positioning tagline below
- **Tagline:** "The consumer intelligence infrastructure where brands, consumers, and influencers meet" (`text-sm`, max-w-22rem)
- **Case sensitivity gotcha:** `Branding/` (capital) is fine on Windows but 404s on Vercel Linux — always commit lowercase folder names; case-rename requires 2-step (folder→tmp→folder) on case-insensitive FS

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
| 028 | `run-migration-028` | Influencer Verification (A9 — `influencer_verification_requests` table with 7-status lifecycle, FK CASCADE → users, partial UNIQUE on open requests) |
| 029 | `run-migration-029` | Money ≥0 CHECKs (campaign_payments, reward_redemptions, rewards) + B18 proposed_rate range + campaign_applications.status enum |
| 030 | `run-migration-030` | status/enum CHECKs (campaign_payments.status + payment_type, reward_redemptions.status) |
| 031 | `run-migration-031` | FK integrity + GDPR-aware on-delete actions (B33) + `process-deletions` cron rewrite. **Polymorphic columns SKIP** (see 032 for the one that slipped through). |
| 032 | `run-migration-032` | Drop erroneous `fk_feedback_media_owner` — 031 wrongly FK'd the **polymorphic** `feedback_media.owner_id` to `users.id`, which broke ALL audio/video/image uploads. Idempotent `DROP CONSTRAINT IF EXISTS`. |

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

### Surveys
- **No Pause/Activate UI (Tier-B follow-up).** Surveys are live-on-create (`status='active'`), but `toggleSurveyActive(surveyId, isActive)` in `surveyService` has zero callers — there's no toggle on `/dashboard/surveys` or the detail page, so a brand can't pause/resume a live survey. Post-launch: add an Activate/Pause control on the detail page wired to `toggleSurveyActive`, and **reconcile `isActive` ↔ `status` to one source of truth** (`isActive` is currently a derived read, ignored on write). See §5 Surveys.
- **`notifyIdealConsumers` / `survey-distribute` route likely dead** — no UI caller; writes the email *queue*, not the bell. Verify + remove in cleanup.

### Auth
- **Verify-email SuccessPanel transition error** — `error.tsx` boundary fires on `/verify-email` after a successful token verification when the page tries to `router.push('/dashboard')`. Defensive fixes (HTML meta refresh, `force-dynamic`, plain `<a>`) sidestep the failure mode and verification works end-to-end. Root cause unknown — needs Vercel function logs to investigate digest `2626478451`. Currently parked as low-impact.
- **A9 — Influencer Verification Flow** — 7th hard-block route from EV.1, deferred pending broader email-verification surface. Now ready as current sprint.

---

## 12. Reference Docs

- **`docs/CLAUDE_HISTORY.md`** — full history: Phase Status table, ~80-row Key Decisions archive, feature notes (EV.1, password UX), audit cross-reference
- **`ARCHITECTURE.md`** — authoritative technical reference (22 sections, all phases)
- **`docs/PRELAUNCH_AUDIT_FIX_LOG.md`** — 6-pass audit journal, Phase 1–3.5 fix narratives
- **`docs/SCHEMA.md`** — all DB table definitions (migrations 002–028)
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
- **`docs/FEATURE11_INFLUENCER_VERIFICATION.md`** — A9 deep dive: 3-tier auto-approval model, 8-check evaluator, admin queue UI, 6 email templates, threshold tuning guide, admin layout pattern, smoke test plan.
