# CLAUDE.md — Earn4Insights Developer Guide

> Last updated: April 2026 (Session: Influencers Adda complete)
> Read this file at the start of every session. It is the authoritative source of truth for this project.

## Phase Status Summary

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Schema + Repositories | ✅ COMPLETE |
| Phase 2 | Consent Layer | ✅ COMPLETE |
| Phase 3 | Signal Collection Services | ✅ COMPLETE |
| Phase 4 | ICP Scoring + Brand API | ✅ COMPLETE |
| Phase 5 | ICP-Aware Alert Service | ✅ COMPLETE |
| Phase 6 | Consumer Data Access APIs | ✅ COMPLETE |
| Phase 7 | Cron Jobs | ✅ COMPLETE |
| Security Hardening | 8 issues found and fixed by Opus review | ✅ COMPLETE |
| Bulk Score API | `POST /api/brand/icps/[id]/bulk-score` + rate limiting | ✅ COMPLETE |
| GDPR Erasure Flow | `DELETE /api/consumer/account` + physical-delete cron | ✅ COMPLETE |
| Brand ICP Builder UI | Weight slider, match leaderboard, audience charts | ✅ COMPLETE |
| Social OAuth Integration | LinkedIn stub built; Instagram pending App Review | ✅ COMPLETE (stub) |
| Consumer Dashboard UI | Privacy, signals, data-export pages | ✅ COMPLETE |
| Influencers Adda | Influencer marketing marketplace — 11 tables, repos, services, APIs, UI | ✅ COMPLETE |

---

**Production migration steps required before going live:**
1. `POST /api/admin/run-migration-002` — apply schema (6 new tables + 3 ALTERs)
2. `POST /api/admin/migrate-consent-records` — backfill legacy JSONB consent → `consent_records`
3. `POST /api/admin/run-migration-003` — add FK constraints + partial UNIQUE index
4. `POST /api/admin/run-migration-004` — Influencers Adda (11 new tables, ALTER users)

All 4 routes are idempotent (safe to re-run). Require `x-api-key: <ADMIN_API_KEY>` header.

---

## 1. Project Overview — Earn4Insights

Earn4Insights is a **B2B2C consumer-insights platform** built in India.

- **Consumers** complete surveys, give product feedback, and earn points/rewards in return.
- **Brands** pay to access consumer feedback, survey responses, and targeted audience insights about their products.

The platform connects brands that want honest consumer opinions with consumers who want to be compensated for their time and data. Think of it as a "market research exchange" — consumers opt in, brands get insights, everyone gets value.

**Core flows:**
1. Consumer signs up → completes onboarding (demographics, interests) → gets matched to relevant surveys/products
2. Consumer gives feedback / completes surveys → earns points
3. Brand creates a product → sets up surveys → receives real-time alerts when feedback arrives
4. Brand builds an ICP (Ideal Consumer Profile) → platform scores consumers against it → brand gets alerts when high-match consumers engage

**Compliance context:** India-first (DPDP Act 2023) + GDPR-compatible (EU users). Consent is explicit, granular, and independently revocable per data category.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, RSC) |
| Language | TypeScript (strict) |
| Database | Neon PostgreSQL (serverless, pgBouncer pooler) |
| ORM | Drizzle ORM |
| Auth | NextAuth v5 (`@/lib/auth/auth.config`) |
| Styling | Tailwind CSS + shadcn/ui (Radix UI primitives) |
| Email | Resend |
| SMS/WhatsApp | Twilio |
| AI | OpenAI (GPT-4o) via Genkit |
| File storage | Vercel Blob |
| Hosting | Vercel (Edge + Serverless functions) |
| Dev port | `9002` (`npm run dev`) |

**Key packages:**
- `postgres` (v3) — raw postgres.js driver; used directly for DDL migrations
- `drizzle-orm` — all application queries go through Drizzle
- `dotenv-cli` — required for `tsx` scripts that need `.env.local` (non-Next.js context)

---

## 3. Architecture Patterns

### Repository → Service → API Route

Every feature follows this strict three-layer pattern:

```
src/db/repositories/        ← DB queries only. No business logic. No auth.
src/server/                 ← Business logic, orchestration, consent gating.
src/app/api/                ← HTTP boundary. Auth check → call service → return JSON.
```

