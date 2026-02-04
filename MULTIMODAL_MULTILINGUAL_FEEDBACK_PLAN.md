# 🌍🎙️ Multilingual + Multimodal Feedback & Survey Extension (Living Spec)

Last updated: 2026-02-04

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
- [ ] Add schema support for modality + processing states (no behavior change)
- [ ] Add upload infrastructure (object storage + signed URLs)
- [ ] Add feature flags per survey/campaign (e.g., `allowAudio`, `allowVideo`)

### Phase 1 — Audio + multilingual normalization (core value)
- [ ] UX: rating + “Tap to record” voice input + “Type instead” (progressive disclosure)
- [ ] Record in browser via `MediaRecorder` (mobile-friendly)
- [ ] Upload audio via signed URL
- [ ] Background transcription (STT)
- [ ] Language detection (from text/transcript)
- [ ] Translation → `normalized_text` (analytics language, e.g., English)
- [ ] Sentiment on normalized text (treat as signal, not truth)
- [ ] Robust error handling + non-blocking UX

### Phase 1.5 — Hardening + Admin/ops (quality)
- [ ] Retries + partial failure states
- [ ] Better progress/processing UI
- [ ] Admin review tools (view transcript, override language, delete media)
- [ ] Cost controls + file limits

### Phase 2 — Video feedback (optional, gated)
- [ ] Enable behind flags only after audio is stable
- [ ] UX safeguards: short duration, preview, re-record, explicit consent
- [ ] Storage limits + retention rules
- [ ] Moderation/review queue and abuse controls

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

