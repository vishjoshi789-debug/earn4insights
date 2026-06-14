# Feature 11 — Influencer Verification (A9)

> **Status:** ✅ Shipped end-to-end. Smoke-tested 2026-06-14 with the Tier 2 manual-review path through admin approve.
> **Phases:** A9.1 (backend) → A9.2 (UI + emails) → Admin fix (layout + queue badge).
> **Commits:** `d4f7c67` → `417cfa6` → `cd74a79` → `4c8864d`.
> **Sister docs:** `ARCHITECTURE.md §5` (Influencer Verification System), `docs/SCHEMA.md` (migration 028), `docs/PRELAUNCH_AUDIT_FIX_LOG.md` (Phase A9), `docs/CLAUDE_HISTORY.md §4.8 + §4.9`, `docs/FEATURE10_EMAIL_VERIFICATION_AND_ROLE_GUARDS.md` (hard-blocked routes — verification is the 8th).

---

## 1. Why this feature

A9 was the 7th `requireEmailVerified` hard-blocked route from EV.1 — explicitly deferred at the time pending "broader strategic discussion on the influencer onboarding flow." That discussion produced **Phase 3.5** (which redesigned the entire influencer surface — first-class signup, 6-step wizard, dedicated dashboard, dual-role sidebar, cross-role upgrade). A9 then slotted naturally on top of:

- **EV.1/2/3** — email verification provides the first of the 8 checks
- **ER.1/2** — role guards already enforce `requiresCapability: 'isInfluencer'`
- **Phase 3.5** — onboarding wizard captures most of the data the checks read
- **A10** — admin payout queue gives the UX pattern for the admin verification queue

The system is the **final Tier A item**. Shipping it cleared the last ship-blocker from the 6-pass pre-launch audit.

The product problem: brands need a trust signal that an influencer is real before they invest in a campaign. Self-reported follower counts are gameable (anyone can type "1 million"). The system gates a verified badge behind 8 quality checks + a follower threshold, with three escape valves (auto-approve for clearly-legitimate creators, manual review for borderline cases, hard-floor auto-reject for obviously-incomplete profiles).

---

## 2. Architecture at a glance

```
                  POST /api/influencer/verification/request
                                    │
       (8th hard-blocked route — requireEmailVerified guard fires first)
                                    │
                                    ▼
                evaluateVerificationRequest(userId)  — pure read-only
                                    │
       loads: users + influencer_profiles + sum(influencer_social_stats)
                                    │
                   runs 8 checks + follower threshold
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
          Tier 1                 Tier 2                Tier 3
       auto_approved          manual_review        auto_rejected
              │                     │                     │
              │            (admin queue surface)          │
              │                     │                     │
              │            ┌────────┼────────┐            │
              │            │        │        │            │
              │        approved  rejected  needs_info     │
              │             │       │         │           │
              ▼             ▼       ▼         ▼           ▼
       profile.verification_status flips atomically with the request row
                                    │
              user receives one of 6 branded emails
              admin receives "[Admin] New verification needs review" on Tier 2
```

**Two state stores, one source of truth:**

| Store | Purpose | Status values |
|---|---|---|
| `influencer_verification_requests` (append-only) | Full lifecycle history of every attempt | `pending` / `auto_approved` / `auto_rejected` / `manual_review` / `approved` / `rejected` / `needs_info` (7 values) |
| `influencer_profiles.verification_status` (current state) | "Are they verified RIGHT NOW?" — drives badges + UI | `unverified` / `pending` / `verified` (3 values) |

The route layer flips both inside the same DB transaction so a crash between the two can't leave a "verified user with rejected request" inconsistency.

---

## 3. Database schema (migration 028)

