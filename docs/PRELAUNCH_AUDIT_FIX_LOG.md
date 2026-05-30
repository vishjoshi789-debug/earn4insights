# Pre-Launch Audit Fix Log

> **Purpose** — Running journal of the 6-pass pre-launch audit and the fixes that came out of it.
> Append-only as we work through the phases. The canonical docs (CLAUDE.md, ARCHITECTURE.md, SCHEMA.md, FEATURE*.md, CRON_JOBS.md) get synced AFTER all phases complete, in one consolidated pass — see "Docs to sync when Phase 6 ships" at the bottom.
>
> **Audit started:** 2026-05-28
> **Phase 1 completed:** 2026-05-30

---

## Status Overview

| Phase | Sub-phase | Bug summary | Commit | Smoke-tested | Docs synced |
|---|---|---|---|---|---|
| 1 | 1A | Marketplace handshake — atomic accept + campaign_influencers insert | `f4d909d` | ✅ 2026-05-30 | ⏳ deferred |
| 1 | 1B | Google signup role bug — signed intent cookie | `c29dad3` | ✅ 2026-05-30 (Tests 1–4) | ⏳ deferred |
| 2+ | — | TBD (compile master list, then phase) | — | — | — |

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

## Phase 2+ — Pending

To be defined after compiling the master fix list from all 6 audit passes.

---

## Items discovered mid-work (queued, not yet phased)

These came up DURING Phase 1 execution. Real findings, not blocking Phase 1, need to be merged into the master fix list before phase scoping:

| Item | Source | Priority hint |
|---|---|---|
| Influencer profile: location field needs autocomplete (Google Places or static city/country list) | 1A smoke test setup | UX polish — Phase 3+ |
| Influencer profile: niche field needs chip-input with autocomplete (LinkedIn-style: type + comma/Tab → chip) | 1A smoke test setup | UX polish — Phase 3+ |
| `/api/influencer/profile` save latency — took noticeably long, possibly synchronous downstream fanout blocking the response | 1A smoke test setup | Investigate — Phase 2+ perf bucket |
| Brand campaign edit flow — no PATCH UI exists, brand cannot edit dates/budget/marketplace settings after create | 1A smoke test setup | Real bug — Phase 2 likely |
| Login UX: misleading "Invalid email or password" for password-less (Google-only) users. Better: "This account uses Google sign-in. Please use the Google button." | 1A smoke test (vishweshwar98765 login attempt) | Auth UX polish — Phase 2 cluster with 1B |
| `ADMIN_DIAGNOSTICS_ENABLED=true` env var didn't take effect on production despite redeploy — diagnostic route returned 404. Root cause not yet investigated. Worked around by querying Neon SQL directly. | 1A Phase A smoke test | Investigate — Vercel ops, minor priority |
| Orphan `/signup/complete` page + `/api/auth/complete-signup` route (now structurally unreachable after 1B) | 1B planning | Cleanup — Phase 2+ |

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