**Rules:**
- API routes NEVER query the DB directly — they call services or repositories.
- Services NEVER import from `app/` — they only import repositories and other services.
- Repositories ONLY import from `@/db` (schema + client). No service imports.
- All server-only files start with `import 'server-only'`.

### Consent enforcement pattern

Every operation that touches personal data must check consent BEFORE reading/writing:

```ts
// Option A — throws on denied (use in service layer)
await enforceConsent(userId, 'behavioral', 'operation_name')

// Option B — returns { allowed, reason } (use when consent is optional)
const { allowed } = await checkConsent(userId, 'behavioral')
if (!allowed) return null

// Option C — enforce by operation name (looks up required categories automatically)
await enforceConsentByOperation(userId, 'collect_behavioral_signals')
```

### Auth pattern in API routes

```ts
const session = await auth()
if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
const userId = (session.user as any).id
const role = (session.user as any).role   // 'consumer' | 'brand' | 'admin'
```

### Drizzle vs raw postgres.js

- **All application queries:** use `db` (Drizzle ORM) from `@/db`
- **DDL migrations only:** use `pgClient` (raw postgres.js) from `@/db` — needed because Drizzle's `db.execute()` is DML-only
- When running DDL via API: strip `BEGIN`/`COMMIT` from SQL before passing to `pgClient.unsafe()` — postgres.js blocks transaction control on pooled connections. All DDL statements use `IF NOT EXISTS` so idempotency is preserved.

---

## 4. Database Tables — Hyper-Personalization Engine (Added April 2026)

Six new tables created in migration `002_hyper_personalization.sql`:

### `consent_records`
Per-category consent records. Replaces the old `userProfiles.consent` JSONB blob.
One row per (user, dataCategory). Independently revocable. Stores proof of consent (IP, UA, policy version, timestamp).

**Purpose:** GDPR Art. 7 proof of consent + DPDP §6 notice+consent requirement.

### `consumer_signal_snapshots`
Append-only time-series of consumer signal snapshots. Never overwrites — every computation creates a new row.
Columns: `userId`, `signalCategory`, `signals` (JSONB), `triggeredBy`, `schemaVersion`, `snapshotAt`.

**Purpose:** Signal history for ICP scoring, preference drift analysis, GDPR Art. 15 right-of-access export.
Retention: `SIGNAL_RETENTION_DAYS` env var (default 365). Purged daily by cron.

### `consumer_sensitive_attributes`
Encrypted storage for GDPR Art. 9 / DPDP "sensitive personal data":
religion, caste, dietary preferences, health interests.
Each row has `encryptedValue` (AES-256-GCM ciphertext) + `encryptionKeyId` (for key rotation) + `deletedAt` (soft-delete).

**Purpose:** Independently deletable sensitive data. Physical deletion 30 days after soft-delete via daily cron. Linked to a `consent_records` row — if consent is revoked, attribute is immediately soft-deleted.

### `brand_icps`
Brand's Ideal Consumer Profile definitions.
`attributes` JSONB contains weighted criteria (all weights must sum to exactly 100 — hard validated at write time).
Optional `productId` — null means brand-wide ICP.

**Purpose:** Defines what a "perfect match" consumer looks like for a brand/product.

### `icp_match_scores`
Cached match scores between a consumer and an ICP. UNIQUE (icpId, consumerId).
`isStale=true` triggers recomputation by the daily cron.

**Purpose:** Avoid re-scoring every consumer on every alert. Stale scores are recomputed overnight.

### `consumer_social_connections`
Connected social platform accounts (Instagram, Twitter, LinkedIn, YouTube).
OAuth token stored encrypted (AES-256-GCM). LinkedIn OAuth flow implemented; Instagram pending App Review.

**Purpose:** Social signal enrichment (interests from connected platform activity).

### Modified existing tables

| Table | Added columns |
|-------|--------------|
| `userProfiles` | `psychographic` (JSONB), `socialSignals` (JSONB), `signalVersion`, `lastSignalComputedAt` |
| `brandAlertRules` | `icpId` (UUID → brand_icps), `minMatchScore` (int, default 60) |
| `brandAlerts` | `matchScoreSnapshot` (JSONB — score breakdown at alert fire time) |

---

## 5. Encryption Setup

### Current encryption (`src/lib/encryption.ts`)

Two encryption systems coexist:

**Legacy (for `userProfiles.sensitiveData`):**
```ts
encryptSensitiveData(data)   // AES-256-GCM, single key from ENCRYPTION_KEY env
decryptSensitiveData(value)
isEncrypted(value)           // base64 roundtrip check + structural length validation
```

