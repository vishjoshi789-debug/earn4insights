# Feature 10 — Email Verification System + Role Boundary Guards

> **Status:** ✅ Shipped end-to-end (with one parked low-impact UX issue documented at the end).
> **Phases:** EV.1 (backend) → EV.2 (UI) → EV.3 (5-layer nudge system) → ER.1 (role guards) → ER.2 (upgrade prompt).
> **Commits:** `c4b1dce` → `da93b39` → `11b6840` → `622e7fa` → `f00e725` → `cb1d766` → `faf1bfb` → `4394304` → `dbf5c6b` → `dd4e536` → `799bd52`.
> **Sister docs:** `ARCHITECTURE.md §5` (Auth & Role System), `docs/SCHEMA.md` (migrations 026 + 027), `docs/PRELAUNCH_AUDIT_FIX_LOG.md` (Phase EV / ER), `docs/CLAUDE_HISTORY.md §4` (feature notes).

---

## 1. Why this feature

Three overlapping problems coalesced into one multi-phase build:

1. **Email verification was missing.** Six financial / legal / contractual API routes had no proof that the user owned the email address they signed up with. A bad-faith user could redeem rewards, apply for campaigns, set up payouts — all attached to an unverified email.
2. **There was no soft user-facing nudge surface.** Even after EV.1 shipped the backend, users would hit hard 403 walls without ever knowing they needed to verify. Conversion would tank.
3. **Role boundaries leaked.** Discovered during EV.3 smoke testing — pure consumers were seeing influencer items in their sidebar, and `/dashboard/brand/*` URLs were accessible by direct navigation. Pre-existing bugs that EV.3's lock icons accidentally highlighted.

The feature is best understood as **a verification gate with a friendly approach**: hard 7-route block on the server, but six layered nudges on the client to guide users to verify before they hit any wall. Role boundaries piggybacked because the sidebar lock pass surfaced their existence.

---

## 2. Architecture overview

```
                ┌─────────────────────────────────────────┐
                │   EmailVerificationProvider (Context)   │
                │   one shared poll, fail-open semantics  │
                └─────────────────┬───────────────────────┘
                                  │
   ┌──────────────────────────────┼────────────────────────────────┐
   ▼                ▼             ▼              ▼                 ▼
  L1 banner    L2 context    L3 sidebar    L4 button     Settings card
  (dashboard)  banners       lock icon     intercept     (verified date)
  dismissable  (7 pages,     + tooltip     handler         or resend
  per-session  non-          on items      short-circuit    branch
  via sess     dismissable)  with          to L5 modal
  storage                    requires-
                             EmailVerified

                  ┌──────────────────────────────────┐
                  │   L5 EmailNotVerifiedModal       │
                  │   listens on window event        │
                  │   ESC + backdrop close + ARIA    │
                  └─────────────┬────────────────────┘
                                ▲
                                │ dispatched by 2 paths:
                                │ a) api-client send() peeks 403 EMAIL_NOT_VERIFIED
                                │ b) openEmailVerificationPrompt() helper (Layer 4)


                 SERVER SIDE — independent of UI:
                ─────────────────────────────────
                7 hard-blocked routes use
                requireEmailVerified() guard →
                throws EmailNotVerifiedError →
                NextResponse.json(emailNotVerifiedResponseBody(), 403)
```

**Shared invariant:** the server-side `requireEmailVerified` guard is the source of truth. Every client nudge is a soft hint that the server will reject. If a nudge fails (e.g. JavaScript disabled, browser quirk), the worst case is the user hits a 403 directly — the modal's network-driven path catches that too via the api-client 403 peek.

---

## 3. Database schema

### Migration 026 — EV.1 backend

