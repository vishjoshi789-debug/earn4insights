# Feature 4 — Competitive Intelligence Dashboard

Brand-facing competitive monitoring system. 9 DB tables (migration 010), 6-dimension scoring engine, AI insight generation, real-time alert detection, email digests, 5 cron jobs.

**Status: ✅ COMPLETE (April 2026 — commit 6f8714c)**

---

## Architecture Overview

```
Brand configures competitors (on-platform or off-platform)
        ↓
Daily crons score brands (6 dimensions), detect alerts, build digests
        ↓
Brand views dashboard: ScoreCard grid, AlertFeed, InsightsFeed, benchmarks, rankings
        ↓
Brand requests on-demand AI insights (GPT-4o-mini / GPT-4o)
        ↓
Digest emails sent via Resend (daily + weekly)
```

All routes share a common `_auth.ts` helper that validates session + brand role.
**Ownership failures return 404 (not 403)** — prevents competitor existence leakage.

---

## Schema (Migration 010)

9 new tables. Applied via `POST /api/admin/run-migration-010`.

### `competitor_profiles`

Tracks competitors per brand. Supports on-platform (another brand on Earn4Insights) and off-platform (external — name + website only).

Columns: `id` (UUID PK), `brand_id` (TEXT), `competitor_type` (`'on_platform' | 'off_platform'`), `competitor_brand_id` (TEXT nullable — null for off-platform), `competitor_name` (TEXT), `competitor_website` (TEXT), `competitor_logo_url` (TEXT), `category` (TEXT), `sub_categories` (TEXT[]), `geographies` (TEXT[]), `is_system_suggested` (BOOLEAN), `is_confirmed` (BOOLEAN), `is_active` (BOOLEAN), `confirmed_at`, `dismissed_at`, `notes`, `created_at`, `updated_at`

Indexes:
- Partial UNIQUE `(brand_id, competitor_brand_id) WHERE competitor_brand_id IS NOT NULL` — one on-platform competitor per brand
- Partial UNIQUE `(brand_id, competitor_name) WHERE competitor_type = 'off_platform'` — one off-platform per name
- `(brand_id, is_active, is_confirmed)` — dashboard query
- `(competitor_brand_id)` — reverse lookup
- `(category)` — category-based scoring

### `competitor_products`

Competitor product catalogue with pricing and features.

Columns: `id`, `competitor_profile_id` (UUID → competitor_profiles), `product_name`, `product_id`, `category`, `description`, `current_price` (INTEGER paise), `currency` (default 'INR'), `price_updated_at`, `features` (JSONB array), `positioning`, `target_segment`, `external_url`, `is_active`, `created_at`, `updated_at`

### `competitor_price_history`

Append-only price log. Never updated — each price observation is a new row.

Columns: `id`, `competitor_product_id` (UUID → competitor_products), `price` (INTEGER paise), `currency`, `source`, `recorded_at`

Index: `(competitor_product_id, recorded_at DESC)` — time-series queries

### `competitive_insights`

AI or system-generated insights per brand.

Columns: `id`, `brand_id`, `insight_type`, `title`, `summary`, `details` (JSONB), `data_sources` (JSONB), `severity` (`'info' | 'warning' | 'critical'`), `is_read`, `is_actionable`, `action_suggestion`, `expires_at`, `generated_by` (`'system' | 'ai'`), `ai_model`, `created_at`

Indexes:
- `(brand_id, is_read, created_at DESC)` — unread first
- `(brand_id, insight_type)` — type filter
- Partial index on `(expires_at) WHERE expires_at IS NOT NULL` — expiry cleanup

### `competitive_benchmarks`

Per-metric brand vs category comparison snapshot.

Columns: `id`, `brand_id`, `category`, `metric_name`, `brand_value` (NUMERIC 10,4), `category_avg`, `category_best`, `category_worst`, `percentile` (INTEGER), `competitor_values` (JSONB — per-competitor breakdown), `sample_size`, `period_start/end` (DATE), `computed_at`

Index: `(brand_id, category, metric_name)`, `(brand_id, computed_at DESC)`

### `competitive_scores`

Overall 0-100 competitive score per `(brand_id, category)`.