**Versioned (for `consumer_sensitive_attributes` and social OAuth tokens):**
```ts
encryptForStorage(data)      // returns { encryptedValue, encryptionKeyId }
decryptFromStorage(value, keyId)
reEncryptWithNewKey(value, oldKeyId, newKeyId)
getCurrentKeyId()            // reads CURRENT_ENCRYPTION_KEY_ID env var
```

### Key rotation pattern

Keys are identified by version ID (e.g., `v1`, `v2`). Each row stores which key encrypted it.

```bash
CURRENT_ENCRYPTION_KEY_ID=v1
ENCRYPTION_KEY_v1=<32-byte hex or base64>
ENCRYPTION_KEY_v2=<32-byte hex or base64>   # add when rotating
```

**Rotation procedure:**
1. Add `ENCRYPTION_KEY_v2` to env, set `CURRENT_ENCRYPTION_KEY_ID=v2`
2. New writes use v2. Old v1 rows still decrypt fine.
3. Run `rotateAttributeKey()` from `sensitiveAttributeRepository` for each old row (cron job).
4. Once all rows are on v2, `ENCRYPTION_KEY_v1` can be removed.

---

## 6. Consent System Design

### Three tiers of data categories

**Tier 1 — Platform Essentials:**
- `tracking` — on-platform event tracking
- `personalization` — personalised recommendations
- `analytics` — usage pattern analysis
- `marketing` — marketing communications

**Tier 2 — Insight Signals:**
- `behavioral` — engagement scores, category interests, feedback patterns
- `demographic` — age, gender, location, education (from onboarding)
- `psychographic` — values, lifestyle, personality, aspirations
- `social` — connected social account signals

**Tier 3 — Sensitive (GDPR Art. 9 / DPDP "sensitive personal data"):**
- `sensitive_health` — health interests (e.g., fitness, medical)
- `sensitive_dietary` — dietary preferences and allergies
- `sensitive_religion` — faith and religious practices
- `sensitive_caste` — caste/community (relevant in Indian market context)

### Key design decisions

1. **Granular, independently revocable** — one `consent_records` row per (user, category). Revoking `sensitive_health` does not affect `behavioral`.
2. **Consent proof stored** — IP address, user-agent, consent policy version, and timestamp recorded at grant time. Required for GDPR Art. 7 accountability.
3. **Sensitive categories force `legalBasis='explicit_consent'`** — even if caller passes a different value, the repository overrides it.
4. **Revocation cascades** — revoking a `sensitive_*` consent immediately soft-deletes the corresponding `consumer_sensitive_attributes` row.
5. **Legacy fallback** — `hasConsent()` in `userProfileRepository` delegates to `consent_records` table but falls back to the old JSONB blob if no record exists (safe for pre-migration users).

### Consent enforcement map (`src/lib/consent-enforcement.ts`)

`CONSENT_REQUIREMENTS` maps operation names to required categories:
```ts
'collect_behavioral_signals'    → ['behavioral']
'collect_sensitive_health'      → ['sensitive_health']
'compute_icp_match_score'       → ['behavioral', 'personalization']
'send_personalized_notification' → ['personalization']
'connect_social_account'        → ['social']
// ...etc
```

---

## 7. ICP Scoring Algorithm

**Input:** An ICP (with criteria + weights) + a consumer's latest signal snapshots.

**Algorithm:**
```
for each criterion in icp.criteria:
  if criterion.requiresConsentCategory:
    if consumer has NOT granted that consent:
      → skip criterion, add to consentGaps[]
      → DO NOT add criterion.weight to totalPossible   ← key design decision
      continue

  totalPossible += criterion.weight
  consumerValue = lookup(signalSnapshots, criterionKey)

  if criterionValue is string (ageRange, gender, engagementTier, ...):
    earned = consumerValue in criterion.values ? weight : 0

  if criterionValue is array (interests, values, lifestyle, ...):
    overlap = count(consumerArr intersect criterion.values)
    earned = Math.min(Math.round(weight × overlap/criterion.values.length), weight)

  totalEarned += earned

// Post-loop: if any required criterion scored 0 (excluding consent gaps) → zero total
matchScore = round((totalEarned / totalPossible) × 100)   // 0–100
```

