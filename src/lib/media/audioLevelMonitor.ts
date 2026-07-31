/**
 * Live microphone level measurement, shared by every audio and video capture
 * surface.
 *
 * WHY THIS EXISTS
 * ---------------
 * Four production recordings (two different users, two months apart) contained
 * digital silence: valid WebM/Opus containers, correct duration, correct 20ms
 * frame cadence — but 12 bytes per frame, the Opus DTX/comfort-noise floor.
 * The recorder code was correct; the microphone simply produced no signal
 * (muted OS input, wrong device, or the user never spoke).
 *
 * Nothing surfaced that to anyone. The UI showed a normal timer and a pulsing
 * icon, the upload succeeded, and Whisper transcribed the silence to its
 * well-known hallucination ("you") — which then entered feedback text, the CSV
 * export, and sentiment analysis as if a consumer had said it.
 *
 * So the fix is two-part: show the user a live level while recording (so a dead
 * mic is obvious immediately), and refuse to upload a take that never rose
 * above the floor.
 *
 * THRESHOLD POLICY — deliberately permissive
 * ------------------------------------------
 * Blocking a real user costs feedback that is gone forever; letting a quiet
 * recording through costs almost nothing. So this only catches a *dead track*,
 * not a quiet one:
 *
 *   digital silence (what we observed) : peak ~0.000
 *   live mic, quiet room (room tone)   : peak ~0.005 - 0.02
 *   whispered / soft speech            : peak ~0.05+
 *   normal speech                      : peak ~0.2 - 0.8
 *
 * SILENCE_PEAK_THRESHOLD sits at 0.015 — above the digital-zero floor, but
 * roughly 3x below even whispered speech. It measures PEAK across the entire
 * take, not an average, because speech is bursty: a single word anywhere in a
 * recording clears it. Only a track that never once crossed 1.5% of full scale
 * is treated as silent.
 *
 * FAILS OPEN. If AudioContext is unavailable or throws, `createAudioLevelMonitor`
 * returns null and callers must allow the upload. We never block on our own
 * inability to measure.
 */

/** Peak normalized amplitude (0..1) below which a whole take counts as silent. */
export const SILENCE_PEAK_THRESHOLD = 0.015

export type AudioLevelMonitor = {
  /** Smoothed 0..1 level for a live meter. */
  getLevel: () => number
  /** Highest peak observed since start (0..1). */
  getPeak: () => number
  /** True only if the entire take stayed below SILENCE_PEAK_THRESHOLD. */
  isSilent: () => boolean
  /** Release the AudioContext. Safe to call more than once. */
  stop: () => void
}

/**
 * Attach a level monitor to a live capture stream.
 *
 * Taps the stream read-only via an AnalyserNode — it does NOT alter the audio
 * that MediaRecorder receives, and is not connected to any destination, so
 * nothing is played back to the user (which would cause feedback howl).
 *
 * Returns null when the browser can't support it; treat null as "unable to
 * measure" and allow the recording through.
 */
export function createAudioLevelMonitor(stream: MediaStream): AudioLevelMonitor | null {
  if (typeof window === 'undefined') return null

  const Ctx: typeof AudioContext | undefined =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctx) return null

  // A video stream carries an audio track too — that track has the same
  // failure mode, so video is monitored exactly like audio.
  if (stream.getAudioTracks().length === 0) return null

  let ctx: AudioContext
  let analyser: AnalyserNode
  let source: MediaStreamAudioSourceNode
  try {
    ctx = new Ctx()
    analyser = ctx.createAnalyser()
    analyser.fftSize = 2048
    // Deliberately NOT connected to ctx.destination — connecting would play the
    // mic back through the speakers and cause howl.
    source = ctx.createMediaStreamSource(stream)
    source.connect(analyser)
  } catch {
    return null
  }

  const buf = new Uint8Array(analyser.fftSize)
  let smoothed = 0
  let peak = 0
  let raf = 0
  let stopped = false

  const sample = () => {
    if (stopped) return
    analyser.getByteTimeDomainData(buf)

    // Peak absolute deviation from the 128 centre line, normalized to 0..1.
    // Peak (not RMS) because speech is bursty — one syllable should clear the
    // gate even if the recording is mostly pauses.
    let maxDev = 0
    for (let i = 0; i < buf.length; i++) {
      const dev = Math.abs(buf[i] - 128)
      if (dev > maxDev) maxDev = dev
    }
    const level = maxDev / 128

    if (level > peak) peak = level
    // Fast attack, slow release — the meter tracks speech but doesn't flicker.
    smoothed = level > smoothed ? level : smoothed * 0.85 + level * 0.15

    raf = requestAnimationFrame(sample)
  }
  raf = requestAnimationFrame(sample)

  return {
    getLevel: () => smoothed,
    getPeak: () => peak,
    isSilent: () => peak < SILENCE_PEAK_THRESHOLD,
    stop: () => {
      if (stopped) return
      stopped = true
      if (raf) cancelAnimationFrame(raf)
      try { source.disconnect() } catch { /* already gone */ }
      try { void ctx.close() } catch { /* already closed */ }
    },
  }
}

/** User-facing copy shown when an audio take is rejected as silent. */
export const SILENT_RECORDING_MESSAGE =
  "We couldn't hear anything in that recording. Check that your microphone isn't muted and that the right input device is selected, then try again."

/**
 * Video WARNS rather than blocks — deliberately different from audio.
 *
 * Silent audio contains nothing at all, so rejecting it loses nothing. A silent
 * video still carries its visual content, and that content is often the whole
 * point: a product defect, damaged packaging, how something looks in use. Those
 * are legitimate submissions where narration is incidental, so destroying the
 * clip to enforce an audio rule would throw away real feedback.
 *
 * The warning still catches the accidental dead-mic case — the user sees it
 * immediately and can re-record — while leaving deliberate visual feedback
 * intact. Do not "consistency-fix" this into a hard block.
 */
export const SILENT_VIDEO_WARNING =
  "We couldn't hear any audio in this video. If you meant to narrate it, check your microphone isn't muted and record again — otherwise you can submit it as is."
