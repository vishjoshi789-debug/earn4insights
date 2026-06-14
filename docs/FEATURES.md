# Earn4Insights — Feature Catalog

> **Audience:** product managers, marketers, support staff, partners, new joiners.
> **Scope:** what each feature *does* for end users, who it's for, and how to access it. Engineering deep-dives live in `docs/FEATURE1`–`docs/FEATURE10` and `ARCHITECTURE.md`.
> **Status:** features in italics are functionally complete but pending external dependencies (API approvals, billing setup) or are intentionally hidden behind feature flags for launch.

---

## What is Earn4Insights?

An **Intelligence Operating System** for three audiences in one platform:

- **Consumers** earn points and rewards by sharing authentic feedback, taking surveys, claiming deals, and engaging with brands they care about.
- **Brands** turn that feedback into competitive advantage through AI-powered analytics, ideal-customer-profile (ICP) scoring, influencer campaigns, and competitive intelligence.
- **Influencers** discover paid brand campaigns, apply with proposals, deliver content, and get paid in their currency of choice.

Sign up at **https://www.earn4insights.com** as a consumer, brand, or influencer — three first-class roles. Dual-role accounts (e.g. consumer + influencer) are supported with a header role-switcher.

---

## Trust & Compliance Foundation

Every feature below sits on top of a privacy-first foundation:

