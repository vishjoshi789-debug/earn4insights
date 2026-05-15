# Feature 3 — Real-Time Connection Layer

Pusher WebSocket (cluster ap2 — Mumbai/Asia), 6 DB tables + 1 ALTER, event bus (31 events), notification inbox, activity feed, presence indicators, social listening.

**Status: ✅ COMPLETE + reviewed (April 2026)**

---

## Architecture

- **`src/lib/pusher.ts`** — server SDK singleton, `triggerPusherEvent()`, `PUSHER_EVENTS`, channel helpers
- **`src/lib/pusher-client.ts`** — client SDK singleton (`channelAuthorization`), channel helpers
- **`src/server/eventBus.ts`** — `emit()` + `PLATFORM_EVENTS` (31 events) + `routeEvent()` + ICP targeting
- **`src/server/realtimeNotificationService.ts`** — consent-gated dispatch: inbox + feed + Pusher + email/SMS

## Pusher Channel Design

| Channel | Type | Purpose |
|---------|------|---------|
| `private-user-{userId}` | Private | Personal notifications (auth required) |
| `presence-dashboard` | Presence | Active user tracking for online indicators |
| `public-product-{productId}` | Public | Product page live activity |

Auth endpoint: `POST /api/pusher/auth` — validates NextAuth session; enforces users can only subscribe to their own private channel. On presence auth, stamps `lastActiveAt` on `userProfiles` (fire-and-forget).

## 36 Platform Events

All defined in `PLATFORM_EVENTS` const in `src/server/eventBus.ts`. All 36 have `routeEvent()` case handlers.

| Event | Targets | Emitted by |
|-------|---------|------------|
| `brand.product.launched` | ICP-matched consumers (score ≥ 60) | product launch route |
| `brand.survey.created` | ICP-matched consumers (score ≥ 50) | survey route |
| `brand.campaign.launched` | All active influencers | brand campaigns route |
| `brand.alert.fired` | Brand owner | `brandAlertService` |
| `brand.member.active` | ICP-matched consumers (score ≥ 50) — *handler ready; no emitter yet* | — |
| `brand.discount.created` | ICP-matched consumers (score ≥ 50) — *handler ready; no emitter yet* | — |
| `brand.content.pending_review` | Campaign brand owner | `contentApprovalService.submitForReview()` + `resubmitContent()` |
| `consumer.feedback.submitted` | Product brand | feedback submit route |
| `consumer.survey.completed` | Survey brand | survey route |
| `consumer.product.browsed` | Product brand | browse route |
| `consumer.product.searched` | Product brand | search route |
| `consumer.community.posted` | Product brand | community route |
| `consumer.reward.withdrawn` | Product brand (loyalty signal) | rewards route |
| `influencer.post.published` | Campaign brand + ICP-matched consumers (score ≥ 60) | `contentApprovalService.approveContent()` |
| `influencer.campaign.accepted` | Brand | influencer campaign route |
| `influencer.milestone.completed` | Brand | milestone route |
| `influencer.content.approved` | Influencer who submitted the post | `contentApprovalService.approveContent()` |
| `influencer.content.rejected` | Influencer who submitted the post | `contentApprovalService.rejectContent()` |
| `brand.content.auto_approved` | Campaign brand owner | `contentApprovalService.approveContentAsSystem()` (cron) |
| `social.mention.detected` | Brand owning the mentioned entity | social mention webhook / cron |
| `influencer.campaign.applied` | Campaign brand owner | `campaignMarketplaceService.applyToCampaign()` |
| `brand.application.accepted` | Influencer who applied | `campaignMarketplaceService.respondToApplication()` |
| `brand.application.rejected` | Influencer who applied | `campaignMarketplaceService.respondToApplication()` |
| `payment.order.created` | Brand | `razorpayService.createOrder()` after Razorpay order created |
| `payment.escrowed` | Brand + Campaign influencer | `razorpayService.capturePayment()` after HMAC-verified webhook |
| `payment.released` | Brand + Influencer | `POST /api/payments/release/[campaignId]` after milestone approved |
| `payment.failed` | Brand | Razorpay `payment.failed` webhook event |
| `payment.payout.initiated` | Recipient (influencer/consumer) | `payoutService.initiateRecipientPayout()` |
| `payment.payout.completed` | Recipient | `payoutService.markPayoutCompleted()` (admin action) |
| `payment.payout.failed` | Recipient | `payoutService.markPayoutFailed()` (admin action) |
| `consumer.reward.redeemed` | Consumer | `POST /api/consumer/rewards/redeem` after successful deduction |
| `support.ticket_created` | ALL admins (fan-out via `getAdminUserIds()` 5-min cache) | `supportService.createTicket()` |
| `support.chat_escalated` | ALL admins | `chatbotService.escalateToTicket()` |
| `support.admin_reply` | Ticket owner | `supportService.addTicketReply()` (admin role only, non-internal) |
| `support.ticket_updated` | Ticket owner | `supportService.updateTicketStatus()` (non-resolved status change) |
| `support.ticket_resolved` | Ticket owner | `supportService.updateTicketStatus()` (resolved transition) |

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

GET/POST `/api/notifications/preferences` — 31 event types, per-type `inApp`/`email`/`sms` toggles.
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
│   └── eventBus.ts                                # emit() + PLATFORM_EVENTS (31 events) + routeEvent() + ICP targeting
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

# Files that emit events:
components/dashboard-header.tsx                    # Replaced legacy NotificationDropdown with NotificationBell
server/brandAlertService.ts                        # emit BRAND_ALERT_FIRED after writing alert
server/contentApprovalService.ts                   # emit BRAND_CONTENT_PENDING_REVIEW, INFLUENCER_CONTENT_APPROVED,
                                                   #      INFLUENCER_CONTENT_REJECTED, BRAND_CONTENT_AUTO_APPROVED,
                                                   #      INFLUENCER_POST_PUBLISHED (on approve)
server/campaignMarketplaceService.ts               # emit INFLUENCER_CAMPAIGN_APPLIED, BRAND_APPLICATION_ACCEPTED,
                                                   #      BRAND_APPLICATION_REJECTED
app/api/feedback/submit/route.ts                   # emit CONSUMER_FEEDBACK_SUBMITTED
app/api/influencer/content/route.ts                # NOTE: INFLUENCER_POST_PUBLISHED removed from here (was premature —
                                                   #       posts were drafts). Now emitted in contentApprovalService.
app/api/brand/campaigns/route.ts                   # emit BRAND_CAMPAIGN_LAUNCHED
vercel.json                                        # 26 cron entries (20 pre-CI + 5 competitive + 1 dsar-cleanup)
```
