# Pre-Launch Audit Fix Log

> **Purpose** — Running journal of the 6-pass pre-launch audit and the fixes that came out of it.
> Append-only as we work through the phases. The canonical docs (CLAUDE.md, ARCHITECTURE.md, SCHEMA.md, FEATURE*.md, CRON_JOBS.md) get synced AFTER all phases complete, in one consolidated pass — see "Docs to sync when Phase 6 ships" at the bottom.
>
> **Audit started:** 2026-05-28
> **Phase 1 completed:** 2026-05-30
> **Phase 2 completed:** 2026-05-31
> **Phase 3 completed:** 2026-06-01

---

## Status Overview

| Phase | Sub-phase | Bug summary | Commit | Smoke-tested | Docs synced |
|---|---|---|---|---|---|
| 1 | 1A | Marketplace handshake — atomic accept + campaign_influencers insert | `f4d909d` | ✅ 2026-05-30 | ⏳ deferred |
| 1 | 1B | Google signup role bug — signed intent cookie | `c29dad3` | ✅ 2026-05-30 (Tests 1–4) | ⏳ deferred |
| 2 | 2A | Security quick wins — delete orphan signup route + admin key URL leak | `5080d87` | ✅ 2026-05-30 | ⏳ deferred |
| 2 | 2B | Points system — atomic deductPoints + unified UI minimum | `573da7e` | ⏳ deferred (zero-balance test consumer) | ⏳ deferred |
| 2 | 2C | Scheduled launch timezone — TZ-aware via date-fns-tz | `b2749a3` | ✅ 2026-05-31 (banner shows wall-clock) | ⏳ deferred |
| 3 | 3A.1 | Brand onboarding — schema (`brand_profiles`) + actions + Zod | `4de21c8` | ✅ 2026-05-31 (wizard in use during 3B–3D) | ⏳ deferred |
| 3 | 3A.2 | Brand onboarding — wizard UI + OnboardingGuard role split + backfill banner | `186442f` | ✅ 2026-05-31 (wizard in use during 3B–3D) | ⏳ deferred |
| 3 | 3B | Brand dashboard — scope feedback + surveys by owner; brand empty states | `ead68f9` | ✅ 2026-06-01 (verified during 3D smoke) | ⏳ deferred |
| 3 | 3C | Campaign publish — CSRF + confirm modals + pre-publish validation + transition audit | `40d443d` | ✅ 2026-06-01 (C1 disabled state verified, see "tooltip-on-disabled-button" finding below) | ⏳ deferred |
| 3 | 3D | Brand campaign edit — Edit dialog + status gate + paymentType lock + per-save audit | `6ea441c` | ✅ 2026-06-01 (D1–D2, D11, D12 verified; D7 surfaced custom-Dialog gap → fixed in `ee9fe98`) | ⏳ deferred |
| 3 | 3D-fu | Edit dialog X close + Escape key (custom Dialog has no built-in dismiss) | `ee9fe98` | ✅ 2026-06-01 | ⏳ deferred |

---

## Phase 1 — Highest-priority ship-blockers (COMPLETE)

### Sub-Phase 1A — Marketplace handshake

**Audit reference:** Pass 2 C1, Pass 3 I-C1

#### Bug
When a brand accepted a marketplace application, `updateApplicationStatus()` only flipped `campaign_applications.status = 'accepted'`. It never inserted a `campaign_influencers` row. That single missing INSERT silently broke five downstream surfaces that all gate on `getInvitation()`:

- `/api/payments/release/[campaignId]` — returned 400 "Influencer is not assigned to this campaign"
- `/dashboard/influencer/campaigns` — My Campaigns list was empty for marketplace-accepted influencers
- `/api/campaigns/[campaignId]/reviews` — reviews blocked
- `disputeResolutionService.raiseDispute` — disputes blocked
- `markInfluencerComplete` / `removeInfluencer` — no-ops

#### Root cause
`src/db/repositories/campaignMarketplaceRepository.ts:338` (pre-fix) only did the application UPDATE. The mirror code in the manual-invite path (`campaignManagementService.inviteInfluencerToCampaign` → `campaignInfluencerRepository.inviteInfluencer`) DID insert the row, but the marketplace path was missing this second write.

#### Fix
New `acceptApplicationAtomic()` in `campaignMarketplaceRepository.ts` runs both writes in one `db.transaction()` with `SELECT … FOR UPDATE OF campaign_applications` for serialisation. Conflict resolution per Q1:

| Existing `campaign_influencers.status` | Action |
|---|---|
| (no row) | Insert fresh, `status='accepted'`, `agreed_rate = application.proposed_rate` |
| `'invited'` | Bump → `'accepted'`, preserve any negotiated `agreed_rate` if already set |
| `'rejected'` | Bump → `'accepted'` (brand changed mind) |
| `'accepted'` / `'active'` / `'completed'` | Leave untouched (already a member) |

Application status guard:
| Application status | Action |
|---|---|
| `'pending'` / `'reviewing'` | Proceed |
| `'accepted'` | Idempotent replay — return existing invitation, no double-write |
| `'rejected'` | Proceed (brand changed mind, allowed) |
| `'withdrawn'` | Throw — influencer pulled out, can't accept |

Audit log row written per accept with `action='marketplace_application_accepted'`, tagged with `conflictResolution` path + `agreedRate` + `wasReplay` flag.

