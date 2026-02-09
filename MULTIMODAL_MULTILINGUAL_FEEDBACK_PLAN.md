# 🌍🎙️ Multilingual + Multimodal Feedback & Survey Extension (Living Spec)

Last updated: 2026-02-07

This is the **single source of truth** for extending the existing feedback & survey system to support:
- **Multimodal input** (rating + text + audio; video later)
- **Multilingual handling** (automatic language detection + translation + normalized analytics)

This file contains:
- The **original prompt/requirements** exactly as provided
- The **proposed phased plan + UX + architecture** (startup-friendly, no overengineering)
- A **phase checklist** and **update log** that we will keep updating as we complete work

---

## ✅ Operating Rules (so we don’t miss anything)

- We will implement in **phases**.
- We will **not break** existing rating/text flows.
- After completing any step/phase, we will **update this file**:
  - Mark checklist items complete
  - Add any key decisions (providers, formats, limits)
  - Record migrations, endpoints, UI locations, and test notes

---

## 🧩 Original Request (verbatim)

I want to extend my feedback & survey system
to support MULTILINGUAL and MULTIMODAL input,
especially for non-tech-savvy consumers.

--------------------------------------------------
GOAL
--------------------------------------------------

Allow users (especially consumers) to share feedback via:
- Rating
- Text
- Audio (voice)
- Video (optional, later)

The system must:
- Work across languages automatically
- Be simple for users
- Produce unified analytics for brands

--------------------------------------------------
CORE UX PRINCIPLES
--------------------------------------------------

- Minimize typing
- Voice-first for consumers
- No mandatory language selection
- Mobile-friendly
- Accessible for low literacy users

--------------------------------------------------
REQUEST
--------------------------------------------------

1️⃣ MULTIMODAL INPUT DESIGN
- How to design the UI so users can:
  - rate
  - speak
  - type
  - optionally record video
- Progressive disclosure (don’t overwhelm users)

2️⃣ MULTILINGUAL HANDLING
- Automatic language detection
- Store:
  - original content
  - translated text
- Analytics should operate on normalized language

3️⃣ AUDIO FEEDBACK PIPELINE (PHASE 1)
- Browser recording
- Upload handling
- Speech-to-text
- Sentiment analysis
- Error handling

4️⃣ VIDEO FEEDBACK (PHASE 2)
- When to enable
- UX safeguards
- Storage & moderation considerations

5️⃣ DATA MODEL
- How feedback entries store:
  - modality
  - original language
  - transcript
  - sentiment
  - metadata

6️⃣ ANALYTICS INTEGRATION
- How audio/video feedback is:
  - converted into insights
  - merged with text feedback
- Segment analytics by:
  - region
  - language
  - sentiment
  - modality

7️⃣ PRIVACY & CONSENT
- Explicit consent for audio/video
- Opt-out options
- Storage retention rules

--------------------------------------------------
CONSTRAINTS
--------------------------------------------------

- Do NOT break existing text/rating flows
- Design in PHASES
- Avoid overengineering
- Startup-friendly approach
- No unrealistic AI claims

--------------------------------------------------
OUTPUT EXPECTATION
--------------------------------------------------

- Clear phased plan
- UX guidance
- Technical architecture
- Practical implementation advice

This is a REAL product feature,
not a theoretical system.

NOTE: Don't right away start implementing . first tell me what is possible what is not and then we will start implementing it.

---

## 🎯 Feasibility Summary (what’s possible / what’s not)

### ✅ Possible (startup-friendly)
- **Voice-first feedback** in the browser (record → upload) without breaking existing text/rating.
- **Automatic language detection** (best-effort) from text and/or transcript.
- **Store original + translated** (normalize to a single analytics language like English).
- **Unified analytics** by converting audio → transcript → normalized text, then reusing existing text analytics.
- **Phased rollout** behind feature flags (per survey/campaign).

### ⚠️ Not realistic to promise perfectly
- **100% accurate multilingual automation**: language detect, STT, and translation have edge cases (noise, slang, code-switching).
- **Low-literacy accessibility without iteration**: needs UX testing and refinement.
- **Video without moderation/cost controls**: doable, but requires safeguards and review workflows.

---

## 🗺️ Phased Implementation Plan (high-level)

### Phase 0 — Foundations (no UX disruption)
- [x] Add schema support for modality + processing states (no behavior change)
- [x] Add upload infrastructure (object storage + signed URLs)
- [x] Add feature flags per survey/campaign (e.g., `allowAudio`, `allowVideo`)

### Phase 1 — Audio + multilingual normalization (core value)
- [x] UX: rating + “Tap to record” voice input + “Type instead” (progressive disclosure)
- [x] Record in browser via `MediaRecorder` (mobile-friendly)
- [x] Upload audio (Phase 1 uses server upload route + Blob storage)
- [x] Background transcription (STT)
- [x] Language detection (from text/transcript)
- [x] Translation → `normalized_text` (analytics language, e.g., English)
- [x] Sentiment on normalized text (treat as signal, not truth)
- [x] Robust error handling + non-blocking UX

---

## ✅ Phase 1 processing pipeline (STT → normalize → sentiment)

### What we added
- Background processing service:
  - `src/server/feedbackMediaProcessingService.ts`
  - Picks pending `feedback_media` rows (`media_type='audio'` and `status='uploaded'`)
  - Runs:
    - **STT** via OpenAI (`whisper-1` by default; configurable)
    - Extracts **original language** (best-effort from verbose transcription)
    - Translates to **normalized English** (Whisper translation when language != `en`)
    - Computes sentiment on normalized text using existing `analyzeSentiment()` (keyword-based for now)
  - Writes results back to:
    - `feedback_media`: `status`, `transcript_text`, `original_language`, error fields
    - owning record (currently `survey_responses` / `feedback`): `transcript_text`, `original_language`, `normalized_text`, `normalized_language`, `sentiment`, `processing_status`

### Cron trigger
- Added cron endpoint:
  - `GET /api/cron/process-feedback-media`
  - `src/app/api/cron/process-feedback-media/route.ts`
  - Secured by `CRON_SECRET` (same pattern as other cron routes)
- Updated Vercel cron schedule:
  - `vercel.json` now includes `/api/cron/process-feedback-media` every 10 minutes

