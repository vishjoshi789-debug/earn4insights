# CLAUDE.md — Earn4Insights Developer Guide

> Last updated: April 2026 (Session: Hyper-Personalization Engine — Phases 1–7 COMPLETE + Security Hardening)
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
| Consumer Dashboard UI | Privacy, signals, data-export pages | ⏳ Not started |
| Brand ICP Builder UI | Weight slider, match leaderboard, audience charts | ⏳ Not started |
| Social OAuth Integration | Instagram, LinkedIn OAuth + interest inference | ⏳ Not started |
| GDPR Erasure Flow | Right to be forgotten, physical delete cron | ⏳ Not started |
| Bulk Score API | `POST /api/brand/icps/[id]/bulk-score` + rate limiting | ⏳ Not started |

**Production migration steps still required:**
1. `POST /api/admin/run-migration-002` — apply schema (6 new tables)
2. `POST /api/admin/migrate-consent-records` — backfill legacy JSONB consent
3. `POST /api/admin/run-migration-003` — add FK constraints + partial UNIQUE index

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

**Purpose:** Independently deletable sensitive data. Physical deletion 30 days after soft-delete. Linked to a `consent_records` row — if consent is revoked, attribute is immediately soft-deleted.

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
OAuth token stored encrypted. Actual OAuth flow + sync deferred to a later phase — table created now to avoid a future ALTER TABLE.

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
isEncrypted(value)           // checks if string is base64-encoded ciphertext
```

**Versioned (for `consumer_sensitive_attributes`):**
```ts
encryptForStorage(data)      // returns { encryptedValue, encryptionKeyId }
decryptFromStorage(value, keyId)
reEncryptWithNewKey(value, oldKeyId, newKeyId)
getCurrentKeyId()            // reads CURRENT_ENCRYPTION_KEY_ID env var
```

### Key rotation pattern

Keys are identified by version ID (e.g., `v1`, `v2`). Each row stores which key encrypted it.

```bash
# Active key (used for all new encryptions)
CURRENT_ENCRYPTION_KEY_ID=v1

# Keys by version ID (add new versions without removing old ones)
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

**Tier 1 — Legacy (migrated from JSONB blob):**
- `tracking` — on-platform event tracking
- `personalization` — personalised recommendations
- `analytics` — usage pattern analysis
- `marketing` — marketing communications

**Tier 2 — Standard signals (Phase 9):**
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
    earned = weight × (overlap / criterion.values.length)  capped at weight

  totalEarned += earned

