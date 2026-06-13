# Pre-Launch Audit Fix Log

> **Purpose** — Running journal of the 6-pass pre-launch audit and the fixes that came out of it.
> Append-only as we work through the phases. The canonical docs (CLAUDE.md, ARCHITECTURE.md, SCHEMA.md, FEATURE*.md, CRON_JOBS.md) get synced AFTER all phases complete, in one consolidated pass — see "Docs to sync when Phase 6 ships" at the bottom.
>
> **Audit started:** 2026-05-28
> **Phase 1 completed:** 2026-05-30
> **Phase 2 completed:** 2026-05-31
> **Phase 3 completed:** 2026-06-01
> **Phase 4 in progress:** 4A + 4B shipped 2026-06-02; 4C (A9 — influencer verification) deferred pending strategic design discussion on the broader influencer onboarding flow.
> **Phase 3.5 completed:** 2026-06-04. Strategic redesign of the influencer surface — first-class signup, 6-step onboarding wizard, dedicated dashboard home, dual-role sidebar with view-switcher, cross-role upgrade path. 6 sub-phases (3.5A–3.5F) + 9 follow-up fixes + 3 migrations (022, 023, 024). 3.5G (grandfather banner) intentionally skipped — humane prefill in 3.5C + cross-role upgrade in 3.5F made it moot for the 1 legacy influencer in DB. A9 verification still pending; remains the natural next Tier A item.

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
| 4 | 4A | Marketplace draft exclusion — apply guard + listing/recommended/detail filters | `6c7d80b` | ✅ 2026-06-02 (A13-1 + A13-3 verified; A13-2/4/5/6 functional, not separately confirmed) | ⏳ deferred |
| 4 | 4B | Payout-account prompt — banner (L1) + inline notice (L2) + accept/apply guards (L3/L4) + friendly modal (L5) | `bdc0f01` | ⏳ deferred — just shipped, awaiting smoke | ⏳ deferred |
| 4 | 4C | Influencer verification flow (A9) | — | ⏳ pending — moved to follow Phase 3.5 (the strategic discussion fed into 3.5, not into A9) | ⏳ deferred |
| 3.5 | 3.5A | Multi-role flags + influencer in auth (migration 022 + 023 hot-fix) | `23ee50e` + `028c075` | ✅ 2026-06-02 (smoke checks 3.5A-1 through 3.5A-6) | ⏳ deferred |
| 3.5 | 3.5B | First-class influencer signup option (3 hot-fixes: OnboardingGuard bypass, sidebar role-array form) | `cb66586` + `cf78ea7` + `cd52f57` | ✅ 2026-06-02 (B-1, B-2 verified; B-3 through B-7 skipped per user) | ⏳ deferred |
| 3.5 | 3.5C | 6-step influencer onboarding wizard (migration 024 + 3 hot-fixes: photo cap, per-user storage, legacy data sanitisation) | `c101bbc` + `31a0f03` + `f6f49a4` + `4348fa5` | ✅ 2026-06-03 (wizard reaches step 6, audit_log row written) | ⏳ deferred |
| 3.5 | 3.5D | Influencer dashboard home + profile completeness breakdown | `8e963d8` + `c297244` | ✅ 2026-06-03 (D-2 surfaced "show contribution per segment" — addressed in follow-up) | ⏳ deferred |
| 3.5 | 3.5E | Role-aware sidebar + dual-role view-switcher | `f78f80c` | ✅ 2026-06-04 (E-2 through E-5 verified after data fix-up) | ⏳ deferred |
| 3.5 | 3.5F | Cross-role upgrade entry from /settings (2 hot-fixes: stale profile bounce, defensive completion action on sign-out) | `7862312` + `9f25adf` + `513d21d` | ✅ 2026-06-04 (RoleSwitcher visible post sign-out + re-login) | ⏳ deferred |
| 3.5 | 3.5G | Grandfather banner | — | ⏭️ intentionally skipped — moot after 3.5C humane prefill + 3.5F cross-role upgrade | n/a |
| EV | EV.1 | Email verification backend — migration 026, service + guard + 6 hard-blocked routes | `c4b1dce` | ✅ 2026-06-05 (Google backfill confirmed, 6 routes return 403 on unverified) | ✅ 2026-06-13 |
| Sig | a38f85b | Password UX — SSOT policy, reusable PasswordInput, confirm-password field | `a38f85b` | ✅ 2026-06-07 (signup gate, login toggle) | ✅ 2026-06-13 |
| EV | EV.2.1 | Auto-send verification at signup + Google auto-verify (both new + existing-NULL) | `da93b39` | ✅ 2026-06-10 (real inbox: welcome + verification both arrived) | ✅ 2026-06-13 |
| Schema | 027 | `user_profiles.id` FK CASCADE → `users(id)` + orphan cleanup | `11b6840` | ✅ 2026-06-10 (POST migration returned `affected: 1`; second call no-op) | ✅ 2026-06-13 |
| EV | EV.2.2 | `/verify-email` page + L1 banner + settings card + global modal + api-client 403 interceptor | `622e7fa` | ⚠️ Partial — verify-email transition error surfaced (see Known Issue); banner/card/modal verified working | ✅ 2026-06-13 |
| EV | EV.3.1 | Shared `EmailVerificationProvider`, context banner, prompt helper, sidebar lock rendering, deal-redeem hard-block | `f00e725` | ✅ 2026-06-11 (provider polls correctly, sidebar locks show/hide on verification toggle) | ✅ 2026-06-13 |
| EV | EV.3.2 | Layer-2 context banners + Layer-4 click intercepts on 6 surfaces | `cb1d766` | ✅ 2026-06-11 (banners visible on each gated page; click intercepts open modal without network call) | ✅ 2026-06-13 |
| ER | ER.1 | Sidebar `requiresCapability` filter + influencer / brand server-side layout guards | `faf1bfb` | ✅ 2026-06-13 (pure consumer no longer sees influencer items; direct URLs redirect to `/dashboard?upgrade=…`) | ✅ 2026-06-13 |
| ER | ER.2 | `UpgradePromptCard` mounted on `/dashboard` reading `searchParams.upgrade` | `4394304` | ✅ 2026-06-13 (both variants render with correct CTAs) | ✅ 2026-06-13 |
| EV | EV.2 def | Verify-email defensive patches (try/catch, meta refresh, force-dynamic, plain `<a>`) | `dbf5c6b` + `dd4e536` + `799bd52` | ⚠️ End-to-end verification works (AlreadyUsedPanel + meta refresh paths verified); SuccessPanel `router.push` root cause unresolved | ✅ 2026-06-13 |
| 4 | 4C | Influencer verification flow (A9) | — | ⏳ **NEXT — current sprint.** Strategic deferral resolved by EV.2 + EV.3 + ER.1 + ER.2 landing. The 7th `requireEmailVerified` route + an influencer-specific verification request UI. | ⏳ pending |

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

## Phase 4 — Tier A remaining (IN PROGRESS)

Theme: close the rest of Tier A from the original audit (A13, A10, A9). A13 + A10 shipped 2026-06-02. A9 is deferred pending a strategic design discussion on the broader influencer-onboarding flow (user-led).

### Sub-Phase 4A — Marketplace draft exclusion (`6c7d80b`)

**Audit reference:** Pass 2 C4 (A13)

#### Bug
`applyToCampaign` in `campaignMarketplaceService.ts:132` allowed applications against `['draft','proposed','active']`. Drafts are still being edited by the brand — surfacing them to influencers is wrong on two axes:

1. **Apply leakage** — an influencer could submit an application against a campaign whose title, brief, budget, or deliverables were still being typed
2. **Listing leakage** — investigation surfaced that the broader marketplace listing also leaked drafts: `getPublicCampaigns` (line 131), `getRecommendedCampaigns` (line 201), and `getCampaignMarketplaceDetail` (line 248) all included drafts when `is_public=true`

After 3D shipped, a brand could toggle `isPublic=true` on a draft via the new Edit dialog — accidentally exposing the in-progress campaign across all four surfaces. Same conceptual bug in four places.

#### Root cause
The status allowlist was written when only `('proposed','active')` made sense, then `'draft'` was added to make local development easier (drafts could be browsed before the publish flow existed). The dev shortcut never got removed.

#### Fix — drafts removed from all four marketplace surfaces

| Spot | Before | After |
|---|---|---|
| `applyToCampaign` allowlist | `['draft','proposed','active']` | `['proposed','active']` + draft caught first with friendlier *"This campaign is not yet open for applications"* error |
| `getPublicCampaigns` listing | included `draft` | `proposed` + `active` only |
| `getRecommendedCampaigns` | included `draft` | same |
| `getCampaignMarketplaceDetail` | only `isPublic` filter | + status `IN ('proposed','active')` so direct URL 404s |