### Environment variables required
- `OPENAI_API_KEY`: required to process audio (without it, items will be marked failed with `missing_openai_key`)
- Optional:
  - `OPENAI_STT_MODEL` (default: `whisper-1`)
  - `NORMALIZED_LANGUAGE` (default: `en`)
  - `OPENAI_TEXT_MODEL` (default: `gpt-4o-mini`, used for typed-text normalization)
  - `FEEDBACK_MEDIA_MAX_RETRIES` (default: `3`)
  - `FEEDBACK_MEDIA_RETRY_BACKOFF_BASE_SECONDS` (default: `60`)
  - `FEEDBACK_MEDIA_PROCESSING_TIMEOUT_SECONDS` (default: `900` / 15 min)

### Phase 1.5 — Hardening + Admin/ops (quality)
- [x] Retries + partial failure states
- [x] Better progress/processing UI
- [x] Admin review tools (view transcript, override language, delete transcript text)
- [x] Cost controls + file limits

### Phase 2 — Video feedback (optional, gated)
- [x] Enable behind flags only after audio is stable (kept OFF by default via `allowVideo`)
- [x] UX safeguards: short duration, preview, re-record, explicit consent (Phase 2 foundation)
- [x] Storage limits + retention rules (Phase 2 foundation; short retention default)
- [x] Moderation/review queue and abuse controls (Phase 2 foundation; hide/flag)

---

## 1️⃣ Multimodal Input UI (progressive disclosure, mobile-first)

**Recommended UX (simple + not overwhelming):**
- **A. Rating**: always visible, big tap targets (1–5)
- **B. Voice (primary)**: large mic button
  - Prefer “Tap to record / Stop” first (accessibility-friendly)
  - Show timer + clear state (“Recording…”, “Uploading…”, “Processing…”)
- **C. Text (secondary)**: “Type instead” expands a text box (collapsed by default)
- **D. Video (later)**: hidden under “More options” (Phase 2)

**Accessibility notes:**
- Big touch targets, minimal text, icons + short labels
- Screen reader labels (ARIA)
- UI strings localized via i18n (even if feedback language is auto-detected)

---

## 2️⃣ Multilingual Handling (detect + store original + translate + normalize)

### Storage goals
- Keep **original** user input (text or transcript)
- Create **normalized** text for analytics/search (e.g., translate to English)

### Fields to store (conceptual)
- **Original**:
  - `original_text` (typed)
  - `original_transcript` (audio)
  - `original_language`, `language_confidence`
- **Normalized**:
  - `normalized_text` (translated or same-as-original fallback)
  - `normalized_language` (e.g., always `en`)
  - `translation_provider` (optional), `translation_quality` (optional)

### Detection strategy (best-effort)
- If typed: detect from text.
- If audio: infer from STT and/or detect from transcript.
- For code-switching: store **dominant language** + confidence (don’t overclaim precision).

---

## 3️⃣ Audio Feedback Pipeline (Phase 1)

### Client (browser)
- Record audio via `MediaRecorder` (format varies by browser; test Safari).
- Upload using **signed URL** (avoid API timeouts).
- Create feedback entry early with status `uploaded` → `processing`.

### Server responsibilities
- Create feedback entry + return upload URL + metadata requirements.
- Finalize upload metadata (mime, size, duration).

### Background processing (recommended)
1. STT: audio → transcript (+ confidence)
2. Language detect (if not from STT)
3. Translation → `normalized_text`
4. Sentiment on normalized text
5. Mark feedback `ready` (or `failed` with reason codes)

### Error-handling rules
- If STT fails: keep rating; keep audio reference; mark `failed_transcription`; allow typed fallback.
- If translation fails: keep transcript; set normalized = transcript; mark `translation_failed`.
- UX: “Saved—processing may take a minute.”

### Provider choices (to decide during implementation)
- STT: hosted Whisper API vs cloud STT vs self-hosted Whisper (trade-offs: cost vs ops).
- Translation: cloud translation API.
- Sentiment: start conservative; treat as “signal”.

---

## 4️⃣ Video Feedback (Phase 2)

### When to enable
- After audio pipeline is stable and costs are known.
- Gate per survey/campaign and (optionally) per user segment.

### UX safeguards
- Max duration (15–30s), max size, countdown.
- Preview + re-record before upload.
- Separate explicit consent for video.

### Storage + moderation
- Private storage, signed reads for admins.
- Minimum moderation: report/flag + admin review queue.
- Retention defaults (video is sensitive and expensive).

---

## 5️⃣ Data Model (practical + extensible; no breaking changes)

Recommended approach:
- Keep existing feedback flow intact.
- Add optional media records rather than forcing all feedback into a single “blob”.

### Conceptual entities

**`feedback`**
- `rating` (existing)
- `text` (existing, optional)
- `modality_primary`: `text | audio | video | mixed`
- `status`: `submitted | uploaded | processing | ready | failed`
- `original_language`, `language_confidence`
- `normalized_text`, `normalized_language`
- `sentiment_label`, `sentiment_score`
- `consent_audio`, `consent_video`, `consent_timestamp`

**`feedback_media`**
- `feedback_id`
- `type`: `audio | video`
- `storage_key/url`, `mime_type`, `size_bytes`, `duration_ms`
- `transcript_text`, `transcript_confidence`
- `processing_error_code`, `processing_error_detail`

---

## 6️⃣ Analytics Integration (unified insights + segmentation)

### Unification rule
Create an “analysis text”:
- Prefer typed text if present
- Else transcript (audio/video)
- Normalize via translation to `normalized_text`

### Segmentation
- **Region**: from profile/survey metadata (avoid IP-based without consent).
- **Language**: `original_language`
- **Sentiment**: computed on normalized text
- **Modality**: `modality_primary`

### Early insights (Phase 1)
- Volume by modality
- Sentiment by modality + language
- Top themes from normalized text (start simple)

---

## 7️⃣ Privacy & Consent (minimum viable but real)

- Explicit consent for audio (and separate consent for video later).
- Opt-out: allow “rating only” or “type only”.
- Retention:
  - Consider keeping transcripts longer than raw media.
  - Consider auto-deleting raw audio/video after X days.
- Deletion/export: extend existing GDPR flows to include transcripts + media.
- Access control: media private; signed URLs for authorized access; audit log access.

---

## ✅ Decisions Log (fill in as we implement)

