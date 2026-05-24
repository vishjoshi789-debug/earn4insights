# Social Platform Setup

> One section per platform: status today, what API access is needed, how
> to apply, approval timeline, env vars to set, and what auto-activates
> once configured. Cross-reference with `src/server/social/platformAdapters.ts`
> and `src/app/api/cron/process-social-mentions/route.ts`.

The social-listening pipeline is **env-gated**: adding an env var to
Vercel activates the corresponding platform on the next cron run, no
code change required. Removing the var deactivates it equally cleanly.
The cron logs `[Social-Cron] Active: ... | Skipped: ... (no <ENV_VAR>)`
on every run so you can audit which platforms are live at a glance.

---

## Quick status table

| Platform | Listening adapter | Cron-polled today | User-link OAuth | Notes |
|---|---|---|---|---|
| Reddit | ✅ built | ✅ yes (free, always-on) | ❌ | Public search JSON, no key |
| YouTube | ✅ built | ⚠️ if `YOUTUBE_API_KEY` | ❌ | Google Cloud → enable YouTube Data API v3 |
| Google Reviews | ✅ built | ⚠️ if `GOOGLE_PLACES_API_KEY` | ❌ | Places API. Sits on the same Google Cloud project as YouTube |
| Twitter / X | ✅ built | ⚠️ if `TWITTER_BEARER_TOKEN` | ❌ | Twitter Basic tier (paid) |
| Telegram | ✅ built (Bot API) | ⚠️ if `TELEGRAM_BOT_TOKEN` | ❌ | Bot must be added to channels — no public-channel search |
| Brand-submitted link | ✅ built | n/a | n/a | Generic HTML scrape of any URL |
| Instagram | ❌ stub (`return []`) | ❌ | ⏳ in settings as "Coming Soon" | Meta App Review required |
| Meta / Facebook | ❌ stub | ❌ | ❌ | Meta App Review required |
| TikTok | ❌ stub | ❌ | ❌ | TikTok Research API approval required |
| LinkedIn | ❌ stub (listening) | ❌ | ✅ live (OIDC, OAuth working) | OIDC for sign-in; content listening needs Partner access |
| Amazon Reviews | ⚠️ stub (calls external scraper) | ❌ | n/a | No public API — needs 3rd-party scraper subscription |
| Flipkart Reviews | ⚠️ stub (calls external scraper) | ❌ | n/a | Same — 3rd-party scraper subscription |

**Legend**: ✅ working today — ⚠️ ready, needs env var — ❌ stub or missing

---

## Reddit

- **Status**: Working out of the box. No setup needed.
- **API used**: `https://www.reddit.com/search.json?q=...` (public, unauthenticated).
- **Cost**: Free.
- **Approval**: None.
- **Env vars**: None.
- **Cron polled**: Yes — Reddit is the only always-on platform in
  `POLL_PLATFORMS`; `envOk: () => true`.
- **Rate limit**: Reddit rate-limits unauthenticated requests by IP +
  `User-Agent`. The adapter sets `User-Agent: earn4insights/1.0
  (social-listening)`. If volume grows past Reddit's tolerance, register
  a Reddit app (free) and use OAuth — but we're well below that threshold
  today.

---

## YouTube

- **Status**: Working when `YOUTUBE_API_KEY` is set. Used by **two** code
  paths: the `process-social-mentions` cron (search for product
  mentions) and the `sync-social-stats` cron (verify influencer
  subscriber counts via `channels.list?forHandle=...`).
- **API used**: YouTube Data API v3 — `search.list`, `videos.list`
  (statistics part), `channels.list`.
- **Cost**: Free — 10,000 quota units / project / day by default. Each
  `search.list` call = 100 units, each `videos.list` = 1 unit per ID.
  Quota increases are free if you fill out the request form.
- **Approval**: None.
- **Setup**:
  1. https://console.cloud.google.com → create or pick a project.
  2. APIs & Services → Library → enable **YouTube Data API v3**.
  3. APIs & Services → Credentials → Create credentials → API key.
  4. (Recommended) restrict the key to YouTube Data API v3 only.
- **Env var**: `YOUTUBE_API_KEY`.
- **Auto-activates**: Cron picks it up on the next scheduled run.

---

## Google Reviews (Google Places)

- **Status**: Adapter built; needs the Places API key.
- **API used**: Google Places API — `textsearch` (resolve `place_id`
  from product/brand name) + `details?fields=reviews`.
- **Cost**: Paid, but Google gives **$200/month free credit** per
  account that covers most usage. After credit: ~$17 per 1,000 Place
  Details requests with reviews. We cache for 24 h to minimise calls.
