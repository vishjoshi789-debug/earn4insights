# CLAUDE.md — Earn4Insights Developer Guide

> **Last updated:** August 2026 (**v17 — the "real users are arriving" wave**, `236ee9c`→`593aae9`, 12 commits. Driven by an inventory pass that re-scored every deferred item against *"real people are using this today"* rather than the conditions when it was parked. Shipped: **email delivery truth** (migration 035 + Resend webhook + suppression — `sent` meant "Resend accepted the call", and a suppressed consumer can never verify, which **hard-blocks feedback submission**); **notification preferences UI** (enforced in `dispatchToUser` since day one, settable nowhere — the only way to stop email was marking spam, which manufactured the suppressions the webhook now catches); **preview-environment groundwork** (migration 036 + `/api/admin/env-check` + `docs/PREVIEW_ENVIRONMENT_SETUP.md`); **survey pause/stop**; **the payment gate as a CONTROL** (`PAYMENTS_ENABLED`, default OFF — the "no brand pays until the ledger is fixed" rule lived only in a doc); and **cron run-records** (migration 037 + `withCronRun` on **all 33 routes** — no job left evidence of execution, so *did nothing* / *crashed* / *never fired* were indistinguishable). Two privacy fixes: the **AI feedback summary was serving verbatim consumer quotes to any logged-in user** (breaking three sentences of the published privacy policy — now viewer-scoped with MIN_COHORT_SIZE applied twice), and **intent inference had no consent gate**. Three false affordances removed: two alert toggles with no emitter, and **459 seeded `social_posts` rendered as live social listening**. Recurring theme, now a §5 rule: **complete-looking components gated on an ignition key nobody turned** — competitive intelligence (0 rows in all 9 tables, gated on `competitor_profiles`), social ingestion (gated on `social_listening_rules`, no UI to create one). **Working detail in `SESSION_RESUME.md`.** v16 — feedback identity + the resolution loop, `ffe606b`→`1f22751`. Closes step 4 of the "real-time three-way connection" — the consumer is now told when a brand addresses their feedback, **verified in production 2026-08-04** with one trace in each of `feedback`/`notification_inbox`/`notification_queue`/`realtime_events`. Migration **033** gave `feedback` a real `user_id` FK (`ON DELETE SET NULL`, founder-approved deviation from 031's PII→CASCADE) with a **provenance-aware** backfill — a naive email join claimed "23/23 backfillable", the honest number is **5 of 23**, because 18 imported rows carry the *importing brand's* address. That same email confusion produced two live defects, both fixed: `process-deletions` **hard-DELETEd** feedback by email (a real data-loss exposure — erasing that brand would have destroyed 18 rows of third-party feedback, now a PII scrub), and `/api/feedback/my` matched on email so a brand account was **listing 18 strangers' feedback as its own**. Migration **034** added the notify-once claim key. Corruption fixed in all **three** ingestion paths (`status:'approved'`, the `session.user.email` fallback, a missing `importSource`). New rules: migration routes are a **two-file change** (route + middleware allowlist); a new `feedback` column must be applied **before** the deploy. Known gaps logged: notification preferences are enforced but have **no UI** — do not record as shipped; `resolution_note` ships unwritten pending moderation design. **Working detail + the verification record in `SESSION_RESUME.md`.** v15 — access-control + media-integrity wave, 19 commits `61b31af`→`c3c2767`. Two security batches closed 9 ownership defects (unauthenticated `'use server'` exports, IDORs, unowned media, missing consent gate) and established a **uniform admin-bypass policy** (`lib/auth/roles.ts`) plus **fail-closed-on-null-`owner_id`**. Two incidents recorded and remediated: **consumer media served from unauthenticated public Blob URLs** (proxy-only rendering + all 8 objects rotated, old URLs now 404) and **silent recordings accepted with Whisper hallucinations entering analytics** (level meter + silence gate on all 6 capture paths; backfill fixed 2 wrong sentiments). Shipped **direct-feedback filtering** and **CSV export** — the capability the pricing page used to falsely advertise — under a new written **claims policy** (`92f7d7b`/`99c9c64`). Known gaps logged: email delivery has no bounce/suppression visibility; `.next` corrupts on a near-full disk. **Working detail + all incident records in `SESSION_RESUME.md`.** v14 — pre-launch landing + public-surface audit shipped on top of v13: pricing `/login` redirect fix, legal-page dark-mode readability, real 1200×630 OG/Twitter share card, shared footer on every public page, `contact@`-only mailbox consolidation, data-driven landing feature grids [Consumer 23 / Brand 18 / Influencer 10 with `ComingSoon` badges], expanded DPDP+GDPR privacy policy [pending legal review]. Branch `chore/prelaunch-public-surface-audit`, commit `17216f6` — now merged to `main`. Live-test follow-ups on `main` (`7a5d27f`/`1d37ee5`/`0087c19`): session-aware landing CTAs, consumer always-free copy, first-class influencer signup + `?role=` preselect. v13 — Tier B beta-hardening wave: middleware revival + CSRF enforced on prod, security batch B1–B9, money + data integrity migrations 029/030/031, secret rotation, admin 2FA recovery, brand-flow + survey-lifecycle fixes. Live working detail in `SESSION_RESUME.md`. v12 = E-Lens brand fully wired; ALL TIER A COMPLETE).
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
- **Creating `run-migration-NNN` is a TWO-FILE change** — the route **and** its path in `PUBLIC_API_ADMIN_PATHS` (`src/middleware.ts`). That set is a deliberate exact allowlist (security batch B1–B9) so a new migration route isn't silently public; the cost is that a missing entry makes the route **unreachable**, with middleware returning `401 {"error":"Unauthorized"}` before route resolution — **byte-identical to a wrong `ADMIN_API_KEY`**, so the natural next move is to go re-check the key, which is not the problem. 033 shipped without it. Diagnostic: probe a migration number that doesn't exist (e.g. `run-migration-099`); if that also returns `401` rather than `404`, the 401 is middleware. Confirm with the response header — `X-Mw-Decision: redirect` = blocked by middleware, `continue` = reached the handler.
- **A new column on `feedback` breaks three bare selects until the migration runs.** `api/user/export-data/route.ts`, `server/analytics/unifiedAnalyticsService.ts` and `server/dsarService.ts` do `db.select().from(feedback)`, which Drizzle expands to every column in the schema. So the **schema change must precede the deploy**, not follow it — and the migration route ships *with* the code, which is the chicken-and-egg. Standard sequence: paste the additive SQL into the Neon console first, deploy, then run the route as an idempotent confirming no-op that still prints its coverage line. Used for 033 and 034; zero downtime both times.

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

### Ownership & access control (v15 — do not weaken these)
- **Ownership checks FAIL CLOSED on a null `owner_id`.** `products.owner_id` is **nullable by design** (`schema.ts:72` — "null for unclaimed placeholders", consumer-created products pending verification). So `if (ownerId && ownerId !== session.user.id)` is a **hole**, not a check: it grants access to every unclaimed product. Always `if (!ownerId || ownerId !== session.user.id) deny`. Two live fail-open instances were fixed this way (`analytics/segments`, `analytics/consumer-intelligence`).
- **Admins bypass ownership platform-wide, via one helper.** `isAdminSession()` in `src/lib/auth/roles.ts` is the single home for the `(role as string) === 'admin'` cast §5 requires. **Every** ownership gate consults it (10 callsites). Adding a new gate? Consult the helper — do not reintroduce a local cast, and do not leave the gate admin-blind (`/dashboard/surveys` deliberately gives admins a platform-wide list, so an admin-blind gate 404s their own links).
- **`'use server'` files are directly-invokable endpoints, not just their button's callback.** Every exported action must re-derive authorization itself. Three separate holes came from assuming otherwise: `exportResponsesToCSV`, the 7 `saveStep*`/`completeProfile` profile writes, and `exportFeedbackToCSV`. Pattern: a private `assert…OwnedByCaller()` as the **first statement**, raising ONE generic error for every failure mode so ids can't be probed.
- **Gate the exposure, not always the page.** `/dashboard/products/[productId]` is a **shared catalog** page every role legitimately browses — an owner-only gate there breaks consumer browsing. `<RecentFeedback>` (names, emails, media) is gated instead, via the same `canManage` flag that hides the brand-management CTAs. Do not "consistency-fix" this into a page gate.
- **`requireRole('brand')` throws for admins** *before* any ownership check can run. Fine for a secondary path, blocking when it's the only path — it made the media proxy admin-inaccessible.

### Media (v15 — Blob is public-read; see the incident record in `SESSION_RESUME.md`)
- **NEVER render `feedbackMedia.storageKey` in a page.** Vercel Blob has **no private-read mode**; every object is `access: 'public'`, so `storageKey` is an unauthenticated, permanent CDN URL that cannot be revoked once seen. Always render `feedbackMediaUrl(id)` (`src/lib/media/mediaUrl.ts`) → the ownership-checked proxy. This includes **client props**: passing `storageKey` into a `'use client'` component serializes it into the RSC payload and leaks it in page source even if never used in a `src`.
- **The media proxy forwards `Range`.** Raw Blob URLs support range requests; a proxy that doesn't breaks `<video>` seeking. Keep the 206 passthrough (`content-range`/`accept-ranges`).
- **Never put media URLs in exports.** The CSV reports media as per-type *counts* + transcript text. Putting `storageKey` in a downloadable file re-publishes what the 2026-07-31 rotation destroyed, in a form that can never be recalled. `scripts/verify-feedback-export.ts` asserts zero Blob URLs — a regression fails that check.
- **Silent-recording gate.** `createAudioLevelMonitor()` (`lib/media/audioLevelMonitor.ts`) taps the stream read-only for a live meter + silence verdict on **all 6 capture paths** (4 audio + 2 video). Threshold is **peak** amplitude `0.015` across the whole take (not average — speech is bursty) and **fails open** when `AudioContext` is unavailable. **Audio blocks, video WARNS** — deliberately asymmetric: a silent video still carries visual content that is often the entire point (a defect, damaged packaging). Do not make video a hard block.
- **Whisper hallucinates on silence** — it returns `"you"`, `"Thank you"` etc. rather than empty text, so an empty-check does not catch a silent recording. Server-side guard discards a transcript only when **BOTH** a known hallucination **AND** sub-6kbps (DTX floor) agree. `silent_audio` is in `NON_RETRYABLE_ERROR_CODES` — `isTransientError()` treats *unlisted* codes as retryable, so anything new needs that decision made consciously or it burns OpenAI calls forever.

### Claims / marketing copy (v15 — policy, see `SESSION_RESUME.md`)
- **An unlabeled item in a priced feature list is a reason to pay — treat it as contractual.** It must work *today*. Labeled roadmap (`detail: 'Roadmap'`, `comingSoon: true`) is legitimate and both mechanisms already exist; vision copy is fine. **The deadline is the first real payment, not launch.**
- **Check gating before rewording a claim to "the true capability".** Filtering and export both exist now but are **ungated**, so listing either under Pro would advertise as an upgrade something every free user already has — the exact trap that caused `92f7d7b`. Both are deliberately absent from pricing copy until tier enforcement lands.

### Feedback identity + the resolution loop (v16 — do not weaken these)
- **`feedback.user_id` is the ONLY trustworthy identity. Never match on `user_email`.** `api/import/csv` used to fall back to `session.user.email`, so all 18 imported production rows carry the **importing brand's** address. `/api/feedback/my` matched on email and was therefore listing 18 strangers' feedback as that brand's own — a live mis-attribution, fixed in `1f22751`. Any "whose feedback is this" question resolves through `user_id` and stops there; a NULL `user_id` belongs to nobody, not to whoever shares the email string.
- **`user_id` is nullable and always will be** (migration 033) — imported and webhook rows are third-party respondents with no platform account. Today that's **18 of 23 rows**. Features that key off it must degrade to a **silent skip**, never an error.
- **The submit route is the only writer of `user_id`.** `api/feedback/submit` populates it from the session; the three import paths deliberately do not. 033 shipped the column, the backfill, and the FK but *not* the write path, so the column sat inert until `1f22751` — **adding a column + backfill is not the same as adding the write path too.**
- **Notify-once is a conditional claim, not a status read.** `claimResolutionNotification()` does `UPDATE … SET resolution_notified_at = now() WHERE id = $1 AND resolution_notified_at IS NULL RETURNING id`, and the route emits only if a row comes back. Reading `status <> 'addressed'` in app code races two tabs, a double-click on the status dropdown, or a retry. Same shape as the scheduled-launch cron guard. So `addressed → new → addressed` notifies **once, forever**. `resolution_notified_at` is also the only durable "was this consumer ever told?" record — `notification_inbox` rows expire and aren't written when in-app is off.
- **Only the TRANSITION into `addressed` notifies.** `reviewed` deliberately does not: it means someone read it, which is not an outcome, and `/dashboard/my-feedback` already shows that badge passively. `FeedbackStatusButton` is a flat dropdown, so notifying on `reviewed` would fire twice for one act of attention.
- **⚖️ `bypassPersonalizationConsent` is a FOUNDER-APPROVED, deliberately NARROW carve-out** on `DispatchPayload`, set by **one** event type (`consumer.feedback.addressed`). `dispatchToUser` otherwise skips consumers lacking `personalization` consent — right for launches/discounts/ICP suggestions, wrong for a message reporting the outcome of the consumer's **own submission** to the person who made it (DPDP §7 service communication; no inference, no audience). Without it the consumers who actually read the consent screen would silently never learn a brand acted on their feedback. **Relaxing the global gate was considered and REJECTED.** Do not "consistency-fix" the flag away, and before setting it on a new event apply the test: *is the recipient derived from their own prior act, or selected from an audience?*
- **`resolution_note` exists but is deliberately unwritten** (Phase 2). It would be the first user-generated content travelling **brand → consumer**, rendered in-app *and* emailed, so it waits on a real moderation design. The notification copy already has a slot for it, so Phase 2 is UI-only.
- **✅ Notification preferences are now REACHABLE (2026-08-10).** `NotificationPreferencesCard` on `/dashboard/settings` reads/writes `/api/notifications/preferences`; `dispatchToUser` has always consulted `getPreference`. The UI groups ~40 event types into role-appropriate **categories** (one request writes every event in a category) and shows **in-app + email only** — `sendSMS` is a stub that throws, so an SMS switch would be a control that silently does nothing. Categories whose events have **no emitter** (`brand.member.active`, `brand.discount.created`) are deliberately omitted. **Email verification and password reset are NOT gated** by these preferences — they call Resend directly, or an opted-out user would be locked out of their own account.
- **In-app is instant; email is not.** Bell + Pusher fire sub-second. Email is queued and drained by `/api/cron/process-notifications`, which is **`0 6 * * *` (daily, 06:00 UTC)** in `vercel.json`. Trigger it manually with `Authorization: Bearer $CRON_SECRET` when testing. The delivery-visibility gap still applies: `sent` means Resend accepted the call, not delivered.

### 🔌 The ignition-key pattern (v17 — check this FIRST on any "is X built?" question)
- **This codebase's dominant failure mode is a complete-looking component gated on something nobody created.** Assume nothing is wired until you have traced a caller. Confirmed instances: **competitive intelligence** (9 tables, 5 crons, AI service, dashboard — **0 rows in all 9**, because `competitor_profiles` is empty and every loop is `categories = [...competitors]`); **social ingestion** (4 adapters, daily cron, Reddit needs no key — **0 `social_mentions`**, because `social_listening_rules` is empty and **no UI can create one**); `BRAND_SURVEY_CREATED`; `frustration_spike` / `watchlist_milestone`; `getConsumerIntents` (0 callers → `consumer_intents` is write-only); `toggleSurveyActive` (0 callers until `09b2649`).
- **A settings toggle for an event with no emitter is a false claim** — same class as the 14-day-trial promise. Either wire it or remove it; `a66114b` removed two. **A type-union member is not a feature.**
- **Watch for two switches where one is visible and meaningless.** `products.social_listening_enabled` is `true` on 11 of 12 products and **the cron never reads it** — ingestion is gated on `social_listening_rules`. Now renders "Setup required".
- **Diagnose before fixing.** `consumer_intents` had 0 rows and looked like a silent write failure; testing the real regex against the real strings showed **4/5 imported rows match, 0/5 organic rows match** — extraction was correct and the input simply contained no intent language. The obvious fix would have churned working code and missed the actual defect (the survey path). **Insist on provenance before touching anything.**

### Email delivery (v17 — migration 035)
- **`notification_queue.status='sent'` never meant delivered** — only that Resend accepted the call. Real state lives in **`email_deliveries`** + **`email_suppressions`**, written by all three send paths. ⚠️ The verification and influencer emails **bypass the queue entirely**, which is why these are tables and not queue columns.
- **The prod `RESEND_API_KEY` is SENDING-SCOPED.** Every read endpoint 401s `restricted_api_key`. **That does not mean the key is dead** (`POST /emails` works) — and it means **no historical backfill is possible**.
- **`isEmailSuppressed` FAILS OPEN.** A suppression check that failed closed would silently block real users — the exact failure the feature exists to eliminate.
- **Suppression is enforced, not just recorded.** Continuing to mail a bounced address degrades the sending domain for *everyone*; suppressed sends are recorded, never silently dropped.
- ⚠️ **Inert without `RESEND_WEBHOOK_SECRET`** — `/api/webhooks/resend` fails closed (503). Its Svix signature check is its *entire* access control, since `/api/webhooks/` is public + CSRF-exempt.

### Cron observability (v17 — migration 037)
- **All 33 routes are wrapped in `withCronRun`.** Adding a cron without wrapping it makes it invisible. Full detail + the three auth patterns: `docs/CRON_JOBS.md`.
- ⚠️⚠️ **INSERT-AT-START IS LOAD-BEARING.** Do not "optimise" it into one write on completion — a job killed at Vercel's 60s limit never reaches a `finally`, so the stranded `status='running'` row is the only way "fired and died" is observable.
- 🔴 **`if (cronSecret && …)` fails OPEN** on 24 routes — unset `CRON_SECRET` makes them publicly triggerable, **including account deletion**. Especially relevant to a fresh preview env.

### Payments (v17)
- **`PAYMENTS_ENABLED` must be exactly `'true'`; default is OFF.** The "no brand pays until the `campaign_payments` ledger gap is fixed AND rehearsed" rule is now a control, not a promise. ⚠️ **Only order CREATION is gated** — `verify` and the webhook are deliberately open so an in-flight payment can complete; blocking those would take money and record nothing.
- **`NEXT_PUBLIC_PAYMENTS_ENABLED` is cosmetic only** — inlined into the bundle, trivially bypassed. The server flag is the gate.

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

**Active (v17):** **The "real users are arriving" wave — CODE COMPLETE** (`236ee9c`→`593aae9`, 12 commits). Grew out of an inventory pass that re-scored every deferred item against *"real people are using this today"*. Typecheck clean throughout; **none of it is browser-verified.**

Shipped in v17:
- **Email delivery truth** (035) — webhook + suppression + `email_deliveries`. The gap was re-scored from "metrics quality" to **blocking**: a suppressed consumer never gets the verification mail, and verification **hard-blocks feedback submission**, so they look merely inactive. Diagnostic found **18 of 29 users unverified**, incl. 5 real external accounts.
- **Notification preferences UI** — enforced since the real-time layer shipped, settable nowhere. Exposed two bugs: `upsertPreference` **reset unspecified fields to defaults on update** (a withdrawn consent silently reinstated), and the POST route **stored any string unvalidated**.
- **Preview-environment groundwork** — 036, `/api/admin/env-check`, `docs/PREVIEW_ENVIRONMENT_SETUP.md`. Found: **`.env.local` points at the production DB with LIVE Razorpay + live Resend keys.**
- **Survey pause/stop** — exposed **five unauthenticated `'use server'` actions** (anyone could delete any brand's survey by id) and the fact that **pausing didn't stop responses**.
- **Payment gate as a control** — `PAYMENTS_ENABLED`, default OFF.
- **Cron run-records** (037) — `withCronRun` on **all 33 routes**.
- **Two privacy fixes** — the AI summary **leaked verbatim consumer quotes to any logged-in user**, breaking three sentences of the published privacy policy; and **intent inference had no consent gate**.
- **Three false affordances removed** — two emitter-less alert toggles, and **459 seeded `social_posts` shown as live social listening**.

**v17 open — mostly console/verification, not code:**
- ⚠️ **Nothing is browser-verified.** Local login now works (`AUTH_URL` fixed), so this is finally cheap.
- **Resend webhook + `RESEND_WEBHOOK_SECRET` not yet configured** → email delivery is still blind.
- **Preview environment not built** → blocks the payment rehearsal, the ledger fix, and mobile capture testing.
- **Payment ledger still unfixed** — highest-severity item; design-first (campaign vs milestone granularity + `escrowForMilestone` reconciliation), blocked on preview.
- **Auth-absorbing pass + closing the `cronSecret &&` fail-open** — queued as one security-shaped change.

**Previous (v16):** **Feedback identity + the resolution loop — COMPLETE and VERIFIED IN PRODUCTION** (`ffe606b`→`1f22751`). Closes step 4 of the "real-time three-way connection": submit → brand notified → brand acts → **the consumer finds out**. Steps 1–3 were already built; step 4 had no event, no handler and no trigger.

Shipped in v16:
- **Migration 033** — `feedback.user_id` + FK `ON DELETE SET NULL` (founder-approved deviation from 031's PII→CASCADE) with a **provenance-aware** backfill. A naive email join reported "23/23 (100%) backfillable"; the honest number is **5 of 23**, because 18 rows carry the importing brand's address. Also closed a **live data-loss exposure**: `process-deletions` hard-DELETEd feedback by email, so erasing that brand would have destroyed 18 rows of third-party feedback. Now a PII scrub.
- **Import corruption fixed in all THREE ingestion paths** — `status:'approved'` (not in `VALID_STATUSES`, so those rows rendered as "new" forever and could never move through review), the `session.user.email` fallback, and a **missing `importSource` on webhook v1** that would have made webhook rows look organic to 033's provenance filter. Backfill run: 18 rows `approved`→`new`.
- **Migration 034 + the resolution loop** — `consumer.feedback.addressed` event, notify-once via a conditional claim on `resolution_notified_at`, four deliberate silent skips, a narrow founder-approved `bypassPersonalizationConsent` carve-out (DPDP §7 service communication), `?highlight=` deep link. **Verified in production 2026-08-04**: one trace in each of `feedback`, `notification_inbox` (`is_read=true` — actually opened), `notification_queue`, `realtime_events`, all within 130ms.
- **Two blockers found while tracing it** — (1) the 033 FK was **inert**: nothing populated `user_id` on new submissions, so the loop would have reached 5 legacy rows and zero future ones; (2) **`/api/feedback/my` matched on `user_email`**, so a brand account was listing **18 pieces of third-party consumers' feedback as its own**. A live mis-attribution, not a latent risk.

**v16 open items:** the `addressed → new → addressed` toggle and the admin-bypass path aren't click-verified; the queued email hasn't been drained; notification preferences are enforced in code but have **no UI** (do not record as shipped); `resolution_note` awaits a moderation design.

**Previous (v15):** **Access-control + media-integrity wave — COMPLETE** (19 commits, `61b31af`→`c3c2767`). Two security batches, two incidents remediated, filtering + export shipped under a written claims policy. See `SESSION_RESUME.md` for the working detail, both incident records, and the open items below.

Shipped in v15:
- **Security batches 1 & 2** — 9 ownership defects closed across `'use server'` actions, dashboard pages and analytics routes; new `isAdminSession()` helper + uniform admin-bypass policy; fail-closed-on-null-`owner_id` (two live fail-open holes fixed).
- **Blob incident** — consumer media was served from unauthenticated public URLs. Phase 1: proxy-only rendering (12 sites) + Range forwarding + a `storageKey`-in-client-props leak closed. Phase 2: all 8 objects rotated, **old URLs verified 404**. One affected record belonged to a genuine external user.
- **Silent-recording incident** — 4 production recordings were digital silence; Whisper hallucinated `"you"` into feedback text, exports and sentiment. Level meter + silence gate on all 6 capture paths; backfill corrected **2 wrong sentiments**. Verified in production: meter works, muted audio rejected.
- **Feedback filtering + CSV export** — the capability pricing falsely advertised now exists; false claims removed first (`92f7d7b`) and the **claims policy** written down (`99c9c64`).

**v15 open items:** external-user breach-notification (unresolved, queued for legal review with the privacy policy); email delivery has **no bounce/suppression visibility**; browser verification of the Blob proxy playback/seeking still outstanding.

**Previous:** Tier B beta-hardening — Group 1 COMPLETE (security + money/data + middleware revival).

Shipped this wave: middleware revival (moved to `src/middleware.ts`, Edge-safe auth/CSRF split, **CSRF enforced on prod**); security batch B1–B9; money + data integrity (migrations 029/030/031 — money CHECKs + FK on-delete GDPR policy + `process-deletions` rewrite); `ADMIN_API_KEY` + `CRON_SECRET` rotation; admin 2FA recovery + prod 2FA interlock verified; brand-flow fixes (survey product picker, GSTIN field errors, product double-submit guard); survey lifecycle (live-on-create). A9 (influencer verification) was the final Tier A item.

**Pre-beta HARD GATES still in force:**
- **Payment ledger** — campaign-level Razorpay pay creates no `campaign_payments` row; fix deferred to post-launch week-1, **gated**. App is on **LIVE** Razorpay keys (`rzp_live_`) with no test env — **no real brand payment until the ledger fix ships AND an end-to-end rehearsal passes**. (Detail in `SESSION_RESUME.md`.)

**Beta-launch open items (non-blocking):**
- **Survey Pause/Activate toggle (Tier-B)** — `toggleSurveyActive` exists, no UI caller (see §11)
- **Existing-survey backfill** — flip pre-fix drafts: `UPDATE surveys SET status='active', updated_at=now() WHERE status='draft' AND product_id <> 'demo';` (Neon console; idempotent)
- **Disk space on C: — keep headroom above ~10 GB.** Below that, expect **silent corruption of written files**, not just slowness. Three occurrences now: a file truncated mid-write, then `.next` route manifests corrupting twice (symptoms differed completely — first route-group 404s where a route *compiles then renders `/_not-found`*, then 76 `tsc` errors in generated types ending in "Unterminated string literal"). **Fix both times: delete `.next`.** `anaconda3` is already gone; biggest safe reclaims found were the pip cache (~3.4 GB) and npm `_cacache` (~0.5 GB).
- **Email delivery has no bounce/suppression visibility (v15).** `notification_queue.status='sent'` means "Resend accepted the API call", NOT delivered — a suppressed recipient returns HTTP 200 and is silently dropped. A suppressed beta user stops receiving *everything* incl. email verification, which hard-blocks feedback submission, and looks merely inactive. Fix = Resend webhook (`email.delivered`/`bounced`/`complained`) writing real state back. Note the prod `RESEND_API_KEY` is **sending-scoped**: it 401s `restricted_api_key` on `GET /domains` and `/emails/{id}` while `POST /emails` works — that 401 does **not** mean the key is dead.
- **Local dev can't log in** — `AUTH_URL` in `.env.local` points at production, so NextAuth mints `Secure` cookies a browser won't send over plain HTTP. Fix for local = a localhost `AUTH_URL`; founder preference is to test UI against production instead.
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
| `593aae9` | 2026-08-13 | **feat(cron): wrap all 33 routes for run-recording.** Completes 037 — *"no `cron_runs` row"* now means *"didn't run"*, no asterisk. Pattern is **rename + re-export** (`handleGET` + `withCronRun`), with **auth left INLINE for 32 of 33** — a deliberate deviation from the design, because the routes use **three** different auth semantics and preservation had to be true *by construction*, not by reasoning correctly 32 times. ⚠️ **`send-time-analysis` is the only route that does NOT fall open when the secret is unset** — the standard wrapper auth would have silently opened it; caught by reading, missed by any find-and-replace. Wrapper now **discards the row on a 401** (a probe is not a run). |
| `03d558e` | 2026-08-13 | **feat(cron): run records — migration 037 + `withCronRun`.** ~33 jobs left no evidence of execution. ⚠️⚠️ **Insert-at-start is load-bearing** — a job killed at Vercel's 60s limit never reaches a `finally`, so the stranded `status='running'` row is the only way "fired and died" is visible; a write-on-completion design loses exactly the failures this exists to catch. 90-day retention folded into `cleanup-analytics-events`, **finished runs only**. |
| `b79bfcb` | 2026-08-13 | **fix(social): stop presenting seeded posts as live social listening.** 459 `social_posts`, all created 2026-03-21, incl. **instagram/amazon/meta/twitter — platforms with no adapter**, so they cannot have been fetched by any code here. Same class as the mock reviews. Removed the **brand fallback** (a brand owning no products was shown 50 *other* products' posts as their own); honest empty state; `social_listening_enabled` now reads **"Setup required"** — the cron never read that flag. ⚠️ The empty state only bites once the seed rows are deleted. |
| `a66114b` | 2026-08-13 | **fix(alerts): remove two toggles that can never fire.** `frustration_spike` + `watchlist_milestone` had **no emitter** anywhere — also removed from `bootstrapDefaultAlertRules`, which was seeding *enabled* rules for them. Removed rather than wired: both are **baseline-relative** and 23 feedback rows cannot supply a baseline. |
| `560ce5a` | 2026-08-12 | **fix(privacy): consent gate on intent inference.** Deriving "this person is churning" from someone's words is **new processing**, and `alertOnHighIntent` ships the **verbatim phrase** to a brand. Gated at the persistence chokepoint on `collect_behavioral_signals → ['behavioral']` — a category that already existed and **nothing used**. Gates the brand alert by construction. Same lesson as `segmentedAnalytics`: **"the brand can already read the feedback" does not establish a lawful purpose for inferring from it.** |
| `bce86f1` | 2026-08-12 | **fix(intent): never write an email or `''` into an FK'd `user_id`.** `consumer_intents.user_id` is NOT NULL + FK → `users.id` (031), and `responseService` passed `response.userEmail \|\| ''` — **every survey-sourced insert was a guaranteed FK violation, caught and logged**. Third occurrence of this family after 033 and `/api/feedback/my`: **an email is not an id.** |
| `54065ad` | 2026-08-10 | **feat(payments): the gate is a CONTROL, not a promise.** Nothing in the code stopped a brand clicking Pay on LIVE keys with no `campaign_payments` row created. `PAYMENTS_ENABLED` default OFF. ⚠️ **Only order CREATION is gated** — `verify`/webhook stay open so an in-flight payment can complete. |
| `09b2649` | 2026-08-10 | **feat(surveys): pause/stop — and five unauthenticated actions it exposed.** `surveyService` is `'use server'`; **none of its mutating exports checked anything** — anyone could delete any brand's survey by id or create a survey on any product (a spam primitive aimed at our own consumers). Also: **pausing didn't stop responses** — the form rendered regardless. Enforced in `submitSurveyResponse`, because **a control that only hides its own button is not a control**. `toggleSurveyActive(bool)` → `setSurveyStatus(status)`. |
| `30b8728` | 2026-08-10 | **feat(env): migration 036 + `/api/admin/env-check` + preview guide.** Vercel env vars default to **All Environments**, so a preview inherits prod's DB, blob store and **live payment keys** unless each is scoped — the failure mode is a preview quietly charging real cards. env-check never returns a secret. Also fixed **local login** (`AUTH_URL` was production → `Secure` cookies over HTTP), the root cause of most "not verified in a browser" items. |
| `2748212` | 2026-08-10 | **feat(notifications): per-event preference UI — and two bugs it exposed.** ⚠️ `upsertPreference` **reset unspecified fields to defaults on update** — turn email off, toggle anything else, email silently returns: **a withdrawn consent reinstated**. And the POST route **cast any string to `NotifiableEventType` unvalidated**. No SMS toggle (`sendSMS` throws); emitter-less categories omitted; verification + password reset deliberately **not** gated. |
| `68e6d15` | 2026-08-10 | **feat(email): delivery truth — migration 035 + Resend webhook + suppression.** `sent` only meant "Resend accepted the call"; prod read **23 sent, 0 failed** while possibly delivering nothing. Because verification **hard-blocks feedback submission**, a suppressed consumer can never perform the core action and looks inactive. ⚠️ **The prod key is sending-scoped** — every read endpoint 401s, so **no historical backfill is possible**. Bug fixed in passing: `sendEmail` **discarded Resend's `error`** and the caller then marked the row `sent`. |
| `236ee9c` | 2026-08-06 | **fix(privacy): AI summary leaked verbatim consumer feedback to any logged-in user.** `/api/analytics/public-summary` had **no auth** ("Public route — no auth required"), no ownership check, no cohort floor, and `Cache-Control: public`; `ProductHealthCard` mounted it **ungated** on the shared catalog page. Real strings served included *"Earn4Insights downtime is getting frustrating. Third time this month."* Broke **three explicit sentences** of the published privacy policy. Fixed with **viewer scope defaulting to `'public'`**, MIN_COHORT_SIZE **twice**, and `Cache-Control: private` — load-bearing, since a shared cache would hand an owner-scoped body to a non-owner. Non-owners get a **degraded payload, not a 404**: the security is in the SCOPE, not the status code. |
| `1f22751` | 2026-08-04 | **feat(realtime): THE RESOLUTION LOOP — step 4 of the three-way connection.** New `consumer.feedback.addressed` event + migration 034. **Verified in production**: one trace each in `feedback`/`notification_inbox`/`notification_queue`/`realtime_events`, within 130ms, `is_read=true`. Two blockers found while tracing it: **(B1) the 033 FK was INERT** — `api/feedback/submit` never wrote `user_id`, so the loop would have reached 5 legacy rows and zero future ones (*adding a column + backfill ≠ adding the write path*); **(B2) `/api/feedback/my` matched on `user_email`**, and since all 18 imported rows carry the importing brand's address, that brand's page was **listing 18 strangers' feedback as its own** — a live mis-attribution, fixed independently of this feature. Notify-once is a **conditional claim** (`UPDATE … WHERE resolution_notified_at IS NULL RETURNING`), not a status read, so two tabs or a toggle can't double-send. `bypassPersonalizationConsent` is a **narrow founder-approved carve-out** — a service message reporting the outcome of the consumer's own submission is DPDP §7 service communication, not personalization; relaxing the global gate was considered and **rejected**. `resolution_note` ships unwritten (Phase 2 — first brand→consumer UGC needs real moderation). |
| `0080619` | 2026-08-04 | **fix(middleware): allowlist `run-migration-033`.** `ffe606b` shipped the route but not its `PUBLIC_API_ADMIN_PATHS` entry, so middleware returned 401 before route resolution — **indistinguishable from a wrong `ADMIN_API_KEY`**. Creating a migration route is a **two-file change**. Also recorded that 033 was applied via the **Neon console** (Option A, zero-downtime), not the route. |
| `68bd1d3`,`b125d20` | 2026-07-31 | **fix(media): silent recordings + Whisper hallucinations — INCIDENT.** 4 production recordings (2 users, 2 months apart) were **digital silence** (valid WebM/Opus, correct duration + 20ms cadence, but 12 bytes/frame = Opus DTX floor, 1.7 kbps). The recorder code was **correct** — the defect was no signal to the user plus a pipeline that accepted the result. Whisper doesn't return empty text for silence, it **hallucinates**: all 4 transcribed to `"you"`, which also **overwrote `normalized_text`** — the field sentiment and the CSV export read — so **2 of 4 sentiments were wrong** (positives scored neutral). Fix: `createAudioLevelMonitor()` + live meter on **all 6 capture paths** (4 audio + 2 video, incl. `submit-feedback/page.tsx`, a 5th surface not in the original report); peak-`0.015` threshold, fails open; **audio blocks, video warns** (a silent video still carries visual content). Server guard needs BOTH a known hallucination AND sub-6kbps; `silent_audio` added to `NON_RETRYABLE_ERROR_CODES` or it retries forever. Backfill restored `normalized_text` + recomputed sentiment. **Verified in production: meter works, muted audio rejected.** |
| `f303155`,`b679d6b` | 2026-07-31 | **feat(feedback): direct-feedback CSV export** — the capability pricing falsely advertised. Shares ONE `parseFeedbackFilters` with the page (the survey side drifted and exported empty files for single-day ranges); filters apply in SQL so the export covers every matching row, not the page's 100. **Deliberately omits media URLs** — that would re-publish what the Blob rotation destroyed, in a file that can't be recalled; reports per-type counts + transcripts instead. Verified against production data (`scripts/verify-feedback-export.ts`). Pricing copy **not** re-added: export is ungated. |
| `a66cb16`,`3585ce0`,`70eb220`,`c31403f`,`51f466b` | 2026-07-31 | **fix(security): consumer media on unauthenticated public Blob URLs — INCIDENT.** Vercel Blob has no private mode, so `storageKey` is a permanent unauthenticated CDN URL — and the dashboard rendered it directly, bypassing the ownership check added in `61b31af`. Also leaked via a **dead `storageKey` prop into a `'use client'` component** (serialized into the RSC payload regardless of any `src`). **Phase 1:** all playback → `feedbackMediaUrl()` proxy (12 sites), proxy hardened with session auth (was `requireRole('brand')`, which threw for admins), **Range forwarding** (else video seeking breaks), `private, no-store`. **Phase 2:** all 8 objects rotated to fresh paths, originals deleted — **verified: 8/8 on new prefix, old URLs all 404**. One affected record belonged to a **genuine external user**; notification question deliberately left **UNRESOLVED**, queued for legal review. |
| `b22ea11`,`5f93991` | 2026-07-30 | **feat(feedback): direct-feedback filtering** (7 dimensions, URL-driven). Filtering done **in SQL, not in memory** — the page is `limit:100`, so the survey page's fetch-then-`.filter()` pattern would silently drop matches; do not "simplify" it back. One predicate builder feeds list + count so "showing X of Y" can't drift. No demographic filters (need the email join + `demographic` consent gate). Also fixes a live bug: `exportResponsesToCSV` didn't widen `dateTo` to end-of-day while the page did — so a single-day range showed rows on screen and **exported an empty file**. |
| `92f7d7b`,`99c9c64` | 2026-07-29 | **fix(copy): removed 14 false export/filtering claims + wrote the claims policy.** Pricing sold "Export all feedback to CSV or JSON — up to 100 exports/month" and both UpgradePrompts promised CSV export; none existed, no metering existed, and a **third instance** was found beyond the two reported. **Cut rather than reworded** — the one export that did exist (survey CSV) is *ungated*, so describing it as a Pro benefit would have created a NEW false claim. Policy (§5): an unlabeled item in a priced list is contractual; badged roadmap is fine; **the deadline is the first real payment, not launch**. |
| `61b31af`,`afc07e8`,`e939199`,`1cccef7` | 2026-07-28 | **fix(security): two access-control batches — 9 ownership defects.** Batch 1: unauthenticated `exportResponsesToCSV` (a `'use server'` action handing out every respondent's name+email for any surveyId), product-feedback IDOR, unowned media download, and a **missing consent gate** on demographic analytics (k-anonymity ≠ lawful purpose; DPDP §6). Batch 2: the 7 `saveStep*`/`completeProfile` **write** actions with no auth at all (any user could overwrite another brand's profile), survey responses/detail pages, 3 read exposures, and two **fail-open** null-`owner_id` checks. Established `isAdminSession()` + uniform admin bypass (10 callsites) and fail-closed-on-null. |
| `ba8d433`,`c3c2767` | 2026-08-02 | **docs: local-dev + email-delivery gaps.** `.next` corrupts on a near-full disk (route-group 404s where a route compiles then renders `/_not-found`; later 76 `tsc` errors in generated types) — fix is delete `.next`, keep >10 GB free. Local login can't work: `AUTH_URL` points at production so NextAuth mints `Secure` cookies a browser won't send over HTTP. **Email has no delivery visibility** — a Resend-suppressed recipient returns HTTP 200 and is silently dropped, so `notification_queue` read "21 sent, 0 failed" while delivering nothing. |
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
| 033 | `run-migration-033` | `feedback.user_id` + FK `ON DELETE SET NULL` (founder-approved deviation from 031's PII→CASCADE) + partial index. Backfill is **provenance-aware** — organic rows only (`importSource IS NULL`); a naive email join would have mis-attributed 18 imported rows to the importing brand. **Applied via the Neon console (Option A), NOT this route.** Verified `total=23 linked=5 imported=18`. |
| 037 | `run-migration-037` | Cron run records — `cron_runs` + 2 indexes. ⚠️ **Insert-at-start is load-bearing**; a killed job leaves `status='running'` with `finished_at IS NULL`, the only observable form of "fired and died". No `'timeout'` status — nothing is alive to write it. **Ordering: safe either way** (new table, all writes non-fatal), like 035. |
| 036 | `run-migration-036` | Parity for a fresh DB: `brand_subscriptions` (created historically by `drizzle push`, FK'd by 031, the only table of ~30 with no CREATE route) + `feature_overrides`, and re-asserts `UNIQUE(user_id, event_type)` on `notification_preferences` (created by 005, **never declared in `schema.ts`**, and `upsertPreference` depends on it). No-op on prod; matters only for preview. |
| 035 | `run-migration-035` | Email delivery truth — `email_deliveries` + `email_suppressions`. Deliberately **not** columns on `notification_queue`: the verification + influencer emails bypass the queue entirely. ⚠️ Starts empty and **cannot be backfilled** — the prod Resend key is sending-scoped. **Ordering: safe either way.** |
| 034 | `run-migration-034` | Resolution loop — `feedback.resolution_notified_at` (notify-once claim key) + `resolution_note` (Phase 2, deliberately unwritten). Both nullable, no default: a default on `resolution_notified_at` would mark every existing row already-notified and permanently suppress the loop. **Also applied via the Neon console**; route re-run as a confirming no-op. Verified `total=23 reachable=5 addressed=0 already_notified=0`. |

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

### v17 — open after the "real users are arriving" wave

**🔴 Console steps that leave shipped code INERT until done:**
- **Resend webhook + `RESEND_WEBHOOK_SECRET`** — `/api/webhooks/resend` fails closed (503) without it, so **email delivery is still blind** despite 035 being built. The highest-value unfinished item.
- **Delete the 459 seeded `social_posts`** (`WHERE created_at::date = '2026-03-21'`) — the honest empty state can't fire while they exist. ⚠️ Verify the count is exactly **459** first; anything else means real data landed.
- **`curl /api/admin/env-check`** — answers YouTube/Google-in-production and confirms the payment flags. ⚠️ **The `ADMIN_API_KEY` in `.env.local` is STALE** (rotated in Tier B); use the Vercel value.

**🔴 Nothing from v17 is browser-verified.** Not the preference toggles, survey pause, summary scope fix, payment gate, or the `?highlight=` deep link. Local login works now (`AUTH_URL` fixed), so this is cheap — and it is the single largest confidence gap.

**Blocked on the preview environment** (not built): the payment rehearsal, the **payment-ledger fix** (highest-severity item overall), and mobile capture testing. 🔴 **`.env.local` still points at the PRODUCTION database with LIVE Razorpay + live Resend keys** — local dev is production with a different frontend; repoint it the moment a preview branch exists.

**Queued as one security-shaped change:** absorb the duplicated cron auth into `withCronRun` **and** close the `cronSecret &&` fail-open (24 routes publicly triggerable if the secret is unset, **including account deletion**).

**Volume-gated, deliberately not built:**
- **Social listening rules UI** (~1 day) — the API exists, no page calls it, so a brand cannot enable listening at all. Pointless until we know the pipeline yields anything for products nobody discusses.
- **Intent regex tuning** — `"stopped working"` and slow-support complaints match nothing. Tuning against 5 organic rows would be overfitting.
- **Extraction on the import paths** — would populate `consumer_intents` with seeded CSV text, teaching nothing and poisoning any future false-positive measurement.

**Strategic conclusion recorded (v17):** **purchase intent is NOT supportable** from post-purchase text — *"I want to buy this"* and *"I'm glad I bought this"* are indistinguishable to the regex, and the failure is invisible. **Churn/switching intent IS** — the language matches the population, and the inputs already exist. Both are blocked on **input volume, not plumbing**.

**Competitive intelligence: 0 rows in all 9 tables** — complete machine, no fuel, gated on `competitor_profiles`. Privacy discipline there is the best in the codebase (`MIN_COHORT_SIZE` defined in that repo, `null` not zero, per-theme floor, access logging). Missing structurally: **`products` has no category column** (category is free text on `competitor_profiles`), no price on our own products, and **`extracted_themes` is not wired to the competitive layer** — that last one is the single most valuable missing wire. ⚠️ `getGeographicDistribution` still joins on `feedback.user_email`.

### v16 — open after the resolution loop
- **✅ CLOSED 2026-08-10 — notification preferences now have a UI.** `NotificationPreferencesCard` on `/dashboard/settings`. Two bugs found while wiring it: `upsertPreference` **reset unspecified fields to their defaults on update** (turn email off, then toggle anything else, and email silently came back on — a withdrawn consent reinstated), and the POST route **cast any string to `NotifiableEventType` without validating**, so a typo wrote a permanent row `getPreference` would never match. Both fixed. The union covered 16 of ~40 event types and is now a runtime array (`NOTIFIABLE_EVENT_TYPES`) used for validation. ⚠️ `notification_preferences` has `UNIQUE(user_id, event_type)` in the DB (migration 005) but **not in `schema.ts`** — drift that the upsert silently depends on.
- **`resolution_note` is a live column with no writer** (migration 034, Phase 2). It would be the first user-generated content travelling **brand → consumer**, in-app *and* emailed — needs a moderation design, not a textarea. Copy already has a slot, so Phase 2 is UI-only.
- **Not click-verified:** the `addressed → new → addressed` toggle (the claim guard is proven by construction and by the single row, but not by a second click); the **admin-bypass path** (`feb710e7…`/`3e668c78…` sit on products with a NULL `owner_id`, so only an admin can fire the loop there); the queued email itself (`process-notifications` is a **daily** `0 6 * * *` cron); and B2's visible fix — the `vishweshwar981+brand@gmail.com` My Feedback page should now be empty.
- **The loop reaches 5 of 23 rows** and that is the honest ceiling, not a coverage failure — 18 are imported, with a permanently NULL `user_id` because those respondents are not platform users. Expect a **quiet loop when testing against imported data**; that is the skip working.
- **`survey_responses` still hard-deletes** in `process-deletions` — acceptable for now (no ingestion path, 66 of 69 rows carry no email), revisit if it ever gains an import route.

### v15 — open after the access-control + media wave
- ⚖️ **External-user breach notification — UNRESOLVED.** One record in the Blob incident belongs to a genuine external user whose audio/image sat on an unauthenticated URL 2026-07-20 → rotation. Not notified; the working position (unguessable URLs, no evidence of access) is a **provisional technical read, not a legal determination**. **Queued for legal review alongside the un-lawyered privacy policy.** ⚠️ *"No evidence of access is not the same as no access"* — Blob public reads aren't attributable per-object in our tooling. Do **not** upgrade this to "assessed as no breach".
- 🚩 **`consumer_signal_snapshots` (302 rows) — UNVERIFIABLE, not clean.** Couldn't be attributed either way in the silent-audio contamination check because it isn't id-linked. Do not record it as "confirmed unaffected" without an actual trace.
- **Blob objects remain `access: 'public'` after rotation** — Vercel Blob has no private mode. Post-rotation the URLs are unguessable and never rendered, so they behave as secrets. True access-controlled storage = signed URLs on S3/R2 (new provider + env + migration of all objects + changes to upload/retention/processing). **Unscheduled.**
- **Not verified in a browser:** Blob proxy playback + **seeking** (Range forwarding is new code that has never met a real player), and the export click-to-download path. *(The silence gate **was** verified in production — meter works, muted audio rejected.)*
- **Email delivery visibility** — see §6; needs a Resend webhook.
- **`/api/dashboard/feedback-media/[id]/download` is the only media path**; the admin variant authenticates by `ADMIN_API_KEY` Bearer header, unusable from a media tag.
- **Three pre-existing ownership checks lack the admin bypass** (`api/contribution/brand-config`, `api/notifications/product-launch`, `api/notifications/survey-distribute`) — all fail-closed so no leak, just inconsistent with the v15 policy.
- **`/dashboard/products` lists every product** (`getProducts()`, not owner-scoped — it's the consumer discovery surface). Intentional, but it makes productIds enumerable, which is what made the closed IDORs trivially reachable.
- **Tier enforcement is still cosmetic** — filtering and export are ungated, so their pricing copy stays out until the freemium build. `tierMiddleware` still has zero callers.

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