**Normalise upward, not downward:** Unconsented criteria are excluded from `totalPossible`. A consumer who has granted fewer consents is not penalised.

**Criterion key mapping:**
| Key | Source |
|-----|--------|
| `ageRange`, `gender`, `country`, `city`, `profession`, `education` | demographic snapshot |
| `engagementTier`, `feedbackFrequency`, `sentimentBias` | behavioral snapshot |
| `interests` / `categoryScores` | behavioral snapshot (overlap ratio) |
| `values`, `lifestyle`, `personality`, `aspirations` | psychographic snapshot |
| `health`, `dietary`, `religion`, `caste` | `consumer_sensitive_attributes` (decrypted on-the-fly) |

**Weight validation:** ICP weights MUST sum to exactly 100. Hard throw at write time — not a warning.

---

## 8. Security Hardening (April 2026 — 8 issues fixed)

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 1 | HIGH | No FK constraints on any of the 6 new tables | Migration 003: FK constraints with `ON DELETE CASCADE` |
| 2 | HIGH | Hardcoded dev fallback key in `getEncryptionKey()` | Throw in ALL environments; key generation command in error message |
| 3 | HIGH | IP/UA retained forever on revoked consents — GDPR Art. 5(1)(e) violation | `anonymizeExpiredConsentMetadata()` nulls IP/UA after 3 years; runs in daily cron |
| 4 | MEDIUM | `required` boolean on ICP criteria never enforced | Post-loop: if any required criterion scored 0, total score is zeroed |
| 5 | MEDIUM | Rounding drift: `Math.round(weight * ratio)` could produce `earned > weight` | All 4 overlap paths use `Math.min(Math.round(weight * ratio), weight)` |
| 6 | MEDIUM | Table-level UNIQUE on `consumer_sensitive_attributes` blocked re-insert after soft-delete | Replaced with partial unique index `WHERE deleted_at IS NULL` in migration 003 |
| 7 | MEDIUM | Versioned encryption used scrypt KDF — unnecessary CPU overhead | Replaced with `deriveKeyFast()` using SHA-256(salt ‖ keyMaterial) |
| 8 | MEDIUM | `isEncrypted()` regex heuristic caused false positives on base64 image data | Replaced with base64 roundtrip check + structural length validation |

---

## 9. Cron Schedule

| Time (UTC) | Route | Purpose |
|------------|-------|---------|
| 00:00 | `/api/cron/process-feedback-media` | Process pending feedback media |
| 01:00 | `/api/cron/physical-delete-sensitive-attributes` | Physical-delete soft-deleted sensitive attributes older than 30 days (GDPR Art. 17) |
| 01:30 | `/api/cron/cleanup-feedback-media` | Clean up expired feedback media |
| 02:00 | `/api/jobs/process-deletions` | Hard-delete user accounts after 30-day grace period |
| 02:30 | `/api/cron/update-consumer-signals` | Batch signal collection for all users |
| 03:00 | `/api/cron/recompute-icp-scores` | Recompute stale ICP match scores + fire alerts |
| 03:00 | `/api/jobs/update-behavioral` | Update behavioral signals |
| 04:00 | `/api/cron/send-time-analysis` | Analyse optimal send times |
| 05:00 | `/api/cron/cleanup-analytics-events` | Purge old analytics events |
| 06:00 | `/api/cron/process-notifications` | Process queued notifications |

All cron routes are authenticated via `Authorization: Bearer CRON_SECRET`.

---

## 10. Important Decisions Made and Why