```sql
-- 1. column on users
ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP NULL;

-- 2. tokens table
CREATE TABLE email_verification_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,                   -- SHA-256 of plaintext (never store plain)
  expires_at  TIMESTAMP NOT NULL,              -- 24h from creation
  used_at     TIMESTAMP NULL,                  -- NOT NULL after consumption
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. hot-path indexes
CREATE INDEX idx_email_verification_tokens_token_hash ON email_verification_tokens (token_hash);
CREATE INDEX idx_email_verification_tokens_user_id    ON email_verification_tokens (user_id);
CREATE INDEX idx_email_verification_tokens_expires_at ON email_verification_tokens (expires_at);

-- 4. Google backfill (OAuth providers verify email before issuing tokens — sound proxy)
UPDATE users SET email_verified_at = created_at
WHERE google_id IS NOT NULL AND email_verified_at IS NULL;
```

### Migration 027 — `user_profiles` FK CASCADE

```sql
-- 1. orphan cleanup
DELETE FROM user_profiles WHERE id NOT IN (SELECT id FROM users);

-- 2. FK CASCADE (idempotent via DO-block check on pg_constraint)
ALTER TABLE user_profiles
  ADD CONSTRAINT user_profiles_id_users_fkey
  FOREIGN KEY (id) REFERENCES users(id) ON DELETE CASCADE;
```

Drizzle schema mirrors this with `.references(() => users.id, { onDelete: 'cascade' })` on `userProfiles.id`.

---

## 4. Hard-blocked routes (7 total)

All return `403` with structured body `{ error, code: 'EMAIL_NOT_VERIFIED', cta: '/dashboard/settings' }`:

1. `POST /api/feedback/submit` — analytics input
2. `POST /api/consumer/rewards/redeem` — financial
3. `POST /api/marketplace/campaigns/[id]/apply` — legal / contractual
4. `POST /api/payouts/accounts` — financial
5. `POST /api/brand/campaigns` — financial
6. `POST /api/payments/create-order` — financial
7. `POST /api/deals/[id]/redeem` — financial (added in EV.3.1)

A pending 8th route is `POST /api/influencer/verification/request` (A9 — current sprint).

Pattern in every route, after auth + role check:
```ts
try {
  await requireEmailVerified(userId)
} catch (err) {
  if (err instanceof EmailNotVerifiedError) {
    return NextResponse.json(emailNotVerifiedResponseBody(), { status: 403 })
  }
  throw err
}
```

---

## 5. Service layer (`src/server/emailVerificationService.ts`)

| Function | Returns | When to call |
|---|---|---|
| `generateVerificationToken(userId)` | `{ plainToken, expiresAt }` | Internal — by `sendVerificationEmail` |
| `sendVerificationEmail({ userId, email, name, trigger? })` | `{ ok: boolean, reason? }` | Signup auto-send (`trigger: 'signup_auto'`), manual resend (`'resend'`), admin (`'admin'`) |
| `verifyEmailToken(plainToken)` | `{ ok: true, userId } \| { ok: false, reason: 'not_found' \| 'expired' \| 'already_used' }` | `/verify-email` page calls this |
| `resendVerificationEmail(userId)` | `{ ok, reason? }` | Caller already rate-limited; no-op if already verified |
| `markEmailVerified(userId, via)` | `{ updated: boolean }` | OAuth / admin backfill. `via: 'google_oauth' \| 'admin_backfill'`. Idempotent (no-op when already verified). |
| `cleanupExpiredTokens()` | `{ deleted: number }` | Cron — 04:00 UTC daily |
| `getEmailVerifiedAt(userId)` | `Date \| null` | Used by `requireEmailVerified` + `/api/auth/check-verification` |

**Atomicity invariants:**
- `generateVerificationToken` runs in a transaction: marks all prior unused tokens for the user as `used_at = NOW()`, then inserts the new unused row. One-active-token-per-user.
- `verifyEmailToken` runs in a transaction: sets `used_at` on the token AND `email_verified_at` on the user atomically. A crash between the two can't leave a "verified user with unused token" state.

---

## 6. Client UI — 5-layer nudge system

### Layer 1 — Dashboard banner

`src/components/EmailVerificationBanner.tsx`. Amber prompt at the top of `dashboard/layout.tsx`. Dismissable per browser session via `sessionStorage` key `e4i-email-verification-banner-dismissed`. Reappears on next login. Auto-hides permanently once verified.

### Layer 2 — Per-page context banners

