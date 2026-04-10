# Feature 3 — Real-Time Connection Layer

Pusher WebSocket (cluster ap2 — Mumbai/Asia), 6 DB tables + 1 ALTER, event bus (16 events), notification inbox, activity feed, presence indicators, social listening.

**Status: ✅ COMPLETE + reviewed (April 2026)**

---

## Architecture

- **`src/lib/pusher.ts`** — server SDK singleton, `triggerPusherEvent()`, `PUSHER_EVENTS`, channel helpers
- **`src/lib/pusher-client.ts`** — client SDK singleton (`channelAuthorization`), channel helpers
- **`src/server/eventBus.ts`** — `emit()` + `PLATFORM_EVENTS` (16 events) + `routeEvent()` + ICP targeting
- **`src/server/realtimeNotificationService.ts`** — consent-gated dispatch: inbox + feed + Pusher + email/SMS

## Pusher Channel Design

| Channel | Type | Purpose |
|---------|------|---------|
| `private-user-{userId}` | Private | Personal notifications (auth required) |
| `presence-dashboard` | Presence | Active user tracking for online indicators |
| `public-product-{productId}` | Public | Product page live activity |

Auth endpoint: `POST /api/pusher/auth` — validates NextAuth session; enforces users can only subscribe to their own private channel. On presence auth, stamps `lastActiveAt` on `userProfiles` (fire-and-forget).

## 16 Platform Events

All defined in `PLATFORM_EVENTS` const in `src/server/eventBus.ts`. All 16 have `routeEvent()` case handlers.

| Event | Targets |
|-------|---------|
| `brand.product.launched` | ICP-matched consumers (score ≥ 60) |
| `brand.survey.created` | ICP-matched consumers (score ≥ 50) |
| `brand.campaign.launched` | All active influencers |
| `brand.alert.fired` | Brand owner |
| `brand.member.active` | ICP-matched consumers (score ≥ 50) — *handler ready; no emitter yet* |
| `brand.discount.created` | ICP-matched consumers (score ≥ 50) — *handler ready; no emitter yet* |
| `consumer.feedback.submitted` | Product brand |
| `consumer.survey.completed` | Survey brand |
| `consumer.product.browsed` | Product brand |
| `consumer.product.searched` | Product brand |
| `consumer.community.posted` | Product brand |
| `consumer.reward.withdrawn` | Product brand (loyalty signal) |
| `influencer.post.published` | Campaign brand + ICP-matched consumers (score ≥ 60) |
| `influencer.campaign.accepted` | Brand |
| `influencer.milestone.completed` | Brand |
| `social.mention.detected` | Brand owning the mentioned entity |

## Dispatch Flow (inbox-first)

```
emit(eventType, payload)
  1. Write realtime_events (audit)
  2. Resolve targets (ICP scores, consent, preferences)
  3. Per target:
     a. Check notification_preferences — skip if all disabled
     b. Check consent ('personalization') for consumers
     c. Write notification_inbox ← source of truth, always first
     d. Write activity_feed_items
     e. Pusher push → private-user-{userId} (best-effort, never throws)
     f. Queue email/SMS via queueNotification()
  4. markEventProcessed()
```

## Notification Preferences

GET/POST `/api/notifications/preferences` — 16 event types, per-type `inApp`/`email`/`sms` toggles.
Defaults: `inApp=true`, `email=true`, `sms=false`.

## Online Presence

`lastActiveAt` on `userProfiles` stamped on every presence channel auth. Powers:
- `OnlineDot` — green dot for active users
- `ActiveUsersCount` — "X users viewing" on product pages
- `BrandActiveBadge` — visible to consumers

## Social Listening

Brands define keyword rules via `GET/POST/PATCH /api/brand/social-listening/rules`.
Mentions ingested via:
- `POST /api/webhooks/social-mention` — HMAC-verified (sha256). **503 if `SOCIAL_MENTION_WEBHOOK_SECRET` unset** — never accepts unsigned payloads.
- `GET /api/cron/process-social-mentions` (05:30 UTC) — polls YouTube + notifies brands on all pending `social_mentions`.

Keyword matching via `textMatchesRule()` in `socialListeningRuleRepository`.

## Security Hardening Applied