```sql
CREATE TABLE influencer_verification_requests (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status                  TEXT NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'auto_approved', 'auto_rejected',
                                            'manual_review', 'approved', 'rejected', 'needs_info')),
  application_message     TEXT,
  brand_contact_notes     TEXT,
  portfolio_links         JSONB NOT NULL DEFAULT '[]',
  proof_documents         JSONB NOT NULL DEFAULT '[]',  -- reserved for future admin-requested uploads
  threshold_check_result  JSONB,                        -- snapshot of evaluator output at submission time
  reviewer_id             TEXT REFERENCES users(id) ON DELETE SET NULL,
  review_notes            TEXT,
  reviewed_at             TIMESTAMP,
  eligible_to_reapply_at  TIMESTAMP,                    -- NOW() + 30d on rejection
  created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ivr_status_created ON influencer_verification_requests (status, created_at DESC);
CREATE INDEX idx_ivr_user_id        ON influencer_verification_requests (user_id);

-- One open request per user (closed statuses don't block — the cooldown
-- timestamp does)
CREATE UNIQUE INDEX uq_ivr_user_open_request
  ON influencer_verification_requests (user_id)
  WHERE status IN ('pending', 'manual_review', 'needs_info');
```

Full per-column documentation: `docs/SCHEMA.md § Migration 028`.

---

## 4. The 8 checks + follower threshold

| Check | Tier 1 minimum | Tier 3 hard floor | Source |
|---|---|---|---|
| `emailVerified` | NOT NULL | NOT NULL (hard floor) | `users.email_verified_at` |
| `profilePhoto` | non-null | non-null (hard floor) | `influencer_profiles.profile_image_url` |
| `bioLength` | ≥ 50 chars | ≥ 20 chars (hard floor) | `influencer_profiles.bio.length` |
| `niches` | ≥ 2 selected | n/a | `influencer_profiles.niche.length` |
| `socialHandles` | ≥ 1 added | ≥ 1 (hard floor) | any of `{instagram,youtube,twitter,linkedin,tiktok}Handle` |
| `accountAge` | ≥ 7 days | ≥ 1 day (hard floor) | `NOW() - users.created_at` |
| `onboardingComplete` | true | n/a | `influencer_profiles.onboarding_completed` |
| `profileCompleteness` | ≥ 80% | ≥ 50% (hard floor) | `calcProfileCompleteness(profile)` — see [§ 5](#5-profile-completeness-shared-source-of-truth) |

**Follower threshold** (Tier 1 requires AND of all 8 checks above AND this):

| Total followers (sum across platforms) | Decision |
|---|---|
| `≥ 1,000` and `≤ 100,000` | Tier 1 auto-approve |
| `≥ 1,000` and `> 100,000` (self-reported) | Tier 2 manual review (fraud guard — verify with reviewer) |
| `≥ 1,000` and `> 100,000` (OAuth-verified handle on file) | Tier 1 auto-approve (numbers came from platform API) |
| `500 – 999` | Tier 2 manual review (borderline) |
| `< 500` | Tier 2 manual review (below auto floor) |

**Tunable via `src/lib/config/verificationThresholds.ts`** — all 12 constants in one module:

```ts
export const VERIFICATION_THRESHOLDS = {
  MIN_BIO_LENGTH: 50,
  MIN_NICHES: 2,
  MIN_SOCIAL_HANDLES: 1,
  MIN_ACCOUNT_AGE_DAYS: 7,
  MIN_PROFILE_COMPLETENESS: 80,
  AUTO_APPROVE_FOLLOWERS: 1_000,
  MANUAL_REVIEW_FOLLOWERS_MIN: 500,
  MAX_AUTO_APPROVE_FOLLOWERS: 100_000,
  REJECTION_BIO_LENGTH: 20,
  REJECTION_ACCOUNT_AGE_DAYS: 1,
  REJECTION_PROFILE_COMPLETENESS: 50,
  COOLDOWN_AFTER_REJECTION_DAYS: 30,
}
```

No magic numbers anywhere in the service — every threshold reads from this file. Retuning is a single-file edit.

---

## 5. Profile completeness shared source of truth

Originally inline at `src/app/dashboard/page.tsx:370-434` (Phase 3.5D). Extracted in A9.1 to `src/lib/influencer/profileCompleteness.ts` so both the dashboard stat card AND the verification gate use the same 10-factor weighted score.

**Why this matters:** without extraction, the two scores would have drifted. Imagine the dashboard adding a 9th factor for a future field while the verification gate still uses 8 — users could see "100%" on dashboard but get rejected for "completeness < 80%" by verification. The extraction makes drift structurally impossible.

**Weights (sum 100):**

| Factor | Weight | Check |
|---|---|---|
| Display name | 10 | `displayName?.trim()` |
| Niche | 10 | `niche.length > 0` |
| Bio | 10 | `bio?.trim()` |
| Photo | 15 | `profileImageUrl` |
| Base rate | 10 | `baseRate > 0` |
| Content types | 10 | `contentTypes.length > 0` |
| Socials | 15 | any handle filled |
| Audience demographics | 10 | `Object.keys(audienceDemographics).length > 0` |
| Location | 5 | `location?.trim()` |
| Portfolio | 5 | always returns false (UI not yet built) |

**Known cap:** the `portfolio` factor's `check()` always returns false (wizard doesn't capture portfolio links yet), so the real-world max is 95%. The 80% verification threshold sits comfortably under that ceiling.

