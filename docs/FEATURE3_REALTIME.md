# Feature 3 — Real-Time Connection Layer

Pusher WebSocket (cluster ap2 — Mumbai/Asia), 6 DB tables, event bus (16 events), notification inbox, activity feed, presence indicators, social listening.

## Architecture

- **`src/lib/pusher.ts`** — server SDK singleton, `triggerPusherEvent()`, `PUSHER_EVENTS`, channel helpers
- **`src/lib/pusher-client.ts`** — client SDK singleton (`channelAuthorization`), channel helpers
- **`src/server/eventBus.ts`** — `emit()` + `PLATFORM_EVENTS` (16 events) + `routeEvent()` + ICP targeting
- **`src/server/realtimeNotificationService.ts`** — consent-gated dispatch: inbox + feed + Pusher + email/SMS

## 16 Platform Events (PLATFORM_EVENTS)

Defined in `src/server/eventBus.ts`. Routed to notification inbox, activity feed, and Pusher channels based on event type and ICP targeting rules.

## Notification Preferences

Per-user, per-event-type toggles: `inApp`, `email`, `sms`. Stored in `notification_preferences` (16 event types). GET/POST via `/api/notifications/preferences`.

## Pusher Channel Auth

`POST /api/pusher/auth` — handles both private and presence channel authorization. Presence channels expose online user counts to brands (for `BrandActiveBadge`, `ActiveUsersCount` components).

## Social Listening

Brands define keyword rules via `POST /api/brand/social-listening/rules`. Incoming mentions matched against rules via `textMatchesRule()` in `socialListeningRuleRepository`. YouTube polled daily at 05:30 UTC; webhook at `POST /api/webhooks/social-mention` for push-based sources (HMAC verified via `SOCIAL_MENTION_WEBHOOK_SECRET`).

---

## File Map

```
src/
├── lib/
│   ├── pusher.ts                                  # NEW — server SDK singleton, triggerPusherEvent, PUSHER_EVENTS, channel helpers
│   └── pusher-client.ts                           # NEW — client SDK singleton (channelAuthorization), channel helpers
│
├── db/
│   ├── migrations/
│   │   └── 005_realtime_connection_layer.sql      # NEW — 6 tables
│   └── repositories/
│       ├── realtimeEventRepository.ts             # NEW
│       ├── notificationInboxRepository.ts         # NEW — cursor pagination, 90-day TTL, unread count
│       ├── notificationPreferenceRepository.ts    # NEW — 16 event types, per-type inApp/email/sms toggles
│       ├── activityFeedRepository.ts              # NEW — cursor pagination, 90-day retention
│       ├── socialMentionRepository.ts             # NEW
│       └── socialListeningRuleRepository.ts       # NEW — textMatchesRule() keyword matching
│
├── server/
│   ├── realtimeNotificationService.ts             # NEW — consent-gated dispatch: inbox + feed + Pusher + email/SMS
│   └── eventBus.ts                                # NEW — emit() + PLATFORM_EVENTS (16 events) + routeEvent() + ICP targeting
│
├── hooks/
│   ├── usePusher.ts                               # NEW — usePusher (subscribe/bind), usePresenceChannel
│   └── useRealtimeNotifications.ts                # NEW — unreadCount, latestNotification, clearLatest
│
├── components/
│   └── notifications/
│       ├── NotificationBell.tsx                   # NEW — Popover bell with badge, bounce animation, real-time updates
│       ├── NotificationDropdown.tsx               # NEW — latest 10 items, mark-read on click
│       ├── NotificationInbox.tsx                  # NEW — full inbox: filter, unread-only, infinite scroll, dismiss
│       ├── ActivityFeed.tsx                       # NEW — live activity stream with Pusher updates
│       └── OnlinePresenceIndicator.tsx            # NEW — OnlineDot, ActiveUsersCount, BrandActiveBadge
│
└── app/
    ├── dashboard/
    │   ├── DashboardShell.tsx                     # MODIFIED — presence channel subscription on mount, Notifications nav item
    │   └── notifications/page.tsx                 # NEW — /dashboard/notifications wrapping NotificationInbox
    └── api/
        ├── admin/run-migration-005/route.ts       # NEW — apply Feature 3 schema migration
        ├── pusher/auth/route.ts                   # NEW — private + presence channel authorization
        ├── notifications/
        │   ├── inbox/route.ts                     # NEW — GET (paginated) + POST (mark-all-read)
        │   ├── inbox/[id]/route.ts                # NEW — PATCH (read/unread) + DELETE (dismiss)
        │   ├── mark-all-read/route.ts             # NEW — POST mark all read
        │   └── preferences/route.ts               # NEW — GET/POST per-event notification preferences
        ├── activity-feed/route.ts                 # NEW — GET cursor-paginated activity feed
        ├── webhooks/social-mention/route.ts       # NEW — POST HMAC-verified webhook, matches rules, emits event
        └── brand/social-listening/rules/route.ts  # NEW — GET/POST/PATCH social listening rules

# Files modified to emit events:
components/dashboard-header.tsx                    # MODIFIED — replaced legacy NotificationDropdown with NotificationBell
server/brandAlertService.ts                        # MODIFIED — emit BRAND_ALERT_FIRED after writing alert
app/api/feedback/submit/route.ts                   # MODIFIED — emit CONSUMER_FEEDBACK_SUBMITTED after contribution record
app/api/influencer/content/route.ts                # MODIFIED — emit INFLUENCER_POST_PUBLISHED after createPost
app/api/brand/campaigns/route.ts                   # MODIFIED — emit BRAND_CAMPAIGN_LAUNCHED after createNewCampaign
```