| Issue | Fix |
|-------|-----|
| Webhook accepted requests when secret unset | Now returns 503 immediately if `SOCIAL_MENTION_WEBHOOK_SECRET` missing |
| `influencer.post.published` only notified brand | Added `getConsumersForBrandViaIcps()` — ICP-matched consumers now also notified |
| Community pages using old Next.js 14 sync params | `[slug]` and `[slug]/[postId]` updated to `Promise<T>` + `await params` |

## Known Gaps (Minor)

| Item | Notes |
|------|-------|
| `ACTIVITY_FEED_UPDATE` Pusher event unused | Defined but never triggered — `ActivityFeed` uses polling |
| `brand.member.active` / `brand.discount.created` emitters | Handlers + targeting correct; no API route calls `emit()` for these yet |
| `dispatchToUsers` N+1 at scale | 2 DB writes + 2 Pusher calls per target; CONCURRENCY=50 cap limits pressure today |

---

## File Map

```
src/
├── lib/
│   ├── pusher.ts                                  # server SDK singleton, triggerPusherEvent, PUSHER_EVENTS, channel helpers
│   └── pusher-client.ts                           # client SDK singleton (channelAuthorization), channel helpers
│
├── db/
│   ├── migrations/
│   │   └── 005_realtime_connection_layer.sql      # 6 tables + ALTER user_profiles ADD last_active_at
│   └── repositories/
│       ├── realtimeEventRepository.ts
│       ├── notificationInboxRepository.ts         # cursor pagination, 90-day TTL, unread count
│       ├── notificationPreferenceRepository.ts    # 16 event types, inApp/email/sms toggles
│       ├── activityFeedRepository.ts              # cursor pagination, 90-day retention
│       ├── socialMentionRepository.ts
│       └── socialListeningRuleRepository.ts       # textMatchesRule() keyword matching
│
├── server/
│   ├── realtimeNotificationService.ts             # consent-gated dispatch: inbox + feed + Pusher + email/SMS
│   └── eventBus.ts                                # emit() + PLATFORM_EVENTS (16 events) + routeEvent() + ICP targeting
│
├── hooks/
│   ├── usePusher.ts                               # usePusher (subscribe/bind), usePresenceChannel
│   └── useRealtimeNotifications.ts                # unreadCount, latestNotification, clearLatest
│
├── components/
│   └── notifications/
│       ├── NotificationBell.tsx                   # Popover bell, badge, bounce animation, real-time updates
│       ├── NotificationDropdown.tsx               # Latest 10 items, mark-read on click
│       ├── NotificationInbox.tsx                  # Full inbox: filter, unread-only, infinite scroll, dismiss
│       ├── ActivityFeed.tsx                       # Live activity stream with Pusher updates
│       └── OnlinePresenceIndicator.tsx            # OnlineDot, ActiveUsersCount, BrandActiveBadge
│
└── app/
    ├── dashboard/
    │   ├── DashboardShell.tsx                     # MODIFIED — presence channel subscription, Notifications nav
    │   └── notifications/page.tsx                 # /dashboard/notifications wrapping NotificationInbox
    └── api/
        ├── admin/run-migration-005/route.ts       # Apply Feature 3 schema + ALTER userProfiles
        ├── pusher/auth/route.ts                   # Private + presence channel auth; stamps lastActiveAt
        ├── notifications/
        │   ├── inbox/route.ts                     # GET (paginated) + POST (mark-all-read)
        │   ├── inbox/[id]/route.ts                # PATCH (read/unread) + DELETE (dismiss)
        │   ├── mark-all-read/route.ts             # POST mark all read
        │   └── preferences/route.ts               # GET/POST per-event notification preferences
        ├── activity-feed/route.ts                 # GET cursor-paginated activity feed
        ├── webhooks/social-mention/route.ts       # POST HMAC-verified webhook (503 if secret unset)
        └── brand/social-listening/rules/route.ts  # GET/POST/PATCH social listening rules

# Files modified to emit events:
components/dashboard-header.tsx                    # Replaced legacy NotificationDropdown with NotificationBell
server/brandAlertService.ts                        # emit BRAND_ALERT_FIRED after writing alert
app/api/feedback/submit/route.ts                   # emit CONSUMER_FEEDBACK_SUBMITTED
app/api/influencer/content/route.ts                # emit INFLUENCER_POST_PUBLISHED
app/api/brand/campaigns/route.ts                   # emit BRAND_CAMPAIGN_LAUNCHED
vercel.json                                        # 15 cron entries (was 13)
```
