# Feature 6 — DSAR System (GDPR Article 15)

Data Subject Access Request system. 1 DB table (migration 012). OTP identity verification, pdfkit PDF generation, Vercel Blob storage, 7-day TTL, 30-day rate limit, daily cleanup cron.

**Status: ✅ COMPLETE (April 2026 — commits a000b7c, bd70d81)**

---

## Overview

GDPR Art. 15 grants consumers the right to receive a copy of all personal data held about them. Earn4Insights implements two tiers:

| Tier | Route | Format | Auth | TTL |
|------|-------|--------|------|-----|
| JSON export (instant) | `GET /api/consumer/my-data` | JSON download | Session only | Immediate |
| DSAR PDF report (formal) | `POST /api/consumer/dsar/request` | PDF (pdfkit) + email | Session + OTP email verification | 7 days |

The DSAR system implements the formal tier: identity-verified, audit-logged, rate-limited, delivered as a structured PDF.

---

## Request Flow

```
Consumer clicks "Request Data Report" (Dashboard → My Data)
        ↓
POST /api/consumer/dsar/request
  → Rate limit check: 1 completed/active request per 30 days
    If unexpired otp_sent request exists, returns same requestId (re-send path)
  → Generate 6-digit OTP (crypto.randomInt)
  → bcrypt.hash(otp, 10) → store as otp_hash
  → Create dsar_requests row (status: 'otp_sent', otp_expires_at: now+15min, max_otp_attempts: 3)
  → Send OTP email via Resend
  → Audit log: logDataAccess (action: 'export', reason: 'DSAR initiated')
  → Return { requestId, message }
        ↓
Consumer enters OTP from email
        ↓
POST /api/consumer/dsar/verify { requestId, otp }
  → Fetch dsar_requests row; verify ownership
  → Check status === 'otp_sent'; check otp_expires_at > now
  → Increment otp_attempts first (prevents race on retry)
  → bcrypt.compare(otp, otp_hash)
    → Invalid: decrement remaining attempts; if exhausted → status='expired'
    → Valid:
        status: 'generating'
        collectAllData(consumerId) — parallel DB queries across 13 tables
        buildPdf(data) — pdfkit, in-memory buffer, A4, 9 sections
        put(filename, pdfBuffer, { access: 'public' }) → Vercel Blob URL
        status: 'completed', pdf_url, expires_at = now + 7 days
        sendDataReadyEmail — PDF attached if < 10 MB, download link always included
        emailSentAt stamped
        Audit log: logDataAccess (action: 'export', reason: 'DSAR PDF generated')
  → Return { success: true, pdfUrl, expiresAt }
        ↓
Consumer downloads PDF
        ↓
GET /api/consumer/dsar/download/[requestId]
  → Auth check + ownership check
  → Fetch request; verify status === 'completed' and expires_at > now
  → Redirect or proxy from pdf_url (Vercel Blob)
        ↓
GET /api/consumer/dsar/status
  → Returns latest active dsar_requests row for session user
        ↓
Cron: /api/jobs/dsar-cleanup (03:00 UTC daily)
  → findExpiredCompletedRequests() — expires_at < NOW()
      → del(pdf_url) from Vercel Blob
      → status='expired', pdf_url=null
  → findStaleOtpRequests() — otp_sent rows stale > 1 hour
      → status='expired'
```

---

## Schema (Migration 012)

Applied via `POST /api/admin/run-migration-012`.

### `dsar_requests`

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `consumer_id` | TEXT | FK → users(id) ON DELETE CASCADE |
| `status` | TEXT | `otp_sent \| generating \| completed \| expired \| failed` |
| `otp_hash` | TEXT | bcrypt hash of 6-digit OTP, cleared after completion |
| `otp_expires_at` | TIMESTAMP | OTP valid for 15 minutes |
| `otp_attempts` | INTEGER | Default 0; incremented before compare |
| `max_otp_attempts` | INTEGER | Default 3; exhausted → status='expired' |
| `pdf_url` | TEXT | Vercel Blob public URL; nulled after expiry by cleanup cron |
| `pdf_generated_at` | TIMESTAMP | When PDF was written to Blob |
| `email_sent_at` | TIMESTAMP | When delivery email was dispatched |
| `expires_at` | TIMESTAMP | pdf_url expires 7 days after generation |
| `ip_address` | TEXT | Captured at request initiation for audit |
| `user_agent` | TEXT | Captured at request initiation for audit |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