- **Normalized analytics language**: TBD (recommended: `en`)
- **STT provider**: TBD
- **Translation provider**: TBD
- **Sentiment approach**: TBD (keyword vs model; scope)
- **Audio format(s)**: TBD (e.g., `audio/webm;codecs=opus`)
- **Limits**: TBD (max seconds, max MB)
- **Retention**: TBD (audio/video delete after X days)
- **Moderation approach (video)**: TBD

---

## 🧾 Implementation Log (append updates here)

### 2026-02-07: Phase 5 — Product Resolution & Claiming (COMPLETE)

**Goal**: Enable product discovery, consumer-created placeholders, brand claiming, and de-duplication.

**Implementation**:

**5.1 Product Schema Extension** ✅
- Added lifecycle fields to products table: `lifecycle_status`, `owner_id`, `claimable`, `claimed_at`, `claimed_by`, `merged_into_id`, `merged_at`, `created_by`, `creation_source`, `name_normalized`
- Migration: `drizzle/0010_add_product_lifecycle.sql`
- Updated Product type: `src/lib/types/product.ts` (added `ProductLifecycleStatus`, `ProductCreationSource`)

**5.2 Product Search API** ✅
- `GET /api/products/search?q=iPhone&limit=10` - Public fuzzy search
- Uses PostgreSQL ILIKE for case-insensitive partial matching
- Returns match scores (100=exact, 90=startsWith, 70=contains)
- Excludes merged products
- Returns only safe public fields (no owner info)
- File: `src/app/api/products/search/route.ts`

**5.3 Placeholder Product Creation** ✅
- `POST /api/products/placeholder` - Consumer creates placeholder
- Flow: Consumer types name → system checks for near-duplicates → if high match (>=80%) suggests existing → else creates placeholder
- Placeholder: `lifecycle_status='pending_verification'`, `claimable=true`, `creation_source='consumer_feedback'`
- File: `src/app/api/products/placeholder/route.ts`

**5.4 Brand Claim Workflow** ✅
- `GET /api/dashboard/products/claim` - List claimable products
- `GET /api/dashboard/products/claim?action=my-products` - List brand's owned products
- `POST /api/dashboard/products/claim` - Claim a product (assigns ownership, sets verified)
- Auth-protected (brand must be logged in)
- File: `src/app/api/dashboard/products/claim/route.ts`

**5.5 Admin De-duplication Tools** ✅
- `GET /api/dashboard/products/merge?action=pending-review` - List pending products
- `GET /api/dashboard/products/merge?productId=xxx` - Find duplicates for product
- `POST /api/dashboard/products/merge` - Merge source into target
  - Migrates all survey_responses, feedback, and surveys to target product
  - Marks source as merged with `merged_into_id`
- File: `src/app/api/dashboard/products/merge/route.ts`

**5.6 Repository Enhancements** ✅
- `searchProductsByName()` - Fuzzy search with match scoring
- `findPotentialDuplicates()` - Find near-duplicate products
- `createPlaceholderProduct()` - Create consumer-submitted placeholder
- `claimProduct()` - Brand claims product
- `mergeProduct()` - Merge duplicate into canonical
- `getProductsByStatus()`, `getProductsByOwner()`, `getClaimableProducts()`
- File: `src/db/repositories/productRepository.ts`

**Product Lifecycle States**:
- `verified` - Brand onboarded and confirmed
- `pending_verification` - Consumer-created, awaiting brand claim
- `merged` - Duplicate resolved into canonical product

**Status**: ✅ Phase 5 COMPLETE - Committed and deployed

---

### 2026-02-07: Phase 6 — Direct Feedback Flow (COMPLETE)

**Goal**: Create the complete consumer-facing feedback submission flow, independent of surveys. 
Consumers can discover products, submit multimodal feedback (text + voice + images), and brands 
can view/manage this feedback from their dashboards.

**Architecture**: Follows the "Separate Pipelines + Common Analytics Layer" pattern:
- `feedback` table: unstructured consumer reviews (separate from `surveyResponses`)
- Same processing pipeline: language detection → translation → sentiment analysis
- Same media storage: Vercel Blob via dedicated upload route
- Feeds into unified analytics aggregation layer (Phase 4)

**Milestone 1: Feedback Submission API** ✅
- `POST /api/feedback/submit` — submits text feedback with auto language detection + sentiment
  - Validates: productId, feedbackText (min 3 chars), rating (1-5), category
  - Runs `normalizeTextForAnalytics()` for language detection + translation
  - Runs `analyzeSentiment()` on normalized text
  - Returns: feedbackId, sentiment, originalLanguage
  - File: `src/app/api/feedback/submit/route.ts`

**Milestone 2: Feedback Media Upload API** ✅
- `POST /api/feedback/upload-media` — upload audio, video, or images for a feedback entry
  - Separate from survey media upload (no surveyId requirement)
  - Validates content types, sizes (audio 4MB, video 4MB, images 5MB)
  - Stores in Vercel Blob under `feedback-media/direct/{feedbackId}/`
  - Updates feedback modality and processing status
  - File: `src/app/api/feedback/upload-media/route.ts`

**Milestone 3: Product Search Component** ✅
- Reusable `<ProductSearch>` typeahead component
  - 300ms debounced search → `/api/products/search`
  - Shows verified badges, match scores
  - "Add as new product" fallback → `/api/products/placeholder`
  - De-duplication: checks for high-confidence matches before creating
  - File: `src/components/product-search.tsx`

**Milestone 4: Public Feedback Submission Page** ✅
- `/submit-feedback` — full multimodal feedback form
  - Step 1: Product search (typeahead with create fallback)
  - Step 2: Star rating (1-5, interactive, optional)
  - Step 3: Category selection (general, praise, complaint, bug, feature-request)
  - Step 4: Voice recording (MediaRecorder, 2min max, consent required)
  - Step 5: Text feedback (any language, auto-detect)
  - Step 6: Image upload (up to 3 images, 5MB each, consent required)
  - Step 7: Optional contact details
  - Progressive upload: text first → audio → images sequentially
  - Success state with sentiment + language badges
  - File: `src/app/submit-feedback/page.tsx`