| Decision | Why |
|----------|-----|
| **Hard throw if ICP weights ≠ 100** | Silent weight misconfiguration produces meaningless scores. Better to reject at write time than silently compute wrong scores for weeks. |
| **Normalise upward for unconsented ICP criteria** | Penalising consumers for not sharing sensitive data would create a perverse incentive — brands would want to collect more data just to avoid low scores. Normalising upward keeps scores fair and consent-preserving. |
| **Append-only signal snapshots (never overwrite)** | Enables preference drift analysis, GDPR Art. 15 history export, and debugging. Storage cost is managed by the `SIGNAL_RETENTION_DAYS` rolling window. |
| **Sensitive attributes in a separate table** | GDPR Art. 17 right to erasure. If a user revokes consent for `sensitive_health`, only that attribute is deleted — not their entire profile. This would be impossible with a single JSONB blob. |
| **Consent records as proper rows, not JSONB** | Individual categories must be independently revocable, queryable, and auditable. JSONB blob makes this impossible without parsing in application code. |
| **Physical deletion delay (30 days)** | Grace period for accidental revocations. Industry standard. Implemented as soft-delete (`deletedAt`) + cron physical delete after threshold. |
| **`pgClient.unsafe()` for DDL, not `db.execute()`** | Drizzle's `db.execute()` is designed for DML. DDL (especially multi-statement migrations) requires raw postgres.js. `BEGIN`/`COMMIT` must be stripped because postgres.js blocks transaction control on pooled connections. |
| **Admin API route for running migrations** | Local machine's firewall/ISP blocks outbound port 5432. Running migrations via an API route on the already-running dev server sidesteps this entirely. Idempotency via `IF NOT EXISTS` makes re-running safe. |
| **Bulk score capped at 200 consumers** | `batchScoreConsumersForIcp` is intentionally sequential to avoid DB pressure. 200 × ~100ms ≈ 20s — safe within Vercel's 60s Pro function limit. |
| **GDPR erasure: signal snapshots deleted immediately, sensitive attributes after 30 days** | Signals have no mandatory retention period. Sensitive attributes get a 30-day grace period so accidental revocations can be recovered. |
| **Social OAuth stub — LinkedIn implemented, Instagram deferred** | Instagram Basic Display API was deprecated in 2025. Instagram Graph API requires App Review (4–6 weeks). LinkedIn is available immediately with standard OAuth2. |
| **`confirm: true` required on DELETE /api/consumer/account** | Prevents accidental erasure from stray DELETE calls. Forces explicit client acknowledgement. |
| **Min cohort size of 5 in analytics endpoint** | Prevents re-identification attacks where a brand could narrow down individual consumers by querying small audience segments. |
| **`isSensitiveCategory()` in consent-enforcement** | Single source of truth for whether a category requires GDPR Art. 9 handling. Used in the consent API, scoring engine, sensitive attribute service, and privacy dashboard UI. |

---

## 11. Environment Variables Required

```bash
# ── Database ────────────────────────────────────────────────────
POSTGRES_URL=                          # or DATABASE_URL
ADMIN_API_KEY=                         # for /api/admin/* routes

# ── Encryption — versioned key rotation ───────────────────────
CURRENT_ENCRYPTION_KEY_ID=v1           # which key is active for NEW encryptions
ENCRYPTION_KEY_v1=                     # 32-byte hex or base64 AES key
# ENCRYPTION_KEY_v2=                   # add when rotating to a new key

# ── Signal retention (optional — defaults shown) ───────────────
SIGNAL_RETENTION_DAYS=365              # days before signal snapshots are purged

# ── Cron batch sizes (optional — defaults shown) ───────────────
SIGNAL_CRON_BATCH_SIZE=                # max users per signal cron run (default: all)
ICP_SCORE_CRON_BATCH_SIZE=200          # max stale scores per ICP cron run

# ── Cron auth ─────────────────────────────────────────────────
CRON_SECRET=                           # Bearer token Vercel injects into cron requests

# ── Social OAuth (LinkedIn) ───────────────────────────────────
LINKEDIN_CLIENT_ID=                    # LinkedIn App client ID
LINKEDIN_CLIENT_SECRET=                # LinkedIn App client secret
SOCIAL_OAUTH_REDIRECT_URI=             # e.g. https://yourdomain.com/api/consumer/social/callback
NEXT_PUBLIC_LINKEDIN_CLIENT_ID=        # Same as LINKEDIN_CLIENT_ID — exposed to client for OAuth URL construction
```

**All other required env vars** (Resend, Twilio, OpenAI, NextAuth, Stripe, etc.) are documented in `ARCHITECTURE.md` and should already be set.

---

## 12. Complete File Map