**FK:** `consumer_id → users(id) ON DELETE CASCADE` — DSAR records deleted with account.

**Indexes:**
- `(consumer_id, created_at DESC)` — fast lookup of latest request (rate limit check)
- `(status, created_at)` — cleanup cron query

---

## Service (`dsarService.ts`)

`src/server/dsarService.ts` — three public functions.

### `initiateRequest(consumerId, consumerEmail, ipAddress?, userAgent?)`

- Checks rate limit (latest request within 30 days that is not expired/failed)
- If active `otp_sent` and OTP not yet expired → returns existing `requestId` (re-send path)
- Generates OTP with `crypto.randomInt(100000, 999999)`
- Hashes with `bcrypt.hash(otp, 10)`
- Creates `dsar_requests` row and sends OTP email
- Calls `logDataAccess()` for audit trail

### `verifyOTP(requestId, consumerId, otp)`

- Validates request exists and belongs to consumer
- Checks status, OTP TTL, attempt count
- Increments `otp_attempts` before comparing (prevents race condition)
- On valid OTP: calls `generateDataPackage()` inline and returns result
- On invalid: returns remaining attempts; locks on exhaustion

### `generateDataPackage(requestId, consumerId, consumerEmail)`

- `collectAllData()` — 13 parallel Drizzle queries (see Data Collected section)
- `buildPdf(data)` — pdfkit stream to in-memory Buffer
- `put(filename, buffer, { access: 'public' })` — Vercel Blob upload
- Updates request: status='completed', pdf_url, expires_at
- `sendDataReadyEmail()` — attaches PDF if < 10 MB, always includes download link

---

## Data Collected (GDPR Art. 15 scope)

`collectAllData()` runs 13 Drizzle queries in parallel:

| Section | Tables queried | Limit |
|---------|---------------|-------|
| Account | `users`, `userProfiles` | 1 row each |
| Consents | `consentRecords` | All |
| Feedback | `feedback` (by email) | 500 |
| Survey responses | `surveyResponses` (by email) | 500 |
| Point events | `userEvents` | 500 |
| Community posts | `community_deals_posts` | 200 |
| Community comments | `community_deals_comments` | 500 |
| Community votes | `community_deals_post_votes` | count only (privacy — not which posts voted on) |
| Saved deals | `deal_saves` | 200 |
| Deal redemptions | `deal_redemptions` | 500 |
| Influencer follows | `influencer_follows` | 200 |
| Content posts | `influencer_content_posts` | 200 |

---

## PDF Structure (pdfkit, A4, 9 sections)

| Section | Content |
|---------|---------|
| Cover | Branded header, consumer name/email, generation timestamp |
| 1 — Account Information | Name, email, role, creation date, demographics, interests |
| 2 — Consent Records | All consent categories — granted status, legal basis, dates |
| 3 — Feedback Submitted | Product ID, rating, text (truncated 80 chars), date |
| 4 — Survey Responses | Survey ID, completion date, answers (truncated) |
| 5 — Points & Rewards | Point events table, deal redemptions table |
| 6 — Community Activity | Posts, comments, vote count (aggregate), saved deals |
| 7 — Influencer Activity | Influencers followed, content posts created |
| 8 — Payment History | Redemption count summary; note to contact support for full details |
| 9 — Your Rights | GDPR Art. 15/16/17/20/21 + India DPDP Act §11/12, retention schedules, DPO contact |

Footer on every page: `Generated under GDPR Article 15 · {timestamp} · Earn4Insights`

---

## Email Flows

### OTP Email (`sendOtpEmail`)

- From: `privacy@earn4insights.com`
- Subject: `Verify your data request — Earn4Insights`
- Body: Branded HTML with 36px monospace OTP code, 15-minute expiry notice, attempt limit notice
- Lazy Resend init: if `RESEND_API_KEY` not set, logs OTP to console (dev mode)

### Delivery Email (`sendDataReadyEmail`)