---

## 6. API surface (6 routes)

### Influencer-side

| Route | Purpose | Notes |
|---|---|---|
| `POST /api/influencer/verification/request` | Submit a new verification request | **8th hard-blocked route** — `requireEmailVerified` guard fires first. CSRF + role gate (`influencer` OR `isInfluencer=true` OR `admin`) + open-request guard + cooldown guard + evaluator + persist + atomic profile-status flip + audit + fire-and-forget email |
| `GET /api/influencer/verification/status` | Read current state | Returns `{ profileStatus, openRequest, lastDecision, cooldownUntil, livePreview }`. `livePreview` re-runs the evaluator against current profile state so the checklist UI updates as user edits in another tab |

### Admin-side

| Route | Purpose | Notes |
|---|---|---|
| `GET /api/admin/verification-requests?status=manual_review` | Queue list | Default filter `manual_review`; pass `?status=all` for full history. Returns rows joined with user + profile context so the UI doesn't need a second fetch per row |
| `POST /api/admin/verification-requests/[id]/approve` | Approve a manual_review or needs_info request | Optional `reviewNotes` body. Flips request to `approved` + profile to `verified` atomically. Fires `manualApproved` email |
| `POST /api/admin/verification-requests/[id]/reject` | Reject with required notes | `reviewNotes` REQUIRED. Sets `eligible_to_reapply_at = NOW() + COOLDOWN_AFTER_REJECTION_DAYS`. Reverts profile to `unverified`. Fires `manualRejected` email (with reason + cooldown date) |
| `POST /api/admin/verification-requests/[id]/request-info` | Ask user for more info | `reviewNotes` REQUIRED. Status moves to `needs_info` (still an open request). NO cooldown — user can re-submit any time. Fires `needsInfo` email |

All admin routes: CSRF-gated, `role === 'admin'` enforced, return structured 409 on invalid state transitions (only `manual_review` → other states is allowed; approve also accepts `needs_info`).

---

## 7. UI surface

### Influencer page — `/dashboard/influencer/verification`

Server stub (`page.tsx`) auth + role-gates; client (`VerificationClient.tsx`) does the work:

1. **Status card** — 4 mutually-exclusive states:
   - Verified (green check + "the badge is live")
   - Open request in review (blue clock + submission date + "few business days" copy)
   - In cooldown (amber alert + countdown to `eligibleToReapplyAt` + reviewer note from last decision)
   - Never submitted (neutral copy guiding to the checklist below)
2. **Live checklist** — `X of 8 requirements met` header, each check rendered as a green/grey pill with the current value vs threshold. A 9th line under a separator shows total followers. Polls `/api/influencer/verification/status` every 30s so the user sees updates if they edit their profile in another tab.
3. **Submit form** — optional fields:
   - `applicationMessage` (1000 chars) — free-text "tell us about your work"
   - `brandContactNotes` (500 chars) — referral context like "Currently collaborating with X" / "Was referred by Y" (no full referral system in v1)
   - `portfolioLinks` (5 URLs) — external work samples
   - `requestManualReview` checkbox — forces Tier 2 even if Tier 1 would auto-approve (useful when follower numbers are hard to auto-verify or the user wants a human eyeball)
