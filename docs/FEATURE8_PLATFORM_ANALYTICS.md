# Feature 8 — Platform Analytics Dashboard (Founder Dashboard)

**Status: ✅ COMPLETE (May 2026)** — Migration 017 + 24 repo functions + 7 service functions + 8 API routes + 12 UI components + 3 crons + 1 nav item.

URL: `/admin/platform-analytics` &middot; Access: `role === 'admin'`

The single internal view of platform health — Stripe / Baremetrics / Linear–inspired. One page covering DAU/MAU, cohort retention, MRR, runway, cost breakdown, feature adoption, growth forecasts, and support snapshot, all derived from existing platform tables.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Daily cron 01:00 UTC                  /api/cron/compute-platform-… │
│  Weekly cron Sun 02:00 UTC          /api/cron/compute-retention-…   │
│  Monthly cron 1st 03:00 UTC      /api/cron/compute-financial-…      │
└──────────────┬───────────────────────────────────────────────────────┘
               │ calls
               ▼
   src/server/platformAnalyticsService.ts   ← compute + assemble payload
               │ reads / writes
               ▼
   src/db/repositories/platformAnalyticsRepository.ts
               │
               ▼
   5 new tables (migration 017) + 11 source tables
       (users · analytics_events · feedback · survey_responses ·
        deal_redemptions · community_deals_posts/_comments ·
        influencer_campaigns · campaign_payments · reward_redemptions ·
        chat_conversations · support_tickets)
               ▲
   GET /api/admin/platform-analytics/dashboard       ← orchestrator
   GET /api/admin/platform-analytics/retention       ← per-role refresh
   GET /api/admin/platform-analytics/revenue
   GET /api/admin/platform-analytics/predictions
   GET /api/admin/platform-analytics/financial
   GET /api/admin/platform-analytics/costs           ← per-month list
   POST/PUT/DELETE /api/admin/platform-analytics/costs[/[id]]
               ▲
   src/app/admin/platform-analytics/page.tsx (RSC) → PlatformAnalyticsClient
   12 chart / table components under src/components/admin/analytics/
