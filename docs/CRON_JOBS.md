# Cron Jobs — Earn4Insights

**16 total entries** in `vercel.json`. All authenticated via `Authorization: Bearer CRON_SECRET`.

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
| Every 2h | `/api/cron/process-content-reviews` | SLA reminders (75%/90%) + auto-approve or escalation at 100% SLA |

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

- Middleware does NOT intercept cron routes. The `middleware.ts` matcher `/((?!api|_next/static|_next/image|favicon.ico).*)` excludes `/api/*`. Cron routes handle their own auth.
- `SIGNAL_CRON_BATCH_SIZE` — max users per signal cron run (default: all)
- `ICP_SCORE_CRON_BATCH_SIZE=200` — max stale scores per ICP cron run. Bulk score is intentionally sequential: 200 × ~100ms ≈ 20s, safe within Vercel's 60s Pro function limit.
- **`process-content-reviews`** runs every 2 hours (`0 */2 * * *`). Duplicate prevention: `content_review_reminders` table with UNIQUE index on `(post_id, reminder_type)`. Reminder types: `75_pct`, `90_pct`, `sla_expired`. At 100% SLA: auto-approves if `autoApproveEnabled=true`, otherwise sends escalation notification. Returns stats: `{ autoApproved, reminders75, reminders90, escalations }`.