```
src/
├── lib/
│   ├── encryption.ts                              # MODIFIED — versioned key rotation + security fixes (2,7,8)
│   ├── consent-enforcement.ts                     # REWRITTEN — 13 operations + isSensitiveCategory()
│   ├── rate-limit.ts                              # MODIFIED — added bulkScore rate limit config
│   └── personalization/
│       └── userSignalAggregator.ts                # MODIFIED — added aggregateAndPersistUserSignals()
│
├── db/
│   ├── index.ts                                   # MODIFIED — exported pgClient
│   ├── schema.ts                                  # MODIFIED — 6 new tables + 3 altered
│   ├── migrations/
│   │   ├── 002_hyper_personalization.sql          # NEW — 6 tables, 3 ALTERs, all IF NOT EXISTS
│   │   └── 003_foreign_keys_and_constraints.sql   # NEW — FK constraints + partial UNIQUE (security fix 1,6)
│   └── repositories/
│       ├── consentRepository.ts                   # NEW + anonymizeExpiredConsentMetadata() (security fix 3)
│       ├── signalRepository.ts                    # NEW
│       ├── icpRepository.ts                       # NEW
│       ├── sensitiveAttributeRepository.ts        # NEW — soft/physical delete + key rotation
│       ├── socialConnectionRepository.ts          # NEW — encrypted OAuth token storage
│       └── userProfileRepository.ts               # MODIFIED — hasConsent() delegation + JSONB fallback
│
├── server/
│   ├── brandAlertService.ts                       # MODIFIED — ICP gating + alertOnIcpMatch()
│   ├── signalCollectionService.ts                 # NEW — per-category consent-gated collectors
│   ├── sensitiveAttributeService.ts               # NEW — ConsentDeniedError + category mapping
│   ├── icpMatchScoringService.ts                  # NEW — scoring engine (security fixes 4,5)
│   ├── updateConsumerSignals.ts                   # NEW — batch signal cron + IP anonymization (fix 3)
│   └── recomputeIcpScores.ts                      # NEW — batch ICP score recomputation
│
├── components/
│   └── icp-weight-editor.tsx                      # NEW — reusable ICP weight slider component
│
└── app/
    ├── dashboard/
    │   ├── DashboardShell.tsx                     # MODIFIED — added ICP, Privacy, My Signals, My Data nav items
    │   ├── privacy/
    │   │   └── page.tsx                           # NEW — consent management UI (12 categories, 3 tiers)
    │   ├── my-signals/
    │   │   └── page.tsx                           # NEW — signal history UI (tabbed by category)
    │   ├── my-data/
    │   │   └── page.tsx                           # NEW — GDPR Art. 15 data export UI + JSON download
    │   └── brand/
    │       └── icps/
    │           ├── page.tsx                       # NEW — ICP list + create dialog
    │           └── [icpId]/
    │               └── page.tsx                   # NEW — ICP edit: weights, leaderboard, charts, bulk rescore
    └── api/
        ├── admin/
        │   ├── run-migration-002/route.ts         # NEW — apply schema migration
        │   ├── run-migration-003/route.ts         # NEW — FK constraints migration
        │   └── migrate-consent-records/route.ts   # NEW — backfill legacy consent
        ├── consumer/
        │   ├── consent/route.ts                   # NEW — GET/POST/DELETE
        │   ├── signals/route.ts                   # NEW — GET (paginated, consent-gated)
        │   ├── my-data/route.ts                   # NEW — GET (GDPR Art. 15 full export)
        │   ├── account/route.ts                   # NEW — DELETE (GDPR Art. 17 erasure)
        │   └── social/
        │       ├── connections/route.ts            # NEW — GET active connections
        │       ├── connect/route.ts                # NEW — POST encrypted token storage
        │       ├── disconnect/route.ts             # NEW — DELETE revocation
        │       └── callback/route.ts               # NEW — OAuth redirect handler (LinkedIn)
        ├── brand/
        │   └── icps/
        │       ├── route.ts                       # NEW — GET/POST
        │       └── [icpId]/
        │           ├── route.ts                   # NEW — GET/PATCH/DELETE
        │           ├── matches/route.ts            # NEW — GET cached matches / POST on-demand score
        │           └── bulk-score/route.ts         # NEW — POST batch scoring (max 200, rate limited)
        ├── analytics/
        │   └── icp-audience/route.ts              # NEW — GET aggregate audience stats (min cohort 5)
        └── cron/
            ├── update-consumer-signals/route.ts   # NEW — 02:30 UTC daily
            ├── recompute-icp-scores/route.ts      # NEW — 03:00 UTC daily
            └── physical-delete-sensitive-attributes/route.ts  # NEW — 01:00 UTC daily (GDPR Art. 17)

vercel.json                                        # MODIFIED — 3 new cron entries added
```

### Influencers Adda file map (added April 2026)