- **Approval**: None.
- **Setup**:
  1. Same Google Cloud project as YouTube is fine — Google Cloud
     bills + quotas per **project**, so co-locating them is convenient
     for audit; **separate keys** are still recommended for per-key
     restrictions and quota isolation.
  2. APIs & Services → Library → enable **Places API**.
  3. APIs & Services → Credentials → Create credentials → API key.
  4. (Recommended) restrict the key to Places API only.
  5. Add billing alerts so a runaway call rate doesn't blow past the
     free tier without warning.
- **Env var**: `GOOGLE_PLACES_API_KEY`.
- **Auto-activates**: Cron picks it up on the next scheduled run.

---

## Twitter / X

- **Status**: Adapter built; needs a bearer token. Not in cron registry
  yet because no token is configured — adding the env var is enough,
  the registry entry can be flipped on with one line if/when Twitter
  becomes a paid line item.
- **API used**: Twitter API v2 — `tweets/search/recent`.
- **Cost**: **Paid.** Free tier is read-very-limited; Basic tier is
  ~$100/month (subject to Twitter's pricing changes). Pro tier ~$5,000/month.
- **Approval**: Yes — Twitter developer account + project.
  Search/recent on the Basic tier returns up to 7 days of tweets and a
  monthly cap (currently ~10k tweets/month).
- **Setup**:
  1. https://developer.twitter.com → apply for a developer account.
  2. Create a Project + App. Subscribe to Basic tier (or above).
  3. App → Keys and tokens → generate **Bearer Token**.
- **Env var**: `TWITTER_BEARER_TOKEN`.
- **To enable in cron**: add a registry entry to `POLL_PLATFORMS` in
  `process-social-mentions/route.ts` next to YouTube/Reddit. The
  adapter is already imported and ready.

---

## LinkedIn

LinkedIn is in **two** places. They are independent.

### LinkedIn — consumer account linking (live today)

- **Status**: ✅ working. Users connect via Settings → Connected Accounts → LinkedIn.
- **API used**: OpenID Connect — `/oauth/v2/authorization` → `/oauth/v2/accessToken` → `/v2/userinfo`.
- **Cost**: Free.
- **Approval**: None — just add the **Sign In with LinkedIn using OpenID Connect** product to your LinkedIn app under Products. (The legacy "Sign In with LinkedIn" is retired and produces the "Bummer" error.)
- **Setup**:
  1. https://www.linkedin.com/developers/apps → create app (or pick existing).
  2. Auth tab → Redirect URLs → add
     `https://www.earn4insights.com/api/consumer/social/callback`.
     Click **Update** at the bottom of the section — it does not
     auto-save.
  3. Products tab → add **Sign In with LinkedIn using OpenID Connect**.
  4. Auth tab → copy Client ID and Client Secret.
- **Env vars** (all four must be set):
  - `LINKEDIN_CLIENT_ID` (server-side — used by `/api/consumer/social/callback`)
  - `LINKEDIN_CLIENT_SECRET` (server-side, never exposed)
  - `NEXT_PUBLIC_LINKEDIN_CLIENT_ID` (client-side — used by `getSocialOAuthUrl()` in `settings/page.tsx`; **same value** as `LINKEDIN_CLIENT_ID`)
  - `SOCIAL_OAUTH_REDIRECT_URI` = the exact redirect URL above
- **Scopes**: `openid profile email` (OIDC). The retired
  `r_liteprofile` / `r_emailaddress` scopes are no longer used.
- **Important**: `NEXT_PUBLIC_*` vars are inlined at build time, so an
  env-var change in Vercel requires a **rebuild**, not just a redeploy.
- **What we store at OAuth time**: from `/v2/userinfo`, the `sub` field
  (LinkedIn URN like `urn:li:person:abc123`) is captured into
  `consumer_social_connections.verified_subject`. This powers the
  Phase 4 handle-attribution lookup once LinkedIn listening goes live.

### LinkedIn — content listening (not yet built)

- **Status**: ❌ stub — `LinkedInAdapter.fetchMentions()` returns `[]`.
- **API used**: LinkedIn Marketing / Community Management API (Partner-tier).
- **Cost**: LinkedIn doesn't sell content-search APIs on the free
  developer tier. Partner access is application-only and selective.
- **Approval**: Yes — LinkedIn Partner Program. Long timeline (months),
  no published SLA, no guaranteed approval.
- **Env vars**: `LINKEDIN_ACCESS_TOKEN` (placeholder — current adapter
  reads this but returns `[]` regardless).
- **Auto-activates**: When real implementation is written, the
  `verified_subject` already stored on each connected account will
  immediately power attribution back to E4I users.

---

## Instagram

- **Status**: ❌ stub — `InstagramAdapter.fetchMentions()` returns `[]`.
  Settings page shows the row as "Coming Soon — pending Meta App Review".
- **API used**: Instagram Graph API (via a Facebook App in Advanced Access).
- **Cost**: Free API, but advanced permissions require approval.
- **Approval**: **Yes — Meta App Review**, ~4–6 weeks per CLAUDE.md.
  Requires a business Instagram account linked to a Facebook page.
  Instagram Basic Display API was deprecated in 2025 — use Graph API only.
- **Setup** (once approved):
  1. https://developers.facebook.com/apps → create App, type "Business".
  2. Link the Facebook page that owns your Instagram business account.
  3. Add the **Instagram Graph API** product.
  4. Request the permissions you actually need
     (e.g. `instagram_basic`, `instagram_manage_insights`,
     `pages_show_list`) and submit for review with screencasts.
  5. Once approved, generate a long-lived access token.
- **Env vars**: `INSTAGRAM_ACCESS_TOKEN`.
- **Cron registry**: Add an entry to `POLL_PLATFORMS` when the adapter
  is no longer a stub.

---

## Meta / Facebook

- **Status**: ❌ stub — `MetaAdapter.fetchMentions()` returns `[]`.
  Not shown in Settings.
- **API used**: Facebook Graph API — page/post search via a Facebook App.
- **Cost**: Free.
- **Approval**: **Yes — Meta App Review** for any read-access to
  pages/posts beyond your own.
- **Setup**: same Facebook App as Instagram. Add the **Page Public
  Content Access** permission (very high-bar review — Facebook
  routinely rejects without a clear journalistic / research use case).
- **Env vars**: `META_ACCESS_TOKEN`.

---

## TikTok

- **Status**: ❌ stub — `TikTokAdapter.fetchMentions()` returns `[]`.
- **API used**: TikTok Research API (or the limited Display API).
- **Cost**: Free.
- **Approval**: **Yes — TikTok gates the Research API to approved
  partners**, typically academic/research institutions. The Display API
  is for app-side integration only (login, post sharing) and doesn't
  expose search.
- **Setup** (long shot for non-academic use):
  1. https://developers.tiktok.com → developer portal.
  2. Apply for Research API access with detailed use-case docs.
  3. If denied, alternative: use a third-party scraper service (see
     Amazon section for the trade-offs).
- **Env vars**: `TIKTOK_API_KEY`.

---

## Amazon Reviews

- **Status**: ⚠️ stub — adapter calls an external scraper URL when
  configured. No API call when `AMAZON_SCRAPER_URL` is unset.
- **API used**: None — Amazon has **no public review API**. The adapter
  calls whatever service you configure at `AMAZON_SCRAPER_URL` (Apify,
  Bright Data, ScrapingBee, etc.) and expects it to return an array of
  `{ text, title, rating, author, helpful_count, ... }`.
- **Cost**: Paid — third-party scraper subscription. Pricing varies
  by service and review volume.
- **Approval**: None for the scraper, but scraping Amazon directly
  is a **ToS-grey area** — use a reputable provider that handles the
  legal exposure on their side.
- **Setup**:
  1. Pick a provider (Apify Amazon Reviews scraper, Bright Data
     Web Scraper IDE, ScrapingBee custom).
  2. Build or use a pre-built actor/recipe that takes `?asin=...` and
     returns `[{ text, title, rating, author, helpful_count, date,
     review_id, url }]`.
  3. Front the actor with an authenticated endpoint URL.
  4. Set `AMAZON_SCRAPER_URL` to that endpoint. The adapter
     also expects the product to have an `options.asin` passed in.
- **Env vars**: `AMAZON_SCRAPER_URL`.

---

## Flipkart Reviews

- **Status**: ⚠️ stub — same pattern as Amazon. Adapter calls
  `FLIPKART_SCRAPER_URL?product_id=...`.
- **API used**: None — Flipkart has no public review API.
- **Cost**: Paid — third-party scraper.
- **Approval**: None; same ToS-grey caveat as Amazon.
- **Env vars**: `FLIPKART_SCRAPER_URL`.

---

## Telegram

- **Status**: ✅ adapter built (`TelegramAdapter`) — Bot API only.
  Activates when `TELEGRAM_BOT_TOKEN` is set; cron polls it from
  Phase 1 onwards.
- **Honest scope first**: Telegram's Bot API can read messages only
  from channels/groups where the bot has been **added as a member or
  admin**. There is **no** `getPublicChannelHistory(@channelname)`
  endpoint. Broad public-channel monitoring across Telegram requires
  MTProto (see "Future considerations" below) and is intentionally
  out of scope.
- **Operational model**:
  1. Brand wants to monitor their own Telegram channel/community.
  2. Brand adds our bot (`@earn4insights_bot` or whatever you name it)
     as a member or admin to that channel/group.
  3. The bot reads new messages via `getUpdates` with an offset cursor
     stored in `telegram_bot_state.last_update_id`.
  4. Messages are filtered by brand keywords and ingested as
     `social_posts` with `platform = 'telegram'`.
- **API used**: `https://api.telegram.org/bot<TOKEN>/getUpdates`.
- **Cost**: Free.
- **Approval**: None.
- **Setup**:
  1. Telegram → search **@BotFather** → `/newbot`.
  2. Pick a name and username, e.g. `Earn4Insights Listener` /
     `@earn4insights_bot`.
  3. BotFather returns the bot token — set `TELEGRAM_BOT_TOKEN`.
  4. Run migration 020 if not done (`POST /api/admin/run-migration-020`).
  5. **Important**: send `/setprivacy` to BotFather and pick `Disable`
     for the bot — otherwise it only sees commands and @-mentions in
     groups, not the full message stream.
  6. Tell brands to add the bot to their channel/group. For channels
     it must be an **admin** (with at least "Post messages" off — it
     only needs read).
- **Env vars**: `TELEGRAM_BOT_TOKEN`.
- **Auto-activates**: Cron picks it up on the next scheduled run.
  Logged `[Social-Cron] Active: ..., telegram | ...`.

---

## Future considerations

### Telegram MTProto — not building

For broad **public-channel monitoring** across Telegram (channels we
haven't been invited into), the only path is **MTProto** — Telegram's
client protocol. The trade-offs:

- ✗ Requires a phone-number-authenticated session (we'd be acting as a
  user, not a bot).
- ✗ ToS-grey for automated monitoring; Telegram has blocked sessions
  that look like scrapers.
- ✗ Ban risk on the phone number — losing the session loses the
  history.
- ✗ Significantly more complex (~3 days build vs ~1 day for the
  Bot API adapter we already ship).
- ✗ Adds a heavyweight dep (e.g. `gramjs` ≈ 6 MB).

**Decision**: not built. Documented here so the trade-off is visible.
If a future use case justifies it, build it as a separate `mtproto/`
service with its own session storage and operate it carefully.

### LinkedIn listening

Once a Partner-tier API gives us a usable content endpoint, the
existing `LinkedInAdapter` stub flips to a real implementation. Each
returned post should carry `externalAuthorSubject = "urn:li:person:..."`
which `handleAttributionService` (Phase 4) will match against
`consumer_social_connections.verified_subject` — so attribution
activates the moment listening data starts flowing.

### Reddit / YouTube user-OAuth

Today we use brand-level API keys (or unauthenticated public endpoints)
for these. Adding **user-OAuth** flows would let consumers connect
their Reddit/YouTube identity, capture `verified_handle` (Reddit
username) and `verified_subject` (Reddit user id / YouTube channel id)
at OAuth completion, and have their public posts attributed back to
their account by the Phase 4 pipeline.

This is purely additive — no changes needed to the adapters or the
attribution service; just new OAuth callback routes that populate the
existing columns.

---

## Cron schedule reference

| Cron | Endpoint | Schedule | Platforms |
|---|---|---|---|
| Process social mentions | `/api/cron/process-social-mentions` | daily 05:30 UTC | env-gated registry (Reddit + YouTube + Google + Telegram) |
| Sync social stats | `/api/cron/sync-social-stats` | daily 04:30 UTC | YouTube only (influencer subscriber verification) |

See `vercel.json` for the canonical cron definitions.

---

## Where to look in the code

| Concern | File |
|---|---|
| Adapter implementations | `src/server/social/platformAdapters.ts` |
| Adapter registry (`ALL_ADAPTERS`) | bottom of the same file |
| Cron poll registry | `src/app/api/cron/process-social-mentions/route.ts` |
| Brand "Refresh data" path | `src/server/social/socialIngestionService.ts` |
| UI status badges | `src/app/dashboard/social/SocialPageClient.tsx` (`PLATFORM_OPTIONS`) |
| Consumer OAuth callback | `src/app/api/consumer/social/callback/route.ts` |
| Handle-attribution lookup (Phase 4) | `src/server/social/handleAttributionService.ts` *(arrives in Phase 4)* |
| Migration 020 (Telegram + verified handles) | `src/app/api/admin/run-migration-020/route.ts` |