4. **Submit gating** — disabled when: submitting, already verified, has open request, in cooldown, or evaluator says Tier 3 (red destructive copy explains "fix hard-floor items in checklist above first")

The page mounts the EV.3 `EmailVerificationContextBanner` at the top — `emailVerified` is the first of the 8 checks, so the user can resend their verification email inline without navigating away.

### Admin queue page — `/admin/verification-requests`

Mirrors `/admin/payouts` UX exactly — same component patterns, same dialog flows, same status + age badge taxonomy:

- **Filter tabs** — Awaiting review (default) / Needs info / All history / Refresh
- **Per-row card** — profile photo + name + email, age badge (green <24h, amber <72h, red >72h), status badge, two-column layout:
  - **Left:** detail panel with evaluator reason snapshot, total followers, all 8 check rows (✓/✗ with value vs threshold), application message, brand contact notes, portfolio links (clickable, opens in new tab)
  - **Right:** 3 action buttons (Approve / Reject / Request info) for open rows; reviewer note (italic) for closed rows
- **Action dialogs** — modal with notes textarea. Required for reject + request-info (with helpful placeholder explaining what the note should contain), optional for approve

### Sidebar entries

| Entry | Where | Visibility |
|---|---|---|
| "Get Verified" | `/dashboard/influencer/verification` | Influencer role (primary or dual-role via `isInfluencer` flag). Carries `requiresEmailVerified: true` → amber 🔒 lock when email unverified |
| "Verification Queue" | `/admin/verification-requests` | Admin role only. Carries unread count badge — red destructive badge with pending `manual_review` count, polled every 30s |

### `VerifiedBadge` component

`src/components/influencer/VerifiedBadge.tsx` — reusable trust badge:
- Props: `verified: boolean | null | undefined`, `size?: 'sm' | 'md'`, `withLabel?: boolean`, `className?: string`
- Renders nothing when `verified` is falsy → safe to drop in unconditionally next to a name (no wrapper conditional needed)
- BadgeCheck icon in blue, optional "Verified" text label
- **Currently not mounted** on brand-side influencer cards (`/dashboard/brand/influencers`) — component is ready, the brand-discover surface is the natural target for a follow-up polish commit

---

## 8. Six email templates

`src/lib/email/templates/influencer-verification.ts` — branded HTML matching EV.1 visual identity:

| Template | Recipient | Trigger |
|---|---|---|
| `autoApproved` | influencer | Tier 1 decision at submission |
| `underManualReview` | influencer | Tier 2 decision at submission |
| `adminAlert` | `SUPPORT_ADMIN_EMAIL` (default `contact@earn4insights.com`) | Tier 2 decision at submission |
| `manualApproved` | influencer | Admin clicks Approve |
| `manualRejected` | influencer | Admin clicks Reject — includes reason + cooldown date |
| `needsInfo` | influencer | Admin clicks Request info — includes reviewer's note |

All sends are fire-and-forget — every route wraps `void send(...).catch(log)`. A Resend outage never blocks the DB state change (which is the source of truth). Admin alert goes to a single inbox rather than fanning out via `getAdminUserIds()` (lower volume than support tickets, no need for the cache pattern).

Auto-rejected does NOT send an email — the UI shows the failed checks inline immediately, and emailing someone we just told their request failed for fixable reasons is noise.

---

## 9. File map

### Backend (services + config + routes)

| File | Purpose |
|---|---|
| `src/lib/config/verificationThresholds.ts` | 12 tunable constants — Tier 1/2/3 cutoffs + cooldown |
| `src/lib/influencer/profileCompleteness.ts` | Extracted shared profile-score (10 factors, sum 100) |
| `src/server/verificationThresholdService.ts` | 8-check evaluator, returns `{ tier, autoDecision, checks, ... }` |
| `src/server/influencerVerificationEmailService.ts` | 6 sender wrappers around Resend |
| `src/lib/email/templates/influencer-verification.ts` | 6 branded HTML email builders |
| `src/db/schema.ts` | `influencerVerificationRequests` table declaration |
| `src/app/api/admin/run-migration-028/route.ts` | Migration runner — table + 2 FKs + 3 indexes + CHECK |
| `src/app/api/influencer/verification/request/route.ts` | POST — 8th hard-blocked route |
| `src/app/api/influencer/verification/status/route.ts` | GET — full status read with live preview |
| `src/app/api/admin/verification-requests/route.ts` | GET — admin queue list |
| `src/app/api/admin/verification-requests/[id]/approve/route.ts` | POST — approve transition |
| `src/app/api/admin/verification-requests/[id]/reject/route.ts` | POST — reject transition (sets cooldown) |
| `src/app/api/admin/verification-requests/[id]/request-info/route.ts` | POST — needs-info transition |

