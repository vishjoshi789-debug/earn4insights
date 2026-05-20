# Cron Jobs — Earn4Insights

**31 total entries** in `vercel.json`. All authenticated via `Authorization: Bearer CRON_SECRET`.

## Schedule

| Time (UTC) | Route | Purpose |
|------------|-------|---------|
| 00:00 | `/api/cron/process-feedback-media` | Process pending feedback media |
| 00:30 | `/api/cron/cleanup-notifications` | Purge expired notification_inbox rows + old activity_feed_items (90-day TTL) |
| 01:00 | `/api/cron/physical-delete-sensitive-attributes` | Physical-delete soft-deleted sensitive attributes older than 30 days (GDPR Art. 17) |
| 01:30 | `/api/cron/cleanup-feedback-media` | Clean up expired feedback media |
| 02:00 | `/api/jobs/process-deletions` | Hard-delete user accounts after 30-day grace period |
| 02:00 Sun | `/api/cron/extract-themes` | Extract AI themes for all products with feedback (weekly) |
| 02:30 | `/api/cron/update-consumer-signals` | Batch signal collection for all users |
| 03:00 | `/api/cron/update-behavioral` | Update behavioral signals |
| 03:00 | `/api/cron/recompute-icp-scores` | Recompute stale ICP match scores + fire alerts |
| 03:30 | `/api/cron/update-campaign-performance` | Aggregate performance metrics for active campaigns |
| 04:00 | `/api/cron/send-time-analysis` | Analyse optimal send times |
| 04:30 | `/api/cron/sync-social-stats` | Validate influencer social stats (placeholder for platform API sync) |
| 05:00 | `/api/cron/cleanup-analytics-events` | Purge old analytics events |
| 05:30 | `/api/cron/process-social-mentions` | Poll YouTube for new mentions + notify brands on pending social_mentions |
| 06:00 | `/api/cron/process-notifications` | Process queued notifications |
| 06:00 | `/api/cron/process-payouts` | Find released campaign_payments with no payout record → create payout; retry failed payouts (cool-down: >1h, max 3 retries) |
| 07:00 | `/api/cron/sync-razorpay-status` | Poll Razorpay Payouts API for processing payouts (placeholder — activates when `RAZORPAYX_ENABLED=true`) |
| 02:00 daily (ext. 2h) | `/api/cron/process-content-reviews` | SLA reminders (75%/90%) + auto-approve or escalation at 100% SLA |
| 04:00 | `/api/cron/community-deals-moderation` | Auto-approve pending posts past time window; auto-hide posts with ≥ 5 flags |
| 05:00 | `/api/cron/deals-expiry` | Mark `deals` with `validUntil < now` as `expired`; update `status` to `'expired'` |
| 06:30 | `/api/cron/competitive/daily-digest` | Build daily competitive digest per brand; persist `competitive_reports` row |
| 07:30 | `/api/cron/competitive/detect-alerts` | Run 10 alert detectors across all brands; 24h dedup before writing `competitor_alerts` |
| 08:00 | `/api/cron/competitive/recompute-scores` | Recompute 6-dimension competitive scores for all brands; write `competitive_scores` + `competitive_benchmarks` |
| Mon 06:00 | `/api/cron/competitive/weekly-report` | Generate GPT-4o weekly competitive summary per brand; persist report + queue email |
| 09:00 | `/api/cron/competitive/send-reports` | Send pending competitive reports via Resend (daily + weekly); sets `email_sent=true` |
| 03:00 | `/api/jobs/dsar-cleanup` | Delete expired DSAR PDFs from Vercel Blob; expire stale OTP-sent requests older than 1h |
| 09:00 | `/api/cron/support-ticket-reminders` | Daily digest to admin inbox of stale tickets: `open` >48h with no admin reply + `in_progress` with no admin reply >24h. Skips email when total=0. |
| 06:00 (Vercel daily safety-net) + */15 min (cron-job.org) | `/api/cron/publish-scheduled-launches` | Flip products where `launch_status='scheduled'` and `scheduled_launch_at<=NOW()` to `'live'`; fire the same side-effects as instant launch (brand confirmation email + smart distribution + watchlist fan-out). Race-safe — `publishScheduledProduct()` returns null on second writer. **Vercel Hobby allows only daily crons**, so `vercel.json` registers `0 6 * * *` as a daily safety-net and the real 15-min cadence is driven externally by cron-job.org hitting the route with `Authorization: Bearer $CRON_SECRET`. |
| 01:00 | `/api/cron/compute-platform-metrics` | Upsert `platform_metrics_daily` + `revenue_metrics_daily` for YESTERDAY's UTC day (never today — would be a partial-day row). 6 parallel repo helpers feed `computeDailyMetrics(day)` + `computeRevenueMetrics(day)`. `?backfill=N` (cap 30) walks back N days from yesterday for one-shot historical seed after migration 017. Returns 207 multi-status with per-day `{date, ok, error?}` list when any fail. Idempotent — `upsertDailyMetrics` keys on `UNIQUE(date)`. |
| 02:00 Sun | `/api/cron/compute-retention-cohorts` | Rebuild 12 weeks × 4 roles (all/brand/consumer/influencer) of `retention_cohorts` via `buildCohortRetention()`. `?weeks=N` (cap 26) override. Each cell uses a ±0.5d window for the day-N retention count to absorb weekday-boundary effects. Cells that haven't matured (e.g. Day 30 for a 10-day-old cohort) write `NULL`, not 0%. Idempotent — `upsertRetentionCohort` keys on `UNIQUE(cohort_date, role, period_type)`. |
| 03:00 1st of month | `/api/cron/compute-financial-snapshots` | Snapshot PREVIOUS month into `financial_snapshots_monthly`. Aggregates daily revenue rollups + monthly costs; computes margins, burn, runway, MRR + growth, ARPU, brand/consumer LTV. Carries over `cash_balance` from existing row unless `?cashBalance=PAISE` override (useful for monthly treasury update). `?month=YYYY-MM` recomputes a specific month (after editing costs in the UI). `?months=N` (cap 12) walks back N months for historical seed. Idempotent — `upsertFinancialSnapshot` keys on `UNIQUE(month)`. |