**Milestone 5: Shareable Product Feedback Links** ✅
- `/submit-feedback/[productId]` — pre-selected product feedback page
  - Brands share link: consumers skip product search
  - Server component loads product, passes to client form
  - Redirect to generic page if product not found
  - Files:
    - `src/app/submit-feedback/[productId]/page.tsx`
    - `src/app/submit-feedback/[productId]/DirectFeedbackForm.tsx`

**Milestone 6: Brand Dashboard — Feedback Viewer** ✅
- `/dashboard/products/[productId]/feedback` — view direct feedback for a product
  - Stats cards: total count, avg rating, sentiment breakdown, modality breakdown
  - Feedback list with sentiment badges, modality badges, category, status
  - Shows normalized/translated text and transcripts
  - Star rating display
  - File: `src/app/dashboard/products/[productId]/feedback/page.tsx`

**Milestone 7: Feedback Repository** ✅
- `src/db/repositories/feedbackRepository.ts`
  - `getFeedbackByProduct()` — paginated, filterable by status/sentiment
  - `getFeedbackByProductIds()` — brand-wide feedback
  - `countFeedbackByProduct()` — count query
  - `getFeedbackStats()` — aggregate stats with SQL FILTER clauses
  - `updateFeedbackStatus()` — review workflow (new → reviewed → addressed)

**Milestone 8: Navigation + UX** ✅
- "Submit Feedback" link in main site header (visible to all users)
- FeedbackMediaType updated to include 'image' in `feedbackMediaRepo.ts`

**Consumer Entry Points** (from Architectural Design):
- A) From Product Page: `/submit-feedback/[productId]` (product pre-selected)
- B) From "Submit Feedback" link: `/submit-feedback` (search/create product)
- C) From Survey Link: existing survey response flow (unchanged)

**Status**: ✅ Phase 6 COMPLETE - Committed and pushed

---

### 2026-02-07: Phase 7 — Dashboard Integration & Feedback Management (COMPLETE)

**Goal**: Wire real feedback data into the brand dashboard, replace mock data, add review workflow, 
shareable feedback links, and feedback stats on the main dashboard.

**Milestone 1: Feedback Dashboard with Real Data** ✅
- Rewrote `/dashboard/feedback` to use real DB queries instead of `mockProducts`/`mockFeedback`
  - Aggregate stats per product using SQL `FILTER` clauses
  - Latest feedback preview per product
  - Global totals: total count, avg rating, unreviewed, sentiment breakdown
  - Modality breakdown per product (text/audio/video/mixed)
  - Empty state with CTA to product list
  - File: `src/app/dashboard/feedback/page.tsx`

**Milestone 2: Feedback Review Workflow** ✅
- API: `PATCH /api/dashboard/feedback/[id]/status`
  - Authenticated (requires session)
  - Status transitions: `new` → `reviewed` → `addressed`
  - File: `src/app/api/dashboard/feedback/[id]/status/route.ts`
- Client component: `FeedbackStatusButton`
  - Dropdown with status options (New/Reviewed/Addressed)
  - Inline PATCH call — no page reload required
  - File: `src/app/dashboard/products/[productId]/feedback/FeedbackStatusButton.tsx`

**Milestone 3: Shareable Feedback Link Widget** ✅
- `ShareFeedbackLink` component on product feedback pages
  - Shows the shareable URL: `/submit-feedback/[productId]`
  - One-click copy to clipboard with confirmation
  - Open in new tab button
  - File: `src/app/dashboard/products/[productId]/feedback/ShareFeedbackLink.tsx`
- Product feedback page now includes the share widget and status buttons
  - File: `src/app/dashboard/products/[productId]/feedback/page.tsx`

**Milestone 4: Main Dashboard Feedback Stats** ✅
- Added "Consumer Feedback" section to main dashboard page
  - Total feedback count, unreviewed count, avg rating, positive/negative ratio
  - Quick links to unified analytics, surveys, and public feedback form
  - File: `src/app/dashboard/page.tsx`

**Status**: ✅ Phase 7 COMPLETE - Committed and pushed

---

### 2026-02-07: Phase 8 — AI-Powered Theme Extraction (COMPLETE)

**Goal**: Automatically identify recurring themes/topics from normalized feedback text using OpenAI GPT, with fallback keyword extraction.

**Milestone 1: Theme Extraction Service** ✅
- `src/server/themeExtractionService.ts`
  - `extractThemesFromFeedback()` — sends normalized text to GPT-3.5 for theme identification
  - Returns: theme name, count, sentiment, example quotes
  - Fallback: keyword-based extraction when OpenAI fails (15 common keywords)
  - `extractThemesForProduct()` — gathers normalized text from both `feedback` + `surveyResponses` tables
  - Sample size cap: 200 items per extraction (cost control)
  - Low temperature (0.3) for consistent results

**Milestone 2: Database Schema + Repository** ✅
- Schema: `extracted_themes` table in `src/db/schema.ts`
  - Fields: productId, theme, count, sentiment, examples (JSONB), extractedAt, extractionMethod
  - Indexes: product_id, extracted_at, sentiment
- Migration: `drizzle/0011_add_extracted_themes.sql`
- Repository: `src/db/repositories/themeRepository.ts`
  - `saveExtractedThemes()` — batch insert themes
  - `getLatestThemesForProduct()` — get most recent extraction
  - `getLatestThemesForProducts()` — brand-wide theme view
  - `cleanupOldThemes()` — delete themes older than 90 days

**Milestone 3: API Endpoints** ✅
- `POST /api/dashboard/products/[productId]/extract-themes` — manual trigger (authenticated)
- `GET /api/cron/extract-themes` — weekly cron job (Sunday 2 AM UTC)
  - Iterates all non-merged products
  - 2s delay between products (rate limiting)
  - Secured by CRON_SECRET bearer token

**Milestone 4: Dashboard UI** ✅
- `/dashboard/products/[productId]/themes` — themes page
  - Grid of theme cards with sentiment icons, mention counts, example quotes
  - "Extract Themes" button for manual trigger
  - Empty state with explanation
  - Extraction metadata (feedback count, timestamp)
- `ExtractThemesButton` client component for async extraction
- "AI Themes" button added to product overview page

**Status**: ✅ Phase 8 COMPLETE - Ready to commit and deploy

---

### 2026-02-06: Phase 4 — Unified Analytics Foundation (COMPLETE)

**Goal**: Aggregate feedback from multiple sources (surveys + direct feedback) into unified analytics for brands.

