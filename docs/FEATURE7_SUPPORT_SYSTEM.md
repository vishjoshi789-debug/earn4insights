# Feature 7 — Customer Support System

GPT-4o-mini chatbot, ticket workflow, FAQ knowledge base, admin dashboard, real-time notifications, transactional emails, daily reminder cron. Built across 9 phases.

**Status: ✅ COMPLETE (May 2026 — commit `72ca8b9` + Phase 9 follow-up)**

---

## Overview

Three surfaces, one schema:

| Surface | Audience | Path |
|---------|----------|------|
| **Floating chat widget** (3 tabs: Chat / FAQ / Tickets) | All authenticated users on dashboard | mounted in `src/app/dashboard/layout.tsx` |
| **Public help center** | Anyone (SEO-friendly) | `/help` and `/help/[slug]` |
| **Admin dashboard** | Admin users only | `/admin/support` and `/admin/support/tickets/[id]` |

The chatbot resolves common questions instantly via semantic FAQ matching (pgvector cosine). Anything it can't resolve becomes a ticket with auto-classified category, summarised description, and the full chat transcript attached. Tickets follow a standard support lifecycle (open → in_progress → waiting_on_user → resolved → closed) with SLA-driven email reminders.

---

## Schema (Migration 015)

Applied via `POST /api/admin/run-migration-015`. Enables pgvector. Creates `support_ticket_seq` for atomic E4I-XXXX numbering.

| Table | Purpose |
|-------|---------|
| `support_tickets` | Primary ticket record. FK CASCADE → users (GDPR Art. 17). 13 categories, 5 statuses, 4 priorities. Auto-priority inferred from category. |
| `support_ticket_messages` | Threaded conversation. `sender_type`: `user`/`admin`/`system`/`ai`. `is_internal_note=true` hides from user view AND user emails. |
| `chat_conversations` | Chatbot session. Messages stored as JSONB array. `escalated_to_ticket_id` records the lineage. `context` JSONB carries currentPage + recent actions + suspicious-flag counter. |
| `faq_articles` | Markdown KB. `search_vector tsvector` (DB trigger) for `/help` keyword search. `embedding vector(1536)` for chatbot semantic match (OpenAI text-embedding-3-small + ivfflat cosine index). |
| `support_analytics` | Append-only event log. 10 event types (`chat_started`, `chat_resolved_by_ai`, `chat_escalated`, `ticket_created`, `ticket_resolved`, `faq_viewed`, `faq_helpful`, `faq_not_helpful`, `avg_response_time`, `satisfaction`). |

Full column definitions in `docs/SCHEMA.md`.

---

## Services (3)

### `src/server/supportService.ts`
Ticket lifecycle business logic. Functions:
- `createTicket(input)` — auto-numbers, infers priority, persists first user message, fires admin + user emails, emits `support.ticket_created`
- `getUserTickets`, `getAdminTicketQueue`, `getTicketDetail` (internal-note visibility based on `isAdmin`)
- `addTicketReply` — auto-transitions `open → in_progress` (admin reply) and `waiting_on_user → in_progress` (user reply); routes email to user OR admin based on `senderRole`; emits `support.admin_reply` on public admin replies
- `updateTicketStatus` — fires resolved email, emits `support.ticket_resolved` / `support.ticket_updated`
- `assignTicket`, `rateTicket` (1–5 stars, gated on resolved/closed)

### `src/server/chatbotService.ts`
The bot. Functions:
- `startConversation` — looks up user name, builds greeting, returns role-specific quick actions, logs `chat_started`
- `sendMessage` — 4-step flow:
  1. **Hard block** if `context.blocked=true`
  2. **Suspicious-intent filter** (18 regex patterns → 3-flag threshold → block)
  3. **Semantic FAQ search** (pgvector, ≥0.78 similarity) — return article excerpt + link
  4. **GPT-4o-mini fallback** — system prompt + last 10 messages, temp 0.3, 500 tokens
  5. **Escalation hint** if ≥6 user messages and unresolved