```

**Layer rules** are the same as the rest of the codebase (repos → service → API routes). The dashboard's distinctive twist is the `safely()` wrapper inside `getDashboardData` — every sub-block (overview, growth, retention, revenue, engagement, financial, predictions, support) is wrapped so a single panel failure populates the `_errors[]` array instead of sinking the response. Mirrors the support-analytics pattern, scaled up.

---

## Migration 017

Five tables. All money columns in **paise**. See `docs/SCHEMA.md` for column specs.

| Table | Cadence | Driving cron |
|-------|---------|--------------|
| `platform_metrics_daily` | one row/day | `/api/cron/compute-platform-metrics` |
| `revenue_metrics_daily` | one row/day | `/api/cron/compute-platform-metrics` |
| `retention_cohorts` | one row per (cohort_date, role, period_type) | `/api/cron/compute-retention-cohorts` |
| `platform_costs` | manual — founder enters via UI | none (write-through CRUD) |
| `financial_snapshots_monthly` | one row/month, derived | `/api/cron/compute-financial-snapshots` |

**Idempotent everywhere** — every upsert keys on the table's UNIQUE constraint, so cron retries are no-ops.

---

## Methodology / formulas

### Active users (DAU / WAU / MAU)
Source: `analytics_events`. A user is "active" on day D if they have ≥1 event with `user_id IS NOT NULL` in the day window. WAU = distinct in last 7 days, MAU = last 30. Anonymous events excluded (don't have a user_id to dedupe on).

Per-role split (brand / consumer / influencer DAU) joins `users` because `analytics_events.user_role` only tracks `'brand' | 'consumer'` — influencer is `users.role='consumer' AND is_influencer=true`.

### Cohort retention
Cohorts bucketed by signup week (Monday-start). For each (cohort, day_N) cell we count distinct users from the cohort with ≥1 event in `[signup + N − 0.5d, signup + N + 0.5d)`. The ±0.5d window absorbs minor weekday boundary effects from the cron schedule.

**Cell maturity gate**: a cohort that's only 10 days old can't have a Day 30 number; we report `null` for those cells (UI renders `—`). Without this gate the heatmap would silently show "0%" for cells that have no data, training admins to ignore those columns.

### Revenue
Per day, from `campaign_payments`:
- `gross_revenue` = `SUM(amount)` where `status IN ('escrowed', 'released')`
- `platform_fees` = `SUM(platform_fee)` for same status
- `influencer_payouts` = `SUM(influencer_amount)` where `status='released' AND released_at` in window
- `refunds` = `SUM(amount)` where `status='refunded' AND refunded_at` in window
- `net_revenue` = `platform_fees − refunds` (what E4I actually keeps after refund clawbacks)

`consumer_rewards_redeemed` from `reward_redemptions`: `SUM(points_spent) × 10 paise/point` (10 pts = ₹1 = 100 paise).

### Financial snapshot
Monthly aggregate computed from daily revenue rollup + `platform_costs` rows.

- `gross_margin = netRevenue − totalCosts`
- `gross_margin_percent = grossMargin / netRevenue × 100` (0 if netRevenue=0)
- `burn_rate = totalCosts − netRevenue` (positive = net negative)
- `runway_months = cash_balance / burn_rate` when both > 0; `null` when net positive or no signal
- `mrr` = monthly netRevenue (proxy — see Key Decisions below)
- `mrr_growth_percent = pctChange(thisMrr, lastMrr)`
- `arpu = netRevenue / active_brand_count_this_month`
- `brand_ltv` = `AVG(SUM(platform_fee))` per brand across all escrowed/released payments
- `consumer_ltv` = `AVG(SUM(points_spent) × 10)` per consumer (proxy for engagement cost)

`cash_balance` is manually entered (founder updates monthly via cost form or query param on the recompute cron).

### Health score (0–100, weighted)
| Factor | Weight | Scoring |
|--------|--------|---------|
| DAU / MAU ratio | 20% | `clamp(ratio × 250, 0, 100)` — 0.4 = 100, 0.2 = 50 |
| Day-7 retention | 20% | avg of last 8 matured cohorts; `null` → 50 fallback |
| MoM user growth | 15% | `clamp((pct + 20) × 2.5, 0, 100)` — −20% = 0, +20% = 100 |
| MoM revenue growth | 15% | same scaler |
| Engagement events / MAU | 15% | `clamp(events × 25, 0, 100)` — 4 events/MAU = 100 |
| Support CSAT | 15% | `avg / 5 × 100`; `null` → 50 fallback |

Bands: `≥70 healthy` (green), `40–69 attention` (amber), `<40 critical` (rose). Trend = recompute same 6 factors 7 days back, diff totals — `>+2%` improving, `<−2%` declining.

### Growth prediction
OLS linear regression on last 30 daily data points (`totalUsers` for the users metric, `netRevenue` for revenue). Forecast tail extends 30 days. 95% prediction-interval band uses the standard formula:

```
CI(x) = ±1.96 × σ × √(1 + 1/n + (x − x̄)² / Σ(x − x̄)²)
```

Trend bucket from slope normalised by mean:
- `relSlope > 0.005` → improving
- `relSlope < −0.005` → declining
- else → stable

Returns `flatPrediction(metric)` (all zeros) if fewer than 5 historical points exist — UI then renders the "Not enough history" empty state.

### Feature adoption
Numerator = distinct users who touched the feature in the window (joined to `users` for role attribution). Denominator = latest per-role DAU (`brandDau`, `consumerDau`, `influencerDau` from most recent `platform_metrics_daily` row).

**Known approximation**: the denominator is "today's active per-role" rather than "active across the selected window", because we don't store role-split MAU. For a 7d window this slightly inflates the percentage; for 30d it's roughly correct.

Feature/role applicability is enforced UI-side — e.g. brands don't see "0% DSAR adoption" (DSAR is consumer-only) because non-applicable cells render `—`. This avoids penalising correct behaviour in the heatmap.

---

## API surface

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/admin/platform-analytics/dashboard?range=…` | GET | admin | Full `DashboardPayload` |
| `/api/admin/platform-analytics/retention?role=…` | GET | admin | Cohort heatmap data |
| `/api/admin/platform-analytics/revenue?range=…` | GET | admin | Daily + cumulative revenue |
| `/api/admin/platform-analytics/predictions?metric=&days=` | GET | admin | OLS forecast |
| `/api/admin/platform-analytics/financial?months=…` | GET | admin | Trailing N months of snapshots |
| `/api/admin/platform-analytics/costs?month=…` | GET | admin | List month's costs + totals |
| `/api/admin/platform-analytics/costs` | POST | admin + CSRF | Add cost row |
| `/api/admin/platform-analytics/costs/[id]` | PUT | admin + CSRF | Edit cost row |
| `/api/admin/platform-analytics/costs/[id]` | DELETE | admin + CSRF | Remove cost row |

All admin gates: 401/403 + 60/min `platformAnalyticsRateLimit` (Upstash sliding-window, fail-open). Shared `requireAdmin()` helper in `_auth.ts`.

CSRF: state-mutating routes call `validateCsrfToken()` from `src/lib/csrf.ts`. UI auto-attaches `X-CSRF-Token` via `src/lib/api-client.ts` (`apiPost`/`apiPut`/`apiDelete`).