**Milestone 1: Unified Analytics Service** ✅
- Created `src/server/analytics/unifiedAnalyticsService.ts`
- **Architecture Pattern**: Source abstraction layer (inspired by Intercom, Amplitude, Zendesk)
- **Interface-based design**: `IFeedbackSource` for extensibility
- **Two sources implemented**:
  - `SurveyResponseSource` - aggregates survey_responses table
  - `DirectFeedbackSource` - aggregates feedback table
- **Unified data model**: `UnifiedFeedbackItem` works across all sources
- **Performance optimized**: SQL FILTER clauses, parallel queries, efficient aggregations
- **Type-safe**: Full TypeScript with comprehensive interfaces
- **Extensible**: Easy to add ReviewSource, SocialListeningSource later

**Key Features**:
- `getUnifiedFeedback(productId)` - fetch all feedback for a product
- `getUnifiedMetrics(productId)` - calculate aggregated metrics
- `getUnifiedFeedbackForBrand(productIds[])` - brand-level aggregation
- Supports filtering by: date, sentiment, modality, language, rating, processing status
- Returns unified metrics: volume by source, sentiment distribution, modality breakdown

**Milestone 2: Tier System** ✅
- Created `brand_subscriptions` table schema with migration `0009`
- Created `src/server/subscriptions/subscriptionService.ts`
- **Tier structure**: FREE, PRO, ENTERPRISE with clear feature matrix
- **FREE tier**: Aggregate analytics, trends, max 1 product
- **PRO tier**: Individual feedback, media playback, CSV export, max 10 products
- **ENTERPRISE tier**: API access, unlimited products, webhooks
- Created `src/server/auth/tierMiddleware.ts` for route protection
- **Hard checks**: `requireTier()`, `requirePaidTier()`, `requireFeature()` (throws errors)
- **Soft checks**: `checkFeatureAccess()`, `checkProductLimit()` (returns boolean)
- **Usage limits**: Product count, export count tracking
- **Upgrade CTAs**: User-friendly messages for each restricted feature

**Milestone 3: Dashboard Integration** ✅
- Created `/dashboard/analytics/unified` - new unified analytics page
- **Components**:
  - `page.tsx` - Main dashboard with tier-based visibility
  - `UnifiedFeedbackList.tsx` - Client component for displaying feedback items
  - `UpgradePrompt.tsx` - Beautiful upgrade CTA for restricted features
- **FREE tier UX**: Shows aggregate metrics + upgrade prompts
- **PRO tier UX**: Full individual feedback access with media
- **Features**:
  - Overview cards (total, by source, sentiment)
  - Modality breakdown with icons
  - Individual feedback list (PRO only)
  - Source badges (survey vs feedback)
  - Sentiment indicators with emojis
  - Media attachment indicators
  - User information display
- Added navigation link in DashboardShell sidebar
- **Non-breaking**: Existing dashboards continue working

**Architecture Highlights**:
- ✅ Single source of truth for subscription features
- ✅ Graceful degradation (free → pro → enterprise)
- ✅ User-friendly upgrade messaging
- ✅ Extensible for future sources (reviews, social)

**Status**: ✅ Phase 4 COMPLETE - Ready to commit and deploy

---

### 2026-02-06: Phase 3.5 — Image Feedback (COMPLETE)

**Goal**: Enable consumers to submit images alongside text/audio/video feedback (product defects, receipts, packaging, etc.).

**Implementation**:
- ✅ Added `allowImages` feature flag to `SurveySettings` type and DB schema
- ✅ Extended survey creation form with "Enable image feedback uploads" checkbox
- ✅ Added `consentImages` field to `survey_responses` and `feedback` tables
- ✅ Created migration `0008_add_consent_images.sql`
- ✅ Built multi-image upload UI (max 3 images, 5MB each) with preview/remove functionality
  - File: `src/components/survey-response-form.tsx`
- ✅ Extended `/api/uploads/feedback-media/server` to handle `mediaType=image`
  - Validates MIME types: `image/jpeg`, `image/jpg`, `image/png`, `image/webp`
  - Enforces 5MB size limit per image
  - Stores to Vercel Blob with unique filenames (`image-0`, `image-1`, etc.)
- ✅ Added image gallery display in dashboard responses table with thumbnails and download links
  - Files: `src/app/dashboard/surveys/[id]/responses/page.tsx`, `ResponsesTable.tsx`
- ✅ Extended analytics service to include `image` modality metrics
  - File: `src/server/surveys/analyticsService.ts`
- ✅ Updated analytics dashboard overview cards (5 cards now: Text, Audio, Video, Image, Total)
  - Files: `ModalityChart.tsx`, `SentimentChart.tsx`, `ProcessingMetricsCard.tsx`, `page.tsx`
- ✅ **Enhanced CSV export** with all multimodal fields:
  - Added columns: Modality, Original Language, Normalized Language, Normalized Text, Transcript, Sentiment, Processing Status
  - File: `src/server/surveys/responseService.ts`
- ✅ **Created email digest service** for weekly analytics summaries
  - Service: `sendSurveyDigestEmail()` generates beautiful HTML digest with all metrics
  - File: `src/server/surveys/digestService.ts`
  - Includes: response counts, modality breakdown, sentiment analysis, top languages, processing status
  - Ready for cron integration

**Key Decisions**:
- Images don't require processing (no STT/translation) → simpler pipeline
- Multiple images per response (up to 3) for comprehensive visual feedback
- Same consent/moderation model as audio/video
- Images treated as `modalityPrimary='mixed'` when combined with text answers
- CSV export now provides complete data for offline analysis
- Email digests can be triggered manually or via cron (future: weekly auto-send)

**Status**: ✅ Complete. Images, enhanced exports, and digest emails fully integrated.

---

### 2026-02-04
- Created this living spec file.
- **Phase 0 (partial)**: Added DB schema foundations for multimodal + multilingual feedback (no UX changes).
  - Updated: `src/db/schema.ts`
    - Added optional columns to `survey_responses` and `feedback` for:
      - modality (`modality_primary`)
      - processing state (`processing_status`)
      - language + normalization (`original_language`, `normalized_text`, etc.)
      - transcript fields
      - explicit consent flags (`consent_audio`, `consent_video`, `consent_captured_at`)
  - Added: `feedback_media` table (generic media attachments)
  - Added migration SQL: `drizzle/0004_add_multimodal_multilingual_foundations.sql`