matchScore = round((totalEarned / totalPossible) × 100)   // 0–100
```

**Normalise upward, not downward:** Unconsented criteria are excluded from `totalPossible`. A consumer who has granted fewer consents is not penalised — their score is computed over the criteria that can be evaluated.

**Criterion key mapping:**
| Key | Source |
|-----|--------|
| `ageRange`, `gender`, `country`, `city`, `profession`, `education` | demographic snapshot |
| `engagementTier`, `feedbackFrequency`, `sentimentBias` | behavioral snapshot |
| `interests` / `categoryScores` | behavioral snapshot (overlap ratio) |
| `values`, `lifestyle`, `personality`, `aspirations` | psychographic snapshot |
| `health`, `dietary`, `religion`, `caste` | `consumer_sensitive_attributes` (decrypted on-the-fly) |

**Output:** `IcpMatchBreakdown` — per-criterion earned/max, `consentGaps[]`, `explainability` string, `totalEarned`, `totalPossible`.

**Weight validation:** ICP weights MUST sum to exactly 100. This is a hard throw at write time — not a warning. Enforced in `icpRepository.validateIcpWeights()`.

---

## 8. What Was Completed (April 2026)

### Security Hardening — Opus Deep Review (8 issues fixed)

A full security review was run on encryption, GDPR compliance, ICP scoring, and data integrity.
All 8 findings were fixed and committed (`672069e`).

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| 1 | HIGH | No FK constraints on any of the 6 new tables | Migration 003: FK constraints with `ON DELETE CASCADE` |
| 2 | HIGH | Hardcoded dev fallback key in `getEncryptionKey()` — would silently use a known key in preview deploys | Throw in ALL environments; key generation command in error message |
| 3 | HIGH | IP/UA retained forever on revoked consents — violates GDPR Art. 5(1)(e) storage limitation | `anonymizeExpiredConsentMetadata()` nulls IP/UA on revoked records older than 3 years; runs in daily cron |
| 4 | MEDIUM | `required` boolean on ICP criteria was stored but never enforced — required criterion could score 0 silently | Post-loop check: if any required criterion scored 0 (excluding consent gaps), total score is zeroed |
| 5 | MEDIUM | Rounding drift: `Math.round(weight * ratio)` could produce `earned > weight` due to floating-point rounding | All 4 overlap paths now use `Math.min(Math.round(weight * ratio), weight)` |
| 6 | MEDIUM | Table-level `UNIQUE (user_id, attribute_category)` on `consumer_sensitive_attributes` blocked re-insert after soft-delete | Replaced with partial unique index `WHERE deleted_at IS NULL` in migration 003 |
| 7 | MEDIUM | Versioned encryption used scrypt KDF — unnecessary CPU overhead when key material is already 32+ bytes of entropy | Replaced with `deriveKeyFast()` using SHA-256(salt ‖ keyMaterial) — same domain separation, no CPU waste |
| 8 | MEDIUM | `isEncrypted()` used a regex heuristic — could produce false positives on base64 image thumbnails stored in JSONB | Replaced with base64 roundtrip check + structural length validation (salt+iv+authTag+1 minimum) |

**New files from security hardening:**
- `src/db/migrations/003_foreign_keys_and_constraints.sql`
- `src/app/api/admin/run-migration-003/route.ts`

**Modified files:**
- `src/lib/encryption.ts` — fixes 2, 7, 8
- `src/server/icpMatchScoringService.ts` — fixes 4, 5
- `src/db/repositories/consentRepository.ts` — fix 3 (`anonymizeExpiredConsentMetadata`)
- `src/server/updateConsumerSignals.ts` — fix 3 (wired into daily cron)

---

### Phase 1 — Schema + Repositories ✅
- `src/lib/encryption.ts` — added versioned key rotation (`encryptForStorage`, `decryptFromStorage`, `reEncryptWithNewKey`, `getCurrentKeyId`)
- `src/db/schema.ts` — 6 new tables + 3 table modifications (see Section 4)
- `src/db/migrations/002_hyper_personalization.sql` — migration SQL (277 lines, all IF NOT EXISTS, idempotent)
- `src/db/index.ts` — exported raw `pgClient` for DDL use
- `src/db/repositories/consentRepository.ts` — full CRUD for `consent_records` + `migrateAllLegacyConsents()`
- `src/db/repositories/signalRepository.ts` — append-only signal snapshots with `SIGNAL_RETENTION_DAYS` config
- `src/db/repositories/icpRepository.ts` — ICP CRUD + match score cache + staleness management
- `src/db/repositories/sensitiveAttributeRepository.ts` — encrypted attribute storage with soft/physical delete + key rotation
- `src/app/api/admin/run-migration-002/route.ts` — admin route to apply migration from within the running server (workaround for local firewall blocking port 5432)
- `src/app/api/admin/migrate-consent-records/route.ts` — one-time backfill of legacy JSONB consent → `consent_records`

### Phase 2 — Consent Layer ✅
- `src/db/repositories/userProfileRepository.ts` — updated `hasConsent()` to delegate to `consent_records` with JSONB fallback
- `src/lib/consent-enforcement.ts` — rewritten to import from `consentRepository`; added 13 new Phase 9 operations; added `isSensitiveCategory()` helper
- `src/app/api/consumer/consent/route.ts` — `GET` (list all consents), `POST` (grant), `DELETE` (revoke + cascade)

### Phase 3 — Signal Collection Services ✅
- `src/server/signalCollectionService.ts` — per-category collectors; consent-gated; `Promise.allSettled` for parallel collection
- `src/lib/personalization/userSignalAggregator.ts` — added `aggregateAndPersistUserSignals()` wrapper
- `src/server/sensitiveAttributeService.ts` — service layer for sensitive attributes; owns consent→attribute category mapping; `ConsentDeniedError`

### Phase 4 — ICP Scoring + Brand API ✅
- `src/server/icpMatchScoringService.ts` — scoring engine with full criterion resolution + consent gating
- `src/app/api/brand/icps/route.ts` — `GET` list, `POST` create
- `src/app/api/brand/icps/[icpId]/route.ts` — `GET`, `PATCH`, `DELETE`
- `src/app/api/brand/icps/[icpId]/matches/route.ts` — `GET` cached matches, `POST` on-demand score

### Phase 5 — ICP-Aware Alert Service ✅
- `src/server/brandAlertService.ts` — added ICP gating to `fireAlert()`; added `alertOnIcpMatch()`; added `icp_match` alert type; added `resolveMatchScore()` helper (cache → compute on demand)

### Phase 6 — Consumer Data Access APIs ✅
- `src/app/api/consumer/my-data/route.ts` — GDPR Art. 15 full data export
- `src/app/api/consumer/signals/route.ts` — paginated signal history with consent filtering
- `src/app/api/analytics/icp-audience/route.ts` — aggregate ICP audience stats (privacy-safe, min cohort 5)

### Phase 7 — Cron Jobs ✅
- `src/server/updateConsumerSignals.ts` — batch signal collection for all users
- `src/server/recomputeIcpScores.ts` — batch ICP score recomputation + new-match alert triggering
- `src/app/api/cron/update-consumer-signals/route.ts` — cron route (02:30 UTC daily)
- `src/app/api/cron/recompute-icp-scores/route.ts` — cron route (03:00 UTC daily)
- `vercel.json` — two new cron entries added

---

## 9. Remaining Phases (Not Yet Built)

Phases 1–7 and security hardening are complete. The following remain for future sessions.

### Consumer Dashboard UI
Consumer-facing UI components to:
- View and manage consent per category (`/dashboard/privacy`)
- View their signal history (`/dashboard/my-signals`)
- Download their data (`/dashboard/my-data`) — calls `GET /api/consumer/my-data`

### Brand ICP Builder UI
Brand-facing UI to:
- Create/edit ICPs with a weight slider interface (must sum to 100)
- View ICP match leaderboard (`/dashboard/brand/icps/[id]/matches`)
- See audience analytics charts (`/dashboard/brand/icps/[id]/audience`)

### Social OAuth Integration
Currently the `consumer_social_connections` table exists but OAuth flow is not implemented.
Needs: OAuth provider setup (Instagram, LinkedIn), token encryption on callback, interest inference from connected account data.

### GDPR Erasure Flow (Right to Be Forgotten)
- `DELETE /api/consumer/account` — deletes profile, all signal snapshots, soft-deletes sensitive attributes
- Cron job to physically delete soft-deleted sensitive attributes after 30-day delay (the `getAttributesPendingPhysicalDeletion()` + `physicallyDeleteAttribute()` functions exist in the repository — just needs the cron route)
- `DSAR` formal request flow for encrypted sensitive data export

### ICP Score API for Third-Party Integrations
`POST /api/brand/icps/[icpId]/bulk-score` — score a large batch of consumers at once (for ad-targeting use cases). Current `batchScoreConsumersForIcp()` in the service layer is ready; just needs the route + rate limiting.

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
| **`dotenv-cli` for standalone tsx scripts** | Next.js auto-loads `.env.local` for the dev server but tsx scripts run outside Next.js and need explicit env loading. |
| **Legacy consent fallback** | Six users with existing JSONB consent records needed a safe migration path. The fallback in `hasConsent()` ensures zero downtime — old behaviour preserved until backfill runs. |
| **Min cohort size of 5 in analytics endpoint** | Prevents re-identification attacks where a brand could narrow down individual consumers by querying small audience segments. |
| **`isSensitiveCategory()` in consent-enforcement** | Single source of truth for whether a category requires GDPR Art. 9 handling. Used in the consent API, the scoring engine, and the sensitive attribute service. |

---

## 11. Environment Variables Required

Add these to `.env.local` for the Hyper-Personalization Engine to work:

```bash
# ── Database (already set) ──────────────────────────────────────
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

