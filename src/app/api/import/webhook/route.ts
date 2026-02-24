import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { feedback } from '@/db/schema'
import { analyzeSentiment } from '@/server/sentimentService'

/**
 * Generic webhook receiver for external feedback services.
 * 
 * Accepts JSON payloads with the following schema:
 * {
 *   "apiKey": "...",
 *   "source": "zendesk" | "intercom" | "trustpilot" | "custom",
 *   "entries": [
 *     {
 *       "productId": "...",
 *       "text": "...",
 *       "rating": 4,          // optional, 1-5
 *       "author": "...",      // optional
 *       "email": "...",       // optional
 *       "category": "...",    // optional
 *       "timestamp": "..."    // optional ISO date
 *     }
 *   ]
 * }
 * 
 * Authentication: API key in body or X-API-Key header.
 * Rate limit: 100 entries per request.
 */

const VALID_API_KEY = process.env.IMPORT_WEBHOOK_API_KEY || 'webhook_secret_key'

export async function POST(request: NextRequest) {
  try {
    // Auth via header or body
    const headerKey = request.headers.get('X-API-Key')
    const body = await request.json()
    const apiKey = headerKey || body.apiKey

    if (!apiKey || apiKey !== VALID_API_KEY) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 })
    }

    const { source, entries } = body

    if (!source || typeof source !== 'string') {
      return NextResponse.json({ error: '"source" field is required' }, { status: 400 })
    }

    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json({ error: '"entries" array is required and must not be empty' }, { status: 400 })
    }

    if (entries.length > 100) {
      return NextResponse.json({ error: 'Maximum 100 entries per webhook call' }, { status: 400 })
    }

    let imported = 0
    let skipped = 0
    const errors: string[] = []

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      try {
        const productId = entry.productId?.trim()
        const text = entry.text?.trim()

        if (!productId || !text || text.length < 5) {
          skipped++
          continue
        }

        const sentimentResult = await analyzeSentiment(text)

        await db.insert(feedback).values({
          productId,
          feedbackText: text,
          rating: typeof entry.rating === 'number' ? Math.min(5, Math.max(1, entry.rating)) : null,
          userName: entry.author || `${source} Import`,
          userEmail: entry.email || `${source}@webhook.import`,
          sentiment: sentimentResult.sentiment,
          category: entry.category || source,
          status: 'approved',
        })

        imported++
      } catch (err) {
        skipped++
        errors.push(`Entry ${i}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    return NextResponse.json({
      success: true,
      source,
      imported,
      skipped,
      total: entries.length,
      errors: errors.slice(0, 10),
    })
  } catch (error) {
    console.error('[Webhook Import] Error:', error)
    return NextResponse.json({ error: 'Failed to process webhook' }, { status: 500 })
  }
}