### 2026-02-05
- **Phase 0**: Added secure upload scaffolding (no public UI dependency yet).
  - Installed dependency: `@vercel/blob`
  - Added API route (token exchange + upload completion hook):
    - `src/app/api/uploads/feedback-media/route.ts`
    - Enforces `feedback-media/` pathname prefix
    - Validates by `surveyId` and survey feature flags (`settings.allowAudio` / `settings.allowVideo`)
    - On completion, stores an attachment row in `feedback_media` **when** `ownerType` + `ownerId` are provided (Phase 1 will wire those)
  - Environment required:
    - `BLOB_READ_WRITE_TOKEN` (from Vercel Storage)
    - Local dev note: `onUploadCompleted` needs a tunnel or `VERCEL_BLOB_CALLBACK_URL` (per Vercel docs)

- **Phase 0**: Added per-survey feature flags (defaults off) and surfaced them in survey creation.
  - Updated types: `src/lib/survey-types.ts` (`SurveySettings`)
  - Updated server action: `src/server/surveys/surveyService.ts` to accept `settings`
  - Updated UI: `src/components/survey-creation-form.tsx` (checkboxes)

---

## ⚠️ Known integration risk (to address in Phase 1)

- The dashboard responses page currently reads from the **JSON response store** (`src/lib/survey/responseStore.ts`), while submission writes to **Postgres** via `surveyRepository`.
  - We did **not** change this in Phase 0 to avoid breaking existing behavior.
  - Phase 1 should decide: consolidate to DB reads everywhere (recommended) or keep JSON only for demo data.

---

## 🚧 Phase 1 (in progress): Audio MVP

### What we implemented (Audio capture + upload + DB linkage)
- Added voice recording UI to the public survey response form, gated by `survey.settings.allowAudio`.
  - File: `src/components/survey-response-form.tsx`
  - Explicit consent checkbox required before recording/upload
  - Records via `MediaRecorder` (best-effort MIME type detection) with a 60s cap
  - Uploads to Vercel Blob via **server upload route** (keeps URLs “unlisted”, enforces limits):
    - `POST /api/uploads/feedback-media/server` (multipart form upload)
    - pathname: `feedback-media/{surveyId}/{responseId}/voice.{ext}` with `addRandomSuffix: true`
    - Enforces: `survey.settings.allowAudio === true`, consent, content-type allowlist, size limit (<= 4MB)
  - Security note (important): **Vercel Blob URLs are publicly accessible but unguessable when using `addRandomSuffix: true`** (unlisted-by-URL model). For stricter access control we can add an authenticated proxy download endpoint later.

### DB linkage approach (works on localhost too)
- Added idempotent `feedback_media` upsert helper:
  - `src/server/uploads/feedbackMediaRepo.ts`
- Added server action to finalize uploads from the client (so local dev doesn’t depend on Blob callbacks):
  - `src/server/uploads/feedbackMediaActions.ts` (`finalizeFeedbackMediaUpload`)
- Updated Blob upload callback to use the same upsert helper (idempotent):
  - `src/app/api/uploads/feedback-media/route.ts`

### Survey response metadata updates
- Added repository update helper:
  - `src/db/repositories/surveyRepository.ts` (`updateSurveyResponseById`)
- Added server action to mark a survey response as audio/mixed + consent captured:
  - `src/server/surveys/responseService.ts` (`markSurveyResponseAudioAttached`)

### Authenticated media download (brand/admin only)
- Added **admin-only proxy download endpoint** so clients don’t need blob URLs:
  - `GET /api/admin/feedback-media/{id}/download`
  - File: `src/app/api/admin/feedback-media/[id]/download/route.ts`
  - Auth: `ADMIN_API_KEY` via `Authorization: Bearer <key>` (or `?apiKey=...` in dev)
  - Behavior: fetches the blob URL server-side and streams it to the caller (`Cache-Control: no-store`)

### Dashboard UI: play/download voice feedback
- Added a **brand-session authenticated** proxy download route (works with `<audio>` tags because it uses session cookies):
  - `GET /api/dashboard/feedback-media/{id}/download`
  - File: `src/app/api/dashboard/feedback-media/[id]/download/route.ts`
  - Auth: NextAuth session (`requireRole('brand')`)
- Updated dashboard survey responses page to fetch DB responses + audio attachments:
  - `src/app/dashboard/surveys/[id]/responses/page.tsx`
  - Uses `listFeedbackMediaForOwners({ ownerType: 'survey_response', mediaType: 'audio' })`
- Updated responses table UI to show:
  - **Play voice** toggle + inline `<audio controls>`
  - **Download** button (opens in new tab)
  - File: `src/app/dashboard/surveys/[id]/responses/ResponsesTable.tsx`

### Dashboard UI: processing status + transcript preview
- Updated dashboard responses UI to show, per response:
  - Voice processing status badge (`uploaded` / `processing` / `ready` / `failed`)
  - Failure reason (from `feedback_media.error_code` / `error_detail`)
  - Transcript preview (from `survey_responses.transcript_text` or `feedback_media.transcript_text`)
  - Normalized text preview (from `survey_responses.normalized_text`)
- Files updated:
  - `src/server/uploads/feedbackMediaRepo.ts` (returns media `status` + error fields)
  - `src/app/dashboard/surveys/[id]/responses/page.tsx` (passes richer audio metadata)
  - `src/app/dashboard/surveys/[id]/responses/ResponsesTable.tsx` (renders badges + transcript blocks)
  - `src/lib/survey-types.ts` + `src/db/repositories/surveyRepository.ts` (map `transcript_text`, `normalized_text`, etc.)

---

## ✅ Phase 1.5: retries + lifecycle hardening

### Lifecycle fix (important)
- On audio upload, the owning response is now marked **processing** (not ready):
  - `src/app/api/uploads/feedback-media/server/route.ts` sets `survey_responses.processing_status = 'processing'`
- When the cron job starts processing, it also sets owner `processing_status = 'processing'`:
  - `src/server/feedbackMediaProcessingService.ts`

### Retry tracking (DB)
- Added attempt fields to `feedback_media`:
  - `retry_count` (int, default 0)
  - `last_attempt_at` (timestamp)
  - `last_error_at` (timestamp)
