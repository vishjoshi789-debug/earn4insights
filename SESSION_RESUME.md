# SESSION_RESUME — Tier B Group 1 (Security Batch) — COMPLETE

> Security batch shipped. Resume from the rollout section below.

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

## Carry-forwards (separate, not part of this batch)

1. **Admin access recovery + prod 2FA-interlock verification.** Currently locked out of admin; regain via saved recovery codes on the 2FA challenge page (2FA is TOTP-only — no SMS). If recovery codes fail, a DB-level 2FA reset is needed — note the local box cannot reach the DB (outbound `:5432` firewalled, `ETIMEDOUT`), so do it via the Neon console or a deploy-time script. Then confirm the middleware 2FA interlock (`[2FA-DEBUG]` logs, `requires2FA` → `/auth/two-factor`) behaves on prod.
2. **Money + Data Integrity batch — B14, B18, B19, B33, B34, B35.** Next major work item.

## Cleanup (post-watch-window)

- Trim the `[MW] … enforce=` diagnostic readout (added during the enforcement debug) and gate `[MW]`/`[2FA-DEBUG]` behind a debug flag — per-request log noise + cost at steady state.
- Delete `db-diag.mjs` (untracked temp; can't connect from this box anyway).