---

## Cron schedule

| Time (UTC) | Route | Behaviour |
|------------|-------|-----------|
| 01:00 daily | `/api/cron/compute-platform-metrics` | Yesterday's daily + revenue metrics. `?backfill=N` (cap 30) walks back N days for historical seed. |
| 02:00 Sun | `/api/cron/compute-retention-cohorts` | 12 weeks × 4 roles. `?weeks=N` (cap 26) override. |
| 03:00 1st of month | `/api/cron/compute-financial-snapshots` | Previous month snapshot. `?month=YYYY-MM` recompute specific month; `?months=N` (cap 12) walk-back seed; `?cashBalance=PAISE` override carried cash value. |

All three: Bearer `CRON_SECRET` auth (Vercel injects on scheduled runs; cron-job.org reuses the same secret if used as a redundancy layer).

### One-shot seed after running migration 017

```bash
# Set ORIGIN and CRON_SECRET first
export ORIGIN=https://www.earn4insights.com
export CRON_SECRET=...

# Seed last 30 days of daily data
curl -H "Authorization: Bearer $CRON_SECRET" \
  "$ORIGIN/api/cron/compute-platform-metrics?backfill=30"

# Seed retention cohorts (default 12 weeks is fine)
curl -H "Authorization: Bearer $CRON_SECRET" \
  "$ORIGIN/api/cron/compute-retention-cohorts"

# Seed last 6 months of financial snapshots (after entering costs)
curl -H "Authorization: Bearer $CRON_SECRET" \
  "$ORIGIN/api/cron/compute-financial-snapshots?months=6"

# Set the cash balance for the current month
# (₹2.5 Cr = 25,000,000 paise — multiply rupees by 100)
curl -H "Authorization: Bearer $CRON_SECRET" \
  "$ORIGIN/api/cron/compute-financial-snapshots?month=2026-05&cashBalance=2500000000"
```

After editing costs in the UI, recompute that month so the financial overview chart reflects the change immediately:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "$ORIGIN/api/cron/compute-financial-snapshots?month=2026-05"
```

---

## UI rows (9)

1. **Health score gauge + 4 headline metrics** — half-circle SVG gauge with band colors + factor breakdown grid; MetricCard for Total Users, DAU/MAU, MRR, Burn/Runway
2. **User growth** — stacked area (brand/consumer/influencer) with cumulative ↔ new toggle + WoW/MoM/QoQ pills
3. **Retention heatmap + Revenue chart** — cohort table with 4 role tabs (refetches on switch) + composed bar/line revenue
4. **Engagement** — 4 mini bar-chart tiles (feedback / surveys / deals / community)
5. **Feature adoption** — 10 features × 3 roles heatmap, `—` for non-applicable cells
6. **Financial overview + Cost breakdown donut** — cumulative revenue-vs-costs area chart with break-even marker; donut with center total / clickable legend
7. **Manage monthly costs** — month dropdown + table + inline add/edit + delete confirm
8. **Growth predictions** — 2× PredictionChart (users + revenue) with 95% CI bands + trend pills
9. **Support snapshot** — 4 tiles (open / AI res. / avg response / CSAT) + link to `/admin/support`

Top bar: title + last-updated tag + `TimeRangeSelector` (7D/30D/90D/12M/All) + auto-refresh toggle (60s poll, off by default) + manual refresh.

Defensive banner shows when `_errors[]` is populated: "N panels could not load — showing partial data."

---

## File map

```
src/
├── db/
│   ├── schema.ts                                       # +5 tables + 10 type exports
│   └── repositories/
│       └── platformAnalyticsRepository.ts              # 24 functions: CRUD + live compute helpers
│
├── lib/
│   ├── types/platformAnalytics.ts                      # DashboardPayload + 20 sub-types
│   └── rate-limit-upstash.ts                           # +platformAnalyticsRateLimit (60/min)
│
├── server/
│   └── platformAnalyticsService.ts                     # 7 functions: compute* + getDashboardData
│                                                       #             + computeHealthScore
│                                                       #             + computeGrowthPrediction
│
├── components/admin/analytics/
│   ├── TimeRangeSelector.tsx
│   ├── MetricCard.tsx
│   ├── HealthScoreGauge.tsx
│   ├── UserGrowthChart.tsx
│   ├── RetentionHeatmap.tsx
│   ├── RevenueChart.tsx
│   ├── EngagementMiniChart.tsx
│   ├── FeatureAdoptionMap.tsx
│   ├── FinancialOverview.tsx
│   ├── CostBreakdownDonut.tsx
│   ├── CostManagement.tsx                              # CRUD UI — uses api-client w/ CSRF
│   └── PredictionChart.tsx
│
└── app/
    ├── admin/platform-analytics/
    │   ├── page.tsx                                    # RSC entry — admin guard + SSR initial
    │   └── PlatformAnalyticsClient.tsx                 # 9-row orchestrator
    └── api/
        ├── admin/
        │   ├── run-migration-017/route.ts              # migration: 5 tables + indexes + FK
        │   └── platform-analytics/
        │       ├── _auth.ts                            # requireAdmin() helper
        │       ├── dashboard/route.ts                  # GET — full payload
        │       ├── retention/route.ts                  # GET — per-role refresh
        │       ├── revenue/route.ts                    # GET — daily + cumulative
        │       ├── predictions/route.ts                # GET — OLS forecast
        │       ├── financial/route.ts                  # GET — trailing N months
        │       └── costs/
        │           ├── route.ts                        # GET + POST (CSRF)
        │           └── [id]/route.ts                   # PUT + DELETE (CSRF)
        └── cron/
            ├── compute-platform-metrics/route.ts       # daily 01:00 UTC
            ├── compute-retention-cohorts/route.ts      # weekly Sun 02:00 UTC
            └── compute-financial-snapshots/route.ts    # monthly 1st 03:00 UTC