- Migration:
  - `drizzle/0005_add_feedback_media_retry_fields.sql`
- Schema:
  - `src/db/schema.ts` (`feedbackMedia` table)

### Retry endpoint (dashboard-authenticated)
- `POST /api/dashboard/feedback-media/{id}/retry`
  - File: `src/app/api/dashboard/feedback-media/[id]/retry/route.ts`
  - Auth: NextAuth session (`requireRole('brand')`)
  - Behavior:
    - resets `feedback_media.status` → `uploaded`
    - clears `error_code/error_detail` and transcript fields
    - sets owner `processing_status` → `processing` and clears derived fields (`transcript_text`, `normalized_text`, `sentiment`)

### Retry button (UI)
- In the expanded response view, when voice processing status is `failed`, we now show a **Retry processing** button:
  - File: `src/app/dashboard/surveys/[id]/responses/ResponsesTable.tsx`
  - Calls the retry endpoint then refreshes the page.

---

## ✅ Phase 1.5: retention / cost controls (auto-delete raw audio)

### Goal
- Reduce storage cost and sensitivity by **deleting raw audio after N days**, while keeping:
  - transcript
  - normalized text
  - sentiment
  - analytics signals

### DB fields + migrations
- Added to `feedback_media`:
  - `deleted_at` (timestamp)
  - `retention_reason` (text)
- Migration:
  - `drizzle/0006_add_feedback_media_retention_fields.sql`

### Cleanup service
- `src/server/feedbackMediaRetentionService.ts`
  - Deletes Vercel Blob objects using `del(blobUrl)` from `@vercel/blob`
  - Only deletes candidates that are:
    - `media_type='audio'`
    - `status='ready'`
    - `transcript_text IS NOT NULL` (ensures transcript is preserved before deleting raw)
    - older than `AUDIO_MEDIA_RETENTION_DAYS` (default 30)
    - not already deleted (`deleted_at IS NULL`)
  - Marks DB row:
    - `status='deleted'`
    - `deleted_at=now()`
    - `retention_reason='auto_retention_audio_{N}d'`

### Cron trigger
- Added cron endpoint:
  - `GET /api/cron/cleanup-feedback-media`
  - `src/app/api/cron/cleanup-feedback-media/route.ts`
  - Secured by `CRON_SECRET`
- Scheduled in `vercel.json`:
  - `/api/cron/cleanup-feedback-media` daily at `1:30` UTC

### Environment variables
- `AUDIO_MEDIA_RETENTION_DAYS` (default `30`)
  - Set to `0` to disable retention cleanup.
 - `VIDEO_MEDIA_RETENTION_DAYS` (default `7`)
   - Set to `0` to disable video retention cleanup.

### Dashboard behavior
- When audio is deleted by retention, the dashboard hides Play/Download and shows a badge:
  - “Voice deleted (retention)”
  - File: `src/app/dashboard/surveys/[id]/responses/ResponsesTable.tsx`

### 2026-02-05 (Phase 1 → multilingual completion for typed text + segmentation)
- Added best-effort typed-text language detection + translation to normalized analytics language.
  - New: `src/server/textNormalizationService.ts`
  - Uses OpenAI chat completions when `OPENAI_API_KEY` is set; otherwise falls back to `originalLanguage='und'` and no translation.
- Updated submission flow to persist:
  - `originalLanguage`, `normalizedLanguage`, `normalizedText`, `sentiment`
  - File: `src/server/surveys/responseService.ts` (`submitSurveyResponse`)
  - Repo persistence: `src/db/repositories/surveyRepository.ts` (`createSurveyResponse`)
- Dashboard segmentation filters added (GET params):
  - `language`, `modality`, `sentiment` (plus existing date/rating)
  - File: `src/app/dashboard/surveys/[id]/responses/page.tsx`
- Dashboard now prefers stored sentiment (avoids re-analyzing on the client). Falls back to analyzing `normalizedText` for older rows.
  - File: `src/app/dashboard/surveys/[id]/responses/ResponsesTable.tsx`
- CSV export now respects the same filters as the table (prevents “export all” surprise).
  - Files:
    - `src/server/surveys/responseService.ts` (`exportResponsesToCSV(..., filters)`)
    - `src/app/dashboard/surveys/[id]/responses/ExportResponsesButton.tsx`
    - `src/app/dashboard/surveys/[id]/responses/page.tsx`

### 2026-02-05 (Phase 1: robust processing + non-blocking UX)
- Added processing hardening to prevent stuck jobs and retry thrash:
  - **Processing timeout**: audio stuck in `processing` beyond `FEEDBACK_MEDIA_PROCESSING_TIMEOUT_SECONDS` is **re-queued** with an error marker and backoff.
  - **Max retries**: once `retry_count >= FEEDBACK_MEDIA_MAX_RETRIES`, media is marked `failed` with `max_retries_exceeded`.
  - **Exponential backoff**: after errors, reprocessing is delayed by \(baseSeconds \* 2^{retryCount}\).
  - File: `src/server/feedbackMediaProcessingService.ts`
- Manual retry now clears `last_error_at` so the retry can run immediately (backoff won’t block an intentional retry).
  - File: `src/app/api/dashboard/feedback-media/[id]/retry/route.ts`
- Dashboard operator visibility improved: `retryCount`, `lastAttemptAt`, `lastErrorAt` are now passed through and shown in the expanded response view.
  - Files:
    - `src/app/dashboard/surveys/[id]/responses/page.tsx`
    - `src/app/dashboard/surveys/[id]/responses/ResponsesTable.tsx`
- Public survey UX clarified: voice processing is non-blocking and may take a minute; rating/text are already saved.
  - File: `src/components/survey-response-form.tsx`

### 2026-02-05 (Phase 1.5: admin review / overrides)
- Added a brand-authenticated review endpoint to override analytics fields on a response:
  - `POST /api/dashboard/survey-responses/{id}/review`
  - File: `src/app/api/dashboard/survey-responses/[id]/review/route.ts`
  - Supports:
    - override `originalLanguage`, `normalizedLanguage`
    - edit `normalizedText` and recompute `sentiment`
    - clear transcript text (also clears stored transcript on attached audio media rows)
- Extended `updateSurveyResponseById` to support updating multilingual/analytics fields (backwards compatible).
  - File: `src/db/repositories/surveyRepository.ts`