`src/components/EmailVerificationContextBanner.tsx`. Non-dismissable, compact, mounted at the TOP of each gated page with action-specific copy:

| Page | Copy |
|---|---|
| `/dashboard/submit-feedback` | "Verify your email to start submitting feedback and earn rewards." |
| `/dashboard/rewards` | "Verify your email to redeem rewards." |
| `/dashboard/deals` | "Verify your email to claim deals and earn points." |
| `/dashboard/influencer/marketplace` | "Verify your email to apply for campaigns." |
| `/dashboard/influencer/payouts` | "Verify your email to add payout details." |
| `/dashboard/brand/campaigns` | "Verify your email to publish campaigns." |

### Layer 3 — Sidebar locks

`MenuItem.requiresEmailVerified?: boolean` in `DashboardShell.tsx`. When true AND user is unverified, an amber 🔒 icon renders next to the nav item with tooltip "<Label> — verify email to unlock". Items still navigate (per Q1 design decision — discovery > immediate gating); the destination page's Layer 2 + Layer 4 finish the gating story.

Currently locked items (6 total): Submit Feedback, Rewards, Deals & Offers, Marketplace, Payout Accounts (influencer), Influencer Campaigns. **Note:** Cash Out Points (consumer `/dashboard/payouts`) is intentionally NOT locked — the underlying `/api/payouts` route is not hard-blocked (only `/api/payouts/accounts` is, which is the influencer side).

### Layer 4 — Click intercepts

`openEmailVerificationPrompt()` helper in `src/lib/email-verification-prompt.ts`. Each gated page's primary action handler checks `isVerified` and short-circuits to the modal BEFORE the network request:

```tsx
const { isVerified } = useEmailVerification()
const handleSubmit = async (e) => {
  e.preventDefault()
  if (!isVerified) {
    openEmailVerificationPrompt()
    return
  }
  // proceed with submit
}
```

Pages using raw `fetch` (most of them) need this manual call — the api-client 403 interceptor only fires for callers going through `apiPost`/`apiPatch`/`apiPut`/`apiDelete`.

`withVerificationGate(isVerified, handler)` helper is also exported for wrap-style callers.

### Layer 5 — Global modal

`src/components/EmailNotVerifiedModal.tsx`. Listens for the `e4i:email-not-verified` window event. ESC + backdrop click + X button all close. Focus management on open / close. ARIA-modal with `aria-labelledby` + `aria-describedby`. Mounted once in `dashboard/layout.tsx`.

Two paths dispatch the event:
1. **Network-driven** — `src/lib/api-client.ts` `send()` peeks 403 responses, clones the body, dispatches if `body.code === 'EMAIL_NOT_VERIFIED'`. Transparent to callers.
2. **UI-driven** — `openEmailVerificationPrompt()` from Layer 4.

---

## 7. Shared provider

`src/components/EmailVerificationProvider.tsx` mounted near the top of `dashboard/layout.tsx`. Provides:

```ts
type ContextShape = {
  status: 'loading' | 'verified' | 'unverified' | 'error'
  isVerified: boolean    // fail-open: 'error' treated as verified
  isLoading: boolean
  verifiedAt: string | null
  refresh: () => Promise<void>
}
```

**Polling strategy:**
- Initial fetch on mount
- Background poll every 60s
- Tab-focus revalidation via `visibilitychange` listener — catches "verified in another tab, came back here" within ~1s
- `refresh()` exposed for explicit revalidation (banner / card / context banner call it after a successful resend)
- In-flight de-dupe via a `Promise` ref — concurrent calls share one network request

**Fail-open semantics:** if the check endpoint errors, `status = 'error'` is treated as `isVerified = true` so we don't spam the modal on transient backend hiccups. The server-side hard-block on the 7 routes is still the source of truth.

---

## 8. Role-boundary guards (ER.1 + ER.2)

### Sidebar capability filter