### Client surface

| File | Role |
|---|---|
| `src/app/dashboard/influencer/verification/page.tsx` | Server stub — auth + role gate |
| `src/app/dashboard/influencer/verification/VerificationClient.tsx` | Client UI — status card + live checklist + submit form |
| `src/app/admin/verification-requests/page.tsx` | Admin queue UI (mirrors `/admin/payouts`) |
| `src/components/influencer/VerifiedBadge.tsx` | Reusable trust badge |
| `src/app/dashboard/DashboardShell.tsx` | Sidebar entries + unread count badge poller |

### Cross-cutting fixes from A9

| File | Role |
|---|---|
| `src/app/admin/layout.tsx` (NEW in `4c8864d`) | Restores sidebar on every `/admin/*` page. Three deliberate trims vs dashboard layout: no OnboardingGuard / EmailVerificationBanner / ConsentRenewalWrapper |
| `src/app/dashboard/page.tsx` (`cd74a79`) | Admin role redirects to `/admin/platform-analytics` |

---

## 10. Smoke test plan

### Setup

The test user needs to be an **influencer** (or dual-role consumer+influencer via the 3.5F "Become an Influencer" upgrade path). They also need to be email-verified.

### Tier 1 path (auto-approve)

Requires: all 8 checks pass + ≥ 1,000 total followers (or OAuth-verified handle).

1. Submit on `/dashboard/influencer/verification`
2. **Expect:** green toast "You're verified!" → status card flips to "You're verified" → "You're a verified influencer 🎉" email lands → profile shows verified badge
3. Admin queue: row appears under "All history" filter only (status = `auto_approved`)

### Tier 2 path (manual review) — covers the full admin queue UX

Setup: basic checks pass but `accountAge < 7 days` OR `500 ≤ followers < 1000` OR self-reported `> 100K` without OAuth verification.

1. Submit on `/dashboard/influencer/verification`
2. **Expect:** blue toast "Submitted — our team will review" → status card flips to "Your request is in review" → "Your verification request is being reviewed" email + admin alert email at `SUPPORT_ADMIN_EMAIL`
3. **As admin:** `/admin/verification-requests` shows the row with full threshold context. Verification Queue sidebar badge shows `1`.
4. **Approve:** dialog with optional notes → toast "Request approved" → row disappears from queue → badge drops → user gets "You're verified — welcome aboard!" email → user's profile flips to verified
5. **Reject:** REQUIRED notes → toast "Request rejected" → user gets "Update on your verification request" email with reason + reapply date 30 days out → profile reverts to unverified
6. **Request info:** REQUIRED notes → toast "User notified" → user gets "Quick follow-up" email → status moves to `needs_info` (still open, no cooldown)

### Tier 3 path (auto-reject)

Setup: hard-floor failure — no profile photo OR `bio < 20 chars` OR no social handles OR `accountAge < 1 day` OR `profileCompleteness < 50`.

1. Submit on `/dashboard/influencer/verification`
2. **Expect:** red toast listing what to fix → status card flips to "Auto-rejected — fix items below and re-apply" → checklist clearly shows the failed hard-floor item → NO email sent → NO cooldown — user can submit again immediately after fixing

### Cooldown enforcement

After a `rejected` decision:
1. Re-submit before `eligible_to_reapply_at` → 409 with `code: 'COOLDOWN_ACTIVE'` + the timestamp
2. UI shows "In cooldown — can re-apply soon" banner in the status card with countdown to the date

### Edge cases worth eyeballing

