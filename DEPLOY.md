# Deployment Guide

Last updated: 2026-03-24

## Vercel Deployment

This project deploys automatically via Vercel on push to `main`.

## External Cron (Recommended)

Vercel Hobby plan limits cron to daily schedules. For more frequent notification
processing, set up a free external cron service:

### Setup (cron-job.org or similar)

1. Create a free account at [cron-job.org](https://cron-job.org)
2. Create a new cron job:
   - **URL:** `https://www.earn4insights.com/api/cron/process-notifications`
   - **Schedule:** Every 5 minutes (`*/5 * * * *`)
   - **Method:** GET
   - **Headers:**
     - `Authorization: Bearer <YOUR_CRON_SECRET>`
3. Set `CRON_SECRET` in Vercel environment variables if not already set
4. The Vercel daily cron at 6AM UTC will still run as a fallback

### Endpoints available for external cron

| Endpoint | Purpose | Recommended Frequency |
|---|---|---|
| `/api/cron/process-notifications` | Send queued notifications | Every 5 min |
| `/api/cron/process-feedback-media` | Process audio/video uploads | Every 15 min |
| `/api/cron/extract-themes` | Extract feedback themes | Every 30 min |

All endpoints require `Authorization: Bearer <CRON_SECRET>` header.