Columns: `id`, `brand_id`, `category`, `overall_score` (INTEGER 0-100), `score_breakdown` (JSONB — per-dimension), `rank` (INTEGER), `total_in_category` (INTEGER), `trend` (`'improving' | 'stable' | 'declining'`), `previous_score`, `computed_at`

**UNIQUE(brand_id, category)** — upserted by scoring cron.

Index: `(category, overall_score DESC)` — leaderboard query

### `competitor_alerts`

Real-time competitive event alerts.

Columns: `id`, `brand_id`, `competitor_profile_id` (UUID nullable), `alert_type` (TEXT), `title`, `description`, `severity` (`'info' | 'warning' | 'critical'`), `data` (JSONB), `is_read`, `created_at`

Indexes: `(brand_id, is_read, created_at DESC)`, `(brand_id, alert_type)`, `(competitor_profile_id)`

### `competitive_reports`

Daily/weekly/monthly digest output.

Columns: `id`, `brand_id`, `report_type` (`'daily' | 'weekly' | 'monthly'`), `title`, `content` (JSONB), `category`, `period_start/end` (DATE), `email_sent` (BOOLEAN), `email_sent_at`, `created_at`

Index: `(brand_id, report_type, created_at DESC)`

### `competitor_digest_preferences`

Per-brand digest settings. **UNIQUE(brand_id)**.

Columns: `id`, `brand_id` (UNIQUE), `digest_frequency` (`'daily' | 'weekly' | 'monthly'`), `email_enabled`, `in_app_enabled`, `categories` (TEXT[]), `alert_types` (TEXT[]), `created_at`, `updated_at`

---

## Services

### `competitiveScoringService` (`src/server/competitiveScoringService.ts`)

Computes 0-100 composite score per brand across 6 weighted dimensions.

#### Dimension weights
```ts
export const DIMENSION_WEIGHTS = {
  sentiment:       25,
  marketShare:     20,
  pricing:         15,
  featureCoverage: 15,
  influencerReach: 10,
  consumerLoyalty: 15,
} as const
```

#### Scoring pattern (normalise upward)

```
for each dimension:
  data = repo.getAggregatedXxx(brandId, category)   // returns null if cohort < 5
  if data is null:
    skip dimension — DO NOT add weight to effectiveTotalWeight
    continue

  effectiveTotalWeight += DIMENSION_WEIGHTS[dimension]
  dimensionScore = computeDimensionScore(data)       // 0-100 within dimension
  totalEarned += dimensionScore * DIMENSION_WEIGHTS[dimension]

if effectiveTotalWeight < INSUFFICIENT_WEIGHT_THRESHOLD (40):
  return { score: null, reason: 'insufficient_data' }  // do NOT persist

overallScore = round(totalEarned / effectiveTotalWeight)
```

**Trend:** `improving` if delta > +3 pts vs previous score, `declining` if delta < -3, `stable` otherwise.

#### Privacy discipline
All consumer-derived dimensions read through `competitiveIntelligenceRepository` helpers that enforce `MIN_COHORT_SIZE = 5` and return `null` (never 0) below the floor.

### `competitiveAlertService` (`src/server/competitiveAlertService.ts`)

Runs 10 alert detector functions. Before writing any alert, checks for an existing `competitor_alerts` row of the same type within 24h (dedup window) — if found, skips without writing.

#### Alert types (10)

| Type | Trigger |
|------|---------|
| `price_drop` | Competitor lowers product price significantly |
| `price_surge` | Competitor raises product price |
| `sentiment_drop` | Brand's own sentiment drops vs category avg |
| `sentiment_surge` | Brand's sentiment improves significantly |
| `new_competitor` | New unconfirmed competitor detected in category |
| `market_share_loss` | Brand's feedback volume share drops |
| `market_share_gain` | Brand's share increases |
| `feature_gap` | Category-leading feature not in brand's coverage |
| `influencer_surge` | Competitor influencer post volume spikes |
| `consumer_switching` | Signals of consumers engaging with competitors (requires 3-condition check + cohort ≥ 5) |

### `competitiveAIService` (`src/server/competitiveAIService.ts`)

Generates AI-powered insights using OpenAI.

