import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { feedback } from '@/db/schema'
import { analyzeSentiment } from '@/server/sentimentService'

/**
 * CSV Import endpoint for bulk feedback upload.
 * Expects multipart/form-data with a CSV file.
 * 
 * CSV columns (required): productId, feedbackText
 * CSV columns (optional): rating, userName, userEmail, category
 * 
 * Maximum: 500 rows per upload.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only brand role can import
    if ((session.user as any).role !== 'brand') {
      return NextResponse.json({ error: 'Only brand users can import feedback' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'CSV file is required' }, { status: 400 })
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'File must be a .csv' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
    }

    const text = await file.text()
    const rows = parseCSV(text)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSV is empty or has no valid rows' }, { status: 400 })
    }

    if (rows.length > 500) {
      return NextResponse.json({ error: 'Maximum 500 rows per upload' }, { status: 400 })
    }

    // Validate required columns
    const headers = Object.keys(rows[0])
    if (!headers.includes('productId') || !headers.includes('feedbackText')) {
      return NextResponse.json(
        { error: 'CSV must have "productId" and "feedbackText" columns' },
        { status: 400 }
      )
    }

    let imported = 0
    let skipped = 0
    const errors: string[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        const productId = row.productId?.trim()
        const feedbackText = row.feedbackText?.trim()

        if (!productId || !feedbackText || feedbackText.length < 10) {
          skipped++
          continue
        }

        const sentimentResult = await analyzeSentiment(feedbackText)

        await db.insert(feedback).values({
          productId,
          feedbackText,
          rating: row.rating ? parseInt(row.rating) : null,
          userName: row.userName || 'CSV Import',
          userEmail: row.userEmail || session.user.email || 'import@system',
          sentiment: sentimentResult.sentiment,
          category: row.category || 'general',
          status: 'approved',
        })

        imported++
      } catch (err) {
        skipped++
        errors.push(`Row ${i + 2}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      total: rows.length,
      errors: errors.slice(0, 10),
    })
  } catch (error) {
    console.error('[CSV Import] Error:', error)
    return NextResponse.json({ error: 'Failed to import CSV' }, { status: 500 })
  }
}

// ── CSV Parser ────────────────────────────────────────────────────

function parseCSV(text: string): Array<Record<string, string>> {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length < 2) return []

  const headers = parseLine(lines[0])
  const rows: Array<Record<string, string>> = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i])
    const row: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || ''
    }
    rows.push(row)
  }

  return rows
}

function parseLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}