`negotiating` was already excluded everywhere — left as-is (out of scope; mid-negotiation campaigns typically don't take new applications).

The split-error in `applyToCampaign` is deliberate: `'draft'` gets *"not yet open"* (it's coming), other terminal statuses keep *"no longer accepting"* (it's gone). Two different states, two different stories.

#### Files changed
- `src/server/campaignMarketplaceService.ts` (+9 / -1) — split error + tightened allowlist
- `src/db/repositories/campaignMarketplaceRepository.ts` (+17 / -3) — listing, recommended, detail all tightened

#### Commit
`6c7d80b` — `fix(marketplace): exclude drafts from listing + apply (A13)`

#### Design decisions made
- **Scope expansion** — the original brief asked to fix the apply guard and "verify the listing already filters drafts (probably does)". Investigation showed all four spots leaked. Fixing all four in one commit avoids the broken half-state where "I see a draft in the listing, click apply, get rejected"

#### Smoke test (2026-06-02)
- A13-1 — Brand created a draft, toggled `isPublic=true` via the 3D Edit dialog without publishing ✅
- A13-3 — Influencer GET `/api/marketplace/campaigns/<draftId>` returned `404 {error:"Campaign not found"}` ✅ (route converts the repo's `result.campaign === null` to a clean 404 — pre-fix would have returned the draft body)
- A13-2 (listing not visible), A13-4 (apply force-test), A13-5 (post-publish appears), A13-6 (cancelled returns different error) — functional based on the server change, not separately confirmed by user

#### Follow-ups for canonical docs (queue for end-of-phase-6)
- **CLAUDE.md** — Key Decisions: "Marketplace surfaces (listing, recommended, detail, apply) all gate on `status IN ('proposed','active')` — drafts are deliberately excluded even when `isPublic=true`, because the brand may be mid-edit"
- **FEATURE2_INFLUENCERS_ADDA.md** — Document the status gate as the marketplace visibility contract

---

### Sub-Phase 4B — Payout-account prompt (`bdc0f01`)

**Audit reference:** Pass 3 I-C3 (A10)

#### Bug
Silent failure on first payment release. The flow:
1. Influencer registers an influencer profile (`/dashboard/influencer/profile`)
2. Accepts a campaign invitation OR applies to a marketplace campaign
3. Does the work
4. Brand clicks Release Payment → `payoutService.initiateRecipientPayout()` calls `getPrimaryAccount(userId, currency)` → returns null → throws `PayoutAccountMissingError`
5. `/api/payments/release/[campaignId]:132` catches it and returns 422 to brand UI
6. **Influencer never knew this requirement existed** — learns about it through brand support escalation

Worst case the influencer has already delivered the deliverable, has expectations of payment, and discovers the missing payout setup only through customer-support back-and-forth. Bad for trust, bad for support load.

#### Root cause
The payouts page (`/dashboard/influencer/payouts`) and the underlying `influencer_payout_accounts` table existed from migration 008. The page was polished, the API worked, the schema supported five account types with encryption. The gap was **discoverability** — nothing on the influencer's normal path mentioned payouts existed until they tried to receive money.

#### Fix — five defensive layers, soft-to-hard

| Layer | Surface | Effect |
|---|---|---|
| **L1** | `/dashboard` (consumer dashboard, where influencers land) | Amber Wallet banner: *"Add your payout account"* + CTA. Shown only when user has an influencer profile AND no payout account. sessionStorage dismissable. Mirrors `BrandOnboardingBanner` pattern |
| **L2** | `/dashboard/influencer/profile` | Quieter inline card below the profile form. Same trigger condition. CTA → payouts page |
| **L3** | `respondToInvitation` (accept campaign) | Hard guard: loads campaign, checks `hasPayoutAccount(influencerId, 'influencer', campaign.budgetCurrency)`. On miss → audit_log row (`accept_blocked_no_payout`) + throws `PayoutAccountRequiredError` |
| **L4** | `applyToCampaign` (marketplace apply) | Same shape but in the apply path. audit_log row `apply_blocked_no_payout` |
| **L5** | `CampaignDetailPanel` (marketplace card → Apply panel) | Intercepts the L4 server response when `code='PAYOUT_ACCOUNT_REQUIRED'`. Opens friendly modal with currency-specific copy + CTA. Replaces generic toast.error |

#### Design Q&A (all approved upfront)

1. **What counts as "has payout account"?** — Q1 approved: **(b) currency-matched** for L3+L4 hard blocks (matches the `payoutService.getPrimaryAccount(userId, currency)` check that fires at release time); **(a) any-currency** for L1+L2 gentle nudges
2. **Error type** — Q2 approved: **(a) typed `PayoutAccountRequiredError` class** alongside the existing `PayoutAccountMissingError`. Stripe/Razorpay pattern — typed errors let API routes return structured `{code, currency, cta}` responses the UI can render specially
3. **L1 banner dismissal cadence** — Q3 approved: **(a) sessionStorage**, mirrors BrandOnboardingBanner, reappears next login
4. **L5 — disable button or intercept click?** — Q4 approved: **(b) intercept**. The click is intent ("I want this campaign"); converting that intent into a payout-setup flow is the right next step. Disabled buttons just look broken without context
5. **Audit log scope** — Q5 approved: **(a) blocked attempts only**. Account creation already auto-audits via the `payout_accounts` row write itself
6. **Extra DB call for currency lookup?** — Q6 approved: **yes, accept it.** Simplest correct check; caching would be premature optimization

#### Files changed
- `src/db/repositories/payoutAccountRepository.ts` — new `hasPayoutAccount(userId, userRole, currency?)` helper (EXISTS via LIMIT 1)
- `src/server/payoutService.ts` — new `PayoutAccountRequiredError` class with `currency: string` field
- `src/server/campaignManagementService.ts` — L3 guard in `respondToInvitation` (adds `getCampaignById` lookup for currency, `hasPayoutAccount` check, audit_log row, throw)
- `src/server/campaignMarketplaceService.ts` — L4 guard in `applyToCampaign` (same pattern, campaign already loaded)
- `src/app/api/influencer/campaigns/[campaignId]/route.ts` — catches `PayoutAccountRequiredError` → 400 with `{error, code:'PAYOUT_ACCOUNT_REQUIRED', currency, cta}`
- `src/app/api/marketplace/campaigns/[campaignId]/apply/route.ts` — same catch
- `src/components/InfluencerPayoutBanner.tsx` (new) — L1 banner; sessionStorage `e4i-influencer-payout-banner-dismissed`; hydration-safe
- `src/app/dashboard/page.tsx` — `ConsumerDashboard` checks influencer profile + `hasPayoutAccount` in parallel with existing dashboard fetches; renders banner when both conditions hold
- `src/app/dashboard/influencer/profile/page.tsx` — fetches `/api/payouts/accounts` alongside the profile fetch; renders inline amber card below social handles when registered AND no accounts
- `src/components/influencer/marketplace/CampaignDetailPanel.tsx` — `handleApply` parses response body for `code`; on `PAYOUT_ACCOUNT_REQUIRED` opens the L5 modal with currency-specific copy

**No schema migration** — `influencer_payout_accounts` already in place from migration 008.

#### Commit
`bdc0f01` — `feat(payouts): payout-account prompt — banner + guards + modal (A10)`

#### Smoke test (deferred — just shipped)
A10 smoke plan (run after Vercel green): A10-L1 (banner appears + sessionStorage dismiss), L1b/L1c (later button persists session, re-appears next login), L2 (inline card on profile), L2b (gone after adding account), L3 (accept blocked with structured 400), L4 (marketplace apply blocked), L4b (form state preserved on modal close), L4c (after adding account, apply succeeds), L4d (audit_log rows present), A10-currency-mismatch (USD campaign, INR-only influencer — modal copy reflects USD).

#### Out of scope (logged as follow-ups)
- **Retroactive sweep** — influencers who accepted invitations BEFORE A10 shipped still have no payout account; they're stuck until a brand tries to release payment. Would need a cron + email reminder. Deferred
- **Payout account verification UX** — `isVerified` flag exists; no verification flow yet (would need micro-deposit or Razorpay verify API)
- **Profile wizard expansion to include payout setup** — turning `/dashboard/influencer/profile` into a multi-step wizard like brand onboarding. Deferred pending user-led strategic discussion (next agenda item before A9)
- **Email reminder cron** — daily/weekly nudge to influencers who registered but never added payout. Out of scope; let's see if L1–L5 are enough first

#### Follow-ups for canonical docs (queue for end-of-phase-6)
- **CLAUDE.md** — Key Decisions:
  - "Influencer payout setup is gated at 5 layers: dashboard banner (L1), profile inline notice (L2), accept-invitation hard guard (L3, currency-matched), marketplace-apply hard guard (L4, currency-matched), apply modal intercept (L5). Soft nudges use any-currency check; hard blocks use currency-specific to mirror the `payoutService.getPrimaryAccount(userId, currency)` failure point"
  - "`PayoutAccountRequiredError` (entry-time, fires in `respondToInvitation` + `applyToCampaign`) is distinct from `PayoutAccountMissingError` (release-time, fires in `initiateRecipientPayout`). Both share the same root cause but fail at very different points in the lifecycle — the former is the new defensive layer that prevents the latter"
  - "API routes that surface `PayoutAccountRequiredError` return structured 400 `{error, code:'PAYOUT_ACCOUNT_REQUIRED', currency, cta}` so the client can render a friendly modal rather than a generic toast"
- **FEATURE2_INFLUENCERS_ADDA.md** — Document the 5-layer payout prompt as part of the influencer engagement lifecycle
- **SCHEMA.md** — No schema change; cross-link `influencer_payout_accounts` to the A10 guards

---

### Sub-Phase 4C — Influencer verification (A9) — PENDING

User explicitly deferred: *"After A10 is done, I want to discuss a BIGGER strategic change to influencer onboarding BEFORE we tackle A9."*

A9 will pick up after the strategic discussion lands. Likely scope (TBD):
- What "verified" means (manual admin badge? social-handle OAuth ownership proof? identity-doc upload?)
- Whether verification is a prerequisite to apply or just a trust signal
- Whether the strategic onboarding rethink absorbs A9 into a larger wizard

No code shipped yet. Status row in Status Overview reflects this.

---

## Phase 3.5 — Influencer onboarding redesign (COMPLETE)

> User-led strategic phase. Inserted between Phase 4 and the (still pending) A9 because the broader influencer-onboarding rethink the user flagged after A10 absorbed what would have been incremental Tier A polish. Makes influencers first-class citizens: discoverable signup option, polished 6-step wizard, dedicated dashboard home, dual-role sidebar with view-switcher, cross-role upgrade path from settings. 6 sub-phases (3.5A–3.5F) + 9 follow-up fixes + 3 migrations (022, 023, 024). 3.5G grandfather banner intentionally skipped — the humane-prefill in 3.5C and the cross-role upgrade path in 3.5F make it moot for the 1 legacy influencer in the DB.

**Inspiration cited by user**: LinkedIn (multi-role identity), Patreon Creator onboarding, Whop Hub setup, Shopify Partner program.

---

### Sub-Phase 3.5A — Multi-role flags + influencer in auth (`23ee50e` + hot-fix `028c075`)

#### Bug / gap
Before 3.5A there was no first-class concept of "influencer" in `users.role`. The role column was effectively `'brand' | 'consumer' | 'admin'` (with admin as a runtime-only DB value not in the TS union), and "influencer" was a modular add-on signalled by `users.is_influencer = true` on a consumer-shaped account. That worked when influencers were a niche feature but cracked the moment we wanted:
- A signup page where influencer is one of three first-class options
- A dedicated `/dashboard` home for pure-influencer accounts
- A sidebar that reflects the user's primary surface
- A role-switcher for dual-role users to toggle views

#### Design (approved upfront — Q1)
Stripe-Connect-style **dual schema**:
- `users.role` (single value, `'brand' | 'consumer' | 'influencer' | 'admin'`) — primary view / default dashboard
- `users.is_brand` / `users.is_consumer` / `users.is_influencer` (booleans) — cross-cutting capability flags

A user can have multiple capability flags true. Existing `role === 'X'` checks throughout the codebase keep working unchanged (they decide primary view). New code uses `isX` flags for cross-role feature gates.

#### Fix
- **Migration 022** — adds `users.is_brand` + `users.is_consumer` (both NOT NULL DEFAULT false) + backfills from existing `role`. Also adds `influencer_profiles.onboarding_completed` + `onboarding_completed_at` (defaults FALSE — intentionally grandfathers existing influencer rows as "needs wizard" so 3.5G banner could catch them). Partial index `idx_influencer_pending_onboarding` for the lookup. Idempotent.
- **`UserRole` type** extended: `'brand' | 'consumer' | 'influencer' | 'admin'`. New `SignupRole = 'brand' | 'consumer' | 'influencer'` (admin excluded).
- **`signupIntent.ts`** allowlist extended to include `'influencer'` (admin still never self-assignable).
- **`userStore.ts`** — `createUser` sets the matching boolean flag at create time; extracted `rowToUser` helper for db-row → User mapping so getById / getByEmail / getByGoogleId / getAllUsers / getUsersByRole stay lock-step.
- **`welcomeNotifications.ts`** — new `generateInfluencerWelcomeHTML` mirroring brand template structure with pink/purple gradient. Tone: enthusiastic + professional + "let's get you earning" per Q7 brief. WhatsApp + email both extended to accept `WelcomeRole = 'brand' | 'consumer' | 'influencer'`.
- **`auth.actions.ts`** — Zod role enum extended to include `'influencer'`.

#### Hot-fix — Migration 023 (`028c075`)
3.5B smoke immediately surfaced a `users_role_check` CHECK constraint on the production DB that was NOT in `schema.ts` (must have been added directly in Neon at some prior point — the audit log's mid-work item #14 had flagged this surface but believed no CHECK existed). The constraint's allowlist was `('brand','consumer','admin')`. Inserting a new influencer user failed with a constraint-violation 500.

**Fix**: migration 023 drops + recreates the constraint with the expanded allowlist `('brand','consumer','influencer','admin')`. Captures the previous definition in the response for audit clarity. Idempotent. Lives in `src/app/api/admin/run-migration-023/`.

#### Files changed
- 022: `src/app/api/admin/run-migration-022/route.ts` (new), `src/db/schema.ts` (+10), `src/lib/auth/signupIntent.ts`, `src/lib/user/types.ts` (+18), `src/lib/user/userStore.ts` (rowToUser refactor + flag-setting), `src/server/welcomeNotifications.ts` (+~150 for influencer template), `src/lib/actions/auth.actions.ts`
- 023: `src/app/api/admin/run-migration-023/route.ts` (new)

#### Smoke test (2026-06-02)
Six SQL diagnostics on Neon: columns exist (`users.is_brand`, `is_consumer`; `influencer_profiles.onboarding_completed`, `onboarding_completed_at`), backfill correctness (all `role='X'` rows have matching `is_X=true`), partial index present, all existing influencer rows have `onboarding_completed=false` (grandfather default), population counts (Q5 baseline: 1 brand, 7 consumers, 1 legacy influencer = 1 dual-role), application-level sanity via `/api/auth/session`.

#### Design Q&A — Q1, Q2, Q3, Q4, Q5, Q6, Q7, Q8 (all approved)
1. Schema: dual model (single `role` + 3 boolean flags) — chosen over 3-booleans-only OR keeping single role
2. Existing influencers: grandfather + dismissable banner approach (3.5G later skipped)
3. Dual-role landing: `users.role` always wins (predictable default + two-tier session/permanent toggle)
4. `/dashboard/*` paths: keep flat for consumer; `/dashboard/consumer/*` symmetry deferred
5. Existing influencer count: 1 (low — banner urgency low)
6. Sub-phase ordering: 3.5A first as foundation
7. Welcome email copy: Claude drafts + user reviews (delivered in 3.5A)
8. Role toggle feature flag: NO flag, ship live

#### Follow-ups for canonical docs (queue for end-of-phase-6)
- **CLAUDE.md** Phase Status: "Multi-role schema (users.role primary view + is_brand/is_consumer/is_influencer capability flags) — Stripe Connect pattern; existing role-string checks unchanged for primary-view decisions"
- **CLAUDE.md** Key Decisions: "Migration 023 (users_role_check expanded for influencer) added separately as hot-fix when prod-only constraint surfaced; brings schema.ts perception in line with prod"
- **SCHEMA.md** — Update users table definition with the 3 boolean flags; add `influencer_profiles.onboarding_completed` + `onboarding_completed_at`
- **ARCHITECTURE.md** — Document the `SignupRole` vs `UserRole` distinction (signup allowlist excludes admin)

---

### Sub-Phase 3.5B — First-class influencer signup (`cb66586` + 2 follow-ups: `cf78ea7`, `cd52f57`)

#### Bug / gap
The signup page had only Brand and Consumer as radio options. Influencer was an "informational only" dashed tile telling users to sign up as Consumer and then complete an influencer profile — a 2-step path the user never took.

#### Fix (`cb66586`)
- **`src/app/(auth)/signup/page.tsx`** — 3 selectable RadioGroupItem tiles (Brand 🏢, Consumer 🛍️, Influencer 🎯) with concise value-prop copy per design brief:
  - Brand: "Get hyper-personalized feedback and intelligence on your products."
  - Consumer: "Earn rewards by sharing honest feedback on products you love."
  - Influencer: "Get paid for genuine campaigns with brands that match your audience."
  - Selected state: role-themed border colour (violet for influencer)
- Single `getRedirectUrl(role)` helper drives both email+Google paths: brand → `/dashboard`, consumer → `/top-products`, influencer → `/dashboard/influencer/profile` (temp until 3.5C wizard) — later updated to `/onboarding` in 3.5C

#### Hot-fix 1 — OnboardingGuard influencer bypass (`cf78ea7`)
First influencer signup landed on the CONSUMER onboarding wizard at `/onboarding` instead of `/dashboard/influencer/profile`. Root cause: `OnboardingGuard.tsx` had explicit branches for admin and brand but no influencer branch — `role='influencer'` fell through to the consumer path, which called `ensureUserProfile` + checked `user_profiles.onboardingComplete` (false for a fresh user) and redirected to `/onboarding`.

Fix added a role==='influencer' early branch that bypasses (temp 3.5B behavior; 3.5C flips it to a real `hasCompletedInfluencerOnboarding` check).

#### Hot-fix 2 — Sidebar shows influencer items for pure influencer (`cd52f57`)
After influencer signup, the user saw only the shared sidebar items (Dashboard, Products, Top 10, Notifications, Social, Community, Community Deals) and none of the 6 influencer items (Marketplace, My Campaigns, My Content, Earnings, Payouts, Influencer Profile). Root cause: those items were tagged `role: 'consumer'` from the historical model where "influencer" was a consumer with `isInfluencer=true`.

Fix extended `MenuItem.role` to accept `Role | Role[]` and retagged the 6 influencer items as `role: ['consumer', 'influencer']` so they appear under both primary views. Filter handles the array form via `item.role.includes(userRole)`.

#### Smoke test (2026-06-02)
- B-1 (3-tile UI) ✅
- B-2 (email signup as influencer, DB flags, welcome email) ✅ after OnboardingGuard fix
- B-3 through B-7 skipped per user — regression tests on unchanged code paths

#### Follow-ups for canonical docs
- **CLAUDE.md** Key Decisions: "MenuItem.role now accepts string | string[]; multi-role items use the array form so they appear under either primary view"

---

### Sub-Phase 3.5C — 6-step influencer onboarding wizard (`c101bbc` + 3 follow-ups: `31a0f03`, `f6f49a4`, `4348fa5`)

#### Bug / gap
The existing single-form `/dashboard/influencer/profile` page worked but wasn't a wizard — no progressive disclosure, no per-step save, no draft persistence, no required-fields gate, no payout integration, no audience demographics, no content-type taxonomy. New influencer signups needed a Patreon-grade flow.

#### Design Q&A — 8 decisions approved upfront
1. Niche taxonomy: curated 16 (`beauty/fashion/tech/food/fitness/travel/lifestyle/gaming/education/finance/parenting/music/art/sports/automotive/health-wellness` — last added per India market)
2. Content types: curated 9 (`reels/stories/posts/short-form-video/long-form-video/blog-post/podcast/livestream/review`)
3. Payout step: skip-with-CTA (link to `/dashboard/influencer/payouts`, no duplicate form inside wizard)
4. Verification status post-wizard: stay `unverified` (A9 owns the transition; don't fake-promote to `pending`)
5. Audience demographics: number inputs + soft sum validation (≤100, not strict =100); colour-coded "% remaining" pill
6. Profile photo: PNG/JPG/WEBP, 2 MB → bumped to 5 MB in follow-up (modern phone photos)
7. Existing influencer: humane prefill + skip-through (Q7 — wizard hydrates from existing data; "Save and continue" with no edits still flips `onboarding_completed=true`)
8. Single commit (vs. split like 3A.1/3A.2)

#### Fix (`c101bbc`)
- **Migration 024** — adds 4 columns to `influencer_profiles`: `profile_image_url TEXT`, `tiktok_handle TEXT`, `content_types TEXT[] NOT NULL DEFAULT '{}'`, `audience_demographics JSONB NOT NULL DEFAULT '{}'`. Idempotent. JSONB shape Zod-validated at write time (not enforced by Postgres).
- **`src/lib/validation/influencer-onboarding.ts`** (new) — 4 Zod schemas (profile basics, social handles, audience+rates, composite). 16-niche enum + 9-content-type enum + age brackets + gender split + top countries + currencies, all curated. `percentageSplitSchema` enforces ≤100 sum with a small float-arithmetic tolerance. Human-readable label maps for the UI multi-selects.
- **`src/app/onboarding/influencer-onboarding.actions.ts`** (new) — `saveProfileBasicsAction`, `saveSocialHandlesAction`, `saveAudienceAndRatesAction`, `completeInfluencerOnboardingAction`, `getInfluencerOnboardingState`. `requireInfluencerCapable` accepts `role in {influencer, consumer, admin}` (the 3.5F cross-role upgrade path piggy-backs on this). Completion writes `audit_log action='influencer_onboarding_completed'` + sets `users.isInfluencer=true` (covers cross-role upgrade).
- **`src/app/onboarding/InfluencerOnboardingClient.tsx`** (new, ~720 LOC) — 6 steps: welcome, profile basics, social handles, audience+rates, payouts (skip-with-CTA), done. sessionStorage draft persistence keyed `e4i_influencer_onboarding_draft`. All shadcn primitives, dark theme tokens, mobile responsive, role-coloured pill multi-selects (violet for niches, pink for content types), gradient header avatar.
- **`src/db/repositories/influencerProfileRepository.ts`** — added `hasCompletedInfluencerOnboarding`, `upsertInfluencerProfile`, `markInfluencerOnboardingComplete`. updateProfile signature widened for new fields.
- **`src/app/api/uploads/influencer-photo/route.ts`** (new) — mirrors brand-logo: PNG/JPG/WEBP, 2 MB cap, no SVG (XSS), `influencer-photos/` namespace, `addRandomSuffix=true`.
- **Wiring**: `/onboarding/page.tsx` adds influencer branch routing to wizard; `OnboardingGuard.tsx` flips 3.5B bypass → real `hasCompletedInfluencerOnboarding` check; `signup/page.tsx` `getRedirectUrl` for influencer changes to `/onboarding` (was `/dashboard/influencer/profile` in 3.5B).

#### Hot-fix 1 — Photo cap 2 MB → 5 MB (`31a0f03`)
Wizard step-2 photo upload failed for a real phone photo. Modern iPhone 12+ / Android flagships routinely produce 3–5 MB JPEGs. Bumped both client-side `PHOTO_MAX_BYTES` and server-side `maximumSizeInBytes` to 5 MB. Brand logo cap stays at 2 MB (logos are typically smaller).

#### Hot-fix 2 — Per-user sessionStorage + defensive step clamp (`f6f49a4`)
Dual-role user (E-5 smoke) logged back in, got bounced to `/onboarding` showing the "You're all set!" final screen — but clicking "Go to dashboard" did nothing (infinite redirect loop). Root cause: the wizard's draft sessionStorage key was a single global string (`e4i_influencer_onboarding_draft`), NOT scoped to userId. Earlier test runs had left `{ step: 6, ... }` in storage. Different user lands on `/onboarding`, wizard hydrates from sessionStorage, restores `step=6`, shows the done screen even though DB says `onboarding_completed=false`. Clicking "Go to dashboard" → `OnboardingGuard` redirects back → loop.

**Fix layers**:
1. Per-user storage key: `e4i_influencer_onboarding_draft:<userId>`. Different accounts on the same browser get independent draft state.
2. Defensive step clamp on hydration: if `draft.step === 6` but `initial?.onboardingCompleted !== true`, reset to step 1 + clear the stale draft. Catches any edge case the per-user key doesn't.

Brand wizard has the same global-key pattern but no surface report — queued as a future Tier C polish.

#### Hot-fix 3 — Sanitise legacy data on hydration (`4348fa5`)
Legacy dual-role user hit two bugs after the per-user-key fix:
- "Validation failed" toast on step-2 save — server-side Zod rejected because the legacy `influencer_profiles` row had free-text niches not matching the curated 16-enum
- Could only select 4 niches instead of 5 — one stale free-text niche sat invisibly in `form.niche.length`, blocking the `length < 5` add gate

**Fix**: `sanitiseNiches()` filters hydrated values against `INFLUENCER_NICHES` set; `sanitiseContentTypes()` does the same; `clampString()` forces displayName/bio/location/each social handle into their schema max lengths on hydration. Plus `describeActionError()` surfaces the first Zod field error in toasts so future validation failures are debuggable ("displayName: Display name must be at least 2 characters" instead of bare "Validation failed").

#### Smoke test (2026-06-03)
Wizard reaches step 6, `audit_log` row written, `influencer_profiles.onboarding_completed=true`, `users.is_influencer=true`. Photo upload at 4 MB works.

#### Follow-ups for canonical docs
- **CLAUDE.md** Key Decisions:
  - "Influencer wizard sessionStorage key is per-user (`e4i_influencer_onboarding_draft:<userId>`); brand wizard still uses the global key — fix queued as Tier C"
  - "Wizard final-step (step 6) is reachable ONLY via the completion server action by design; defensive step clamp resets stale `step:6` storage when DB says NOT completed"
  - "Legacy data sanitisation on wizard hydration: free-text values from the pre-3.5C single-form path are filtered against the curated enums; lengths clamped to schema max — prevents 'Validation failed' on save without UI feedback about which field"
  - "Niche taxonomy bounded to 16 curated values; content types 9 curated. Adding new values is a one-line edit to `INFLUENCER_NICHES` / `INFLUENCER_CONTENT_TYPES` + relevant migration if persistence shape changes"
- **SCHEMA.md** — `influencer_profiles` columns added in migration 024
- **FEATURE2_INFLUENCERS_ADDA.md** — Document the wizard end-to-end (6 steps, completion contract, audit row, sanitisation layer)

---

### Sub-Phase 3.5D — Influencer dashboard home (`8e963d8` + follow-up `c297244`)

#### Bug / gap
A pure-influencer signup (`role='influencer'`) landing on `/dashboard` saw ConsumerDashboard — points balance, feedback stats, product recommendations. Wrong audience.

#### Fix (`8e963d8`)
- `/dashboard/page.tsx` `DashboardPage` now branches on role in `{brand, influencer, else}`. Pure influencer (`role='influencer'`) gets the new `InfluencerDashboard`. Dual-role consumer-with-`isInfluencer=true` (role='consumer') keeps seeing `ConsumerDashboard` until 3.5E adds the role-switcher.
- `InfluencerDashboard` (~300 LOC inline) layout:
  1. Welcome banner with violet-pink gradient avatar matching wizard
  2. `InfluencerPayoutBanner` (A10 reuse — fires when no payout account)
  3. Stats row: Active campaigns / Pending earnings / Profile completeness / Verification status
  4. Quick actions: 4 cards linking to marketplace / content / earnings / profile
  5. Recommended campaigns (top 3 from `getRecommendedCampaigns`)
  6. Recent activity (last 5 `campaign_influencers` rows by `updatedAt`)
  7. Niche badges footer
- `calcProfileCompleteness` — 10-factor heuristic, weights sum to 100. Heuristic, not perfect.
- `getInfluencerStats` — active count + pending payouts sum (INR only on the card; multi-currency on /earnings page).
- All reads via existing repos/services server-side. No new APIs, no new schema, no new migrations.

#### Follow-up — Profile completeness breakdown (`c297244`)
D-2 smoke: the stat card showed "80% complete" with no indication of which segments were missing. User said "can't see contribution of each segment".

**Fix**: extracted `COMPLETENESS_FACTORS` array (single source of truth for percentage + breakdown — no drift possible). New `getMissingProfileFactors` helper. Added "Boost your profile" section between stats and Quick Actions, visible only when missing factors exist; lists each unfilled item with weight badge (`+15%`, `+10%`) as clickable cards linking to the profile edit page. LinkedIn-style "complete your profile" pattern.

#### Smoke test (2026-06-03)
- D-1 to D-7 verified including the per-segment breakdown after the follow-up
- Portfolio reserved as future factor (weight 5, no UI yet); practical max today is 95%

#### Follow-ups for canonical docs
- **CLAUDE.md** Key Decisions:
  - "Influencer dashboard home (`/dashboard` when `role='influencer'`) — distinct surface from ConsumerDashboard; stats are campaign+earnings focused, not points/feedback"
  - "Profile completeness uses a 10-factor weighted heuristic via `COMPLETENESS_FACTORS` single source of truth — same array drives the stat card percentage AND the breakdown card; max reachable today is 95% (portfolio reserved 5% for future)"
- **FEATURE2_INFLUENCERS_ADDA.md** — document the dashboard layout sections + completeness calculation

---

### Sub-Phase 3.5E — Role-aware sidebar + dual-role view-switcher (`f78f80c`)

#### Bug / gap
After 3.5B-fix-2, the sidebar tagged influencer items with `role: ['consumer', 'influencer']` so dual-role users saw both consumer items AND influencer items mixed together — ~25+ items, cluttered.

#### Design (Q1, Q2, Q3 approved)
- **Q1**: two-tier persistence — session-only toggle (sessionStorage, cheap, no DB write) + "Make this my default view" link that updates `users.role` permanently
- **Q2**: RoleSwitcher hidden for single-role users (no clutter)
- **Q3**: header top-right (LinkedIn pattern), not sidebar (Patreon pattern)

#### Fix
- **`auth.config.ts`** — session + JWT now carry the 3 capability flags. authorize() (credentials), Google signIn branches (existing + new user), jwt callback, session callback all propagate. NextAuth type augmentation includes `user.isBrand / isConsumer / isInfluencer`.
- **`src/components/ActiveViewProvider.tsx`** (new) — React Context wrapping the dashboard subtree. SSR-safe: renders with `defaultView` (= `session.user.role`) first paint, then hydrates to sessionStorage value AFTER mount. `useActiveView()` returns `{ activeView, setActiveView, defaultView }`.
- **`src/components/RoleSwitcher.tsx`** (new) — dropdown, hidden when user has <2 capability flags. Shows each available role with description + ✓ on active + "(default)" annotation. "Make X my default view" item POSTs to `/api/user/primary-view` and toasts on success; hidden when active view IS the default.
- **`src/app/api/user/primary-view/route.ts`** (new) — POST endpoint, CSRF-gated. Validates body.role ∈ `{brand, consumer, influencer}` (admin excluded). Re-reads user fresh to check capability flag — can't switch to a role you don't own. UPDATE users.role + audit_log row `action='primary_view_changed'`, metadata `{from, to}`.
- **`src/app/dashboard/DashboardShell.tsx`** — sidebar filter now consumes `activeView` from `useActiveView()` instead of `session.user.role`. Single-role users have `activeView === userRole` (identical behavior). Dual-role users see only the active view's items.
- **`src/app/dashboard/layout.tsx`** — wraps shell in `ActiveViewProvider`.
- **`src/components/dashboard-header.tsx`** — RoleSwitcher mounted top-right between Search and NotificationBell; hidden on mobile (icon-only area is tight).

#### Smoke test (2026-06-04, after data-fix-up)
E-1 (single-role: no switcher) ✅, E-2 (dual-role: switcher visible) ✅ after a manual SQL fix-up (see mid-work item below for the broader "consumers disappeared" mystery), E-3 (session toggle) ✅, E-4 (sessionStorage persistence) ✅, E-5 (Make default → users.role updated + audit_log row) ✅, E-6 (capability gate — can't switch to a role you don't own) ✅.

#### Follow-ups for canonical docs
- **CLAUDE.md** Key Decisions:
  - "RoleSwitcher gates on `>= 2` capability flags being true; admin excluded from dropdown (runtime-only role with its own /admin/* surface)"
  - "Active view is session-scoped (sessionStorage `e4i_active_view`); 'Make default' updates users.role and requires a fresh JWT (next login) to fully apply"
  - "Session + JWT carry the 3 capability flags propagated from authorize() (credentials) or signIn callback (Google)"
- **ARCHITECTURE.md** — Document the `ActiveViewProvider` context as the dashboard's view-state authority

---

### Sub-Phase 3.5F — Cross-role upgrade from /settings (`7862312` + 2 hot-fixes: `9f25adf`, `513d21d`)

#### Bug / gap
Consumers had no discoverable way to become influencers besides finding `/dashboard/influencer/profile` (the legacy single-form path). Needed an explicit "Become an Influencer" entry on /settings.

#### Fix (`7862312`)
- **`src/components/BecomeInfluencerCard.tsx`** (new) — gradient violet-pink card matching 3.5C wizard tone. 3-bullet value prop. Primary CTA → `/onboarding?path=influencer`. Auto-hides when `isInfluencer=true` OR `role in (brand, admin)`.
- **`src/app/dashboard/settings/page.tsx`** — page title widened from "Notification Settings" to "Settings" (it's no longer just notifications). `<BecomeInfluencerCard />` mounted between page header and SecuritySettingsCard.
- **`src/app/onboarding/page.tsx`** — accepts `searchParams.path`. If `path === 'influencer'` AND user's primary role is not already 'influencer', renders `InfluencerOnboardingClient` with `isCrossRoleUpgrade=true`. Brand-primary role wins over `?path` override.
- **`src/app/onboarding/InfluencerOnboardingClient.tsx`** — new `isCrossRoleUpgrade` prop. Step 6 branches: cross-role users see "One more step / Sign in again to continue" + `signOut()` button; normal users see the existing 3-action-card list + "Go to dashboard".

#### Hot-fix 1 — Stale profile bounce (`9f25adf`)
Clicking "Set up Influencer profile" on settings card bounced to /dashboard instead of rendering the wizard. Root cause: the user had a stale `influencer_profiles` row with `onboarding_completed=true` from earlier testing (the fix-up SQL flipped `users.is_influencer` to false but didn't touch the profile row). `/onboarding/page.tsx` short-circuited on `existing?.onboardingCompleted=true` and redirected.

**Fix**: tighten the auto-bounce so it only fires for a full influencer (`role==='influencer'`) with a completed profile. Cross-role upgrade attempt re-enters the wizard regardless of stale profile row.

#### Hot-fix 2 — Defensive completion action on sign-out (`513d21d`)
Session after force-signOut + re-login showed `isInfluencer: false` despite the user seeing Step 6's "You're all set" screen. Root cause: the user reached Step 6 via stale per-user sessionStorage (`step: 6` cached from earlier session) — the wizard's defensive clamp from `f6f49a4` only resets when `draft.step=6` AND `dbCompleted=false`, but THIS user had `dbCompleted=true` (stale legacy row). Step 6 rendered WITHOUT ever calling `completeInfluencerOnboardingAction`, so `users.is_influencer` never flipped.

**Fix**: `signOutForReauth` now defensively re-runs `completeInfluencerOnboardingAction` BEFORE signing out when `isCrossRoleUpgrade=true`. Idempotent — both internal writes (`markInfluencerOnboardingComplete` + `UPDATE users SET is_influencer=true`) are no-ops if already at target value. audit_log gains a possible duplicate row for users who reached Step 6 via the legitimate path AND clicked "Sign in again" — that's fine; the trail captures both moments.

Future-proofs against any similar race where the wizard's done screen is reached without the completion write actually firing.

#### Smoke test (2026-06-04)
F-1 (card visible for pure consumer, hidden for influencer/brand/admin) ✅, F-2 through F-4 (wizard renders, walk through, Step 6 cross-role branch) ✅ after the 2 hot-fixes, F-5 (DB shows `role='consumer', is_influencer=true`) ✅, F-6 (RoleSwitcher visible post-relogin) ✅.

#### Out of scope (logged for future)
- Deprecate the legacy `/dashboard/influencer/profile` single-form path. It still works for consumers who happen to land there; 3.5F just adds the discoverable polished path. Future cleanup.
- Same per-user sessionStorage key pattern in brand wizard — not surfaced yet but a known parity gap.

#### Follow-ups for canonical docs
- **CLAUDE.md** Key Decisions:
  - "Cross-role upgrade from /settings: consumer → influencer keeps users.role='consumer', sets users.is_influencer=true. Wizard step 6 force-signs-out so the next login mints a fresh JWT — same pattern as 2FA setup"
  - "completeInfluencerOnboardingAction is idempotent; signOutForReauth defensively re-runs it before sign-out for cross-role upgrades so the flag is set even if the user reached step 6 via stale sessionStorage"
- **ARCHITECTURE.md** — Document the `?path=influencer` override on `/onboarding` as the cross-role entry contract

---

### Sub-Phase 3.5G — Grandfather banner — INTENTIONALLY SKIPPED

User decision at end of 3.5F smoke: the dismissable grandfather banner for legacy influencers is moot now because:
- 3.5C humane-prefill makes the wizard ride over existing data smoothly
- 3.5F cross-role upgrade gives them a discoverable opt-in path
- Only 1 legacy influencer exists in the DB anyway

No code shipped. Documented here for future Claude sessions wondering why the 3.5G slot is empty in the Status Overview.

---

## Items discovered mid-work (queued, not yet phased)

Real findings that surfaced during Phase 1 / 2 / 3 / 3.5 / 4 execution. Each is a candidate for the master fix list / future phase scoping. Newest entries at the bottom.

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
| 21 | 3D edit dialog allows a brand to toggle `isPublic=true` on a `draft` campaign. Before 4A this leaked drafts into the marketplace listing + apply. 4A fixed the leak server-side, but the brand-facing edit dialog could still warn at toggle time ("This campaign is still a draft. It won't be visible in the marketplace until you publish.") so brands understand the toggle is a future-state preference rather than an instant publish. Cosmetic — Tier C polish. | 4A investigation | UX polish — Tier C |
| 22 | A10 retroactive sweep — influencers who accepted invitations or applied to marketplace campaigns BEFORE A10 shipped (2026-06-02) and still have no payout account are now structurally stuck: the L3/L4 guards don't help them retroactively, and the first signal will still be a 422 at brand payment release. A one-shot cron / SQL identify-and-email would close the gap. Logged as A10 out-of-scope follow-up. | A10 design | Real bug — Tier B operational follow-up |
| 23 | A10 + payout verification gap — accounts created via the payouts page are usable while `isVerified=false`. No verification UX exists (no micro-deposit, no Razorpay account verify API call). For India INR via Razorpay this surfaces only when RazorpayX is activated (`RAZORPAYX_ENABLED=false` today, all payouts manual). For international (PayPal, Wise, SWIFT) it's manual already so verification is implicit. Documented for the future RazorpayX activation moment. | A10 design | Hardening — defer until RazorpayX activation |
| 24 | A10 + profile wizard expansion — user explicitly flagged a "BIGGER strategic change to influencer onboarding" before A9. Today's `/dashboard/influencer/profile` is a single-form page (bio, niches, social handles, base rate) with the L2 inline notice as a post-form nudge. A wizard would absorb profile + payout + verification (A9) into a single guided flow, mirroring brand onboarding (3A) but tailored to the influencer surface. Awaiting design discussion. — **CLOSED IN Phase 3.5** | A10 / pre-A9 | ✅ Done (Phase 3.5 absorbed this strategic ask end-to-end) |
| 25 | Undocumented production `users_role_check` CHECK constraint surfaced during 3.5A — schema.ts had no CHECK; production had one with allowlist `('brand','consumer','admin')`. Inserting 'influencer' on first signup attempt failed with constraint violation. Closes mid-work item #14's "no CHECK constraint" assumption — reality differed. Captured in code via migration 023. | 3.5A first influencer signup | ✅ Done (migration 023) |
| 26 | Brand wizard `middleware.ts` redirect: `if (role === 'brand') redirect /onboarding → /dashboard`. Brand wizard lives AT /onboarding so the redirect creates an infinite loop in theory. But brand onboarding works in production — somehow. Latent bug that's never been exercised because admins skip OnboardingGuard and existing test brands already have `brand_profiles.onboarding_completed=true`. Worth investigating before any brand-side phase. | 3.5C investigation | Investigate — Phase 4+ brand-side, real bug |
| 27 | Cross-user sessionStorage leak in onboarding wizards — until 3.5C-fix-2, the influencer wizard's draft key was a single global string. Different users on the same browser could see each other's `step: 6` cached state. Fixed for influencer via per-user key (`e4i_influencer_onboarding_draft:<userId>`). Brand wizard still uses the global key — same surface, hasn't surfaced because brand testing is single-account. | 3.5C-fix-2 | Tier C parity — fix brand wizard the same way |
| 28 | Defensive step-clamp on wizard hydration covers one direction (`draft.step=6 && !dbCompleted → reset to step 1`) but NOT the opposite (`draft.step=6 && dbCompleted=true && cross-role upgrade`). 3.5F-fix-2 patched the cross-role path by defensively re-running the completion action on Step 6 sign-out instead of patching the clamp. Worth revisiting if a third edge case appears. | 3.5F-fix-2 | Architectural — defensive action re-run is the working pattern |
| 29 | **Data mystery — 7 consumers → 0 consumers in production DB**. Q5 (2026-06-02) showed `consumers: 7, dual_role_users: 1`. After Phase 3.5E smoke (2026-06-04) Diagnostic 1 showed 0 users with `role='consumer'`. The dual-role user's E-5 "Make Influencer my default view" only changes one row. The `/api/user/primary-view` POST handler uses `eq(users.id, userId)` so it can't bulk-flip. Possible causes: (a) the user clicked "Make default" for multiple accounts across testing; (b) a stray manual SQL during the migration 023 hot-fix; (c) a bug we haven't found. Unblocked 3.5F smoke via a one-line UPDATE fix-up; root cause not chased. Worth a future audit-log query: `SELECT * FROM audit_log WHERE action='primary_view_changed' ORDER BY timestamp` to count primary-view changes and confirm cause (a). | 3.5F smoke setup | Investigate — Phase 4+ data forensics |
| 30 | Legacy data drift on wizard hydration — pre-3.5C `/dashboard/influencer/profile` single-form path accepted free-text niches + uncapped bio/handle/location lengths. The new wizard's Zod schema is strict (16-niche enum + 200-char bio cap + 80-char display name cap). 3.5C-fix-3 added `sanitiseNiches` / `sanitiseContentTypes` / `clampString` helpers on hydration. Future legacy data validation drift (e.g. adding a niche later that an existing row uses) is covered by the same pattern. | 3.5C-fix-3 | Pattern established — applies forward |
| 31 | Welcome JWT staleness on cross-role upgrade — completeInfluencerOnboardingAction sets `users.is_influencer=true` server-side but the JWT carries stale capability flags until next sign-in. RoleSwitcher gates on `session.user.isInfluencer`, so it stays hidden until re-login. Solved via force-signOut on Step 6 (same pattern as 2FA setup wizard). NextAuth v5's `useSession().update()` could refresh JWT without sign-out but adds JWT-callback complexity around the `trigger==='update'` branch — deferred. | 3.5F design | Architectural — force-signOut pattern is consistent across role/security changes |
| 32 | 3.5G grandfather banner intentionally skipped — moot for the 1 legacy influencer in DB after 3.5C humane prefill + 3.5F cross-role upgrade entry. If future data import / migration creates >>1 grandfathered influencers, revisit. | Phase 3.5 wrap | n/a — by design |

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

## Phase EV — Email verification system (COMPLETE)

> Three-phase build of the end-to-end email-verification surface. EV.1 (`c4b1dce`, 2026-06-05) shipped the backend; EV.2.1 (`da93b39`, 2026-06-10) wired auto-send at signup + Google auto-verify; EV.2.2 (`622e7fa`, 2026-06-10) shipped the user-facing UI; EV.3.1 (`f00e725`, 2026-06-11) added the shared provider + sidebar lock infrastructure + deal-redeem hard-block; EV.3.2 (`cb1d766`, 2026-06-11) wired Layer-2 context banners + Layer-4 click intercepts on the 6 hard-blocked surfaces.

### EV.2.1 — Auto-send + Google auto-verify (`da93b39`)

**Scope:**
- `signUpAction` (`src/lib/actions/auth.actions.ts`) captures the `createUser` return value and `await`s `sendVerificationEmail({ trigger: 'signup_auto' })` inside a try/catch. Resend outage logs but doesn't block signup.
- `signIn` callback (`src/lib/auth/auth.config.ts`) calls `markEmailVerified(user.id, 'google_oauth')` for BOTH the new-Google-user branch AND the existing-user branch. The existing-user branch covers the edge case where a credentials user later links Google by signing in with the same email — without this, their `email_verified_at` would stay NULL forever despite Google having verified their address.
- `sendVerificationEmail` extended with a `trigger: 'signup_auto' | 'resend' | 'admin'` param written into audit metadata so the audit timeline distinguishes auto-send from manual resend from admin backfill.
- `markEmailVerified(userId, via)` added to `emailVerificationService.ts` — uses `isNull(emailVerifiedAt)` WHERE guard so the call is idempotent for already-verified users; audit row written only when an actual flip occurs.

**Smoke test (2026-06-10):** signed up with real inbox → received both welcome email AND verification email. Google OAuth sign-in on a fresh email → `users.email_verified_at` set to NOW() in Neon.

### Schema migration 027 — `user_profiles` FK CASCADE (`11b6840`)

**Bug discovered during EV.3 smoke testing:** running `DELETE FROM users WHERE lower(email) = '…'` to reset a test account left orphan rows in `user_profiles` because `user_profiles.id` was declared as `text('id').primaryKey()` with no `.references()` to `users(id)`. The next signup with the same email triggered `ensureUserProfile`'s non-destructive reconciliation, which carried over `onboarding_complete=true` from the orphan — making test-account resets impossible AND leaving PII / consent data for "deleted" users.

**Fix:**
1. Migration 027 route (`POST /api/admin/run-migration-027`) — DELETE orphans (`user_profiles.id NOT IN (SELECT id FROM users)`), then ADD CONSTRAINT FK CASCADE with DO-block idempotency check.
2. Drizzle schema (`src/db/schema.ts`) updated to declare `.references(() => users.id, { onDelete: 'cascade' })` on `userProfiles.id` so future regenerations match the live DB.

**Smoke test (2026-06-10):** first run reported `affected: 1` (the orphan from the original deletion). Second run reported `affected: 0` confirming idempotency. After migration, `DELETE FROM users WHERE …` correctly cascades to `user_profiles` and all downstream user-content tables.

### EV.2.2 — User-facing UI (`622e7fa`)

**Surface shipped (8 new components / files):**
- `/verify-email` page (server component, 5 states: success / expired / already-used / invalid / missing-token)
- `EmailVerificationBanner` mounted on dashboard layout (amber prompt, sessionStorage dismiss)
- `EmailVerificationCard` mounted on settings page (verified/unverified branches)
- `EmailNotVerifiedModal` (global modal listening on `e4i:email-not-verified` window event)
- api-client `send()` interceptor — 403 peek + event dispatch
- Original SuccessPanel used a client component (`SuccessRedirect`) with `useRouter().push('/dashboard')` after a 3s countdown — this turned out to be the source of the Known Issue below.

### EV.3.1 — Foundation refactor (`f00e725`)

**Provider unification:**
- `EmailVerificationProvider` (`src/components/EmailVerificationProvider.tsx`) — Context + `useEmailVerification` hook. Single fetch to `/api/auth/check-verification`, 60s background poll, tab-focus revalidation via `visibilitychange` listener, `refresh()` exposed for explicit revalidation after resend. Fail-open semantics — endpoint error treated as verified to avoid spamming nags on transient failures.
- Existing `EmailVerificationBanner` and `EmailVerificationCard` refactored to consume the shared context (removes ~3x redundant `/api/auth/check-verification` polls).

**Sidebar locks (Layer 3):**
- `MenuItem` interface gained `requiresEmailVerified?: boolean` in `DashboardShell.tsx`.
- Sidebar filter reads `useEmailVerification()`, renders an amber 🔒 next to items where `requiresEmailVerified && !isVerified`, with tooltip "<Label> — verify email to unlock".
- 7 items marked at this stage (later corrected in ER.1 — see below): Submit Feedback, Rewards, Cash Out Points (REMOVED in ER.1 — no underlying API hard-block), Deals & Offers, Marketplace, Payout Accounts, Influencer Campaigns.

**Reusable building blocks:**
- `EmailVerificationContextBanner` (compact, non-dismissable, amber, with `[Verify now]` resend button) for Layer 2 page-level banners.
- `openEmailVerificationPrompt()` helper (`src/lib/email-verification-prompt.ts`) — dispatches the same `e4i:email-not-verified` window event the api-client interceptor uses. Lets Layer 4 buttons short-circuit to the modal without making a doomed network call. `withVerificationGate(isVerified, handler)` helper added in EV.3.2 for click-handler wrapping.

**Deal redemption hard-block:**
- `POST /api/deals/[id]/redeem` joined the 6 EV.1 hard-blocked routes. Deal redemption awards points (financial action) → matches the EV.1 protection scope. Pattern identical to feedback/submit (`requireEmailVerified` + `EmailNotVerifiedError` + `emailNotVerifiedResponseBody`).

### EV.3.2 — Layer-2 + Layer-4 wire-up (`cb1d766`)

**Layer-2 context banners mounted on 6 pages:**
- `/dashboard/submit-feedback` — "Verify your email to start submitting feedback and earn rewards."
- `/dashboard/rewards` — "Verify your email to redeem rewards."
- `/dashboard/deals` (via `DealsClient.tsx`) — "Verify your email to claim deals and earn points."
- `/dashboard/influencer/marketplace` — "Verify your email to apply for campaigns."
- `/dashboard/influencer/payouts` — "Verify your email to add payout details."
- `/dashboard/brand/campaigns` — "Verify your email to publish campaigns."

**Layer-4 click intercepts** added to each page's primary CTA handler. Most pages use raw `fetch` instead of `apiPost`, so the api-client 403 interceptor wouldn't fire — manual `openEmailVerificationPrompt()` call BEFORE the network request is the only path to the modal for those.

**Marketplace apply (`CampaignDetailPanel.tsx`)** got a dedicated intercept because the apply handler lives in a child component, not the marketplace page itself.

**Sidebar correction during EV.3.2:** Cash Out Points (consumer `/dashboard/payouts`) was un-marked from `requiresEmailVerified` because its underlying `/api/payouts` route is NOT hard-blocked (only `/api/payouts/accounts` is). Showing a lock on a feature that wasn't actually gated would be an honest-UI violation.

---

## Phase ER — Role boundaries (COMPLETE)

> Discovered during EV.3 smoke testing: pure consumers were seeing influencer items in the sidebar, and `/dashboard/brand/*` URLs were accessible by direct navigation. The 3.5B-fix array-form `role: ['consumer', 'influencer']` was meant to support dual-role consumer-with-isInfluencer users but the sidebar filter never actually checked the `isInfluencer` capability flag. Brand routes had only inconsistent per-page client-side guards.

### ER.1 — Sidebar capability filter + server-side layout guards (`faf1bfb`)

**Sidebar filter (`DashboardShell.tsx`):**
- New `MenuItem.requiresCapability?: 'isInfluencer' | 'isBrand'` field.
- Filter reads `session.user.isInfluencer` / `isBrand` and excludes items whose capability isn't satisfied. Admin bypasses the capability check.
- 6 influencer items marked `requiresCapability: 'isInfluencer'`.
- 17 brand items marked `requiresCapability: 'isBrand'` (defensive — brand items use single-role `'brand'` so the role check already filters them, but the capability annotation future-proofs against any later move to array-form).

**Layout guards:**
- `src/app/dashboard/influencer/layout.tsx` (NEW) — allows `role==='influencer'` OR `isInfluencer===true` OR `role==='admin'`, otherwise `redirect('/dashboard?upgrade=influencer')`.
- `src/app/dashboard/brand/layout.tsx` (NEW) — allows `role==='brand'` OR `isBrand===true` OR `role==='admin'`, otherwise `redirect('/dashboard?upgrade=brand')`.
- Server components, so redirect fires before any client paint. Replaces the inconsistent `/dashboard/brand/campaigns/page.tsx` client-side guard.

**Smoke test (2026-06-13):** pure consumer no longer sees Influencer Profile / Marketplace / etc in sidebar. Direct nav to `/dashboard/influencer/marketplace` redirects to `/dashboard?upgrade=influencer`. Direct nav to `/dashboard/brand/campaigns` redirects to `/dashboard?upgrade=brand`. Both without content flash.

### ER.2 — UpgradePromptCard (`4394304`)

**Component (`src/components/UpgradePromptCard.tsx`):**
- Server component, accepts `variant: 'influencer' | 'brand'`.
- Influencer variant: amber Sparkles icon, "Become an Influencer" title, primary CTA → `/onboarding?path=influencer` (3.5F cross-role upgrade path).
- Brand variant: red ShieldAlert icon, "Brand Account Required" title, primary CTA → `mailto:hello@earn4insights.com?subject=Brand%20account%20access`. No auto-upgrade because brand accounts require business verification + billing setup.
- Both variants have secondary `[Back to dashboard]` CTA that strips the `?upgrade=` param.

**Mount (`src/app/dashboard/page.tsx`):**
- `DashboardPage` now accepts `searchParams: Promise<{ upgrade?: string }>` (Next.js 15 App Router shape).
- `UpgradePromptCard` rendered ABOVE the role-specific dashboard component (BrandDashboard / InfluencerDashboard / ConsumerDashboard) so it stays visible without rearranging per-role layouts.
- `searchParams` await wrapped in try/catch defaulting to `undefined` (shipped in the verify-email defensive patch `dbf5c6b`) — a malformed or rejected Promise can't take down the dashboard render.

**Smoke test (2026-06-13):** both variants render correctly. Clicking primary CTA opens influencer onboarding wizard / brand-access mailto. Secondary CTA returns to clean `/dashboard`.

---

## Phase EV (defensive) — Verify-email transition error mitigations (`dbf5c6b` + `dd4e536` + `799bd52`)

**Symptom (2026-06-12):** clicking the verification email link rendered the SuccessPanel briefly, then the branded `error.tsx` boundary appeared with `Error ref: 2626478451` (Next.js server-error digest). The verification itself succeeded server-side (`email_verified_at` was set), but the user saw an error page instead of being redirected to the dashboard. `/dashboard` accessed directly worked fine — the error was specific to the verify-email → dashboard transition.

**Three mitigations shipped:**

1. **`dbf5c6b` — Defensive try/catch in `SuccessRedirect`:** wrapped `router.push('/dashboard')` in try/catch with `window.location.assign('/dashboard')` fallback. Also wrapped `DashboardPage`'s `searchParams` await in try/catch defaulting to `undefined`. **Result:** error persisted — `router.push` wasn't throwing into the try block.

2. **`dd4e536` — Replaced `SuccessRedirect` client component with HTML meta refresh:** `<meta http-equiv="refresh" content="3;url=/dashboard">` drives the redirect. Pure HTML primitive — no JavaScript, no hydration to fail, no RSC fetch transition. `SuccessRedirect.tsx` left as dead code in the repo. **Result:** the user's first re-test hit the AlreadyUsedPanel path (token already_used from a previous successful but error-displayed click), not the SuccessPanel, so we couldn't confirm the fix cleanly.

3. **`799bd52` — `force-dynamic` + plain `<a>`:** `export const dynamic = 'force-dynamic'` on `/verify-email/page.tsx` eliminates Vercel CDN / browser cache as a suspect (token state changes between requests). Success / AlreadyUsed panels switched from `<Link href="/dashboard">` to plain `<a href="/dashboard">` for full-page-reload nav, identical to direct URL-bar navigation. **Result:** end-to-end verification works through the AlreadyUsedPanel + middleware-redirect-to-login path AND through the meta-refresh path. SuccessPanel path remains untested cleanly because the user's test cycles kept hitting AlreadyUsedPanel (tokens already consumed by earlier broken-but-server-side-succeeded clicks).

**Root cause status:** unknown. The error digest `2626478451` is a Next.js server-side digest, meaning a server component or server action threw an unhandled exception during render. Without Vercel function logs access we can't see the stack trace. **Parked as low-impact** — verification works for users end-to-end via the defensive paths. Investigation queued for whenever Vercel logs become accessible.

**Smoke test (2026-06-13):** user verified end-to-end, dashboard reflects verified state (L1 banner gone, L2 banners gone, sidebar 🔒 locks gone, settings card green check + verified date).

---

## A9 — Influencer verification flow (CURRENT SPRINT)

The 7th `requireEmailVerified` hard-block route from EV.1 (`POST /api/influencer/verification/request`) was deferred pending the broader user-facing email-verification surface. With EV.2 + EV.3 + ER.1 + ER.2 all shipped, A9 slots naturally into the existing 5-layer nudge system. Scope still TBD but likely:

- New table or columns on `influencer_profiles` for verification request lifecycle
- API route `POST /api/influencer/verification/request` with `requireEmailVerified` + role check (`isInfluencer` capability) + `requiresCapability: 'isInfluencer'` server layout already enforced by ER.1
- Sidebar lock + Layer-2 banner + Layer-4 intercept on whatever influencer-side surface initiates the request (per EV.3 conventions)
- Admin queue UI for processing verification requests (mirrors the existing `/admin/payouts` queue pattern from A10)
- Email notifications via Resend (mirrors EV.1 audit + email pattern)

---

## Docs to sync when Phase 6 ships

> **Update 2026-06-13:** This sync happened in commit `<TBD>` — CLAUDE.md, ARCHITECTURE.md, SCHEMA.md, CLAUDE_HISTORY.md, this audit log, and new `docs/FEATURE10_EMAIL_VERIFICATION_AND_ROLE_GUARDS.md` all updated together. Phase 1–3.5 sub-rows below still show `⏳ deferred` in the Status Overview because they predate this consolidated sync; the rows for EV / ER are marked `✅ 2026-06-13`. Future doc-sync cycles will sweep the older rows.

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