```
src/
├── db/
│   ├── schema.ts                                  # MODIFIED — 11 new tables + is_influencer flag on users
│   ├── migrations/
│   │   └── 004_influencer_adda.sql                # NEW — 11 tables, 15 indexes, ALTER users
│   └── repositories/
│       ├── influencerProfileRepository.ts         # NEW — profile CRUD, search, verification
│       ├── influencerSocialStatsRepository.ts     # NEW — per-platform stats upsert
│       ├── influencerContentPostRepository.ts     # NEW — content post CRUD
│       ├── influencerCampaignRepository.ts        # NEW — campaign CRUD, brand/influencer queries
│       ├── campaignInfluencerRepository.ts        # NEW — invitation management
│       ├── campaignMilestoneRepository.ts         # NEW — milestone CRUD, amount totals
│       ├── campaignPaymentRepository.ts           # NEW — payment CRUD, escrow/release totals
│       ├── campaignPerformanceRepository.ts       # NEW — metrics recording, aggregation
│       ├── influencerFollowRepository.ts          # NEW — follow/unfollow, counts
│       ├── influencerReviewRepository.ts          # NEW — reviews, average rating
│       └── campaignDisputeRepository.ts           # NEW — dispute CRUD, resolution
│
├── server/
│   ├── influencerProfileService.ts                # NEW — registration, discovery, public profiles
│   ├── campaignManagementService.ts               # NEW — campaign lifecycle, invitations, status transitions
│   ├── campaignPaymentService.ts                  # NEW — milestone + escrow payment flows
│   ├── campaignPerformanceService.ts              # NEW — metrics recording, campaign analytics
│   └── disputeResolutionService.ts                # NEW — dispute lifecycle, admin resolution
│
├── app/
│   ├── dashboard/
│   │   ├── DashboardShell.tsx                     # MODIFIED — added influencer + brand campaign nav items
│   │   ├── influencer/
│   │   │   ├── profile/page.tsx                   # NEW — register/edit influencer profile
│   │   │   ├── campaigns/
│   │   │   │   ├── page.tsx                       # NEW — list campaign invitations
│   │   │   │   └── [campaignId]/page.tsx          # NEW — campaign detail, accept/reject, submit milestones
│   │   │   └── content/page.tsx                   # NEW — manage content posts
│   │   └── brand/
│   │       ├── campaigns/
│   │       │   ├── page.tsx                       # NEW — list/create campaigns
│   │       │   └── [campaignId]/page.tsx          # NEW — campaign detail, milestones, payments, influencers
│   │       └── influencers/page.tsx               # NEW — discover/search influencer profiles
│   └── api/
│       ├── admin/
│       │   └── run-migration-004/route.ts         # NEW — apply Influencers Adda migration
│       ├── influencer/
│       │   ├── profile/route.ts                   # NEW — GET/POST/PATCH own profile
│       │   ├── discover/route.ts                  # NEW — GET search/browse influencers
│       │   ├── social-stats/route.ts              # NEW — GET/POST platform stats
│       │   ├── content/route.ts                   # NEW — GET/POST content posts
│       │   ├── content/[postId]/route.ts          # NEW — GET/PATCH/DELETE single post
│       │   └── campaigns/
│       │       ├── route.ts                       # NEW — GET influencer's campaigns
│       │       └── [campaignId]/route.ts          # NEW — GET detail, PATCH accept/reject/submit
│       ├── brand/
│       │   └── campaigns/
│       │       ├── route.ts                       # NEW — GET/POST brand campaigns
│       │       └── [campaignId]/
│       │           ├── route.ts                   # NEW — GET/PATCH/DELETE campaign
│       │           ├── influencers/route.ts       # NEW — GET/POST/DELETE manage influencers
│       │           ├── milestones/route.ts        # NEW — GET/POST milestones
│       │           ├── milestones/[milestoneId]/route.ts # NEW — PATCH approve/reject/escrow, DELETE
│       │           ├── payments/route.ts          # NEW — GET payment summary
│       │           ├── performance/route.ts       # NEW — GET analytics, POST record metrics
│       │           └── disputes/route.ts          # NEW — GET/POST brand disputes
│       ├── campaigns/
│       │   └── [campaignId]/
│       │       ├── reviews/route.ts               # NEW — GET/POST campaign reviews
│       │       └── disputes/route.ts              # NEW — GET/POST/PATCH disputes (influencer + admin)
│       └── consumer/
│           └── follows/[influencerId]/route.ts    # NEW — GET/POST/DELETE follow/unfollow
```