# ── Cron auth (already set if existing crons work) ────────────
CRON_SECRET=                           # Bearer token Vercel injects into cron requests
```

**All other required env vars** (Resend, Twilio, OpenAI, NextAuth, Stripe, etc.) are already documented in `ARCHITECTURE.md` and should already be set.

---

## 12. File Map — All Files Added/Modified

```
src/
├── lib/
│   ├── encryption.ts                              # MODIFIED — versioned key rotation + security fixes (2,7,8)
│   ├── consent-enforcement.ts                     # REWRITTEN — Phase 9 operations added
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
│       ├── consentRepository.ts                   # NEW + anonymizeExpiredConsentMetadata() (fix 3)
│       ├── signalRepository.ts                    # NEW
│       ├── icpRepository.ts                       # NEW
│       ├── sensitiveAttributeRepository.ts        # NEW
│       └── userProfileRepository.ts               # MODIFIED — hasConsent() delegation
│
├── server/
│   ├── brandAlertService.ts                       # MODIFIED — ICP gating + alertOnIcpMatch
│   ├── signalCollectionService.ts                 # NEW
│   ├── sensitiveAttributeService.ts               # NEW
│   ├── icpMatchScoringService.ts                  # NEW + required enforcement + rounding fix (fix 4,5)
│   ├── updateConsumerSignals.ts                   # NEW + IP anonymization cron call (fix 3)
│   └── recomputeIcpScores.ts                      # NEW
│
└── app/api/
    ├── admin/
    │   ├── run-migration-002/route.ts             # NEW
    │   ├── run-migration-003/route.ts             # NEW — FK constraints migration
    │   └── migrate-consent-records/route.ts       # NEW
    ├── consumer/
    │   ├── consent/route.ts                       # NEW — GET/POST/DELETE
    │   ├── signals/route.ts                       # NEW — GET
    │   └── my-data/route.ts                       # NEW — GET (GDPR Art. 15)
    ├── brand/
    │   └── icps/
    │       ├── route.ts                           # NEW — GET/POST
    │       └── [icpId]/
    │           ├── route.ts                       # NEW — GET/PATCH/DELETE
    │           └── matches/route.ts               # NEW — GET/POST
    ├── analytics/
    │   └── icp-audience/route.ts                  # NEW — GET
    └── cron/
        ├── update-consumer-signals/route.ts       # NEW
        └── recompute-icp-scores/route.ts          # NEW

vercel.json                                        # MODIFIED — 2 new cron entries
```
