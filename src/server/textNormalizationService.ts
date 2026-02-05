import 'server-only'

import OpenAI from 'openai'

export type NormalizedTextResult = {
  originalLanguage: string | null
  normalizedLanguage: string
  normalizedText: string
}

function getNormalizedLanguage(): string {
  return process.env.NORMALIZED_LANGUAGE || 'en'
}

/**
 * Best-effort language detection + translation.
 *
 * - If `OPENAI_API_KEY` is set: uses a small chat call to detect ISO-639-1 language code
 *   and translate into the normalized analytics language (default: en).
 * - If missing: falls back to `und` + original text (no translation).
 */
export async function normalizeTextForAnalytics(text: string): Promise<NormalizedTextResult> {
  const normalizedLanguage = getNormalizedLanguage()
  const cleaned = (text || '').trim()
  if (!cleaned) {
    return {
      originalLanguage: null,
      normalizedLanguage,
      normalizedText: '',
    }
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return {
      originalLanguage: 'und',
      normalizedLanguage,
      normalizedText: cleaned,
    }
  }

  const client = new OpenAI({ apiKey })
  const model = process.env.OPENAI_TEXT_MODEL || 'gpt-4o-mini'

  const prompt = [
    'You are a careful language detector and translator.',
    `Target normalizedLanguage: ${normalizedLanguage}.`,
    '',
    'Return ONLY valid JSON with this exact shape:',
    '{"originalLanguage":"<iso-639-1 or und>","normalizedText":"<translated or original>"}',
    '',
    'Rules:',
    '- originalLanguage should be a 2-letter ISO-639-1 code when confident, otherwise "und".',
    `- If originalLanguage is already ${normalizedLanguage}, normalizedText must equal the original text (no paraphrasing).`,
    '- If translation is uncertain, keep meaning as close as possible.',
    '',
    'Text:',
    cleaned,
  ].join('\n')

  const completion: any = await client.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
  })

  const raw = completion?.choices?.[0]?.message?.content || ''
  try {
    const parsed = JSON.parse(raw)
    const originalLanguage =
      typeof parsed.originalLanguage === 'string' ? parsed.originalLanguage : 'und'
    const normalizedText =
      typeof parsed.normalizedText === 'string' ? parsed.normalizedText : cleaned
    return {
      originalLanguage,
      normalizedLanguage,
      normalizedText: normalizedText.trim(),
    }
  } catch {
    // Fallback to no translation if parsing fails
    return {
      originalLanguage: 'und',
      normalizedLanguage,
      normalizedText: cleaned,
    }
  }
}