---

## 14. Influencers Adda — Architecture

### Tables (migration 004)

11 new tables + ALTER on `users`:

| Table | Purpose |
|-------|---------|
| `influencer_profiles` | Influencer public profiles (niche, handles, rates, verification) |
| `influencer_social_stats` | Per-platform follower/engagement metrics (UNIQUE per influencer+platform) |
| `influencer_content_posts` | Content posts with media, cross-posting, campaign links |
| `influencer_campaigns` | Campaign briefs, budgets, deliverables, status lifecycle |
| `campaign_influencers` | Junction: campaigns ↔ influencers with invitation status |
| `campaign_milestones` | Milestone-based deliverables with payment amounts |
| `campaign_payments` | Payment records with Razorpay integration, escrow tracking |
| `campaign_performance` | Per-post/platform metrics (views, likes, reach, etc.) |
| `influencer_follows` | Consumer → influencer follow relationships |
| `influencer_reviews` | Post-campaign reviews with 1-5 rating |
| `campaign_disputes` | Dispute filing and admin resolution |

### Campaign lifecycle

```
draft → proposed → negotiating → active → completed
                                      ↘ cancelled
                                      ↘ disputed → active (after resolution)
```

### Payment flow

```
1. Brand creates campaign with budget
2. Brand adds milestones (total must not exceed budget)
3. Brand escrows funds for milestone → payment status: 'escrowed'
4. Influencer submits deliverable → milestone status: 'submitted'
5. Brand approves milestone → milestone: 'approved', payment: 'released'
   Brand rejects → milestone: 'rejected' (influencer can resubmit)
```

Platform fee is calculated at escrow time: `Math.round(amount * platformFeePct / 100)`

### Key design decisions

| Decision | Why |
|----------|-----|
| **Consumers can register as influencers** | `is_influencer` flag on users table. Same auth, extended profile. No separate user type. |
| **Milestone payments don't exceed budget** | Hard validation at milestone creation. Prevents over-commitment. |
| **Status transitions are validated** | `VALID_TRANSITIONS` map prevents invalid state changes (e.g., draft→completed). |
| **Disputes auto-set campaign to 'disputed'** | Makes dispute status visible in campaign listings. Reverts to 'active' when all disputes resolved. |
| **Reviews only on completed campaigns** | Prevents premature reviews. One review per reviewer per campaign (UNIQUE constraint). |

---

## 15. Known Gaps & Future Work

**Influencers Adda gaps:**

| Item | Notes |
|------|-------|
| **Influencer earnings dashboard** | UI page for influencers to view payment history and total earnings. Data exists in `campaign_payments`, needs a dedicated `/dashboard/influencer/earnings` page. |
| **Razorpay integration** | Payment records store Razorpay IDs but actual payment gateway integration (order creation, webhook handling) is not implemented. |
| **Campaign content approval flow** | Content posts can be linked to campaigns but there's no brand-side review/approval workflow for content before publishing. |
| **Social stats API verification** | Stats are self-declared. Need platform API integrations to verify follower counts and engagement rates. |
| **Campaign search for influencers** | Influencers can only see campaigns they're invited to. No public campaign marketplace/browse feature yet. |

**Previous gaps:**

| Item | Notes |
|------|-------|
| **Instagram OAuth** | Basic Display API deprecated 2025. Requires Facebook App in Advanced Access + App Review (4–6 weeks). Table and plumbing exist; just needs provider approval. |
| **Social interest inference** | `inferredInterests` starts empty on connect. A future `POST /api/consumer/social/sync` route should call the provider API, infer interests, and call `upsertInferredInterests()`. |
| **`icp_match_scores` orphan cleanup** | When a consumer account is deleted, `icp_match_scores` rows with that `consumerId` become orphaned (no FK on `consumerId` — denormalised cache). Should be cleaned up in the `process-deletions` cron. |
| **DSAR flow** | Formal Data Subject Access Request for decrypted sensitive data export. Currently sensitive data is listed by category only in `/api/consumer/my-data`. Full decrypted export requires identity verification and is out of scope. |
| **`consumerSignalSnapshots` in process-deletions cron** | The existing account-deletion cron does not clean signal snapshots. The new `DELETE /api/consumer/account` route handles immediate deletion, but if a user's profile is deleted via admin/other means, snapshots may be orphaned. |
