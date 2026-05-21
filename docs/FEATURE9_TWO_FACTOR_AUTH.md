# Feature 9 — Two-Factor Authentication (TOTP)

> Migration 019. RFC 6238 time-based one-time passwords, compatible with Google
> Authenticator, Authy, 1Password, and Microsoft Authenticator.

## Overview

Optional account 2FA for **password (credentials) accounts**. Google-OAuth users
rely on Google's own 2FA — the setup UI is hidden for password-less accounts.

A login with 2FA enabled, on a device that isn't trusted, must pass a TOTP (or
recovery-code) challenge before reaching any route. The interlock is enforced in
middleware, not just the UI.

## Schema (migration 019)

| Table | Purpose |
|-------|---------|
| `user_totp_secrets` | One secret per user. `encrypted_secret` is AES-256-GCM ciphertext; `encryption_key_id` is the versioned-key id needed to decrypt. `is_enabled` flips true at setup completion. |
| `user_recovery_codes` | 10 single-use codes per user, bcrypt-hashed. `is_used` / `used_at` burn a code on use. |
| `trusted_devices` | "Skip the challenge for 30 days" records. `device_fingerprint` = SHA-256 of the `e4i-trusted-device` cookie token. |

Plus `users.two_factor_enabled BOOLEAN NOT NULL DEFAULT false`. All FKs CASCADE → `users`.

## The `requires2FA` interlock

NextAuth v5 uses stateless JWT sessions, so 2FA is not a mutable session flag —
it is derived and gated:

1. **`authorize()`** (credentials) — after the password check, if `two_factor_enabled`
   and the `e4i-trusted-device` cookie does not match a live `trusted_devices` row,
   returns `twoFactorPending: true`.
2. **`jwt` callback** — copies it to the token; also mints a per-login `loginNonce`.
3. **`session` callback** — exposes `session.requires2FA` and `session.loginNonce`.
4. **`middleware.ts`** — a `requires2FA` session with no valid `e4i-2fa` proof cookie
   is confined: every page → redirect to `/auth/two-factor`, every API → 403. Only
   the challenge page, `verify`/`recovery`/`status`, NextAuth internals, CSRF init,
   and assets are allowed. `/api/auth/2fa/{setup,disable,regenerate-codes}` are
   **not** — disabling 2FA mid-challenge cannot be used to bypass it.
5. **`POST /api/auth/2fa/verify`** (or `recovery`) — on success sets the `e4i-2fa`
   proof cookie; middleware then lets the session through.

### Cookies

| Cookie | Set by | Lifetime | Notes |
|--------|--------|----------|-------|
| `e4i-2fa` | verify / recovery routes | 30 days | HMAC-SHA-256 over `AUTH_SECRET`, httpOnly, bound to `loginNonce`. Proves this login passed 2FA — once per login (a new login = new nonce = re-challenge). Web-Crypto-only so middleware can verify it on Edge. |
| `e4i-trusted-device` | verify route (when "trust this device" checked) | 30 days | HMAC-signed random token; SHA-256 of it is stored as `device_fingerprint`. Skips the challenge entirely on the next login. |

## Services

- **`src/server/twoFactorService.ts`** — `generateSetup`, `verifyAndEnable`, `verifyCode`,
  `verifyRecoveryCode`, `disable2FA`, `regenerateRecoveryCodes`, `trustDevice`,
  `isDeviceTrusted`, `cleanupExpiredDevices`, `listTrustedDevices`, `removeTrustedDevice`,
  `getTwoFactorStatus`, `countRemainingRecoveryCodes`.
- **`src/server/twoFactorEmailService.ts`** — 5 fire-and-forget security emails.
- **`src/db/repositories/twoFactorRepository.ts`** — all DB queries.
- **`src/lib/twoFactor/`** — `totp.ts` (otpauth + qrcode), `recoveryCodes.ts`,
  `devices.ts` (trusted-device cookie), `proofCookie.ts` (Edge-safe `e4i-2fa` cookie).

## API routes (`/api/auth/2fa/`)

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `setup` | POST | full | Start setup — returns QR + secret |
| `verify-setup` | POST | full | Confirm code, enable 2FA, return recovery codes |
| `verify` | POST | session | TOTP login challenge |
| `recovery` | POST | session | Recovery-code login challenge |
| `disable` | POST | full | Disable 2FA (password-confirmed) |
| `regenerate-codes` | POST | full | New recovery codes (TOTP-confirmed) |
| `trusted-devices` | GET | full | List trusted devices |
| `trusted-devices/[id]` | DELETE | full | Remove a trusted device |
| `status` | GET | full | 2FA state for the settings UI |

All mutating routes are CSRF-gated. `verify`/`recovery` share `twoFactorChallengeRateLimit`
(5 / 15 min per user); management routes use `twoFactorManageRateLimit` (10 / 15 min).

## UI

- **`/dashboard/settings/two-factor`** — 3-step setup wizard (intro → QR + verify →
  recovery codes).
- **`/auth/two-factor`** — login challenge page (TOTP, recovery-code mode, "trust this
  device", lockout state).
- **Settings → Security** (`SecuritySettingsCard`) — enable CTA / status / manage
  trusted devices / regenerate codes / disable. "Recommended" badge for brands;
  hidden enable button for Google-only accounts.
- **`OtpInput`** — reusable 6-box digit input.

## Email alerts

`twoFactorEmailService` sends: 2FA enabled, 2FA disabled, recovery code used, new
device trusted, account locked. The lockout email is deduped to once per 15-min
window via `twoFactorLockoutNotifyRateLimit`.

## Cron

`/api/cron/cleanup-trusted-devices` — daily 04:00 UTC — deletes `trusted_devices`
past `expires_at`. (Expired rows are also pruned lazily on read.)

## Runbook

1. Deploy.
2. `POST /api/admin/run-migration-019` with header `x-api-key: <ADMIN_API_KEY>`.
3. No new env vars — reuses `AUTH_SECRET` and `ENCRYPTION_KEY_v1`.

Existing logged-in sessions predate the `twoFactorPending` token field, so they are
not challenged until their next login — expected, no forced logout needed.

## File map

```
src/db/schema.ts                                  userTotpSecrets, userRecoveryCodes, trustedDevices
src/app/api/admin/run-migration-019/route.ts      migration
src/lib/twoFactor/totp.ts                         TOTP + QR
src/lib/twoFactor/recoveryCodes.ts                recovery code gen/hash
src/lib/twoFactor/devices.ts                      e4i-trusted-device cookie
src/lib/twoFactor/proofCookie.ts                  e4i-2fa proof cookie (Edge-safe)
src/db/repositories/twoFactorRepository.ts        DB queries
src/server/twoFactorService.ts                    business logic
src/server/twoFactorEmailService.ts               5 security emails
src/app/api/auth/2fa/*                            9 API routes
src/app/api/cron/cleanup-trusted-devices/route.ts cron
src/app/dashboard/settings/two-factor/page.tsx    setup wizard page
src/app/auth/two-factor/                          challenge page + client
src/components/two-factor/*                       OtpInput, wizard, panels, settings card
src/lib/auth/auth.config.ts                       authorize() + jwt/session — twoFactorPending
middleware.ts                                     requires2FA gate
```
