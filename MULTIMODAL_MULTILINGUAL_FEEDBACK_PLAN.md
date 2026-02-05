# 🌍🎙️ Multilingual + Multimodal Feedback & Survey Extension (Living Spec)

Last updated: 2026-02-05

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