- **Daily insights:** `gpt-4o-mini` — cost-effective, sufficient for daily summaries
- **Weekly reports:** `gpt-4o` — full reasoning for strategic analysis
- **Cap:** 3 AI insights per brand per day (24h idempotency check before generation)
- **Zod validation:** All AI responses validated against typed schemas before persistence
- **Token cost logging:** Model + token counts logged per call
- **Anti-hallucination:** System prompt instructs model to return `"insufficient data"` rather than fabricate when cohort < 5

### `competitiveEmailService` (`src/server/competitiveEmailService.ts`)

Resend-backed HTML email templates:
- **Daily digest:** Summary of top alerts, score changes, and insights for the day
- **Weekly summary:** Full competitive landscape summary with trend charts (text representation)

### `competitiveIntelligenceService` (`src/server/competitiveIntelligenceService.ts`)

Orchestrator service. Aggregates data from scoring, alerts, and insights into the dashboard response. Also handles:
- Building digest data structure for cron
- Enriching scores with competitor comparison context
- Generating `competitive_reports` rows

---

## Repository (`competitiveIntelligenceRepository`)

`src/db/repositories/competitiveIntelligenceRepository.ts` — 764-line file.

**Privacy chokepoint:** `MIN_COHORT_SIZE = 5` enforced in all aggregate helpers. Functions return `null` (never a zero-valued object) when cohort is too small. Callers must handle null explicitly.

Key helpers:
- `getAggregatedSentiment(brandId, category)` — category-relative sentiment (cohort-gated)
- `getFeedbackThemes(brandId, category)` — feature coverage from feedback categories
- `getCompetitiveScore(brandId, category)` — fetch latest score row
- `upsertCompetitiveScore(...)` — insert or update by UNIQUE(brand_id, category)
- `upsertBenchmark(...)` — append benchmark row
- `getCompetitorProfiles(brandId)` — confirmed + active competitors
- `getCompetitorAlertWithinWindow(brandId, alertType, windowHours)` — 24h dedup check

---

## Cron Jobs (5 routes)

| Time (UTC) | Route | Returns |
|------------|-------|---------|
| 06:30 | `/api/cron/competitive/daily-digest` | `{ digests, errors, duration }` |
| 07:30 | `/api/cron/competitive/detect-alerts` | `{ detected, deduped, errors, duration }` |
| 08:00 | `/api/cron/competitive/recompute-scores` | `{ scored, skipped, errors, duration }` |
| Mon 06:00 | `/api/cron/competitive/weekly-report` | `{ reports, errors, duration }` |
| 09:00 | `/api/cron/competitive/send-reports` | `{ sent, errors, duration }` |

All follow the existing `Bearer CRON_SECRET` auth pattern and `logger.cronResult` logging convention.

Note: commit message mentions "Frequent cadences (15min scores, 30min alerts) wired via cron-job.org per Q1" — vercel.json schedules are daily; external cron-job.org triggers the routes at higher frequency if configured.

---

## Rate Limiting

Three in-memory LRU limiters added to `src/lib/rate-limit.ts`:

| Limiter | Route |
|---------|-------|
| `competitiveRead` | Dashboard + all listing reads |
| `competitiveRecompute` | `POST /scores/recompute` |
| `competitiveAiGenerate` | `POST /insights/generate` |

---

## Key Design Decisions

| Decision | Why |
|----------|-----|
| **404 on ownership failure, not 403** | Prevents brands from inferring whether a competitor profile exists for another brand |
| **MIN_COHORT_SIZE=5 at repo level** | Same privacy floor as ICP scoring; null returned so callers must explicitly handle missing data |
| **Normalise upward for missing dimensions** | Same pattern as ICP scoring — brands not penalised when data cohort too small |
| **Score not persisted if effective weight < 40** | Below 40% weight coverage, the score is too data-sparse to be meaningful |
| **24h dedup window for alerts** | Prevents alert flood from recurring conditions; one alert per type per day |
| **3 AI insights/brand/day cap** | Prevents runaway GPT-4o token cost |
| **gpt-4o-mini for daily, gpt-4o for weekly** | Cost vs quality trade-off — daily summaries tolerate lighter model |
| **Zod-validated AI responses** | Prevents unexpected schema from OpenAI causing downstream type errors |
| **Competitor existence 404 guard** | `_auth.ts` helper returns 404 (not 403) for ownership checks — same principle as GDPR data minimisation |