- **Explicit, granular consent** — separate opt-in per data category (behavioural, demographic, social, sensitive). Independently revocable.
- **DPDP Act 2023 + GDPR compliant** — verified consent records with IP, user-agent, policy version, timestamp at grant time.
- **Email verification required** for financial actions — see [§ Email Verification](#email-verification).
- **Two-factor authentication** (TOTP) optional for credentials accounts.
- **Sensitive data encrypted** at rest with versioned AES-256-GCM keys.
- **Data export (DSAR)** — full personal-data export as PDF via the consumer dashboard, OTP-verified, GDPR Art. 15 compliant.
- **Right to be forgotten** — 30-day soft-delete window before physical deletion. Cascades all dependents.

---

# Consumer Features

The consumer experience is built around a simple promise: **share authentic feedback, earn meaningful rewards**.

## Feedback Submission

Submit multimodal feedback on any product — text, voice, video, or images.

- **For:** any logged-in consumer with a verified email
- **Where:** `/dashboard/submit-feedback` (or "Submit Feedback" in sidebar)
- **What you get:** 50 points per text feedback, bonuses for voice (×2) and video (×3). Sentiment + theme extraction shows up in your "My Feedback" history.
- **Anti-spam:** minimum length, duplicate detection, sentiment authenticity checks. Low-quality or repetitive submissions get rejected with friendly guidance.
- **Languages:** voice and video accepted in any language — automatic transcription + translation pipeline.

## Surveys & NPS

Answer brand-issued surveys for points. Surveys can be product-specific (NPS) or generic feedback questionnaires.

- **For:** logged-in consumers; surveys may be ICP-targeted (only shown to consumers who match the brand's ideal customer profile)
- **Where:** sent via in-app notification + optional email; visible in `/dashboard/surveys`
- **What you get:** variable point reward per question (brand-set)

## Rewards Catalogue

Redeem accumulated points for gift cards, brand vouchers, and exclusive experiences.

- **For:** verified-email consumers
- **Where:** `/dashboard/rewards`
- **What you get:** point balance → discrete reward tiers. Each redemption is recorded with full audit trail; gift-card codes delivered by email.

## Cash Out Points

Convert points to cash at a fixed rate (10 pts = ₹1, ₹5 minimum payout).

- **For:** any consumer with balance ≥ 500 points (₹50 minimum cash-out)
- **Where:** `/dashboard/payouts`
- **What you get:** brand reviews each payout request before approval; approved payouts processed via the active payout rail (RazorpayX coming soon for INR; Wise / PayPal stubs ready)

## Personalised Recommendations ("For You")

A signal-driven feed of products, deals, brands, and content most likely to be relevant.

- **For:** consumers who've granted personalization consent
- **Where:** `/dashboard/recommendations`
- **How:** ICP match scoring + recent behaviour + watchlist + social signals (if connected). All inputs visible at `/dashboard/my-signals`.

## Watchlist

Save products you care about and get alerts when prices drop, new feedback appears, or your watchlist hits a milestone.

- **For:** any consumer
- **Where:** "My Watchlist" in sidebar; watchlist toggle on any product card
- **What you get:** brand alerts (notification-channel of your choice) when triggers fire

## Community & Community Deals

Reddit-style feed of community-posted deals, discussions, and feedback threads.

- **For:** all roles
- **Where:** `/dashboard/community` (general) + `/dashboard/community-deals` (deal-specific)
- **Moderation:** community-driven flagging + admin review. Posts default to `pending` until approved.

## Brand Deals & Promo Codes

Discover exclusive brand-issued deals and promo codes. Each redemption awards points + (optionally) opens a redirect URL or copies a promo code.

- **For:** verified-email consumers
- **Where:** `/dashboard/deals` (or "Deals & Offers" in sidebar)
- **What you get:** 10 points per redemption + the actual brand discount

## Privacy & Consent Centre

Granular, per-category consent management. Revoke any category instantly without affecting others.

- **For:** any consumer
- **Where:** `/dashboard/privacy`
- **What you control:** Tier 1 (tracking, personalization, analytics, marketing), Tier 2 (behavioural, demographic, psychographic, social), Tier 3 (sensitive: health, dietary, religion, caste — India-specific)

## My Data Export (DSAR)

Download a complete PDF of every piece of personal data the platform holds about you. GDPR Art. 15.

- **For:** any consumer
- **Where:** `/dashboard/my-data`
- **Flow:** OTP-verified request → PDF generated → 7-day download link emailed to you. Rate-limited to 1 request per 30 days.

## Social Account Linking *(LinkedIn live; others pending platform approvals)*

Connect external accounts (LinkedIn, future: Instagram, YouTube, Reddit, etc.) so brands can offer better-targeted recommendations.

- **For:** consumers + influencers
- **Where:** `/dashboard/social`
- **What you get:** improved personalization + (for influencers) brand-discoverability via verified-handle attribution

## Become an Influencer (Cross-Role Upgrade)

Already a consumer? Upgrade your account to influencer in 6 guided steps without re-signing up.

- **For:** existing consumers
- **Where:** Settings → "Become an Influencer" card OR direct link `/onboarding?path=influencer`
- **What unlocks:** influencer marketplace, content management, payout accounts, earnings dashboard. Your consumer balance + history is preserved.

---

# Brand Features

Brands turn consumer signal into competitive advantage.

## Brand Onboarding Wizard

Multi-step setup capturing company details, billing info, audience targeting, ICP basics.

- **For:** new brand signups; existing brands see a banner prompting completion
- **Where:** `/onboarding` (forced for new brands)
- **What unlocks:** invoicing, better influencer matching, full analytics surface

## Feedback Hub

Aggregated, AI-analysed feedback on all your products in one view. Sentiment trends, theme extraction, individual response browsing.

- **For:** brands
- **Where:** `/dashboard/feedback`
- **What you get:** product-scoped dashboards (no platform-wide leakage), sentiment time-series, AI-extracted themes, full-text search

## ICP Profiles (Ideal Consumer Profile)

Define what your ideal customer looks like across demographic, behavioural, and psychographic dimensions. Every consumer gets scored against every active ICP.

- **For:** brands
- **Where:** `/dashboard/brand/icps`
- **What you get:** match-score gradient (Great / Good / Fair Match) on every consumer's response or feedback. ICP weights must sum to 100 (hard-enforced). Cohort floor of 5 prevents re-identification.

## Audience Analytics

Demographics, behavioural cohorts, and engagement breakdowns scoped to your products.

- **For:** brands
- **Where:** `/dashboard/analytics`
- **Privacy floor:** 5-user minimum cohort. Smaller segments are masked.

## Consumer Intelligence

AI-generated insight cards on what your audience cares about, common pain points, sentiment shifts.

- **For:** brands
- **Where:** `/dashboard/analytics/consumer-intelligence`
- **Frequency:** 3 insights per brand per day (cost-capped via gpt-4o-mini)

## Feature Insights & Weekly Digest

Per-feature adoption metrics + weekly summary email/dashboard.

- **For:** brands
- **Where:** `/dashboard/analytics/feature-insights`, `/dashboard/analytics/weekly-digest`

## Category Intelligence

What's happening in your broader product category — trends across competitors, emerging themes.

- **For:** brands
- **Where:** `/dashboard/analytics/category-intelligence`

## Competitive Intelligence Dashboard

Six-dimension competitive scoring, AI-generated insights, alert detection on competitor moves.

- **For:** brands
- **Where:** `/dashboard/brand/competitors` (via Competitive Intelligence)
- **What you get:** AI insights (3/day cap), automated alert detection on price moves / new launches / consumer-switching signals, daily digest email, full weekly strategic report

## Alert Rules

Configure custom alerts on feedback volume, sentiment shifts, watchlist milestones, frustration spikes.

- **For:** brands
- **Where:** `/dashboard/alerts`
- **Channels:** email, in-app, *(WhatsApp pending launch flag)*

## Surveys & NPS

Create and distribute targeted surveys. ICP-target to specific consumer segments.

- **For:** brands
- **Where:** `/dashboard/surveys`

## Influencer Campaigns

Run paid influencer campaigns end-to-end — invite or marketplace, escrow payment, content review with SLAs, milestone-based payouts.

- **For:** verified-email brands
- **Where:** `/dashboard/brand/campaigns`
- **What you get:** create as draft → invite specific influencers OR publish to marketplace → review SLA-driven content approvals → release escrow → influencer paid in their chosen currency

## Discover Influencers

Search the platform's influencer base by niche, follower count, audience demographics, ICP fit.

- **For:** brands
- **Where:** `/dashboard/brand/influencers`

## Content Review Queue

Review influencer-submitted content within configurable SLA windows. Auto-approve option for trusted partners.

- **For:** brands running campaigns with Review SLAs
- **Where:** `/dashboard/brand/content-review`
- **Reminders:** 75% / 90% / 100% of SLA window — campaign cron sends reminder emails. Auto-approval kicks in at 100% if enabled.

## Manage Deals

Issue brand deals — promo codes, percentage discounts, fixed-amount, BOGO. Schedule launch/expiry.

- **For:** brands
- **Where:** `/dashboard/brand/deals`
- **What you get:** deal-level analytics (views, redemptions, conversion), ICP-target deals to specific consumer segments

## Product Launch (Instant or Scheduled)

Launch a product immediately or schedule for a future wall-clock time. Side-effects (brand confirmation email, smart distribution, watchlist fan-out) fire only when actually live.

- **For:** brands
- **Where:** `/dashboard/launch`
- **Scheduled launches:** 1h minimum delay, ~15min publish cadence

## Plans & Pricing

View your current plan, usage limits, and upgrade paths.

- **For:** brands
- **Where:** `/dashboard/pricing`

## Product Deep Dive Analytics

Per-product analytics page with detailed sentiment / theme / signal breakdowns.

- **For:** brands
- **Where:** `/dashboard/detailed-analytics`

## Import Data

Bulk-upload existing customer feedback to seed your dashboard.

- **For:** brands
- **Where:** `/dashboard/import`

---

# Influencer Features

The influencer surface launched in **Phase 3.5** as a first-class signup option (no longer a "consumer who's also influencer" upgrade-only path).

## Influencer Onboarding Wizard

6-step guided setup capturing niche, audience platforms, follower counts, content portfolio, payout preferences.

- **For:** new influencer signups (and consumer-to-influencer upgrades)
- **Where:** `/onboarding`
- **What unlocks:** marketplace, applications, content management, earnings, payouts

## Influencer Dashboard Home

Dedicated dashboard with profile-completeness breakdown, active campaign summary, recent earnings preview.

- **For:** influencers (primary role or dual-role)
- **Where:** `/dashboard` (influencer view) — toggle via header role-switcher for dual-role users

## Campaign Marketplace

Browse public brand campaigns. Filter by platform, budget, deadline. Recommended-for-you tab uses niche overlap.

- **For:** verified-email influencers (consumer + influencer dual-role also supported)
- **Where:** `/dashboard/influencer/marketplace`
- **What you get:** ICP match badges (Great / Good / Fair) when a campaign has ICP targeting + your match is computed. Apply with proposal + proposed rate in your currency.

## My Campaigns

Active and past campaigns you've been invited to or accepted via marketplace.

- **For:** influencers
- **Where:** `/dashboard/influencer/campaigns`

## My Content

Submitted content tracked against milestones, review status, approval audit trail.

- **For:** influencers
- **Where:** `/dashboard/influencer/content`
- **What you get:** @ tag system (brands, products, categories, influencers) for content authenticity + cross-linking

## Earnings Dashboard

Multi-currency earnings breakdown (per-currency totals, not summed — summing across currencies is meaningless). Audience intelligence panel showing demographic mix of your past engagement (consent-gated, 5-user cohort floor).

- **For:** influencers
- **Where:** `/dashboard/influencer/earnings`

## Payout Accounts

Configure how you receive campaign payments — Indian bank account, UPI, PayPal, Wise, SWIFT/IBAN.

- **For:** verified-email influencers
- **Where:** `/dashboard/influencer/payouts`
- **Currencies:** INR (Razorpay), USD/EUR/GBP (Wise — *pending API integration*), generic SWIFT
- **Security:** account numbers + IBANs encrypted at rest; last-4 visible after decryption

## Influencer Profile

Public-facing profile with bio, niche, portfolio, audience stats. Surfaces to brands in Discover Influencers.

- **For:** influencers
- **Where:** `/dashboard/influencer/profile`

## Get Verified (Influencer Verification)

Apply for a verified badge that appears on every campaign application and gives higher visibility in brand search. Three-tier auto-approval:

- **Auto-approved** (instant) — all 8 profile requirements met + 1,000+ followers across platforms
- **Manual review** (a few business days) — basics met but borderline; our team reviews
- **Auto-rejected** (no cooldown) — hard-floor checks failed (no photo, very short bio, no social handles, brand-new account); fix and re-submit any time
- **For:** verified-email influencers (consumer + influencer dual-role also supported)
- **Where:** `/dashboard/influencer/verification`
- **What you get:** live 8-check checklist showing your readiness; submit form with optional application message + referral notes + portfolio links; status card with cooldown info if rejected
- **Decision emails:** auto-approved / under review / approved / rejected (with reason + 30-day reapply date) / needs-info — all branded, mobile-responsive
- **Cooldown:** rejected manually = 30 days before re-applying. Hard-floor auto-reject = no cooldown (the user knows what to fix)

---

# Shared / Cross-Cutting Features

## Email Verification

Required for all financial actions (feedback submission, rewards redemption, deal claims, campaign apply, payout setup, brand campaigns, payments).

- **For:** all roles
- **Auto-sent:** at signup; Google OAuth users are auto-verified
- **Flow:** Click link in email → `/verify-email` → auto-redirect to dashboard
- **5-layer nudge system** for unverified users: dashboard banner, per-page banner, sidebar lock icons, button intercepts, global modal. None aggressive; all dismissable or hide on verification.
- **Settings:** `/dashboard/settings` shows verification status with [Resend] button
- See `docs/FEATURE10_EMAIL_VERIFICATION_AND_ROLE_GUARDS.md` for technical deep-dive.

## Two-Factor Authentication (TOTP)

Optional for credentials accounts (Google OAuth users rely on Google's own 2FA).

- **For:** credentials sign-up accounts
- **Where:** Settings → "Two-Factor Authentication" card
- **Flow:** scan QR with any TOTP app (Google Authenticator, 1Password, Authy), confirm setup, save recovery codes. Next login requires the 6-digit code.
- **"Trust this device"** option skips 2FA for 30 days per device.
- See `docs/FEATURE9_TWO_FACTOR_AUTH.md` for technical deep-dive.

## Notifications

Per-channel preferences (email, in-app, *WhatsApp pending launch flag*) with frequency controls (instant, daily digest, weekly) and quiet-hours.

- **For:** all roles
- **Where:** `/dashboard/settings` notifications section
- **Channels covered:** feedback alerts, watchlist updates, campaign updates, payout notifications, deal redemption confirmations, survey invitations

## Settings

Single account-settings page covering profile, password, 2FA, notification preferences, social connections, role-specific options (Become an Influencer, etc.).

- **For:** all roles
- **Where:** `/dashboard/settings`

## Customer Support

In-app help via floating chat widget, knowledge base, and ticket system.

- **AI chatbot** at the floating button (bottom-right) — semantic FAQ matching via vector search; escalates to ticket when needed
- **Knowledge base** at `/help` — searchable, SEO-indexed FAQ articles
- **Email support** — `contact@earn4insights.com` (replies routed to admin queue with E4I-XXXX ticket numbers)
- **For:** all users (logged-in or not)
- See `docs/FEATURE7_SUPPORT_SYSTEM.md` for technical deep-dive.

## Cookie Consent

GDPR-compliant cookie consent banner shown on first visit. Analytics gated on consent.

- **For:** all visitors
- **Where:** banner appears on first visit; preferences re-settable via footer link

## Role Switcher (Dual-Role Users)

Header role-switcher for users who hold multiple roles (e.g. consumer + influencer). Sidebar updates to show that role's items only.

- **For:** dual-role users
- **Where:** header dropdown next to user menu
- **Note:** brand accounts are intentionally single-role (paid business sign-up; no auto-upgrade)

---

# Admin Features (Platform Operations)

Admin users (single platform-operator role) see seven admin-only nav items plus all shared tabs:

| Admin surface | Purpose |
|---|---|
| `/admin/platform-analytics` | Founder dashboard — DAU/MAU, retention cohorts, MRR/LTV/ARPU, runway, health score (6-factor weighted), growth predictions |
| `/admin/analytics` | Traffic analytics (raw event logs) |
| `/admin/payouts` | Manual payout queue (until RazorpayX Payouts API is active) |
| `/admin/community-deals` | Moderation queue for community-submitted deal posts (auto-hide at 5 flags) |
| `/admin/campaigns/schedule` | Manual campaign content schedule |
| `/admin/campaigns/analytics` | Aggregate campaign performance |
| `/admin/send-time-optimization` | AI-driven optimal send-time per consumer |
| `/admin/send-time-analytics` | Send-time A/B results |
| `/admin/support` | Support ticket queue + analytics |
| `/admin/verification-requests` | Influencer verification queue — review manual_review submissions; approve / reject (with 30-day cooldown) / request more info. Sidebar shows unread count badge. |

Admin role bypasses role-based layout guards (can view any `/dashboard/*` surface), but is hidden from consumer/brand/influencer sidebars (consistent UI per role).

---

# Feature Flags (Launch-Time Toggles)

Certain features are intentionally hidden behind flags for the initial launch. Flipping the flag in Vercel + redeploy re-exposes the UI:

| Flag | Default | What it hides |
|---|---|---|
| `NEXT_PUBLIC_WHATSAPP_ENABLED` | `false` | Onboarding Step 5 (WhatsApp opt-in), settings WhatsApp card, alert-rules WhatsApp column. Twilio code + DB + migration retained. |
| `ADMIN_DIAGNOSTICS_ENABLED` | `false` | `/api/admin/diagnostics/*` routes return bare 404 (existence not discoverable) |
| `YOUTUBE_API_KEY` (presence) | unset | Activates YouTube social listener in `process-social-mentions` cron |
| `GOOGLE_PLACES_API_KEY` (presence) | unset | Activates Google Reviews listener |
| `TELEGRAM_BOT_TOKEN` (presence) | unset | Activates Telegram bot listener |
| `RAZORPAYX_ENABLED` (server code) | `false` | All payouts go through admin manual queue. When `true`: automatic INR payouts via RazorpayX. |

---

# Where to find the engineering deep-dives

Per-feature technical docs live under `docs/`:

- `docs/FEATURE1_HYPERPERSONALIZATION.md` — Consent, encryption, ICP scoring algorithm
- `docs/FEATURE2_INFLUENCERS_ADDA.md` — Campaign lifecycle, escrow, content approval, @ tags
- `docs/FEATURE3_REALTIME.md` — Pusher, 31 events, presence
- `docs/FEATURE4_COMPETITIVE_INTELLIGENCE.md` — 9 tables, 6-dimension scoring, AI insights
- `docs/FEATURE5_DEALS_COMMUNITY.md` — 9 tables, moderation, FK CASCADE
- `docs/FEATURE6_DSAR.md` — OTP flow, PDF, Vercel Blob, 30-day rate limit
- `docs/FEATURE7_SUPPORT_SYSTEM.md` — Chatbot, KB, ticket workflow
- `docs/FEATURE8_PLATFORM_ANALYTICS.md` — DAU/MAU, cohorts, health score, OLS forecast
- `docs/FEATURE9_TWO_FACTOR_AUTH.md` — TOTP, `requires2FA` interlock, trusted devices
- `docs/FEATURE10_EMAIL_VERIFICATION_AND_ROLE_GUARDS.md` — Email verification 5-layer system + role guards
- `docs/FEATURE11_INFLUENCER_VERIFICATION.md` — Influencer verification 3-tier auto-approval + admin queue + 6 email templates
- `docs/SOCIAL_PLATFORM_SETUP.md` — Per-platform listener setup (status, API, env vars)
- `docs/CRON_JOBS.md` — All 32 cron entries
- `docs/SCHEMA.md` — All DB table definitions

For overall system architecture: `ARCHITECTURE.md` (root).
For historical context + decision archive: `docs/CLAUDE_HISTORY.md`.
For the pre-launch audit fix log: `docs/PRELAUNCH_AUDIT_FIX_LOG.md`.