- **Double-submit:** open two browser tabs, submit on both → second submit hits 409 `OPEN_REQUEST_EXISTS` (partial unique index would fire anyway; the friendly check returns a better error first)
- **Already verified:** submit while already verified → 409 `ALREADY_VERIFIED`
- **`requestManualReview` checkbox:** all 8 checks pass + ≥1,000 followers BUT user checks "Request manual review" → forces Tier 2 instead of auto-approve

---

## 11. Threshold tuning guide

Open `src/lib/config/verificationThresholds.ts` — every cutoff is one variable.

| You want to... | Change |
|---|---|
| Make Tier 1 easier (more auto-approves) | Lower `AUTO_APPROVE_FOLLOWERS` (from 1000), `MIN_PROFILE_COMPLETENESS` (from 80), `MIN_BIO_LENGTH` (from 50) |
| Tighten fraud guard | Lower `MAX_AUTO_APPROVE_FOLLOWERS` (from 100K) — anything above goes to manual review without an OAuth-verified handle |
| Shorter cooldown after rejection | Lower `COOLDOWN_AFTER_REJECTION_DAYS` (from 30) |
| Allow newer accounts | Lower `MIN_ACCOUNT_AGE_DAYS` (from 7) — but this is a real fraud guard against brand-new accounts gaming the system |
| Force more borderline → manual review | Raise `MANUAL_REVIEW_FOLLOWERS_MIN` (from 500) — fewer cases land in the auto-reject "below floor" branch, more land in manual queue |

After a tuning change, no code edits or migrations needed — restart `npm run dev` (or trigger a Vercel deploy) and the new constants are live.

---

## 12. Where this sits in the broader system

### What sits in front of A9

- **EV.1 email verification** — `emailVerified` is check 1 of 8. Without EV.1, A9 couldn't enforce identity even at the basic level.
- **EV.3 5-layer nudge** — the "Get Verified" sidebar entry shows a 🔒 lock via the same `requiresEmailVerified` flag pattern used across the EV system.
- **ER.1 role guards** — `/dashboard/influencer/*` layout enforces influencer-or-admin access; the verification request route adds a role check on top.
- **Phase 3.5 onboarding wizard** — captures all the data the 8 checks read. Without the wizard, every Tier 1 candidate would fail on `onboardingComplete`.
- **A10 payout queue UX pattern** — `/admin/verification-requests` mirrors `/admin/payouts` exactly. Same dialog flows, same badge taxonomy, same poll-and-refresh ergonomics.

### What sits in front of admin operations

- **`/admin/layout.tsx`** (from `4c8864d`) — restores sidebar on every `/admin/*` page. Before this, admins landing on the verification queue (or any other admin tool) had no navigation. Documented in `docs/CLAUDE_HISTORY.md §4.9`.

### Out of scope for A9 (parked / deferred)

- **Brand-side `VerifiedBadge` mount** — component exists. Drop-in mount on `/dashboard/brand/influencers` cards + campaign-application surfaces is a polish commit (small).
- **`proof_documents` capture UI** — column reserved in schema for admin-requested proof uploads (driver's license? Brand collaboration screenshots?). UI not built; admin can ask for proof via the `needs_info` notes today, user replies via the application message field on re-submission.
- **Filter by `verified=true` in marketplace** — would let brands filter their influencer search to verified creators only. Trivial server-side query addition; UI toggle is the work.
- **Verification expiry / re-verification** — currently a verified influencer stays verified forever. Could add a re-verification cron that flips long-stale verifications back to unverified to force re-attestation. Not in scope today.

### Tier B candidates spawned by A9

- **Admin notification bell** — A9 surfaces verification queue via a sidebar badge, but the broader admin notification bell (payouts + verifications + revenue alerts + support + influencer milestones) remains hard-typed `'brand' | 'consumer'` only. Real product decision (what's important enough to surface) + 8+ files of work.
- **Verification API integration** for major platforms — OAuth-verified handles (`verification_method = 'api_verified'`) bypass the fraud cap today, but actually wiring Instagram Graph API / YouTube Data API / etc. to populate `influencer_social_stats.follower_count` automatically is a significant undertaking (App Review, rate limits, token refresh). Self-declared today.
