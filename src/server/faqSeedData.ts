import 'server-only'

import type { NewFaqArticle } from '@/db/schema'

/**
 * Initial FAQ knowledge base. Loaded once via POST /api/admin/seed-faq.
 * Idempotent: seed route skips slugs that already exist.
 *
 * Conventions:
 *   - `target_roles: []` means visible to all roles (brand, consumer, influencer).
 *   - `category` matches the union in schema.ts.
 *   - `content` is markdown; the chatbot trims/renders it.
 *   - `display_order` orders cards within a category — lower = first.
 */

type SeedArticle = Omit<NewFaqArticle, 'id' | 'createdAt' | 'updatedAt'>

export const FAQ_SEED_ARTICLES: SeedArticle[] = [
  // ── Getting Started — Brand ──────────────────────────────────────
  {
    slug: 'brand-launch-first-product',
    title: 'How to launch your first product',
    excerpt: 'A step-by-step guide to launching your first product on Earn4Insights.',
    content: `## Launch your first product

1. Go to **Dashboard → Products → Launch Product**.
2. Fill in the product name, description, category, and upload at least one image.
3. Select the **launch type**: instant launch, or scheduled launch on a specific date.
4. Confirm and submit. Consumers matching your ICP will be notified within a few minutes.

You can edit product details at any time from **Dashboard → Products**.`,
    category: 'getting_started',
    targetRoles: ['brand'],
    tags: ['product', 'launch', 'onboarding'],
    displayOrder: 1,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },
  {
    slug: 'brand-create-survey',
    title: 'Creating your first survey',
    excerpt: 'Build targeted surveys to collect consumer feedback at scale.',
    content: `## Create a survey

1. Navigate to **Dashboard → Surveys → New Survey**.
2. Add questions — multiple choice, rating, or open text.
3. Optionally attach an **ICP profile** to target a specific audience segment.
4. Set a points reward per response (default: 50 points).
5. Publish. Eligible consumers will see the survey in their dashboard.

Responses appear in real time and are downloadable as CSV.`,
    category: 'getting_started',
    targetRoles: ['brand'],
    tags: ['survey', 'feedback'],
    displayOrder: 2,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },
  {
    slug: 'brand-setup-icp',
    title: 'Setting up an ICP (Ideal Consumer Profile)',
    excerpt: 'Define the consumer segments most valuable to your brand.',
    content: `## Set up an ICP

An ICP defines who your "ideal consumer" looks like using weighted criteria.

1. Open **Dashboard → ICPs → Create ICP**.
2. Add criteria — age range, interests, lifestyle, behavior. Each criterion has a **weight (0–100)**.
3. **Important:** weights must sum to exactly **100**.
4. Save. Earn4Insights scores every consenting consumer against your ICP and produces a 0–100 match score.

ICPs power product targeting, survey distribution, and competitive benchmarking.`,
    category: 'getting_started',
    targetRoles: ['brand'],
    tags: ['icp', 'targeting'],
    displayOrder: 3,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },
  {
    slug: 'brand-understand-consumer-intelligence',
    title: 'Understanding consumer intelligence',
    excerpt: 'What signals we capture and how they power your insights.',
    content: `## Consumer intelligence

Earn4Insights aggregates four signal categories per consenting consumer:

- **Behavioral** — engagement, feedback frequency, sentiment patterns
- **Demographic** — age range, country, profession (with explicit consent)
- **Psychographic** — values, lifestyle, aspirations
- **Social** — interests inferred from connected accounts

All signals are **consent-gated** — consumers who haven't granted a category are excluded from that dimension. We never penalize you for sparse consent; missing signals are normalized upward.

A minimum cohort of **5 consumers** is enforced on every audience query to prevent re-identification.`,
    category: 'getting_started',
    targetRoles: ['brand'],
    tags: ['intelligence', 'signals', 'privacy'],
    displayOrder: 4,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },
  {
    slug: 'brand-create-campaign',
    title: 'How to create an influencer campaign',
    excerpt: 'Launch a paid influencer campaign with milestone-based escrow.',
    content: `## Create an influencer campaign

1. Go to **Dashboard → Campaigns → New Campaign**.
2. Fill in the brief: deliverables, niche, budget, timeline.
3. Choose **invite-only** (pick specific influencers) or **public marketplace** (anyone matching your ICP can apply).
4. Set milestones — each milestone has a deliverable, due date, and payout amount.
5. Fund the campaign via **Razorpay** — funds are held in escrow until milestones are approved.
6. Review applications or invite influencers directly.

Payouts release automatically when you approve each milestone.`,
    category: 'campaigns',
    targetRoles: ['brand'],
    tags: ['campaign', 'influencer', 'payment'],
    displayOrder: 1,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },
  {
    slug: 'brand-payment-methods',
    title: 'Setting up payment methods (brand)',
    excerpt: 'Add a payment method so you can fund campaigns and rewards.',
    content: `## Payment methods

Earn4Insights uses **Razorpay** for all payments.

1. Go to **Dashboard → Settings → Billing**.
2. When you fund a campaign or reward pool, you'll be redirected to Razorpay's secure checkout.
3. Supported methods: UPI, credit/debit card, net banking, wallets (India).
4. Card details are never stored on Earn4Insights — they live with Razorpay.

You can download invoices for every transaction from **Billing → Invoices**.`,
    category: 'payments',
    targetRoles: ['brand'],
    tags: ['payment', 'razorpay', 'billing'],
    displayOrder: 1,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },

  // ── Getting Started — Consumer ───────────────────────────────────
  {
    slug: 'consumer-earn-points',
    title: 'How to earn reward points',
    excerpt: 'Earn points by completing feedback, surveys, deals, and community activity.',
    content: `## Earn reward points

You can earn points in several ways:

- **Submit feedback** on products you've used (typically 20–100 points per piece)
- **Complete surveys** matching your profile (50+ points per response)
- **Redeem deals** from the Deals section (10 points per redemption)
- **Post in the Community** — quality posts earn bonus points after moderation
- **Refer a friend** — both you and your friend earn points

**Exchange rate: 10 points = ₹1.** Redeem points as platform credits, vouchers, or cash payouts once you reach the minimum.`,
    category: 'getting_started',
    targetRoles: ['consumer'],
    tags: ['points', 'rewards'],
    displayOrder: 1,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },
  {
    slug: 'consumer-submit-feedback',
    title: 'Submitting your first feedback',
    excerpt: 'How to share feedback on products you have used.',
    content: `## Submit feedback

1. Open **Dashboard → Feedback → Submit**.
2. Search for the product, or scan its QR code if you have one.
3. Rate the product (1–5 stars), add your written feedback, and optionally upload photos or a short video.
4. Submit. Points are credited within a few minutes once moderation completes.

Your feedback is anonymous to the brand — they see aggregated signals, never your name or contact.`,
    category: 'feedback',
    targetRoles: ['consumer'],
    tags: ['feedback', 'first-time'],
    displayOrder: 1,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },
  {
    slug: 'consumer-browse-deals',
    title: 'Browsing and redeeming deals',
    excerpt: 'Find and redeem deals from your favourite brands.',
    content: `## Browse and redeem deals

1. Open **Dashboard → Deals**.
2. Filter by category, brand, or sort by newest/most popular.
3. Click a deal to view its details.
4. **Promo code deals**: click "Copy code" to copy and redirect to the brand.
5. **Redirect deals**: click "Get deal" to be taken to the brand's offer page.

Every redemption awards **10 points**.`,
    category: 'deals',
    targetRoles: ['consumer'],
    tags: ['deals', 'redeem', 'points'],
    displayOrder: 1,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },
  {
    slug: 'consumer-join-community',
    title: 'Joining the community',
    excerpt: 'Reddit-style community feed for deals, reviews, and discussion.',
    content: `## Community

1. Open **Dashboard → Community**.
2. Vote, comment, save, or share posts about deals, product reviews, and discussions.
3. To post, click **New Post**. Choose a type — Deal, Review, Discussion, or Alert.
4. All posts go through moderation before becoming public (typically within a few hours).
5. Posts with **5 or more flags** are auto-hidden pending admin review.

Quality contributions earn bonus points after approval.`,
    category: 'community',
    targetRoles: ['consumer'],
    tags: ['community', 'posts', 'moderation'],
    displayOrder: 1,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },
  {
    slug: 'consumer-request-data-dsar',
    title: 'Requesting your data (DSAR)',
    excerpt: 'Get a formal report of all data Earn4Insights holds about you (GDPR Art. 15).',
    content: `## Request your data (DSAR)

Under GDPR Article 15, you can request a complete report of all personal data we hold about you.

1. Go to **Dashboard → My Data → Request Data Report**.
2. We email a 6-digit verification code (valid for 15 minutes).
3. Enter the code to confirm identity.
4. We generate a PDF report covering all 13 data tables and email you a download link (valid for 7 days).

Limits:
- One DSAR per **30 days** to prevent abuse
- The PDF is attached to the email if it's under 10 MB; otherwise the email contains a download link

For instant JSON export (no OTP), use **Dashboard → My Data → Download JSON**.`,
    category: 'privacy',
    targetRoles: ['consumer'],
    tags: ['gdpr', 'dsar', 'data-export', 'privacy'],
    displayOrder: 1,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },
  {
    slug: 'consumer-personalization',
    title: 'How personalization works',
    excerpt: 'What signals we collect, what brands see, and how to control it.',
    content: `## How personalization works

We aggregate four signal categories per consenting consumer:

- **Behavioral** — your activity patterns
- **Demographic** — age range, country, profession (only if you opt in)
- **Psychographic** — values, lifestyle, aspirations
- **Social** — interests inferred from connected accounts

You can **revoke any category at any time** from **Dashboard → Privacy**. Revoking sensitive categories also soft-deletes the related data, and we physically delete it 30 days later (grace period for accidents).

Brands only ever see **aggregated, cohort-gated** insights — never your individual data, name, or contact.`,
    category: 'privacy',
    targetRoles: ['consumer'],
    tags: ['personalization', 'consent', 'privacy'],
    displayOrder: 2,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },

  // ── Getting Started — Influencer ─────────────────────────────────
  {
    slug: 'influencer-setup-profile',
    title: 'Setting up your influencer profile',
    excerpt: 'Create your public influencer profile to attract campaigns.',
    content: `## Set up your influencer profile

1. Open **Dashboard → Influencer → Profile**.
2. Fill in your niche (beauty, tech, food, etc.), platforms you create on, and rate cards.
3. Connect your social accounts where supported (LinkedIn live; Instagram pending platform approval).
4. Submit for verification — verified influencers get a badge and higher campaign match rates.

Tip: complete your profile fully before applying to campaigns. Brands strongly favour complete profiles.`,
    category: 'influencer',
    targetRoles: ['consumer'],
    tags: ['influencer', 'profile', 'onboarding'],
    displayOrder: 1,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },
  {
    slug: 'influencer-marketplace',
    title: 'Finding campaigns in the marketplace',
    excerpt: 'Browse public campaigns and apply to the ones that match.',
    content: `## Campaign marketplace

1. Open **Dashboard → Influencer → Marketplace**.
2. Browse public campaigns filtered by niche, budget, and content type.
3. **Recommended** campaigns are filtered to your niche overlap.
4. **Great/Good/Fair Match** badges appear when the brand's ICP matches your audience.
5. Click **Apply** — write a short proposal and (optionally) propose a custom rate.
6. The brand will review and accept, reject, or message you with questions.

Only one application per campaign — be thoughtful.`,
    category: 'influencer',
    targetRoles: ['consumer'],
    tags: ['marketplace', 'apply', 'campaigns'],
    displayOrder: 2,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },
  {
    slug: 'influencer-submit-content',
    title: 'Submitting content for approval',
    excerpt: 'Upload your campaign content for brand review.',
    content: `## Submit campaign content

1. From your accepted campaign, click **Submit Content** on the relevant milestone.
2. Upload your content (image, video, or text post).
3. Add a short note describing the post and where it will be published.
4. Submit. The brand has a defined SLA (set on the campaign) to review.

Outcomes:
- **Approved** → you can publish, payment moves to release queue
- **Rejected** → revise based on the brand's notes and resubmit
- **Auto-approved** → if the brand has auto-approve enabled and doesn't respond by SLA end`,
    category: 'influencer',
    targetRoles: ['consumer'],
    tags: ['content', 'approval', 'sla'],
    displayOrder: 3,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },
  {
    slug: 'influencer-earnings',
    title: 'Understanding your earnings',
    excerpt: 'How your earnings are calculated and when you get paid.',
    content: `## Your earnings

Earnings are tracked **per currency** — campaigns can pay in INR, USD, GBP, etc., and we never sum across currencies (it would be meaningless).

A platform fee is deducted from each milestone payout:
- **Milestone campaigns: 8%**
- **Direct (one-shot) campaigns: 12%**
- **Escrow/standard: 10%**

Payouts are initiated when the brand approves a milestone. Processing time depends on your payout method (3–5 business days for bank transfers in India).

See **Dashboard → Influencer → Earnings** for the live breakdown by campaign, currency, and status.`,
    category: 'influencer',
    targetRoles: ['consumer'],
    tags: ['earnings', 'payout', 'fees'],
    displayOrder: 4,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },
  {
    slug: 'influencer-payout-accounts',
    title: 'Setting up payout accounts',
    excerpt: 'Add a bank account, UPI, or international payout destination.',
    content: `## Payout accounts

1. Open **Dashboard → Influencer → Payouts → Payout Accounts**.
2. Click **Add Account** and choose a type:
   - **Bank Account** (India)
   - **UPI**
   - **Wise** (international)
   - **PayPal** (international)
3. Enter the details. Sensitive fields (account number, IBAN, UPI ID) are encrypted at rest.
4. Mark one account as **primary per currency**.

Note: Wise and PayPal payouts are processed manually by our team until those integrations go live.`,
    category: 'influencer',
    targetRoles: ['consumer'],
    tags: ['payout', 'bank', 'upi'],
    displayOrder: 5,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },
  {
    slug: 'influencer-icp-matching',
    title: 'How ICP matching works for influencers',
    excerpt: 'Why some campaigns show "Great Match" and how to improve yours.',
    content: `## ICP matching

When a brand creates a campaign, they can attach an **ICP** — the consumer profile they want reached.

If we have an ICP match score for you (via your audience or your own consumer profile if you also use the platform as a consumer), we display:

- **Great Match** (80+)
- **Good Match** (60–79)
- **Fair Match** (40–59)
- No badge when we can't compute a meaningful score

To improve match rates: keep your influencer profile complete, connect social accounts (where supported), and ensure your niche tags accurately reflect your audience.`,
    category: 'influencer',
    targetRoles: ['consumer'],
    tags: ['icp', 'match', 'algorithm'],
    displayOrder: 6,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },

  // ── Payments & Billing (shared) ─────────────────────────────────
  {
    slug: 'payments-platform-fees',
    title: 'Understanding platform fees',
    excerpt: 'How much Earn4Insights takes per transaction.',
    content: `## Platform fees

| Campaign type | Platform fee |
|---------------|--------------|
| Milestone-based | **8%** |
| Direct (one-shot) | **12%** |
| Escrow / standard | **10%** |

Fees are deducted from the brand's payment before the influencer is paid. Brands see the full breakdown on the campaign payment screen.

For specific billing questions or custom enterprise pricing, please contact our team via a support ticket.`,
    category: 'payments',
    targetRoles: [],
    tags: ['fees', 'pricing'],
    displayOrder: 2,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },
  {
    slug: 'payments-refunds',
    title: 'Requesting a refund',
    excerpt: 'How refunds work and how to request one.',
    content: `## Refunds

**Campaign refunds (brand):**
- Full refund if the influencer fails to deliver
- Partial refund proportional to undelivered milestones
- No refund after content has been approved and published
- Cancel before influencer accepts → 100% refund
- Cancel during active engagement → 50% refund

**Processing time:** approved refunds reach the original payment method within **5–7 business days**.

**Consumer rewards:** points and redeemed rewards are **non-refundable**.

To request a refund, please raise a support ticket — our team responds within 24–48 hours.`,
    category: 'payments',
    targetRoles: [],
    tags: ['refund', 'cancellation', 'policy'],
    displayOrder: 3,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },
  {
    slug: 'payments-reward-redemption',
    title: 'Redeeming consumer rewards',
    excerpt: 'How to convert your reward points into credits, vouchers, or cash.',
    content: `## Redeem rewards

**Exchange rate: 10 points = ₹1**

From **Dashboard → Rewards**, you can redeem points in three ways:

1. **Platform credits** — instant, no minimum
2. **Brand vouchers** — partner-specific (Amazon, Flipkart, etc.)
3. **Cash payout** — bank transfer or UPI; minimum payout threshold applies

Once redeemed, the transaction is non-reversible. Expired points cannot be reinstated — check expiry terms in your rewards dashboard.`,
    category: 'payments',
    targetRoles: ['consumer'],
    tags: ['rewards', 'redemption', 'cash'],
    displayOrder: 4,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },
  {
    slug: 'payments-processing-times',
    title: 'Payment processing times',
    excerpt: 'How long different payment operations take.',
    content: `## Processing times

| Operation | Time |
|-----------|------|
| Brand → Campaign escrow funding | Instant after Razorpay confirms |
| Milestone approval → Influencer payout initiation | Same day |
| Influencer payout (India, bank/UPI) | 3–5 business days |
| Influencer payout (international, manual) | 5–10 business days |
| Refund to brand | 5–7 business days |
| Consumer reward — platform credits | Instant |
| Consumer reward — cash payout | 3–5 business days |

International payouts (Wise, PayPal) are currently processed manually by our team.`,
    category: 'payments',
    targetRoles: [],
    tags: ['processing', 'times', 'payout'],
    displayOrder: 5,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },

  // ── Account & Privacy ────────────────────────────────────────────
  {
    slug: 'account-update-profile',
    title: 'Updating your profile',
    excerpt: 'How to edit your account details, photo, and preferences.',
    content: `## Update your profile

1. Open **Dashboard → Settings → Profile**.
2. Edit your name, photo, location, bio, and other details.
3. Click **Save**.

Changes take effect immediately. Your email address can be changed but requires re-verification.`,
    category: 'account',
    targetRoles: [],
    tags: ['profile', 'settings'],
    displayOrder: 1,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },
  {
    slug: 'account-notifications',
    title: 'Changing notification preferences',
    excerpt: 'Control what notifications you receive and where.',
    content: `## Notification preferences

Open **Dashboard → Settings → Notifications**.

For each event type, you can toggle:
- **In-app** (always recommended — used for unread badges)
- **Email**
- **SMS** (where supported)

You can change preferences anytime. Critical notifications (security, payment confirmations) cannot be disabled.`,
    category: 'account',
    targetRoles: [],
    tags: ['notifications', 'email', 'sms'],
    displayOrder: 2,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },
  {
    slug: 'account-whatsapp',
    title: 'Enabling WhatsApp notifications',
    excerpt: 'Verify your phone to receive WhatsApp alerts.',
    content: `## WhatsApp notifications

1. Open **Dashboard → Settings → Notifications**.
2. In the WhatsApp section, enter your phone number in international format (e.g. +91…).
3. Click **Send code**. We send a 6-digit OTP via WhatsApp.
4. Enter the OTP (valid for 15 minutes, max 3 attempts).
5. On verification, the number is saved and WhatsApp notifications are enabled.

We only allow phone numbers you've verified — you can't save someone else's number.`,
    category: 'account',
    targetRoles: [],
    tags: ['whatsapp', 'otp', 'phone'],
    displayOrder: 3,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },
  {
    slug: 'account-social-connections',
    title: 'Connecting social accounts',
    excerpt: 'Link your social profiles for richer personalization.',
    content: `## Connect social accounts

1. Open **Dashboard → Settings → Social Connections**.
2. Click the platform you want to connect:
   - **LinkedIn** — live
   - **Instagram** — pending platform approval
   - **YouTube** / **Twitter** — coming soon
3. Authorize on the provider's page. We store an encrypted token (we never see your password).
4. Inferred interests are merged into your profile for better personalization.

You can disconnect any account at any time — we immediately delete the token.`,
    category: 'account',
    targetRoles: ['consumer'],
    tags: ['social', 'oauth', 'connection'],
    displayOrder: 4,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },
  {
    slug: 'account-delete',
    title: 'Deleting your account',
    excerpt: 'How to permanently delete your Earn4Insights account.',
    content: `## Delete your account

Under GDPR Art. 17, you can request complete erasure at any time.

1. Open **Dashboard → Settings → Privacy → Delete Account**.
2. Confirm with your password.
3. We soft-delete your account immediately — you can recover within **30 days** by emailing us.
4. After 30 days, all your data is physically deleted from our systems, including signal snapshots and consent records.

Notes:
- Outstanding payouts will be processed before deletion
- Audit records (financial transactions for legal/tax purposes) are retained per local law
- This action cannot be undone after the 30-day grace period`,
    category: 'privacy',
    targetRoles: [],
    tags: ['delete', 'gdpr', 'erasure'],
    displayOrder: 3,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },
  {
    slug: 'account-download-data',
    title: 'Downloading your data',
    excerpt: 'Two ways to get a copy of your data (instant JSON or formal PDF).',
    content: `## Download your data

**Option 1 — Instant JSON (no OTP):**
Go to **Dashboard → My Data → Download JSON**. Get an immediate JSON file covering all your data.

**Option 2 — Formal PDF report (DSAR):**
Go to **Dashboard → My Data → Request Data Report**. We email a 6-digit code, then generate a structured PDF (download link valid 7 days, PDF attached if under 10 MB). Limit: 1 request per 30 days.

Both options satisfy GDPR Article 15.`,
    category: 'privacy',
    targetRoles: [],
    tags: ['download', 'data', 'gdpr', 'export'],
    displayOrder: 4,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },
  {
    slug: 'account-consent',
    title: 'Understanding consent preferences',
    excerpt: 'Granular consent — toggle any data category on or off at any time.',
    content: `## Consent preferences

Open **Dashboard → Privacy** to see all data categories and toggle each one:

**Platform Essentials:** tracking, personalization, analytics, marketing
**Insight Signals:** behavioral, demographic, psychographic, social
**Sensitive (GDPR Art. 9):** health, dietary, religion, caste

Revoking any consent **immediately** stops data collection for that category. Sensitive categories also trigger soft-deletion of related data, with physical deletion after 30 days.

You can re-grant consent any time — we'll start collecting fresh data going forward.`,
    category: 'privacy',
    targetRoles: ['consumer'],
    tags: ['consent', 'gdpr', 'privacy'],
    displayOrder: 5,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },

  // ── Technical ────────────────────────────────────────────────────
  {
    slug: 'tech-supported-browsers',
    title: 'Supported browsers',
    excerpt: 'Earn4Insights works in all modern browsers.',
    content: `## Supported browsers

Earn4Insights works in the latest two major versions of:

- Chrome / Edge (Chromium)
- Firefox
- Safari (macOS + iOS)

If you experience issues, please update your browser and disable ad blockers on **earn4insights.com**. Clearing cookies and cache also helps.

We do not officially support Internet Explorer.`,
    category: 'technical',
    targetRoles: [],
    tags: ['browser', 'compatibility'],
    displayOrder: 1,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },
  {
    slug: 'tech-mobile-app',
    title: 'Mobile app availability',
    excerpt: 'Earn4Insights is a fully responsive web app.',
    content: `## Mobile

There is no native iOS or Android app yet. Earn4Insights is a fully responsive web app — it works in any mobile browser.

For the best experience on mobile, **add Earn4Insights to your home screen** (Safari: Share → Add to Home Screen; Chrome: ⋮ → Add to Home Screen). It will behave like a native app.

A native app is on our roadmap.`,
    category: 'technical',
    targetRoles: [],
    tags: ['mobile', 'pwa', 'app'],
    displayOrder: 2,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },
  {
    slug: 'tech-bug-report',
    title: 'Reporting a bug',
    excerpt: 'How to report a bug to our team.',
    content: `## Report a bug

Found something broken? Please file a ticket.

Helpful details to include:
- What were you trying to do?
- What did you expect to happen?
- What actually happened?
- Browser + OS
- A screenshot or short screen recording, if possible
- Your dashboard URL when the issue occurred

The more detail you share, the faster we can fix it.`,
    category: 'technical',
    targetRoles: [],
    tags: ['bug', 'report', 'troubleshooting'],
    displayOrder: 3,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },
  {
    slug: 'tech-feature-request',
    title: 'Requesting a feature',
    excerpt: 'How to suggest improvements or new features.',
    content: `## Request a feature

We love hearing what you want next. Please file a ticket with the **Feature Request** category and include:

- What problem would the feature solve for you?
- How do you currently work around it?
- Who else on the platform would benefit?

We review every request and prioritise based on impact, effort, and alignment with our roadmap.`,
    category: 'technical',
    targetRoles: [],
    tags: ['feature', 'request', 'roadmap'],
    displayOrder: 4,
    isPublished: true,
    viewCount: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
  },
]