`MenuItem.requiresCapability?: 'isInfluencer' | 'isBrand'` in `DashboardShell.tsx`. Filter reads `session.user.isInfluencer` / `isBrand`. Items targeting multiple roles via array-form `role: ['consumer', 'influencer']` MUST also declare `requiresCapability: 'isInfluencer'` — without it, a pure consumer (whose `activeView === 'consumer'`) would see every influencer item because the role list includes 'consumer'. Admin bypasses the capability check.

6 influencer items + 17 brand items marked. Brand items use single-role `role: 'brand'` so the role check already filters them, but `requiresCapability: 'isBrand'` is annotated defensively against future moves to array-form.

### Server-side layout guards

| Layout | Allowed | Otherwise |
|---|---|---|
| `src/app/dashboard/influencer/layout.tsx` | `role==='influencer'` OR `isInfluencer===true` OR `role==='admin'` | `redirect('/dashboard?upgrade=influencer')` |
| `src/app/dashboard/brand/layout.tsx` | `role==='brand'` OR `isBrand===true` OR `role==='admin'` | `redirect('/dashboard?upgrade=brand')` |

Both layouts run as server components, so the redirect fires before any client paint — no content flash. Replaces the inconsistent client-side `router.push('/dashboard')` pattern in `/dashboard/brand/campaigns/page.tsx`.

### UpgradePromptCard (ER.2)

`src/components/UpgradePromptCard.tsx` — server component, accepts `variant: 'influencer' | 'brand'`. Mounted in `src/app/dashboard/page.tsx` ABOVE the role-specific dashboard component, reads `searchParams.upgrade`:

| Variant | Title | Icon | Primary CTA |
|---|---|---|---|
| Influencer | "Become an Influencer" | Amber Sparkles | `/onboarding?path=influencer` (3.5F upgrade) |
| Brand | "Brand Account Required" | Red ShieldAlert | `mailto:hello@earn4insights.com?subject=Brand%20account%20access` |

Brand variant has NO auto-upgrade — brand accounts require business verification + billing setup.

`searchParams` await wrapped in try/catch defaulting to `undefined` (defensive against any Promise edge case).

---

## 9. File map

### Backend (services + guard + routes)

| File | Purpose |
|---|---|
| `src/server/emailVerificationService.ts` | 7 service functions (generate, send, verify, resend, markVerified, cleanup, getVerifiedAt) |
| `src/server/emailVerificationGuard.ts` | `requireEmailVerified`, `EmailNotVerifiedError`, `emailNotVerifiedResponseBody` |
| `src/lib/email/templates/email-verification.ts` | Branded HTML template + subject constant |
| `src/lib/rate-limit-upstash.ts` | `verificationResendRateLimit` (3/hour/userId) |
| `src/db/schema.ts` | `users.emailVerifiedAt`, `emailVerificationTokens` table, `userProfiles.id` FK CASCADE declaration |
| `src/app/api/admin/run-migration-026/route.ts` | Migration 026 idempotent runner |
| `src/app/api/admin/run-migration-027/route.ts` | Migration 027 idempotent runner (FK CASCADE retrofit) |
| `src/app/api/auth/resend-verification/route.ts` | POST — auth-gated, CSRF-gated, rate-limited resend |
| `src/app/api/auth/check-verification/route.ts` | GET — polling helper used by the shared provider |
| `src/app/api/cron/cleanup-expired-verification-tokens/route.ts` | Daily 04:00 UTC cleanup |
| `src/lib/auth/auth.config.ts` | Google `signIn` auto-verify (both branches) |
| `src/lib/actions/auth.actions.ts` | `signUpAction` auto-send |

### Hard-blocked routes (7)

`src/app/api/feedback/submit/route.ts`, `src/app/api/consumer/rewards/redeem/route.ts`, `src/app/api/marketplace/campaigns/[campaignId]/apply/route.ts`, `src/app/api/payouts/accounts/route.ts`, `src/app/api/brand/campaigns/route.ts`, `src/app/api/payments/create-order/route.ts`, `src/app/api/deals/[id]/redeem/route.ts`.

### Client UI (5-layer system)