vercel.json                                              # +3 cron entries (31 total)
src/app/dashboard/DashboardShell.tsx                     # +1 nav: /admin/platform-analytics
```

---

## Known approximations & open work

| Item | Notes |
|------|-------|
| **MRR proxy** | `mrr = monthly netRevenue`. E4I doesn't have a true subscription product yet — fees are billed per-campaign. When subscriptions ship, redefine MRR as recurring-subscription revenue and treat per-campaign fees as one-time. |
| **Consumer LTV** | Currently `avg(points_spent × 10 paise)` per consumer — a payout-cost proxy, not a true value-of-data calculation. When the value-per-feedback model exists, switch to revenue-side LTV. |
| **Brand LTV** | `avg(SUM(platform_fee))` per brand. Doesn't account for churn — once we track brand activity-since-last-payment, weight by survival probability. |
| **Feature adoption denominator** | Latest per-role DAU rather than per-role MAU across the window. Add `brand_mau` / `consumer_mau` / `influencer_mau` columns to fix. |
| **Health score trend** | Recomputed against 7-day-ago data each render — accurate but costs a second pass through `rawHealthFactors`. Could cache last-week's factors in a small `health_score_history` table if this becomes a perf hotspot. |
| **Cost visibility** | All cost categories visible to all admins. If non-founder admins are added, gate `salaries` / `legal` lines behind a `role: 'founder'` distinction. |
| **No CAC tracking** | LTV : CAC ratio listed in spec is not yet wired — CAC requires attribution data we don't currently capture. |

---

## Runbook

### After deployment (one-time)

1. Run migration: `POST /api/admin/run-migration-017` with `x-api-key: $ADMIN_API_KEY` header
2. Backfill last 30 days of daily metrics: `GET /api/cron/compute-platform-metrics?backfill=30` with `Authorization: Bearer $CRON_SECRET`
3. Seed retention cohorts: `GET /api/cron/compute-retention-cohorts`
4. Open `/admin/platform-analytics` — most rows now show real data; financial rows stay empty until step 5
5. Enter the current month's costs via the Cost Management UI in row 7
6. Optionally seed historical financial snapshots: `GET /api/cron/compute-financial-snapshots?months=6`
7. Set the current cash balance: `GET /api/cron/compute-financial-snapshots?month=YYYY-MM&cashBalance=$(rupees × 100)`

### Day-2 ops

- **Costs change** → edit in UI → re-trigger `?month=YYYY-MM` financial cron so snapshot reflects new totals
- **Cash balance update** → re-trigger financial cron with `?cashBalance=` override
- **Dashboard looks stale** → manual refresh button on top bar, or check the most recent `computed_at` timestamp on `platform_metrics_daily` to confirm the daily cron ran
- **`_errors[]` banner shows** → check Vercel function logs for the listed panel name — `[platformAnalytics] <label> failed:` lines identify the failing sub-block

### Adding a new cost category

1. Add the literal to `CostCategory` union in `src/lib/types/platformAnalytics.ts`
2. Add to `COST_CATEGORIES` const in same file
3. Add to `CATEGORY_LABELS` + `CATEGORY_COLORS` in `CostBreakdownDonut.tsx`
4. Add to `CATEGORY_LABELS` in `CostManagement.tsx`
5. No DB change — the column is `TEXT`, only the union+enum check enforces validity