- Added “Review / Override (admin)” UI in the dashboard expanded response view.
  - File: `src/app/dashboard/surveys/[id]/responses/ResponsesTable.tsx`

### 2026-02-05 (Phase 1.5: better progress / processing UI)
- Public consumer UX now shows **non-blocking voice processing status** after submission by polling a minimal public status endpoint.
  - New endpoint: `GET /api/public/survey-responses/{id}/status`
  - File: `src/app/api/public/survey-responses/[id]/status/route.ts`
  - Public endpoint returns only processing state (no answers/PII).
  - UI: `src/components/survey-response-form.tsx`
- Dashboard now shows a **Voice processing summary** card with counts (queued/processing/ready/failed/deleted) and a “stuck processing” indicator.
  - File: `src/app/dashboard/surveys/[id]/responses/page.tsx`
- Optional brand-only manual trigger “Process now” for debugging (gated by env var).
  - Env: `ALLOW_MANUAL_MEDIA_PROCESSING=true`
  - Endpoint: `POST /api/dashboard/feedback-media/process-now`
  - Files:
    - `src/app/api/dashboard/feedback-media/process-now/route.ts`
    - `src/app/dashboard/surveys/[id]/responses/ProcessNowButton.tsx`

### 2026-02-05 (Phase 2 foundation: gated video feedback)
- Extended server-side upload route to support **video** (`mediaType=video`) with explicit consent and strict constraints.
  - Requires `survey.settings.allowVideo === true` and `consentVideo === true`
  - Validates content-type allowlist and enforces max duration (15s via `durationMs`)
  - File: `src/app/api/uploads/feedback-media/server/route.ts`
- Public survey form now supports **record → preview → upload** video feedback (progressive, optional).
  - Feature-gated by `survey.settings.allowVideo`
  - File: `src/components/survey-response-form.tsx`
- Dashboard responses page now fetches and displays attached **video media**:
  - Play/download via existing proxy endpoint (`/api/dashboard/feedback-media/{id}/download`)
  - File: `src/app/dashboard/surveys/[id]/responses/page.tsx`
  - File: `src/app/dashboard/surveys/[id]/responses/ResponsesTable.tsx`
- Added moderation foundations for media:
  - DB fields: `moderation_status`, `moderation_note`, `moderated_at`
  - Migration: `drizzle/0007_add_feedback_media_moderation_fields.sql`
  - Schema: `src/db/schema.ts`
  - Brand-only endpoint: `POST /api/dashboard/feedback-media/{id}/moderate`
  - File: `src/app/api/dashboard/feedback-media/[id]/moderate/route.ts`
  - UI: “Hide/Unhide” for video in `ResponsesTable.tsx`
- Retention now supports **video** with short default window:
  - Service: `cleanupOldVideoMedia()` in `src/server/feedbackMediaRetentionService.ts`
  - Cron endpoint now runs both audio + video cleanup:
    - `src/app/api/cron/cleanup-feedback-media/route.ts`

### 2026-02-05 (Phase 2: video processing → transcript + normalized analytics)
- Added **video STT processing pipeline** mirroring audio (startup-friendly, best-effort):
  - New worker: `processPendingVideoFeedbackMedia()` in `src/server/feedbackMediaProcessingService.ts`
  - Flow: `uploaded → processing → ready/failed` with the same timeout + retry/backoff protections as audio
  - Uses OpenAI Whisper transcription + (when needed) Whisper translation to English for `normalized_text`, then keyword sentiment
- Cron + manual triggers now process **both audio and video**:
  - `GET /api/cron/process-feedback-media` runs audio + video
  - `POST /api/dashboard/feedback-media/process-now` runs audio + video (still gated by `ALLOW_MANUAL_MEDIA_PROCESSING=true`)
  - Note: video processing uses a smaller default batch (currently 5) to control costs.
- Public consumer progress UI now supports **video processing status**:
  - Public endpoint now returns both `audio` and `video` status:
    - `GET /api/public/survey-responses/{id}/status`
    - File: `src/app/api/public/survey-responses/[id]/status/route.ts`
  - Public survey form now polls and shows “Video queued/processing/ready/failed” after submission:
    - File: `src/components/survey-response-form.tsx`
- Dashboard review UI now shows **video processing status + failure + retry**, similar to voice:
  - Added a “Video processing” summary card (queued/processing/ready/failed/deleted):
    - File: `src/app/dashboard/surveys/[id]/responses/page.tsx`
  - Table now shows a “Video queued/processing/ready/failed” badge and a retry button when failed:
    - File: `src/app/dashboard/surveys/[id]/responses/ResponsesTable.tsx`
- Important safety behavior:
  - Video processing **does not overwrite** existing typed-text/audio-derived analytics on “mixed” responses; it only fills analytics fields when empty.

### 2026-02-05 (DevX: non-interactive lint)
- `npm run lint` was blocked by an interactive Next.js “configure ESLint” prompt (not CI-safe).
- Added minimal ESLint config files so lint can run without prompts:
  - `.eslintrc.json` (extends `next/core-web-vitals`, `next/typescript`)
  - `.eslintignore` (ignores `.next`, `node_modules`, `dist`, `drizzle`, `coverage`)

---

## 🔎 Reference Products (multimodal + multilingual patterns to emulate)

These are **references for UX patterns and expectations**, not 1:1 replicas.

### Multilingual “no language selection” translation UX
- **Google Maps reviews**: automatically translates reviews into the device language; typically shows translated text with access to original.  
  - References: Google product blog + coverage (see: `blog.google/products/maps/local-reviews-your-language-wherever-you-are`)
- **YouTube comments**: per-comment “Translate” action (progressive disclosure; user controls translation).  
  - References: YouTube help + rollout coverage (see: `support.google.com/youtube/answer/15537051`)

### Voice-first / multimodal input expectations
- **WhatsApp voice message transcripts**: voice → transcript with clear “best-effort” behavior and language constraints; optional enablement.  
  - Reference: WhatsApp Help Center (see: `faq.whatsapp.com/241617298315321`)

### Browser constraints we must design for
- **MediaRecorder on iOS Safari**: supported, but audio MIME type support varies by OS/browser version; must feature-detect with `MediaRecorder.isTypeSupported(...)` and have fallbacks.
  - Reference: Can I use MediaRecorder support tables (see: `caniuse.com/mediarecorder`)