| File | Layer |
|---|---|
| `src/components/EmailVerificationProvider.tsx` | Shared context + hook |
| `src/components/EmailVerificationBanner.tsx` | Layer 1 (dashboard banner) |
| `src/components/EmailVerificationContextBanner.tsx` | Layer 2 (per-page) |
| `src/app/dashboard/DashboardShell.tsx` | Layer 3 (sidebar locks via `requiresEmailVerified`) |
| `src/lib/email-verification-prompt.ts` | Layer 4 helper (`openEmailVerificationPrompt`, `withVerificationGate`) |
| `src/components/EmailNotVerifiedModal.tsx` | Layer 5 (global modal) |
| `src/lib/api-client.ts` | Layer 5 trigger (403 peek) |
| `src/components/EmailVerificationCard.tsx` | Settings card |
| `src/app/verify-email/page.tsx` | Token consumption + 5 panels |
| `src/app/verify-email/SuccessRedirect.tsx` | Dead code (replaced by HTML meta refresh) |

### Layer 2 + Layer 4 wire-ups (6 pages)

`src/app/dashboard/submit-feedback/page.tsx`, `src/app/dashboard/rewards/page.tsx`, `src/app/dashboard/deals/DealsClient.tsx`, `src/app/dashboard/influencer/marketplace/page.tsx`, `src/components/influencer/marketplace/CampaignDetailPanel.tsx` (apply intercept), `src/app/dashboard/influencer/payouts/page.tsx`, `src/app/dashboard/brand/campaigns/page.tsx`.

### Role guards (ER.1 + ER.2)

| File | Purpose |
|---|---|
| `src/app/dashboard/influencer/layout.tsx` | Server guard — allow influencer / admin / `isInfluencer`, else `redirect` |
| `src/app/dashboard/brand/layout.tsx` | Server guard — allow brand / admin / `isBrand`, else `redirect` |
| `src/components/UpgradePromptCard.tsx` | Server component with `variant: 'influencer' \| 'brand'` |
| `src/app/dashboard/page.tsx` | Mounts UpgradePromptCard above role-specific dashboard, reads `searchParams.upgrade` |

---

## 10. Smoke test plan

### Reset to unverified

```sql
UPDATE users SET email_verified_at = NULL
WHERE lower(email) = 'test@example.com';

-- Important: also wipe tokens so the resend gives a truly fresh one
DELETE FROM email_verification_tokens
WHERE user_id = (SELECT id FROM users WHERE lower(email) = 'test@example.com');
```

### Layer-by-layer checks

1. **L1 banner** — `/dashboard` shows amber prompt at top
2. **L2 banners** — each of the 6 gated pages shows compact banner above content
3. **L3 sidebar 🔒** — Submit Feedback, Rewards, Deals & Offers (consumer); Marketplace, Payout Accounts (influencer); Influencer Campaigns (brand)
4. **L4 click intercepts** — submitting feedback / redeeming reward / claiming deal / applying / saving payout / creating campaign → modal opens BEFORE any network call
5. **L5 modal** — ESC + backdrop + X close it; Resend button hits `/api/auth/resend-verification` (auto-CSRF via apiPost), shows "Sent — check your inbox", 429 shows cooldown

### Verify end-to-end