Both notification events fire POST-commit:
- `BRAND_APPLICATION_ACCEPTED` → notify influencer
- `INFLUENCER_CAMPAIGN_ACCEPTED` → notify brand (mirrors the manual-invite flow's "influencer accepted" event)

Idempotent replays skip emission so re-accepts don't double-notify.

#### Files changed
- `src/db/repositories/campaignMarketplaceRepository.ts` (+285 / -8)
  - New: `acceptApplicationAtomic()`, `countOrphanedAcceptedApplications()`, `listOrphanedAcceptedApplications()`
  - New types: `AcceptConflictResolution`, `AcceptApplicationResult`
  - `updateApplicationStatus()` signature narrowed to `'rejected' | 'reviewing'` only (accept now goes through the atomic helper)
- `src/server/campaignMarketplaceService.ts` (+63 / -18)
  - `respondToApplication()` branches: `'accepted'` → atomic helper, `'rejected'` → original single-update path
- `src/app/api/admin/diagnostics/orphan-marketplace-handshakes/route.ts` (new) — GET, read-only count + sample, gated by `ADMIN_DIAGNOSTICS_ENABLED=true`
- `src/app/api/admin/backfill-marketplace-handshake/route.ts` (new) — POST, gated by `x-api-key: $ADMIN_API_KEY`, idempotent, audit-logged

**No schema migration needed** — `uq_campaign_influencer (campaign_id, influencer_id)` constraint from migration 004 already provides the integrity floor.

#### Commit
`f4d909d` — `fix(marketplace): atomic handshake on application accept`

#### Design decisions made (clarifying Q&A)
- **Q1 (conflict policy)** — Bump invited→accepted, bump rejected→accepted (brand changed mind), preserve accepted/active/completed, throw on withdrawn application
- **Backfill** — Check DB count first, then decide approach (per user direction)

#### Backfill
- Diagnostic query result (via Neon SQL, 2026-05-30): `orphan_count = 0`
- **No backfill needed** — fix shipped clean, no legacy orphans to heal
- Backfill route is in place for any future need

#### Smoke test
- Phase A — Diagnostic via direct Neon SQL (API route was 404-blocked, see "ADMIN_DIAGNOSTICS_ENABLED env quirk" below): 0 orphans ✅
- Phase B — End-to-end happy path:
  - B1: Brand created public campaign ✅
  - B2: Influencer applied ✅
  - B3: Brand accepted → status flipped to `accepted` ✅
  - B4: Influencer's `/dashboard/influencer/campaigns` now shows the campaign ✅ (was empty before fix)
- Phases C (idempotency) and D (payment release) — skipped (optional, can revisit when needed)

#### Follow-ups for canonical docs (queue for end-of-phase 6)
- **CLAUDE.md** — Add to "Key Decisions" table:
  - "Marketplace accept is atomic (tx-wrapped status flip + campaign_influencers reconcile)"
  - "Marketplace accept conflict resolution (invited/rejected → accepted, accepted/active/completed → preserve)"
- **FEATURE2_INFLUENCERS_ADDA.md** — Document the marketplace accept flow and the campaign_influencers reconciliation rules
- **ARCHITECTURE.md** — Add `acceptApplicationAtomic()` to the marketplace section if/when one exists

---

### Sub-Phase 1B — Google signup role bug

**Audit reference:** Pass 3 C-C1

#### Bug
`auth.config.ts` Google `signIn` callback hardcoded `role: 'brand'` for new users. A consumer clicking "Sign in with Google" on the signup page (or accidentally on the login page) became a brand, skipped consumer onboarding, and had no path to fix the role. Code comment said "can be changed later" — there was no such path.

#### Root cause
`src/lib/auth/auth.config.ts:170` (pre-fix) — `role: 'brand', // Default to brand, can be changed later`. The intent role from the `/signup` page's role radio was completely lost across the Google OAuth round-trip.

Additional finding during investigation: `/signup/complete` page and `/api/auth/complete-signup` route existed as orphan dead code (original design intent that was abandoned when the hardcoded shortcut shipped). Nothing redirected to them.

#### Fix — Approach C (signed intent cookie + strict reject on /login)

Decision matrix:

| User in DB? | Intent cookie? | Action |
|---|---|---|
| Yes | n/a | Normal login at stored role (cookie ignored — re-clicking signup can't change role) |
| No | Valid (`brand`/`consumer`, unexpired, signature valid) | `createUser` at intent role |
| No | Missing / invalid / expired | Return `/login?error=no_account` → friendly "sign up" CTA |

Cookie design:
- Name: `e4i-signup-intent`
- HMAC-SHA-256 signed with `AUTH_SECRET` (Web Crypto, mirrors `twoFactor/proofCookie.ts` pattern)
- Payload: `{ role, expiry, nonce }` — 12-byte random nonce per cookie so two cookies minted in the same second don't share bytes
- TTL: 5 min — short enough that an abandoned signup can't bleed into a later unrelated login
- `httpOnly: true`, `sameSite: 'lax'`, `secure` in production
- Role allowlist: `{brand, consumer}` only — admin is never self-assignable

Strict-reject behavior per Q2 (Stripe/Linear pattern):
- `/login` Google button never sets the intent cookie → a brand-new Google identity on the login page is intentionally rejected
- Friendly amber banner on `/login` with `?error=no_account` shows: *"No account found with this Google email. If you're new here, sign up to choose your account type and create one."*
- Inline "sign up" link, no auto-redirect — user chooses

#### Files changed
- `src/lib/auth/signupIntent.ts` (new) — HMAC sign/verify helpers, role allowlist, TTL constants
- `src/app/api/auth/signup-intent/route.ts` (new) — POST endpoint, validates role, mints signed cookie, CSRF-gated
- `src/lib/auth/auth.config.ts` (modified) — Google `signIn` callback now uses the decision matrix
  - Reads intent cookie via `cookies()` from `next/headers` (NextAuth v5 doesn't pass `Request` to `signIn` callback)
  - Race-condition rescue (duplicate-key on `createUser` → re-fetch) preserved from old code
- `src/app/(auth)/signup/page.tsx` (modified) — `handleGoogleSignup` first `apiPost('/api/auth/signup-intent', { role })`, then `signIn('google', { callbackUrl: role === 'brand' ? '/dashboard' : '/top-products' })`
- `src/app/(auth)/login/page.tsx` (modified) — Reads `?error=no_account`, renders amber banner with inline sign-up link

**No schema migration needed.**

#### Commit
`c29dad3` — `fix(auth): Google sign-in carries role via signed intent cookie`

#### Design decisions made (clarifying Q&A)
- **Q2 (login-vs-signup behavior)** — STRICT REJECT for non-existent user on `/login` + Google. Friendly error, no auto-create. Stripe/Linear pattern.
- **Q3 (orphan code)** — `/signup/complete` + `/api/auth/complete-signup` left in place (out of scope — Phase 2+ cleanup candidate)

#### Backfill
- User said live app uses email/password almost exclusively. Existing Google users in DB likely from test accounts only.
- **No automated backfill** — no way to know what role a wrongly-roled Google user actually meant
- If any are found: review manually, update individually via SQL or reach out to user
- Admin (`vishjoshi789@gmail.com`, email/password, role=admin) never enters the Google branch — structurally unaffected

#### Smoke test (2026-05-30)
- Test 1 — New consumer signup via Google (vishweshwar981@gmail.com) → consumer, lands on `/top-products` ✅
- Test 2 — New brand signup via Google (vishweshwar98765@gmail.com, separate account) → brand, lands on `/dashboard` ✅
- Test 3 — Strict reject on `/login` for brand-new Google account → `?error=no_account` banner + inline sign-up link, no DB row created ✅
- Test 4 — Existing user re-login (vishweshwar981) → logs in as consumer at stored role ✅
- Tests 5 + 6 (email/password) — deferred (lower risk, unaffected paths)

#### Follow-ups for canonical docs (queue for end-of-phase 6)
- **CLAUDE.md** — Add to "Phase Status" table:
  - "Google OAuth signup role intent cookie (5-min HMAC-SHA-256 signed via AUTH_SECRET; strict reject on /login for brand-new Google identities)"
- **ARCHITECTURE.md** — Document `e4i-signup-intent` cookie alongside `e4i-2fa` and `e4i-trusted-device` in the auth-cookie family section
- **FEATURE9_TWO_FACTOR_AUTH.md** or a new auth-flow doc — link the decision matrix
- Consider deleting orphan `/signup/complete` page + `/api/auth/complete-signup` route in a Phase 2+ cleanup

---

## Phase 2 — Tier A remainder (COMPLETE)

### Sub-Phase 2A — Security quick wins (A3, A11)

**Audit reference:** Pass 1 C1 (A3), Pass 1 C3 (A11)

#### Bug summaries

**A3 — Unauthenticated orphan signup route:**
`POST /api/auth/complete-signup` accepted `{email, name, role, ...}` from the request body and called `createUser()` with no auth, no email-ownership verification, no CSRF. Anyone with the public URL could POST and create an arbitrary account at any role. Only caller was the orphan `/signup/complete` page, which nothing redirected to. Both were dead code left over from the original Google signup design (replaced in 1B by the signed intent cookie). Closes the cleanup item from 1B's discovery list.

**A11 — Admin API key URL leak:**
`/api/admin/analytics` accepted the admin secret via `?key=` query string. Combined with `/admin/analytics` auto-refresh every 10s, every active admin session was writing the secret into Vercel access logs, browser history, referrer headers, and CDN edge logs. The `src/lib/auth.ts` helper had already hardened against this pattern site-wide ("Query parameter auth has been REMOVED for security") — analytics never got migrated.

#### Fix
- **A3** — Deleted both files: `src/app/api/auth/complete-signup/route.ts` and `src/app/(auth)/signup/complete/page.tsx`. Empty directory cleaned up.
- **A11** — Server: removed query-string fallback in `checkAuth()`, switched to shared `authenticateAdmin()` helper which accepts `Authorization: Bearer <ADMIN_API_KEY>` or `x-admin-api-key` header only. Kept `ANALYTICS_ADMIN_SECRET` env as a legacy fallback for deployments that historically used the analytics-specific secret — still HEADER-ONLY. Client: migrated all 4 fetch sites in `/admin/analytics` page (fetchData, handleLogin, loadVisitorDetail, loadFullHistory) to send the key via `x-admin-api-key` header. Both ship in the same commit — no broken interim state.

#### Files changed
- `src/app/api/auth/complete-signup/route.ts` — DELETED (53 lines)
- `src/app/(auth)/signup/complete/page.tsx` — DELETED (175 lines)
- `src/app/api/admin/analytics/route.ts` — header-only auth via shared helper (+39 / -15)
- `src/app/admin/analytics/page.tsx` — 4 fetch sites migrated to header (+19 / -15)

#### Commit
`5080d87` — `fix(security): close orphan signup route + admin key URL leak (A3, A11)`

#### Design decisions made
- **A11 Q1 (external callers)** — Confirmed none. Safe to remove query-string fallback in one commit.
- **A11 Q2 (env var naming)** — Default to keeping `ANALYTICS_ADMIN_SECRET` as fallback. Zero risk if env values differ; cleanup deferred to later env-consolidation pass.

#### Smoke test (2026-05-30)
- `/admin/analytics` loads via in-app form (header path works) ✅
- Direct URL `?key=` now returns 401 ✅
- `/signup/complete` returns 404 ✅
- `POST /api/auth/complete-signup` returns 404 ✅

#### Follow-ups for canonical docs (queue for end-of-phase-6)
- **CLAUDE.md** — Key Decisions: "All admin auth header-only — query-string `?key=` removed site-wide for security (analytics route migrated in A11)"
- **ARCHITECTURE.md** — Document the shared `authenticateAdmin()` helper as the canonical pattern

---

### Sub-Phase 2B — Points system (A4, A6)

**Audit reference:** Pass 3 C-C2 (A4), Pass 2 C3 (A6)

#### Bug summaries

**A4 — UI/server minimum mismatch:**
`/dashboard/rewards` MINS = `{platform_credits: 100, voucher: 200, cash_payout: 500}`. `/api/consumer/rewards/redeem` MINIMUM_REDEMPTION_POINTS = 500 across all types. A consumer with 300 points sees "min 100" on Platform Credits, fills 300, server returns 400. Visible UX bug.

**A6 — Points race condition (negative balance):**
`deductPoints()` did `SELECT balance → if < amount return false → UPDATE total_points = total_points - amount → INSERT point_transactions` in 4 separate statements. Two concurrent redemptions could both see balance=600, both deduct 500, balance landed at -400. Also non-transactional — if INSERT failed after UPDATE, balance moved but no spend record (silent integrity break).

#### Fix

**A4** — UI MINS unified to `{platform_credits: 500, voucher: 500, cash_payout: 500}`. The "(min X)" copy renders dynamically from the constant, no additional copy edits needed. Per-type tiered minimums deferred to Tier C polish.

**A6** — `deductPoints()` rewritten:
- Defensive entry guard (positive-integer check)
- `db.transaction()` wrapping all three writes
- Atomic `UPDATE user_points SET total_points = total_points - $amount WHERE user_id = $uid AND total_points >= $amount RETURNING total_points` — PostgreSQL row-level lock during the UPDATE serialises concurrent deducts; 0 rows returned ≡ insufficient
- `point_transactions` INSERT only on success (kept as the source of truth for balance arithmetic)
- `audit_log` INSERT on EVERY attempt (success → `'points_deducted'`, failure → `'points_deduct_failed'`) per Stripe-grade financial pattern
- Boolean return preserved — all 3 callers (`/api/consumer/rewards/redeem`, `/api/payouts`, `/api/rewards`) unchanged

#### Files changed
- `src/app/dashboard/rewards/page.tsx` — MINS constant: all 500 (+5 / -2)
- `src/server/pointsService.ts` — `deductPoints` rewritten (+109 / -20)

#### Commit
`573da7e` — `fix(points): atomic deductPoints + unified UI minimum (A4, A6)`

#### Design decisions made
- **A6 Q1 (audit scope)** — Both success + failure to `audit_log`. point_transactions stays balance source of truth; audit_log carries operational trail. Lets us investigate "I had X points and it said insufficient" complaints.

#### Backfill
- Pre-deploy SQL check (2026-05-31): `SELECT COUNT(*) FROM user_points WHERE total_points < 0` returned **0**. Race never fired in production. No backfill needed.

#### Smoke test
- **Deferred** — test consumer (vishweshwar981) had zero points, so the redeem UI button stayed correctly disabled. Requires injecting test points via SQL (`INSERT … ON CONFLICT DO UPDATE` to set total_points=1000) before the redeem flow can be exercised end-to-end.
- tsc clean. Code compiled.

#### Follow-ups for canonical docs (queue for end-of-phase-6)
- **CLAUDE.md** — Key Decisions: "deductPoints is atomic (tx-wrapped UPDATE with WHERE-clause balance guard); never leaves user_points in a negative state; writes audit_log row for every attempt success or failure"
- **SCHEMA.md** — Note the audit_log `action` values for points operations (`points_deducted`, `points_deduct_failed`)

---

### Sub-Phase 2C — Scheduled launch timezone (A5)

**Audit reference:** Pass 2 C2, Pass 6 (data layer)

#### Bug
Brand picks "May 31, 09:00" expecting their wall-clock. The form value from `<input type="datetime-local">` is a naive string. `launch.actions.ts:49` did `new Date(scheduledAtRaw)` which Node interprets in the server's local TZ (UTC on Vercel). Brand in IST → stored as 09:00 UTC → cron publishes at 14:30 IST, 5h30 late.

#### Fix — Stripe/Calendly pattern

- **Capture client tz on mount** via `Intl.DateTimeFormat().resolvedOptions().timeZone` → hidden form field `scheduledAtTz`
- **Server interprets** via `fromZonedTime(localStr, ianaTz)` from new `date-fns-tz@^3.2.0` dependency (companion to existing date-fns)
- **Validate TZ** via `isValidIanaTimezone()` helper (Intl.DateTimeFormat with the tz throws RangeError on invalid zones)
- **Fallback** (rare — JS off, stale page): UTC interpretation + `[LaunchTZ]` warning log so we can see how often it fires
- **Success banner** carries `?at=<utcIso>&tz=<ianaTz>` query string; page uses `formatInTimeZone()` to render the brand's wall-clock back — "Scheduled to launch at May 31, 9:00 AM in Asia/Kolkata"
- **Scheduled-launches list** is server-rendered (UTC) — renamed `formatScheduled` → `formatScheduledUtc` and appended honest "UTC" suffix. Follow-up to convert to client-rendered with brand wall-clock logged below.

#### Files changed
- `package.json` + `package-lock.json` — added `date-fns-tz@^3.2.0`
- `src/app/dashboard/launch/LaunchForm.tsx` — capture tz on mount + hidden field + UI copy
- `src/app/dashboard/launch/launch.actions.ts` — `isValidIanaTimezone` validator + `fromZonedTime` + UTC fallback + `?at=&tz=` redirect
- `src/app/dashboard/launch/page.tsx` — `formatScheduledInTz` for the success banner + `formatScheduledUtc` for the list

#### Commit
`b2749a3` — `fix(launch): timezone-aware scheduled launches (A5)`

#### Design decisions made
- **A5 Q1 (TZ-missing fallback)** — Silent fallback to UTC + `[LaunchTZ]` warning log. Matches today's behaviour for the rare corner; majority case is helped.
- **A5 Q2 (success-banner scope)** — Full implementation: at+tz via query string + formatInTimeZone display. Stripe/Calendly UX.

#### Backfill
- Pre-deploy SQL check (2026-05-31): the `scheduled_launch_at` column did not exist in production → **meta-finding: migration 016 had not been applied despite being documented in CLAUDE.md**. Migration 016 was then applied (`POST /api/admin/run-migration-016` returned success), and the re-check returned 0 scheduled products. No buggy-stored rows to heal.
- See "Migration drift audit" in the parked items table below — worth verifying 015–020 status.

#### Smoke test (2026-05-31)
- Scheduled a launch ~3 minutes out. UI showed "Interpreted in `Asia/Kolkata` (your device timezone)". Submit succeeded.
- Success banner showed the brand's wall-clock back, e.g. "Your product will go live at May 31, X:XX PM in Asia/Kolkata." ✅
- Optional verification (Vercel `[LaunchTZ]` log, SQL spot-check, actual cron pickup) not run — visible UX confirms the fix.

#### Follow-ups for canonical docs (queue for end-of-phase-6)
- **CLAUDE.md** — Key Decisions: "Scheduled launches capture IANA timezone client-side and convert via date-fns-tz fromZonedTime; success banner shows wall-clock back via formatInTimeZone"
- **CLAUDE.md** — Phase Status table: add 2C row for scheduled-launch TZ fix
- **ARCHITECTURE.md** — Document the `Intl.DateTimeFormat().resolvedOptions().timeZone` capture pattern + the UTC fallback contract for any future scheduled-time UI
- **CLAUDE.md** — Add date-fns-tz to the tech stack table if a dep list exists

---

## Phase 3 — Brand surface (COMPLETE)

Theme: close the brand-side gaps that would have shipped a half-built brand experience. Onboarding wizard, dashboard correctness, campaign publish polish, and campaign-edit dialog. All four sub-phases plus one follow-up landed between 2026-05-31 and 2026-06-01.

### Sub-Phase 3A — Brand onboarding (3A.1 schema + 3A.2 UI)

**Audit reference:** Pass 3 B-C1, Pass 5 (confirmed UI gap)

#### Bug
There was no brand onboarding flow at all. A new brand signed up via `/signup?role=brand` (or Google), `auth.config` created the row at `role='brand'`, the `OnboardingGuard` was consumer-flavoured (called `ensureUserProfile` + `hasCompletedOnboarding` against `user_profiles`), and the brand was redirected to `/dashboard` with:
- no company name, industry, or size
- no billing entity (can't invoice them)
- no logo (campaign cards looked broken)
- no target audience captured (ICP UX assumed it)

The brand could USE the platform but the dashboard had no "who are you" data, the marketplace surfaces had no logo, and there was no compliance path for billing/GSTIN capture.

#### Root cause
The brand path through OnboardingGuard was a stub — only consumer onboarding had been built. The consumer-shaped `user_profiles` JSONB schema was wrong for brand data (would force schema churn every time either side evolved).

#### Fix — Separate `brand_profiles` table + 5-step wizard

Split into two commits for review-ability:

**3A.1 — Schema + Actions + Zod (`4de21c8`)**
- Migration 021 — new `brand_profiles` table, FK CASCADE → users, partial index `idx_brand_profiles_pending` on the not-yet-completed rows so the dashboard backfill-banner lookup is cheap
- Repository `src/db/repositories/brandProfileRepository.ts`: `getBrandProfile`, `hasCompletedBrandOnboarding`, `upsertBrandProfile`, `markBrandOnboardingComplete`
- Zod schemas `src/lib/validation/brand-onboarding.ts`: 4 step schemas + combined complete-onboarding. `INDUSTRY_OPTIONS` bounded to 15 values to keep downstream analytics clean. `COMPANY_SIZE_OPTIONS = ['1-10','11-50','51-200','200+']`. GSTIN regex enforces real Indian format when provided
- Server actions `src/app/onboarding/brand-onboarding.actions.ts`: per-step save actions + `getBrandOnboardingState` hydrator. `requireBrand()` re-verifies session + role on EVERY call. Validation failures return `{ ok: false, fieldErrors: {...} }` for inline display. `completeBrandOnboardingAction` writes `audit_log` row (`action='brand_onboarding_completed'`) — financial/compliance moment when the brand becomes invoiceable + marketplace-visible. Next.js server actions carry framework-level origin-checked CSRF; no app-level CSRF needed

**3A.2 — UI + Guard + Backfill banner (`186442f`)**
- `BrandOnboardingClient.tsx` (~600 LOC): 5-step wizard mirroring consumer onboarding visual quality. Step 1 welcome, Step 2 company basics (name + industry required), Step 3 primary contact (all optional, pre-fills name from session), Step 4 billing (entity, address, GSTIN — fully skippable), Step 5 logo + target audience. ProgressIndicator across all steps. sessionStorage draft persistence (`e4i_brand_onboarding_draft`). DB-initial hydration on cold reload wins over draft. All shadcn primitives, dark theme tokens, mobile responsive
- Logo upload route `src/app/api/uploads/brand-logo/route.ts` (mirrors `feedback-media` pattern): brand-auth gated BEFORE `handleUpload` runs (anonymous + consumer requests rejected before any token issued), content-type allowlist PNG/JPG/WEBP only (no SVG — XSS risk on inline render), 2 MB cap, pathname locked to `brand-logos/`, `addRandomSuffix=true` prevents cross-brand collisions
- `src/app/onboarding/page.tsx` routing: brand → hydrate from DB + render wizard (or redirect to `/dashboard` if already completed); admin → `/dashboard`; consumer → existing flow
- `OnboardingGuard` refactored to route by role: admin bypass, brand → `hasCompletedBrandOnboarding` check, consumer → existing flow. Brand path does NOT call `ensureUserProfile` (that helper creates consumer-shaped JSONB)
- `BrandOnboardingBanner.tsx`: soft prompt on `/dashboard` for brands who pre-date this fix; dismissible per browser session via sessionStorage; reappears on next login; hydration-safe

#### Files changed
- 3A.1: `src/app/api/admin/run-migration-021/route.ts` (new), `src/app/onboarding/brand-onboarding.actions.ts` (new), `src/db/repositories/brandProfileRepository.ts` (new), `src/db/schema.ts` (+61 — brand_profiles table), `src/lib/validation/brand-onboarding.ts` (new)
- 3A.2: `src/app/api/uploads/brand-logo/route.ts` (new), `src/app/dashboard/page.tsx`, `src/app/onboarding/BrandOnboardingClient.tsx` (new, ~600 LOC), `src/app/onboarding/page.tsx`, `src/components/BrandOnboardingBanner.tsx` (new), `src/components/OnboardingGuard.tsx`

#### Commits
- `4de21c8` — `feat(brand-onboarding): schema + actions + Zod (3A.1)`
- `186442f` — `feat(brand-onboarding): wizard UI + guard + backfill banner (3A.2)`

#### Migration 021
Production status: applied (pre-3B/3C/3D smoke tests required `brand_profiles` to exist; subsequent phases confirmed at runtime). Idempotent `POST /api/admin/run-migration-021` if a re-apply is ever needed.

#### Smoke test (2026-05-31)
Wizard exercised end-to-end during the original phase shipping session. Confirmed working in production by the fact that 3B/3C/3D smoke tests (the test brand was actively using the dashboard) succeeded — without 3A applied, the test brand would have been stuck in the onboarding loop.

#### Follow-ups for canonical docs (queue for end-of-phase-6)
- **CLAUDE.md** — Phase Status table: add brand onboarding row. Key Decisions: "brand profile lives in separate `brand_profiles` table (not `user_profiles`) so consumer schema evolution doesn't churn brand data and vice versa"; "OnboardingGuard routes by role (admin bypass, brand → `hasCompletedBrandOnboarding`, consumer → existing flow)"
- **SCHEMA.md** — Add `brand_profiles` table definition
- **ARCHITECTURE.md** — Document the role-split OnboardingGuard alongside admin bypass note
- Settings page to edit brand profile fields after onboarding (NOT in 3A scope — wizard is set-once today)
- Orphan brand-logo blob cleanup (uploaded but never saved during wizard) — currently relies on existing media-retention sweep

---

### Sub-Phase 3B — Brand dashboard scoping (`ead68f9`)

**Audit reference:** Pass 3 B-C2

#### Bug
Two related scoping leaks on the brand dashboard surface, both giving brands a misleading view of platform-wide data labeled as theirs:

1. **`getDashboardFeedbackStats` had no WHERE clause.** Every brand saw platform-wide COUNT(*), AVG(rating), etc. The "Avg Rating" card was the worst offender — brands saw the platform average (typically ~3.8/5) and assumed their product was rated 3.8 when their actual feedback might be zero.
2. **`fetchAllSurveys` on `/dashboard/surveys` had no WHERE clause.** A brand opening this page saw other brands' NPS/CSAT/custom surveys mixed with their own. Privacy + UX both broken.

#### Root cause
Repo helpers were originally written for admin/cron usage (legitimate platform-wide reads) and were then reused on brand-facing pages without adding a brand filter.

#### Fix
1. `getDashboardFeedbackStats` now accepts `brandProductIds: string[]` and filters `feedback WHERE product_id IN (...)`. New helper `getBrandProductIdsForDashboard(brandUserId)` resolves the brand's products first (mirrors the scoping pattern already used in `/dashboard/feedback`)
2. `/dashboard/surveys` page role-routes:
   - brand → owned surveys only (joined via `products.owner_id`)
   - admin → all surveys (legitimate platform view)
   - other → redirect to `/top-products`
3. `getAllSurveys` docstring updated to flag admin/cron-only usage so this pattern doesn't reappear
4. **Empty states for new brands** (Stripe pattern — don't show zero numbers that imply "no feedback on your products" when the brand has no products at all):
   - Dashboard: "You haven't added any products yet. Add your first product to start collecting feedback…" with [Add your first product] CTA
   - Surveys: distinguishes "no products yet" → "Launch a product first" CTA from "no surveys yet" → three empty NPS/CSAT/Custom cards
5. **Cleanup**: removed `getPersonalizedRecommendations` call from brand dashboard. That function is consumer-only (gated by personalization consent on `user_profiles`); calling it for brands either threw or returned [], adding wasted DB query + visual noise. Consumer dashboard branch unchanged

#### Files changed
- `src/app/dashboard/page.tsx` (+221 / -109)
- `src/app/dashboard/surveys/page.tsx` (+96 reworked)
- `src/db/repositories/surveyRepository.ts` (+39 / -2)

#### Commit
`ead68f9` — `fix(brand-dashboard): scope feedback + surveys by owner (3B)`

#### Smoke test (2026-06-01)
Verified during 3D session — brand dashboard showed only its own products' feedback stats; surveys page listed only the brand's own surveys; new-brand empty states rendered correctly.

#### Follow-ups for canonical docs (queue for end-of-phase-6)
- **CLAUDE.md** — Key Decisions: "brand dashboard feedback stats scoped via `getBrandProductIdsForDashboard` (no platform-wide leak); `getAllSurveys` is admin/cron-only — brand UI uses owned-surveys helper"

---

### Sub-Phase 3C — Campaign publish polish (`40d443d`)

**Audit reference:** Pass 3 B-W1

#### Bug
The buttons + API + state machine for campaign transitions existed before 3C, but the polish was missing:
- `PATCH /api/brand/campaigns/[id]` had no CSRF gate (A11's analytics fix never reached this route)
- Publish was a raw `confirm()` browser dialog
- Cancel had no reason capture and no warning when accepted/active/invited influencers existed
- A brand could click Publish on a draft missing title/budget/brief and only learn about the missing fields via a 400 error AFTER the click
- No audit log on transitions — high-stakes moves (cancel with escrowed payments) left no trail

#### Fix
**API — `src/app/api/brand/campaigns/[campaignId]/route.ts`:**
- `validateCsrfToken(req)` at the head of PATCH + DELETE
- `cancelReason` in body passes through to the service

**Service — `src/server/campaignManagementService.ts`:**
- `transitionCampaignStatus()` now takes `opts.cancelReason`
- New `getMissingPublishFields()` returns required-but-missing fields for draft → proposed. Q4 decision: minimum viable = title + budget + brief. Other fields stay suggested
- Pre-publish guard throws `Complete these fields to publish: X, Y` when fields are missing
- `audit_log` row written on EVERY transition (`action='campaign_status_transition'`, metadata = `{campaignId, fromStatus, toStatus, cancelReason, campaignTitle, budgetTotal}`)
- New `getCampaignPublishability(campaignId, brandId)` helper — same source of truth, exposed so UI can render the "complete these to publish" list before the click

**UI — `src/app/dashboard/brand/campaigns/[campaignId]/page.tsx`:**
- `changeStatus()` rewritten as `openStatusConfirm()` → `executeStatusChange()` two-step flow
- `apiPatch` auto-attaches `X-CSRF-Token` from the `e4i-csrf` cookie (replaces raw fetch)
- One Dialog serves all four transitions (publish / activate / complete / cancel); content keyed by `pendingStatus`
- Publish modal: simple "It will be visible in the marketplace" confirmation
- Cancel modal: `cancelReason` Textarea (500-char cap) + amber warning when accepted/active/invited influencers exist (counted from loaded summary)
- **Pre-publish UX**: Publish button disabled when required fields missing, tooltip + inline amber "Complete to publish: title, brief" — client-side `getMissingPublishFields` mirrors the server

#### Files changed
- `src/app/api/brand/campaigns/[campaignId]/route.ts` (+16 / -1)
- `src/app/dashboard/brand/campaigns/[campaignId]/page.tsx` (+254 / -25)
- `src/server/campaignManagementService.ts` (+81 / -7)

#### Commit
`40d443d` — `fix(campaigns): CSRF + confirm modals + publish validation + audit (3C)`

#### Design decisions made
- **Q4 (minimum publish requirements)** — title + budget + brief. Other fields stay suggested
- **Audit-every-transition** — Cancellations with escrowed payments are the highest-stakes move; an audit row per transition is the cheap compliance trail

#### Smoke test (2026-06-01)
- C1 (disabled Publish state with missing brief): verified ✅
- Inline amber "Complete to publish: brief" message visible ✅
- **Finding surfaced during C1**: the disabled-button tooltip does not fire on hover (browser quirk — disabled buttons with `pointer-events-none` don't dispatch hover events). The inline amber message is the user-facing fallback that always shows, so the UX is fine. Documented in the mid-work table below.
- C2 onwards covered by 3D smoke (the Publish path was re-exercised after 3D shipped)

#### Follow-ups for canonical docs (queue for end-of-phase-6)
- **CLAUDE.md** — Key Decisions: "every campaign status transition writes an `audit_log` row (`action='campaign_status_transition'`) — cancellations with escrowed payments are the highest-stakes move and the audit trail is the cheap compliance lever"; "PATCH on campaign routes is CSRF-gated alongside DELETE — state-mutating endpoints touching state machine + payment transitions all validate the double-submit token"
- **FEATURE2_INFLUENCERS_ADDA.md** — Document the publish-readiness validation contract (`getMissingPublishFields` server-side mirror of client check)

---

### Sub-Phase 3D — Brand campaign edit dialog (`6ea441c` + follow-up `ee9fe98`)

**Audit reference:** Pass 3 B-W1, mid-work item #4

#### Bug
Item #4 from the mid-work findings: a brand who created a draft via the New Campaign dialog with only the required fields (`title` + `budgetTotal`) landed on the detail page with Publish disabled (per 3C's missing-fields gate) and had **no UI to add the brief or any other field**. The only escape was delete + recreate. The same trap applied to dates, deliverables, marketplace toggle, SLA settings — none editable post-create.

#### Root cause
Backend was fully in place from earlier phases:
- `PATCH /api/brand/campaigns/[campaignId]` route (CSRF + ownership gates added in 3C)
- `updateCampaignDetails(campaignId, userId, body)` service function existed
- No UI ever wired to it

#### Design Q&A (approved before code)
1. **Status gate** — `draft` + `proposed` + `negotiating`. Block on `active` / `completed` / `cancelled` / `disputed` (escrow + accepted-influencer commitments)
2. **paymentType editability** — `draft` only. Lock once published. Influencers apply against payment terms; Stripe pattern freeze-pricing-once-customer-in-funnel
3. **`budgetTotal` editability with applications** — warn (don't block). Amber callout with application count in the dialog. Brands need flexibility, applicants can re-evaluate
4. **Notification on edit** — out of scope for 3D. Logged as follow-up for an influencer-side phase
5. **Audit log on every save** — every save (even no-change). Operational trail beats storage savings

#### Fix
**Repo — `src/db/repositories/influencerCampaignRepository.ts`:**
- `updateCampaign` Pick<> extended to include `isPublic`, `maxInfluencers`, `applicationDeadline`, `reviewSlaHours`, `autoApproveEnabled` (previously only the create path could set these)

**Service — `src/server/campaignManagementService.ts`:**
- `EDITABLE_STATUSES = {draft, proposed, negotiating}` (Q1). Throws on anything else with explicit error message
- `EDITABLE_FIELDS` allowlist — anything outside is silently dropped even if the client sends it (defence in depth on top of the repo `Pick<>`). Prevents stale/malicious clients moving `platformFeePct`, `brandId`, etc.
- `paymentType` silently dropped when `status !== 'draft'` (Q2). Rest of the save still goes through
- `audit_log` row on EVERY save with diff metadata (Q5): `{changedFields[], from{}, to{}, noOp}`. JSON-equality diff so arrays + dates compare correctly. Reason: `Updated: brief` or `No fields changed`. noOp saves still log
- `getCampaignSummary` now also returns `applicationCount: number` so the UI can show the Q3 budget-change warning without an extra round trip

**UI — `src/app/dashboard/brand/campaigns/[campaignId]/page.tsx`:**
- Pencil-icon **Edit** button in header, gated on `EDITABLE_STATUSES` (invisible on active and beyond)
- Dialog mirrors New Campaign field layout, `max-h-[85vh] overflow-y-auto`, mobile-stacked grids (`sm:grid-cols-2`)
- sessionStorage draft persistence keyed by campaignId (`e4i_campaign_edit_draft:<id>`): hydrates on open, persists on every change, cleared on save success or explicit Discard
- Inline validation: title required (≤200 chars), budget > 0, brief ≤5000, end ≥ start, positive SLA hours, positive max influencers
- `paymentType` Select disabled when `status !== 'draft'` with hint copy (Q2)
- Amber `AlertTriangle` warning when `applicationCount > 0` AND the budget value has been altered (Q3 — warn-don't-block)

**Follow-up — `ee9fe98` (D7 smoke fix):**
D7 smoke surfaced that the project's custom `Dialog` (`src/components/ui/dialog.tsx`) is hand-rolled and intentionally has no built-in X button, no outside-click handler, and no Escape listener. The sessionStorage "resume mid-edit" path was unreachable through the UI — Discard cleared the draft, Save committed it, nothing else closed the dialog.

Added (on the edit dialog only — other dialogs in this page are short-lived confirms where this trade-off is irrelevant):
- X icon button in the top-right of the dialog header → `closeEditDialog(false)` (keeps draft). aria-label spells out the keep-draft behaviour
- Subtitle under the title: "Close to keep your changes for later · Discard throws them away"
- Window-level Escape keydown listener while `editOpen` → also `closeEditDialog(false)`. Suppressed during `editSaving` so a stray Escape can't abandon an in-flight save

#### Files changed
- 3D: `src/db/repositories/influencerCampaignRepository.ts` (+4 / -2), `src/server/campaignManagementService.ts` (+90 / -5), `src/app/dashboard/brand/campaigns/[campaignId]/page.tsx` (+419 / -2)
- 3D-fu: `src/app/dashboard/brand/campaigns/[campaignId]/page.tsx` (+34 / -2)

#### Commits
- `6ea441c` — `feat(campaigns): edit dialog for draft/proposed/negotiating (3D)`
- `ee9fe98` — `fix(campaigns): X close + Escape on edit dialog (3D follow-up)`

#### Smoke test (2026-06-01)
- D1 — Open missing-brief draft → click Edit → dialog opens prefilled ✅
- D2 — Type brief, Save → toast success, dialog closes, Publish enables ✅
- D7 — surfaced the no-X / no-outside-click issue → fixed in `ee9fe98`
- D11 — Force-edit an active campaign via DevTools fetch → 400 with `Cannot edit a campaign in "active" status — editing is only available for draft, proposed, or negotiating campaigns.` ✅
- D12 — `SELECT … FROM audit_log WHERE action='campaign_details_updated'` → rows present, `metadata.changedFields` populated correctly, `reason` reads `Updated: <fields>` ✅
- D3 / D4 / D5 / D6 / D8 / D9 / D13 / D14 — not explicitly confirmed but functional based on UI exercise during D1/D2/D7

#### Out of scope (logged as follow-ups)
- Edit on `active`/`completed`/`cancelled` campaigns — needs escrow validation + notification fan-out spec
- Notification to existing applicants when a brand edits a `proposed`/`negotiating` campaign (Q4)
- Inline diff display in the dialog ("you've changed: title, budget")
- Bulk-edit across campaigns
- Field-level validation enhancements (brief min/max, deliverable count caps)

#### Follow-ups for canonical docs (queue for end-of-phase-6)
- **CLAUDE.md** — Key Decisions:
  - "Campaign edit is gated to `draft`/`proposed`/`negotiating` — post-activation editing is out of scope until escrow + notification fan-out spec exists"
  - "`paymentType` is editable on `draft` only — Stripe-pattern freeze-pricing-once-customer-in-funnel; silently dropped from PATCH body on non-draft so the rest of the save still goes through"
  - "Every campaign edit save writes an `audit_log` row (`action='campaign_details_updated'`) — even no-op saves; metadata carries `{changedFields[], from{}, to{}, noOp}` for diff trace"
  - "Custom `Dialog` (src/components/ui/dialog.tsx) has no built-in X / outside-click / Escape — opt-in per dialog where dismissal-without-action is desirable (edit dialog has its own X + Escape; status-transition modals deliberately don't)"
- **FEATURE2_INFLUENCERS_ADDA.md** — Document the EDITABLE_STATUSES set + paymentType lock + per-save audit trail

---

## Items discovered mid-work (queued, not yet phased)

Real findings that surfaced during Phase 1 / 2 / 3 execution. Each is a candidate for the master fix list / future phase scoping. Newest entries at the bottom.

| # | Item | Source | Priority hint |
|---|---|---|---|
| 1 | Influencer profile: location field needs autocomplete (Google Places or static city/country list) | 1A smoke test setup | UX polish — Phase 3+ |
| 2 | Influencer profile: niche field needs chip-input with autocomplete (LinkedIn-style: type + comma/Tab → chip) | 1A smoke test setup | UX polish — Phase 3+ |
| 3 | `/api/influencer/profile` save latency — took noticeably long, possibly synchronous downstream fanout blocking the response | 1A smoke test setup | Investigate — Phase 2+ perf bucket |
| 4 | Brand campaign edit flow — no PATCH UI exists, brand cannot edit dates/budget/marketplace settings after create — **CLOSED IN 3D** | 1A smoke test setup | ✅ Done (3D, `6ea441c` + `ee9fe98`) |
| 5 | Login UX: misleading "Invalid email or password" for password-less (Google-only) users. Better: "This account uses Google sign-in. Please use the Google button." | 1A smoke test (vishweshwar98765 login attempt) | Auth UX polish — Phase 2 cluster with 1B |
| 6 | `ADMIN_DIAGNOSTICS_ENABLED=true` env var didn't take effect on production despite redeploy — diagnostic route returned 404. Root cause not yet investigated. Worked around by querying Neon SQL directly. | 1A Phase A smoke test | Investigate — Vercel ops, minor priority |
| 7 | Orphan `/signup/complete` page + `/api/auth/complete-signup` route (now structurally unreachable after 1B) — **CLOSED IN 2A** | 1B planning | ✅ Done (2A) |
| 8 | Platform analytics dashboard shows "1 panel could not load — showing partial data". Could not retrieve `_errors` array from network response. Likely candidates: `prediction_users`/`prediction_revenue` (OLS on insufficient data), `health_score` (multi-step null branch), `financial_this_month` (May 2026 snapshot may not exist). | Mid-2A diagnostic | Investigate — needs Vercel logs or session-cookie curl |
| 9 | React Error #418 (hydration mismatch on text node) on `/admin/platform-analytics`. Likely a date/locale rendering differently between server (UTC) and client (user tz) | Same diagnostic session | Real bug — Phase 3+ UI |
| 10 | `/avatars/01.png` 404 (×10) — missing placeholder avatar asset | Same diagnostic session | Cosmetic — low priority |
| 11 | 2B production smoke test deferred — test consumer (vishweshwar981) had zero points, redeem UI button stayed correctly disabled. Need to inject test points via SQL before exercising the redeem + audit_log flow end-to-end. | 2B smoke | Phase 3+ verification — when consumer has balance |
| 12 | Brand scheduled-launches list at `/dashboard/launch` shows times in UTC ("Goes live May 31, 09:00 AM UTC"). Should render in brand's wall-clock without needing a per-product tz column. Fix: convert to small client component using `toLocaleString` in browser. | 2C scope decision | UX polish — Phase 3+ |
| 13 | **Migration drift** — migration 016 was documented as "COMPLETE" in CLAUDE.md but had not been applied to production. Discovered when `scheduled_launch_at` column was missing. Need to verify migrations 015–020 status; the "COMPLETE" label describes code-shipped, not DB-applied. | 2C SQL backfill check | Investigate — Phase 3 ops cleanup |
| 14 | `users.role` enum is plain TEXT in schema — `role IN ('brand','consumer','admin')` is enforced only at TypeScript level and in `auth.config.ts` role-assignment branches. A direct SQL insert or stray admin script could write any string. CHECK constraint or PG enum would catch. | Mid-1B investigation (admin role detection in OnboardingGuard) | Hardening — Phase 4+ data integrity |
| 15 | Browser quirk — native `title` tooltip does NOT fire on hover of a disabled button (shadcn `Button` sets `disabled:pointer-events-none`, so mouse events never reach the disabled element). The inline amber message below the button is the always-visible fallback in 3C, so the UX is fine. If we ever want the tooltip too, wrap the disabled button in a `<span>` and put the `title` on the wrapper. | 3C C1 smoke | Cosmetic polish — Tier C |
| 16 | Cancel button on a `draft` campaign is intentionally visible (any non-completed/non-cancelled status). Confirmed by-design in the 3C state machine — a brand who created a draft they no longer want should be able to cancel it without first publishing. Not a bug; documented here in case future Claude sessions re-discover. | 3C C1 smoke | Documentation only |
| 17 | Brand settings page to edit `brand_profiles` fields after onboarding — wizard is set-once today. Logo, billing entity, GSTIN, target audience all locked once the wizard is completed. Brands may need to update industry, address, or logo over the lifetime of the account. | 3A.2 follow-up | UX gap — Phase 4+ brand-side polish |
| 18 | Orphan brand-logo blob cleanup — wizard uploads to Vercel Blob via `/api/uploads/brand-logo` and then writes the URL into `brand_profiles.logoUrl` on submit; if the brand abandons the wizard mid-Step-5, the blob is orphaned. Currently relies on the existing media-retention sweep to catch it. Could add an explicit per-brand reconcile cron if abandonment rate is high. | 3A.2 design | Investigate — Phase 4+ ops |
| 19 | Custom `Dialog` (`src/components/ui/dialog.tsx`) has no built-in X button, outside-click handler, or Escape listener. Affects every dialog in the app (Invite Influencer, Add Milestone, Release Payment, Refund, all four status-transition modals, etc.). 3D's edit dialog got its own X + Escape (commit `ee9fe98`) because the sessionStorage resume path was otherwise unreachable. Other dialogs are short-lived confirms where the trade-off is irrelevant. A future architectural cleanup could add these to the shared component, but it would change the dismissal behaviour of every consumer — needs deliberate review. | 3D D7 smoke | Architectural — defer; per-dialog opt-in is fine for now |
| 20 | Migration 021 — confirmed applied in production via 3A wizard usage during 3B/3C/3D smoke (would have failed at runtime without `brand_profiles` table). Belt-and-suspenders: future Claude sessions can re-verify via `SELECT to_regclass('public.brand_profiles')` in Neon SQL. Closes the migration-drift concern from item #13 for migration 021 specifically; items 015–020 still need explicit verification. | 3A status check | ✅ Confirmed via runtime — items 015–020 still pending verify |

---

## End-of-Phase-6 — one-shot tasks (do BEFORE doc sync)

### Preserve the 6 audit pass reports into the repo

**Context:** The 6 audit pass reports were produced across TWO Claude sessions:

| Pass | Topic | Where it lives |
|---|---|---|
| 1 | Security | Original web-Claude session (not in this VS Code session's context) |
| 2 | Business Logic | Original web-Claude session (not in this VS Code session's context) |
| 3 | Stakeholder Workflows | Original web-Claude session (not in this VS Code session's context) |
| 4 | Objectives | Original web-Claude session (not in this VS Code session's context) |
| 5 | UI/UX | Written in this VS Code session (in chat history) |
| 6 | Data Integrity + Performance | Written in this VS Code session (in chat history) |

User confirmed (2026-05-30) that the original session ended before Phase 1 began, so Passes 1–4 are NOT recoverable from this session's chat history. They live only in the web Claude session history.

**Plan at end of Phase 6:**
1. User pastes Passes 1–4 reports verbatim from the web Claude session
2. Claude saves all 6 into `docs/PRELAUNCH_AUDIT_REPORTS.md` (or split per pass — TBD at the time) without modification or "improvement"
3. This becomes the permanent reference for future Claude sessions that don't have either chat history

**Why deferred:** Saving partial (Passes 5+6 only) would create a misleading reference. Saving all 6 in one pass at the end is honest and complete.

**Risk if forgotten:** Future Claude sessions working on related code would have no access to the original audit findings — they'd have to re-derive context from the fix log alone, which is summarised not verbatim.

---

## Docs to sync when Phase 6 ships

One consolidated update pass at the end. Per-doc checklist:

- [ ] **CLAUDE.md** — Phase Status table additions (one row per shipped phase), Key Decisions table additions
- [ ] **ARCHITECTURE.md** — Auth cookie family (e4i-signup-intent), marketplace accept atomicity, any other cross-cutting concerns
- [ ] **SCHEMA.md** — Any new tables/columns from later phases (none from Phase 1)
- [ ] **CRON_JOBS.md** — Any new crons / cadence changes (none from Phase 1)
- [ ] **FEATURE1_HYPERPERSONALIZATION.md** — Updates per related phases
- [ ] **FEATURE2_INFLUENCERS_ADDA.md** — Marketplace accept flow doc + reconciliation rules (from 1A)
- [ ] **FEATURE3_REALTIME.md** — Any event changes
- [ ] **FEATURE4_COMPETITIVE_INTELLIGENCE.md** — Per related phases
- [ ] **FEATURE5_DEALS_COMMUNITY.md** — Per related phases
- [ ] **FEATURE6_DSAR.md** — Per related phases
- [ ] **FEATURE7_SUPPORT_SYSTEM.md** — Per related phases
- [ ] **FEATURE8_PLATFORM_ANALYTICS.md** — Per related phases
- [ ] **FEATURE9_TWO_FACTOR_AUTH.md** — Cross-link e4i-signup-intent alongside e4i-2fa / e4i-trusted-device cookie patterns
- [ ] Consider new auth-flow doc for the Google signup decision matrix (or fold into ARCHITECTURE.md auth section)