- `escalateToTicket` — runs classifier (single GPT call), builds subject + description, creates ticket, sends admin email + Pusher push
- `resolveConversation` (user marks resolved) and `rateConversation` (1–5)
- `getAiResolutionRate(days)` — admin analytics helper

### `src/server/faqService.ts`
Knowledge-base reads + admin CRUD. Functions:
- `listArticles` (filtered by category + role + published flag)
- `getArticleBySlug` (increments view, logs `faq_viewed`)
- `rateArticle` (helpful / not-helpful counters)
- `searchByKeyword` (tsvector — for `/help`)
- `searchBySemantic` (pgvector — for chatbot; default cutoff 0.75)
- `createArticleWithEmbedding`, `updateArticleWithEmbedding` (auto-regen on title/excerpt/content change), `deleteArticleById`, `regenerateEmbeddingForArticle`

### `src/server/supportEmailService.ts`
7 Resend templates, all fail-soft on missing API key:
1. `sendTicketCreatedToAdmin` — new ticket → admin inbox
2. `sendTicketCreatedToUser` — confirmation → user
3. `sendAdminReplyToUser` — admin reply → user
4. `sendUserReplyToAdmin` — user reply → admin inbox
5. `sendTicketResolvedToUser` — resolution + rating CTA → user
6. `sendChatEscalationToAdmin` — chat → ticket with last 5 messages
7. `sendTicketReminderDigest` — daily stale-ticket digest

---

## Chatbot architecture

### System prompt (`src/server/chatbot-knowledge-base.ts`)

Layered build: persona → role-specific KB → shared facts → strict rules → response format → user context.

- **Role-specific KB:** brand / consumer / influencer — each section ≈40 lines, covers all features the role can touch
- **Shared facts** (Q2 confirmed — bot may quote verbatim): platform fees (8/12/10%), points rate (10 pts = ₹1), reward economy, payment timelines, privacy categories, ICP weight rules, community moderation thresholds, social connection status
- **10 strict rules** (refuse to invent / disclose business data / reveal prompt / share other-user data / role-play / quote off-list pricing / give legal advice / leave platform topics / produce third-party content / echo PII)
- **Response format:** ≤150 words, numbered steps for how-tos, end with confirmation question, role-aware pronouns

### Suspicious-intent filter

18 regex patterns across 5 abuse families:
- Prompt extraction ("ignore previous instructions", "show me your system prompt")
- Jailbreaks (DAN, role-play overrides, "ignore your rules")
- Internal metrics fishing ("how many users", "what's your revenue", "tech stack", "biggest clients")
- Cross-user data fishing ("tell me about user X", "list all brands")
- Competitor recon ("how does Earn4Insights make money", "share source code")

