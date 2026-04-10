# Feature 1 — Hyper-Personalization Engine

## Encryption Setup (`src/lib/encryption.ts`)

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
Keys identified by version ID (e.g. `v1`, `v2`). Each row stores which key encrypted it.
```bash
CURRENT_ENCRYPTION_KEY_ID=v1
ENCRYPTION_KEY_v1=<32-byte hex or base64>
ENCRYPTION_KEY_v2=<32-byte hex or base64>   # add when rotating
```
**Rotation procedure:**
1. Add `ENCRYPTION_KEY_v2`, set `CURRENT_ENCRYPTION_KEY_ID=v2`
2. New writes use v2; old v1 rows still decrypt fine
3. Run `rotateAttributeKey()` from `sensitiveAttributeRepository` for each old row (cron)
4. Once all rows on v2, remove `ENCRYPTION_KEY_v1`

---

## Consent System Design

### Key design decisions
1. **Granular, independently revocable** — one `consent_records` row per (user, category). Revoking `sensitive_health` does not affect `behavioral`.
2. **Consent proof stored** — IP address, user-agent, policy version, timestamp recorded at grant. Required for GDPR Art. 7 accountability.
3. **Sensitive categories force `legalBasis='explicit_consent'`** — repository overrides caller's value.
4. **Revocation cascades** — revoking a `sensitive_*` consent immediately soft-deletes the corresponding `consumer_sensitive_attributes` row.
5. **Legacy fallback** — `hasConsent()` in `userProfileRepository` delegates to `consent_records` but falls back to old JSONB blob if no record exists (safe for pre-migration users).

### Consent enforcement map (`src/lib/consent-enforcement.ts`)
`CONSENT_REQUIREMENTS` maps operation names to required categories:
```ts
'collect_behavioral_signals'     → ['behavioral']
'collect_sensitive_health'       → ['sensitive_health']
'compute_icp_match_score'        → ['behavioral', 'personalization']
'send_personalized_notification' → ['personalization']
'connect_social_account'         → ['social']
// ...etc
```

---

## ICP Scoring Algorithm

**Input:** An ICP (criteria + weights) + consumer's latest signal snapshots.

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

**Normalise upward, not downward:** Unconsented criteria excluded from `totalPossible`. Consumers not penalised for granting fewer consents.

**Criterion key mapping:**

| Key | Source |
|-----|--------|
| `ageRange`, `gender`, `country`, `city`, `profession`, `education` | demographic snapshot |
| `engagementTier`, `feedbackFrequency`, `sentimentBias` | behavioral snapshot |
| `interests` / `categoryScores` | behavioral snapshot (overlap ratio) |
| `values`, `lifestyle`, `personality`, `aspirations` | psychographic snapshot |
| `health`, `dietary`, `religion`, `caste` | `consumer_sensitive_attributes` (decrypted on-the-fly) |

**Weight validation:** ICP weights MUST sum to exactly 100. Hard throw at write time.

---

## Security Hardening (8 issues fixed — April 2026)

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

## File Map

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
│   ├── icp-weight-editor.tsx                      # NEW — reusable ICP weight slider component
│   └── ui/
│       ├── slider.tsx                             # NEW — Slider component (range input wrapper)
│       ├── accordion.tsx                          # NEW — Accordion component (custom, no Radix dep)
│       └── dialog.tsx                             # MODIFIED — added asChild prop to DialogTrigger
│
└── app/
    ├── dashboard/
    │   ├── DashboardShell.tsx                     # MODIFIED — added ICP, Privacy, My Signals, My Data nav items
    │   ├── privacy/page.tsx                       # NEW — consent management UI (12 categories, 3 tiers)
    │   ├── my-signals/page.tsx                    # NEW — signal history UI (tabbed by category)
    │   ├── my-data/page.tsx                       # NEW — GDPR Art. 15 data export UI + JSON download
    │   └── brand/icps/
    │       ├── page.tsx                           # NEW — ICP list + create dialog
    │       └── [icpId]/page.tsx                   # NEW — ICP edit: weights, leaderboard, charts, bulk rescore
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
        ├── brand/icps/
        │   ├── route.ts                           # NEW — GET/POST
        │   └── [icpId]/
        │       ├── route.ts                       # NEW — GET/PATCH/DELETE
        │       ├── matches/route.ts               # NEW — GET cached matches / POST on-demand score
        │       └── bulk-score/route.ts            # NEW — POST batch scoring (max 200, rate limited)
        └── analytics/icp-audience/route.ts        # NEW — GET aggregate audience stats (min cohort 5)
```