- From: `privacy@earn4insights.com`
- Subject: `Your data package is ready — Earn4Insights`
- Body: Download button + expiry date + coverage summary
- Attachment: PDF attached inline if file size < 10 MB
- If attachment fails (non-critical): email still sent with download link

---

## Key Design Decisions

| Decision | Why |
|----------|-----|
| **OTP identity verification required** | DSAR PDF contains full personal data — stronger auth than session cookie alone. Prevents third-party from requesting data via borrowed session. |
| **bcrypt for OTP hash** | Standard password hashing; avoids plaintext OTP storage. Cost factor 10 — fast enough (< 200ms) at single-OTP scale. |
| **Increment attempts before comparing** | Prevents race condition where two simultaneous submits both see `attempts < max` and both get to compare (one should fail). |
| **Return same requestId on re-send** | Consumer who closes the tab and returns can re-enter OTP without starting a new 30-day rate limit cycle. |
| **Vercel Blob for PDF storage** | PDFs can be multi-MB; returning inline would violate Vercel's response size limits and time out. Blob decouples generation from download. |
| **7-day PDF TTL** | Balances convenience (enough time to access) with storage cost and DPDP data minimisation. |
| **30-day rate limit** | One formal access request per month is reasonable. Prevents abuse of expensive PDF generation + OpenAI token cost. |
| **PDF attached if < 10 MB** | Most consumer PDFs are small; inline attachment is more convenient. Fallback to download link for large datasets. |
| **Dynamic import of pdfkit** | `import('pdfkit').default` avoids tree-shaking issues in Vercel Edge runtimes and keeps cold-start lighter. |
| **`expired` and `failed` statuses bypass rate limit** | Rate limit only blocks on `completed` and `otp_sent`. If a request failed or expired, consumer can initiate a new one immediately. |

---

## Cron Job — `dsar-cleanup`

Route: `GET /api/jobs/dsar-cleanup` — daily at 03:00 UTC.

**Pass 1 — Expired completed requests:**
- `findExpiredCompletedRequests()` — `status='completed' AND expires_at < NOW()`
- For each: `@vercel/blob del(pdf_url)` → update `status='expired', pdf_url=null`
- Counter: `pdfDeleted`

**Pass 2 — Stale OTP requests:**
- `findStaleOtpRequests()` — `status='otp_sent' AND created_at < NOW() - 1 hour`
- For each: update `status='expired'`
- Counter: `otpExpired`

Returns: `{ success, pdfDeleted, otpExpired, errors[], duration, timestamp }`

Auth: `Bearer CRON_SECRET` (same pattern as all other cron routes).

---

## File Map

```
src/
├── server/
│   └── dsarService.ts                                   # NEW — initiateRequest, verifyOTP, generateDataPackage
│
├── db/
│   ├── schema.ts                                        # MODIFIED — dsar_requests table added
│   └── repositories/
│       └── dsarRepository.ts                            # NEW — createDsarRequest, findDsarById,
│                                                        #   findLatestDsarByConsumer, updateDsarRequest,
│                                                        #   findExpiredCompletedRequests, findStaleOtpRequests
│
└── app/
    ├── api/
    │   ├── admin/
    │   │   └── run-migration-012/route.ts               # NEW — dsar_requests table + FK + indexes
    │   ├── consumer/
    │   │   └── dsar/
    │   │       ├── request/route.ts                     # POST — initiate DSAR, send OTP
    │   │       ├── verify/route.ts                      # POST — verify OTP, trigger PDF generation
    │   │       ├── status/route.ts                      # GET — current request status
    │   │       └── download/[requestId]/route.ts        # GET — serve PDF (auth + TTL checked)
    │   └── jobs/
    │       └── dsar-cleanup/route.ts                    # GET — daily 03:00 UTC
    └── dashboard/
        └── my-data/page.tsx                             # MODIFIED — DSAR request UI integrated
                                                         #   alongside existing JSON export
```

### Dependencies

| Package | Purpose |
|---------|---------|
| `pdfkit` | PDF generation (streamed to Buffer in-memory) |
| `bcryptjs` | OTP hashing (cost 10) |
| `@vercel/blob` | `put()` + `del()` for PDF storage |
| `resend` | OTP email + delivery email |