## Auth Pattern (used by ALL cron routes)

```ts
const authHeader = request.headers.get('authorization')
const cronSecret = process.env.CRON_SECRET
if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

If `CRON_SECRET` is unset, check is skipped (routes run unauthenticated). **Always set in production.**

## Notes

- Middleware does NOT intercept cron routes. The `middleware.ts` matcher `/((?!api|_next/static|_next/image|favicon.ico).*)` excludes `/api/*`. Cron routes handle their own auth via `Authorization: Bearer CRON_SECRET`. Note: middleware does mint the `e4i-csrf` cookie on page responses (for CSRF protection on UI-facing routes), but this does not affect `/api/*` cron routes.
- `SIGNAL_CRON_BATCH_SIZE` — max users per signal cron run (default: all)
- `ICP_SCORE_CRON_BATCH_SIZE=200` — max stale scores per ICP cron run. Bulk score is intentionally sequential: 200 × ~100ms ≈ 20s, safe within Vercel's 60s Pro function limit.
- **`process-content-reviews`** vercel.json schedule is `0 2 * * *` (daily 02:00 UTC). The higher-cadence 2h triggering (`0 */2 * * *`) is wired externally via cron-job.org hitting the same route. Duplicate prevention: `content_review_reminders` table with UNIQUE index on `(post_id, reminder_type)`. Reminder types: `75_pct`, `90_pct`, `sla_expired`. At 100% SLA: auto-approves if `autoApproveEnabled=true`, otherwise sends escalation notification. Returns stats: `{ autoApproved, reminders75, reminders90, escalations }`.
- **`process-payouts`** runs daily at 06:00 UTC. Step 1: `NOT EXISTS` subquery finds `campaign_payments` with `status='released'` that have no `influencer_payouts` row → calls `initiateRecipientPayout()`. Step 2: Retries `failed` payouts where `retry_count < 3` AND `updated_at < 1 hour ago`. All payouts go to admin manual queue (`RAZORPAYX_ENABLED=false`). Returns: `{ processed, retried, failed, manual, duration, errors }`.
- **`sync-razorpay-status`** runs daily at 07:00 UTC. Finds `processing` payouts with `razorpayPayoutId IS NOT NULL` older than 1 hour. Currently logs only — RazorpayX API polling activates when `RAZORPAYX_ENABLED=true`. Will emit `PAYMENT_PAYOUT_COMPLETED` or `PAYMENT_PAYOUT_FAILED` on status change. Returns: `{ checked, updated, errors, duration }`.
- **`community-deals-moderation`** runs daily at 04:00 UTC. Two passes: (1) auto-approve `pending` posts older than the configured window; (2) auto-hide posts where `flag_count >= 5` (sets status → `'removed'`). Returns: `{ approved, hidden, errors }`.
- **`deals-expiry`** runs daily at 05:00 UTC. Finds all `deals` where `status = 'active'` AND `valid_until < NOW()` → sets `status = 'expired'`. Returns: `{ expired, errors }`.
- **`competitive/recompute-scores`** runs daily at 08:00 UTC. Iterates all brands with confirmed competitors. Computes 6-dimension score; skips if effective weight < 40. Upserts `competitive_scores` (UNIQUE per brand+category) and writes `competitive_benchmarks` rows. Returns: `{ scored, skipped, errors, duration }`.
- **`competitive/daily-digest`** runs daily at 06:30 UTC. Calls `competitiveIntelligenceService.buildDailyDigest()` per brand. Persists `competitive_reports` row (`report_type='daily'`). Returns: `{ digests, errors, duration }`.
- **`competitive/detect-alerts`** runs daily at 07:30 UTC. Runs 10 alert detector functions per brand. Before writing, checks for an existing alert of same type within 24h (dedup). Returns: `{ detected, deduped, errors, duration }`.
- **`competitive/weekly-report`** runs Mondays at 06:00 UTC. Uses GPT-4o (not gpt-4o-mini) to generate strategic weekly competitive summary per brand. Persists `competitive_reports` row (`report_type='weekly'`). Returns: `{ reports, errors, duration }`.
- **`competitive/send-reports`** runs daily at 09:00 UTC. Finds `competitive_reports` where `email_sent=false`. Sends via Resend using `competitiveEmailService` HTML templates; sets `email_sent=true`. Returns: `{ sent, errors, duration }`.
- **`dsar-cleanup`** runs daily at 03:00 UTC. Two passes: (1) finds `completed` DSAR requests where `expires_at < NOW()` → calls Vercel Blob `del()`, sets `status='expired'`, clears `pdf_url`; (2) finds `otp_sent` requests stale > 1h → sets `status='expired'`. Returns: `{ pdfDeleted, otpExpired, errors, duration }`.
- **`support-ticket-reminders`** runs daily at 09:00 UTC. Two queries: (1) `open` tickets > 48h old with no public admin reply (`needs_first_response`); (2) `in_progress` tickets where last public admin reply > 24h ago — or never replied (`needs_followup`). Both queries cap at 200 rows. If combined total > 0, sends a single HTML digest email to `SUPPORT_ADMIN_EMAIL` (default `contact@earn4insights.com`); silent on zero. Returns: `{ reminded, openCount, overdueCount, durationMs }`.