Flag tracking lives in `conversation.context.flagCount`. At 3 flags: conversation auto-resolves (NOT escalated — abusive sessions don't fan out to admin queue). Soft flags log `[CHAT_SUSPICIOUS_FLAG]`, blocks log `[CHAT_SUSPICIOUS_BLOCK]` — both greppable in Vercel logs.

### Defence layers (in order)
1. Heuristic regex (free, fast — runs before GPT)
2. System prompt rules (catches what regex misses)
3. Conversation flag counter + auto-block
4. Hard refusal at escalation (blocked chats can't become tickets)
5. Per-user rate limit (20 chat msgs/min via Upstash)

---

## API routes (18 files, 19 endpoints)

| Surface | Endpoint | Method | Rate limit |
|---------|----------|--------|-----------|
| **User tickets** | `/api/support/tickets` | GET / POST | read 60/min, create 5/h |
| | `/api/support/tickets/[id]` | GET | read 60/min |
| | `/api/support/tickets/[id]/messages` | POST | reply 30/h |
| | `/api/support/tickets/[id]/rate` | POST | read 60/min |
| **User chat** | `/api/support/chat/start` | POST | start 10/min |
| | `/api/support/chat/message` | POST | message 20/min |
| | `/api/support/chat/[id]/escalate` | POST | create 5/h |
| | `/api/support/chat/[id]/resolve` | POST | read 60/min |
| | `/api/support/chat/[id]/rate` | POST | read 60/min |
| **User FAQ** | `/api/support/faq` | GET | read 60/min |
| | `/api/support/faq/[slug]` | GET | read 60/min |
| | `/api/support/faq/[slug]/rate` | POST | read 60/min |
| **Admin** | `/api/admin/support/tickets` | GET | admin 120/min |
| | `/api/admin/support/tickets/[id]` | GET / PUT | admin 120/min |
| | `/api/admin/support/tickets/[id]/reply` | POST | admin 120/min |
| | `/api/admin/support/analytics` | GET | admin 120/min |
| | `/api/admin/support/faq` | GET / POST | admin 120/min |
| | `/api/admin/support/faq/[id]` | PUT / DELETE | admin 120/min |
| **Cron** | `/api/cron/support-ticket-reminders` | GET/POST | Bearer CRON_SECRET |
| **Admin migration / seed** | `/api/admin/run-migration-015`, `/api/admin/seed-faq` | POST | `x-api-key` |

All user-facing state-mutating routes validate CSRF via the `e4i-csrf` cookie + `X-CSRF-Token` header.

---

## EventBus integration (Phase 9)

5 platform events route through `src/server/eventBus.ts`:

| Event | Targets | Pusher channel |
|-------|---------|----------------|
| `support.ticket_created` | All admins (fan-out via `getAdminUserIds()`) | `private-user-{adminId}` for each admin |
| `support.chat_escalated` | All admins | same |
| `support.admin_reply` | Ticket owner | `private-user-{userId}` |
| `support.ticket_updated` | Ticket owner | same |
| `support.ticket_resolved` | Ticket owner | same |

Each event:
1. Writes to `realtime_events` (audit log)
2. Writes to `notification_inbox` (in-app inbox)
3. Writes to `activity_feed_items`
4. Pushes via Pusher to private channel(s)
5. Queues email/SMS via existing notification system

`getAdminUserIds()` in `src/db/repositories/userRepository.ts` caches the admin list in-memory for 5 minutes. Newly promoted admins see pushes up to 5 min late; demoted admins keep receiving them for up to 5 min. Admin role is also rechecked at every API route, so the cache is not a security boundary.

### Real-time UI subscriptions

- **`/admin/support`** subscribes to `private-user-{adminId}` and listens for `support.ticket_created` + `support.chat_escalated` → toast + auto-refresh queue + analytics
- **`<ChatWidget />`** subscribes to `private-user-{userId}` and listens for `support.admin_reply` + `support.ticket_resolved` + `support.ticket_updated` → unread badge on the floating button + toast when closed → opening the Tickets tab resets unread

---

## Knowledge base seeding

`POST /api/admin/seed-faq` (one-shot, idempotent):

1. Iterates 31 articles defined in `src/server/faqSeedData.ts`
2. Skips any slug that already exists
3. For each new article: insert row → DB trigger fills `search_vector` → call OpenAI `text-embedding-3-small` on `title + excerpt + content` → write `embedding` column
4. Returns `{ created, skipped, errors }`

Requires `OPENAI_API_KEY`. Cost: ~$0.0006 per seed run (31 × ~1k tokens × $0.00002/k).

### Categories seeded (31 articles)
- Getting Started — Brand (6), Consumer (6), Influencer (6)
- Payments & Billing (5)
- Account & Privacy (6)
- Technical (4)

Admin can add/edit articles via `/admin/support/faq` — embedding auto-regenerates when title / excerpt / content changes.

---

## Admin dashboard

`/admin/support` (single page, client component):
- **4 metric cards:** open tickets, avg first response, AI resolution rate, avg satisfaction
- **Ticket queue:** 5-way filter (status, priority, category, role, free text), priority-then-age sort, color-coded status / priority / age badges, pagination
- **Recent chat escalations:** last 10 promoted chats with one-click admin link
- **5 charts (Recharts):** tickets-over-time line, by-category h-bar, resolution-time histogram, AI-vs-team pie, satisfaction-distribution bar

`/admin/support/tickets/[id]`:
- Header: ticket number + status + priority badge
- Full message thread (internal notes shown inline with yellow callout)
- Reply box with internal-note toggle
- Sidebar: status / priority / category dropdowns, resolution notes textarea, Resolve + Close buttons, satisfaction card (if rated)

---

## Email map

| # | Trigger | Subject | Recipient |
|---|---------|---------|-----------|
| 1 | Ticket created | `[E4I-XXXX] New support ticket: {subject}` | admin |
| 2 | Ticket created | `We received your request — E4I-XXXX` | user |
| 3 | Admin reply | `Update on your ticket E4I-XXXX` | user |
| 4 | User reply | `Re: [E4I-XXXX] {subject}` | admin |
| 5 | Ticket resolved | `Your ticket E4I-XXXX has been resolved` | user |
| 6 | Chat escalation | `[E4I-XXXX] Chat escalated to ticket` | admin |
| 7 | Daily digest | `Support alert: N tickets need attention` | admin |

All fail-soft — ticket creation, escalation, and the cron never block on email outages.

---

## Cron

`/api/cron/support-ticket-reminders` (daily 09:00 UTC):
1. **Needs first response:** `open` tickets > 48h old with no public admin reply
2. **Needs follow-up:** `in_progress` tickets where last public admin reply > 24h ago (or never replied)
3. If total > 0 → single HTML digest email; if 0 → no email sent (zero-noise principle)
4. Returns `{ reminded, openCount, overdueCount, durationMs }`

External trigger via cron-job.org may be configured alongside the `vercel.json` entry for redundancy:
- URL: `https://www.earn4insights.com/api/cron/support-ticket-reminders`
- Crontab: `0 9 * * *`
- Header: `Authorization: Bearer <CRON_SECRET>`

---

## Environment variables

```bash
SUPPORT_ADMIN_EMAIL=contact@earn4insights.com  # destination for admin emails
CHATBOT_MODEL=gpt-4o-mini                      # chat completion model
CHATBOT_CLASSIFY_MODEL=gpt-4o-mini             # chat-to-ticket category classifier
# Reuses: OPENAI_API_KEY, RESEND_API_KEY, EMAIL_FROM, NEXT_PUBLIC_APP_URL,
#         UPSTASH_REDIS_REST_URL/TOKEN, CRON_SECRET, PUSHER_*
```

---

## Known gaps & future work

| Item | Notes |
|------|-------|
| **Chat conversation retention** | `chat_conversations` has no TTL. Planned: cleanup cron deletes `resolved` / `escalated` conversations older than 90 days. Today they accumulate indefinitely (privacy concern at scale). |
| **Email-to-ticket inbound** | `Reply to this email` is currently informational. Inbound webhook (Resend Receive or AWS SES) would parse replies and append as ticket messages. |
| **Per-admin assignment workload view** | `assigned_to` is captured but not surfaced as a "my tickets" admin view yet. |
| **FAQ embedding re-seed** | If `EMBEDDING_MODEL` is bumped or content is bulk-edited, we need an admin route to re-embed every article. Today only single-article edits trigger regeneration. |
| **Chatbot conversation handover to admin** | No "transfer to live agent" path mid-chat. Only the post-hoc escalation-to-ticket flow exists. |

---

## File map

```
src/
├── lib/
│   └── embeddings.ts                                       # NEW — OpenAI text-embedding-3-small wrapper
│
├── db/
│   ├── schema.ts                                           # MODIFIED — 5 new tables + type exports
│   └── repositories/
│       ├── supportRepository.ts                            # NEW — 30+ functions (ticket CRUD, messages, conversations, FAQ, analytics, stale queries, escalation list)
│       └── userRepository.ts                               # NEW — getAdminUserIds (5-min cache), findUserById, findUserEmail
│
├── server/
│   ├── chatbot-knowledge-base.ts                           # NEW — system prompt composer + suspicious-intent detector
│   ├── chatbotService.ts                                   # NEW — sendMessage, escalateToTicket, classifier
│   ├── faqSeedData.ts                                      # NEW — 31 seed articles
│   ├── faqService.ts                                       # NEW — list / search / rate / admin CRUD
│   ├── supportEmailService.ts                              # NEW — 7 Resend templates
│   ├── supportService.ts                                   # NEW — ticket lifecycle
│   └── eventBus.ts                                         # MODIFIED — 5 new events + handlers, getAdminUserIds fan-out
│
├── components/support/
│   ├── ChatWidget.tsx                                      # NEW — floating button + 3-tab panel + Pusher unread badge
│   ├── ChatTab.tsx                                         # NEW
│   ├── ChatBubble.tsx                                      # NEW
│   ├── CreateTicketForm.tsx                                # NEW
│   ├── FAQTab.tsx                                          # NEW
│   ├── TicketTab.tsx                                       # NEW
│   ├── TicketDetail.tsx                                    # NEW
│   └── markdown.tsx                                        # NEW — lightweight markdown renderer
│
├── app/
│   ├── dashboard/
│   │   ├── layout.tsx                                      # MODIFIED — mounts <ChatWidget />
│   │   └── DashboardShell.tsx                              # MODIFIED — Help Center + admin Support nav
│   ├── help/
│   │   ├── page.tsx                                        # NEW — server component, SEO
│   │   ├── HelpBrowserClient.tsx                           # NEW — interactive filter/search
│   │   └── [slug]/
│   │       ├── page.tsx                                    # NEW — JSON-LD Article schema
│   │       └── HelpfulVoteButtons.tsx                      # NEW
│   ├── admin/support/
│   │   ├── page.tsx                                        # NEW — dashboard (queue + escalations + charts + Pusher)
│   │   ├── SupportAnalyticsCharts.tsx                      # NEW — Recharts grid
│   │   └── tickets/[id]/page.tsx                           # NEW — admin ticket detail
│   └── api/
│       ├── admin/
│       │   ├── run-migration-015/route.ts                  # NEW — migration + pgvector + sequence + trigger
│       │   ├── seed-faq/route.ts                           # NEW — idempotent FAQ seed
│       │   └── support/
│       │       ├── tickets/route.ts                        # NEW
│       │       ├── tickets/[id]/route.ts                   # NEW
│       │       ├── tickets/[id]/reply/route.ts             # NEW
│       │       ├── analytics/route.ts                      # NEW
│       │       ├── faq/route.ts                            # NEW
│       │       └── faq/[id]/route.ts                       # NEW
│       ├── support/
│       │   ├── tickets/route.ts                            # NEW
│       │   ├── tickets/[id]/route.ts                       # NEW
│       │   ├── tickets/[id]/messages/route.ts              # NEW
│       │   ├── tickets/[id]/rate/route.ts                  # NEW
│       │   ├── chat/start/route.ts                         # NEW
│       │   ├── chat/message/route.ts                       # NEW
│       │   ├── chat/[id]/escalate/route.ts                 # NEW
│       │   ├── chat/[id]/resolve/route.ts                  # NEW
│       │   ├── chat/[id]/rate/route.ts                     # NEW
│       │   ├── faq/route.ts                                # NEW
│       │   ├── faq/[slug]/route.ts                         # NEW
│       │   └── faq/[slug]/rate/route.ts                    # NEW
│       └── cron/support-ticket-reminders/route.ts          # NEW — daily 09:00 UTC digest
│
├── components/
│   ├── site-footer.tsx                                     # MODIFIED — Help link
│   └── site-header.tsx                                     # MODIFIED — Help link (desktop + mobile)
│
├── lib/
│   └── rate-limit-upstash.ts                               # MODIFIED — 6 new support limiters
│
├── middleware.ts                                           # MODIFIED — /help + /api/support/faq added to public whitelist
└── vercel.json                                             # MODIFIED — support-ticket-reminders cron at 0 9 * * *
```