---

## Known Gaps

| Item | Notes |
|------|-------|
| **Real competitor data ingestion** | Products and prices populated manually by brand or from brand input; no automated scraping or third-party data feed |
| **Market share is a proxy** | Computed from relative feedback volume within category — not actual revenue or unit share |
| **`consumer_switching` alert** | Requires 3-condition check + cohort ≥ 5; conditions without data silently skip (won't false-fire) |
| **`is_system_suggested` automation** | Flag exists; system-suggested competitors are not yet auto-generated from feedback category analysis |

---

## File Map

```
src/
├── app/
│   ├── api/
│   │   ├── admin/
│   │   │   └── run-migration-010/route.ts               # NEW — 9 tables, 250 lines
│   │   └── brand/
│   │       └── competitive-intelligence/
│   │           ├── _auth.ts                             # NEW — shared brand auth + 404 guard
│   │           ├── dashboard/route.ts                   # GET full dashboard
│   │           ├── competitors/route.ts                 # GET list / POST add
│   │           ├── competitors/[id]/route.ts            # GET/PATCH/DELETE
│   │           ├── competitors/[id]/products/route.ts   # GET/POST
│   │           ├── competitors/[id]/products/[pid]/route.ts           # GET/PATCH/DELETE
│   │           ├── competitors/[id]/products/[pid]/price-history/route.ts  # GET
│   │           ├── competitors/suggested/route.ts       # GET
│   │           ├── insights/route.ts                    # GET list
│   │           ├── insights/generate/route.ts           # POST on-demand AI
│   │           ├── insights/[id]/route.ts               # GET/DELETE
│   │           ├── alerts/route.ts                      # GET list
│   │           ├── alerts/[id]/route.ts                 # PATCH mark-read
│   │           ├── benchmarks/route.ts                  # GET
│   │           ├── scores/route.ts                      # GET
│   │           ├── scores/recompute/route.ts            # POST
│   │           ├── rankings/[category]/route.ts         # GET
│   │           ├── reports/route.ts                     # GET/POST
│   │           ├── reports/weekly/route.ts              # POST
│   │           └── digest-preferences/route.ts          # GET/PATCH
│   │   └── cron/
│   │       └── competitive/
│   │           ├── daily-digest/route.ts                # NEW — 06:30 UTC
│   │           ├── detect-alerts/route.ts               # NEW — 07:30 UTC
│   │           ├── recompute-scores/route.ts            # NEW — 08:00 UTC
│   │           ├── weekly-report/route.ts               # NEW — Mon 06:00 UTC
│   │           └── send-reports/route.ts                # NEW — 09:00 UTC
│   └── dashboard/
│       └── competitive-intelligence/
│           ├── page.tsx                                 # NEW — main dashboard
│           ├── competitors/page.tsx                     # NEW — competitor list
│           ├── competitors/[id]/page.tsx                # NEW — competitor detail
│           ├── reports/page.tsx                         # NEW — report history
│           ├── settings/page.tsx                        # NEW — digest preferences
│           └── _components/
│               ├── ScoreCard.tsx                        # NEW — 0-100 score widget
│               ├── AlertFeed.tsx                        # NEW — alert stream
│               ├── InsightsFeed.tsx                     # NEW — insight cards
│               ├── DimensionBreakdown.tsx               # NEW — radar/bar per dimension
│               ├── RankingsTable.tsx                    # NEW — category leaderboard
│               ├── BenchmarksPanel.tsx                  # NEW — metric comparison
│               └── AddCompetitorDialog.tsx              # NEW — add competitor form
├── db/
│   ├── schema.ts                                        # MODIFIED — 9 CI tables added (+194 lines)
│   └── repositories/
│       └── competitiveIntelligenceRepository.ts        # NEW — 764 lines
├── server/
│   ├── competitiveScoringService.ts                     # NEW — 434 lines
│   ├── competitiveAlertService.ts                       # NEW — 458 lines
│   ├── competitiveAIService.ts                          # NEW — 438 lines
│   ├── competitiveEmailService.ts                       # NEW — 313 lines
│   └── competitiveIntelligenceService.ts                # NEW — 462 lines
└── lib/
    └── rate-limit.ts                                    # MODIFIED — 3 CI limiters added
```