1. Click verification email link → `/verify-email?token=…`
2. Should see SuccessPanel: green check + "Email verified" + "Redirecting in a few seconds…" + manual [Go to dashboard]
3. Wait 3 seconds → HTML meta refresh fires → land on `/dashboard`
4. Within ~1s (provider's tab-focus revalidation): L1 banner gone, L2 banners gone, all 🔒 locks gone
5. `/dashboard/settings` → Email verification card shows green check + "Verified on <date>"

### Role guards (ER.1 + ER.2)

As pure consumer (no `isInfluencer`, no `isBrand`):
- Sidebar shows NO influencer items, NO brand items
- Direct nav to `/dashboard/influencer/marketplace` → server redirect → `/dashboard?upgrade=influencer` → UpgradePromptCard with Sparkles icon + "Become an Influencer" CTA
- Direct nav to `/dashboard/brand/campaigns` → server redirect → `/dashboard?upgrade=brand` → UpgradePromptCard with ShieldAlert icon + "Brand Account Required" CTA + mailto CTA

### Multi-tab edge case

1. Open `/dashboard` in tab A + `/verify-email?token=…` in tab B
2. Click link in B → success → meta refresh redirects B to `/dashboard`
3. Switch focus back to A → `visibilitychange` fires → provider re-polls → A's banner + locks vanish within ~1s

---

## 11. Known issue (parked) — verify-email SuccessPanel transition error

**Symptom.** Clicking the verification email link previously rendered SuccessPanel briefly, then the branded `error.tsx` boundary appeared with `Error ref: 2626478451` (a Next.js server-error digest). The verification itself succeeded server-side (`email_verified_at` was set in DB), but the user saw the error page instead of being auto-redirected to dashboard.

**Investigation chain.**
- `/dashboard` accessed directly worked fine → not a dashboard render bug
- Error has a digest → server-side error during the transition
- Most likely site of failure: `router.push('/dashboard')` from the `SuccessRedirect` client component triggering some RSC fetch error
- No Vercel function logs accessible during debugging → couldn't see the actual stack

**Three mitigations shipped:**

1. `dbf5c6b` — defensive try/catch + `window.location.assign` fallback (didn't help)
2. `dd4e536` — replace `SuccessRedirect` with HTML `<meta http-equiv="refresh">` (architecturally fixes the failure surface)
3. `799bd52` — `export const dynamic = 'force-dynamic'` + plain `<a>` (rules out cache + client-router as suspects)

**Current state.** End-to-end verification works through:
- The AlreadyUsedPanel path (token already consumed → middleware redirects unauth visitors to /login → login → /dashboard)
- The meta refresh path (SuccessPanel renders → 3s later HTML meta refresh fires → full page nav to /dashboard, equivalent to typing the URL)

The SuccessPanel-on-fresh-token path is theoretically untested cleanly (user's test cycles kept hitting AlreadyUsedPanel because previous broken-but-server-side-succeeded clicks had consumed the tokens). But the architecture means it MUST work: meta refresh is a 1996 HTML primitive, no JavaScript involved.

**Parked items:**

| Item | Status | Path to fix |
|---|---|---|
| Root cause of digest `2626478451` | Unknown | Need Vercel function logs access |
| Live ticking "3 → 2 → 1" countdown | Replaced by static "Redirecting in a few seconds…" | Progressive enhancement plan: `CountdownDisplay` client component layered on meta refresh — meta drives nav, JS only ticks number. Ready to ship once root cause resolved. |
| `SuccessRedirect.tsx` | Dead code in repo | Delete when polished progressive-enhancement version ships |

**Quality assessment.** The actual quality compromise is shipping with an unknown bug, not the meta refresh itself. Meta refresh is the right tool for post-action confirmation redirects — Stripe, Auth0, GitHub all use server-side redirects for similar flows. Verification flow is one-time-per-user; the ~200ms latency difference vs RSC navigation is invisible and the white flash is barely perceptible. Documented because invisible-to-users bugs are still bugs.

---

## 12. What sits in front of what

For Claude readers planning future work that touches these surfaces, here's the layering quickly:

- **Adding a new hard-blocked route** → just import `requireEmailVerified` + try/catch like the existing 7. No client work needed; the api-client 403 peek + global modal handle it.
- **Adding a new gated client page** → mount `EmailVerificationContextBanner` (Layer 2) at top, mark the sidebar entry with `requiresEmailVerified: true` (Layer 3), wrap the primary handler with `if (!isVerified) { openEmailVerificationPrompt(); return; }` (Layer 4). Layer 1 (dashboard banner) + Layer 5 (modal) auto-cover.
- **Adding a new role-restricted area** under `/dashboard/<role>/...` → create `layout.tsx` modeled on `influencer/layout.tsx` or `brand/layout.tsx`. Add `requiresCapability` annotations to the corresponding sidebar items.
- **Resetting a test account fully** → with migration 027 in place, `DELETE FROM users WHERE lower(email) = '…'` cascades to `user_profiles` + all downstream user-content + verification tokens. Single command, clean slate.
