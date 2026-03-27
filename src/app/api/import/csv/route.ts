import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { db } from '@/db'
import { feedback, importJobs, products } from '@/db/schema'
import { analyzeSentiment } from '@/server/sentimentService'
import { eq, and } from 'drizzle-orm'
import crypto from 'crypto'

/**
 * CSV Import endpoint for bulk feedback upload.
 * 
 * Supports two modes:
 * 1. Preview (action=preview): Parse CSV, return headers + sample rows for column mapping UI
 * 2. Import (action=import): Import with column mapping, dedup, and survey format detection
 * 
 * CSV columns are mapped via the `columnMapping` JSON field in FormData.
 * Legacy mode: If no columnMapping is provided, falls back to exact column names.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if ((session.user as any).role !== 'brand') {
      return NextResponse.json({ error: 'Only brand users can import feedback' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const action = formData.get('action') as string || 'import'
    const columnMappingStr = formData.get('columnMapping') as string | null
    const defaultProductId = formData.get('defaultProductId') as string | null

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

    // ── PREVIEW MODE ──────────────────────────────────────────
    if (action === 'preview') {
      const headers = Object.keys(rows[0])
      const surveyFormat = detectSurveyFormat(headers, rows)
      return NextResponse.json({
        headers,
        previewRows: rows.slice(0, 10),
        totalRows: rows.length,
        surveyFormat,
      })
    }

    // ── IMPORT MODE ───────────────────────────────────────────

    // Parse column mapping
    let columnMapping: Record<string, string> | null = null
    if (columnMappingStr) {
      try {
        columnMapping = JSON.parse(columnMappingStr)
      } catch {
        return NextResponse.json({ error: 'Invalid columnMapping JSON' }, { status: 400 })
      }
    }

    // Validate: either mapped or legacy columns must provide required fields
    const headers = Object.keys(rows[0])
    if (columnMapping) {
      const hasFeedback = !!columnMapping.feedbackText
      const hasProduct = !!columnMapping.productId || !!defaultProductId
      if (!hasFeedback) {
        return NextResponse.json({ error: 'Column mapping must include feedbackText' }, { status: 400 })
      }
      if (!hasProduct) {
        return NextResponse.json({ error: 'Column mapping must include productId or provide a defaultProductId' }, { status: 400 })
      }
    } else {
      // Legacy: require exact column names
      if (!headers.includes('productId') || !headers.includes('feedbackText')) {
        return NextResponse.json(
          { error: 'CSV must have "productId" and "feedbackText" columns (or use column mapping)' },
          { status: 400 }
        )
      }
    }

    // Verify defaultProductId belongs to this brand
    if (defaultProductId) {
      const [prod] = await db.select({ id: products.id }).from(products)
        .where(and(eq(products.id, defaultProductId), eq(products.ownerId, session.user.id)))
        .limit(1)
      if (!prod) {
        return NextResponse.json({ error: 'Default product not found or not owned by you' }, { status: 400 })
      }
    }

    // Detect survey format and transform if needed
    const surveyFormat = detectSurveyFormat(headers, rows)
    let processRows = rows
    if (surveyFormat && !columnMapping) {
      processRows = transformSurveyRows(rows, surveyFormat)
    }

    // Create import job record
    const [job] = await db.insert(importJobs).values({
      brandId: session.user.id,
      source: 'csv',
      fileName: file.name,
      columnMapping: columnMapping || undefined,
      status: 'processing',
      totalRows: processRows.length,
      defaultProductId: defaultProductId || undefined,
      metadata: surveyFormat ? { surveyFormat: surveyFormat.type } : undefined,
    }).returning()

    // Build dedup set from existing feedback (content hash)
    const dedupHashes = new Set<string>()
    let imported = 0
    let skipped = 0
    let duplicates = 0
    const errors: string[] = []

    for (let i = 0; i < processRows.length; i++) {
      const row = processRows[i]
      try {
        // Apply column mapping or use direct keys
        const productId = (columnMapping
          ? (columnMapping.productId ? row[columnMapping.productId]?.trim() : defaultProductId)
          : row.productId?.trim()) || defaultProductId || ''
          
        const feedbackText = (columnMapping
          ? row[columnMapping.feedbackText]?.trim()
          : row.feedbackText?.trim()) || ''

        if (!productId || !feedbackText || feedbackText.length < 10) {
          skipped++
          continue
        }

        // Dedup: hash productId + feedbackText
        const hash = crypto.createHash('sha256').update(`${productId}:${feedbackText}`).digest('hex')
        if (dedupHashes.has(hash)) {
          duplicates++
          continue
        }
        dedupHashes.add(hash)

        const ratingRaw = columnMapping
          ? (columnMapping.rating ? row[columnMapping.rating] : null)
          : row.rating
        const userName = columnMapping
          ? (columnMapping.userName ? row[columnMapping.userName] : null)
          : row.userName
        const userEmail = columnMapping
          ? (columnMapping.userEmail ? row[columnMapping.userEmail] : null)
          : row.userEmail
        const category = columnMapping
          ? (columnMapping.category ? row[columnMapping.category] : null)
          : row.category

        const sentimentResult = await analyzeSentiment(feedbackText)
        const rating = ratingRaw ? parseInt(ratingRaw) : null

        await db.insert(feedback).values({
          productId,
          feedbackText,
          rating: rating && rating >= 1 && rating <= 5 ? rating : null,
          userName: userName || 'CSV Import',
          userEmail: userEmail || session.user.email || 'import@system',
          sentiment: sentimentResult.sentiment,
          category: category || 'general',
          status: 'approved',
          multimodalMetadata: {
            importSource: 'csv',
            importJobId: job.id,
            fileName: file.name,
            ...(surveyFormat ? { surveyFormat: surveyFormat.type } : {}),
          },
        })

        imported++
      } catch (err) {
        skipped++
        errors.push(`Row ${i + 2}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    // Update job status
    await db.update(importJobs)
      .set({
        status: errors.length > 0 && imported === 0 ? 'failed' : errors.length > 0 ? 'partial' : 'completed',
        importedRows: imported,
        skippedRows: skipped,
        duplicateRows: duplicates,
        errors: errors.slice(0, 20),
        completedAt: new Date(),
      })
      .where(eq(importJobs.id, job.id))

    return NextResponse.json({
      success: true,
      jobId: job.id,
      imported,
      skipped,
      duplicates,
      total: processRows.length,
      errors: errors.slice(0, 10),
      surveyFormat: surveyFormat?.type || null,
    })
  } catch (error) {
    console.error('[CSV Import] Error:', error)
    return NextResponse.json({ error: 'Failed to import CSV' }, { status: 500 })
  }
}

// ── Survey Format Detection (P3) ─────────────────────────────────

type SurveyFormat = {
  type: 'typeform' | 'google_forms' | 'surveymonkey' | 'generic_qa'
  questionColumns: string[]
  identifierColumn?: string
  timestampColumn?: string
}

function detectSurveyFormat(headers: string[], rows: Record<string, string>[]): SurveyFormat | null {
  const lowerHeaders = headers.map(h => h.toLowerCase().trim())

  // Google Forms pattern: "Timestamp", then question columns
  if (lowerHeaders[0] === 'timestamp' && headers.length >= 3) {
    const questionCols = headers.filter((_, i) => i > 0 && !['email address', 'score'].includes(lowerHeaders[i]))
    if (questionCols.length >= 1) {
      return {
        type: 'google_forms',
        questionColumns: questionCols,
        timestampColumn: headers[0],
        identifierColumn: lowerHeaders.includes('email address') ? headers[lowerHeaders.indexOf('email address')] : undefined,
      }
    }
  }

  // SurveyMonkey pattern: "Respondent ID", "Collector ID", then Q columns
  if (lowerHeaders.includes('respondent id')) {
    const questionCols = headers.filter(h => {
      const l = h.toLowerCase()
      return !['respondent id', 'collector id', 'start date', 'end date', 'ip address', 'email address', 'custom data 1'].includes(l)
    })
    if (questionCols.length >= 1) {
      return {
        type: 'surveymonkey',
        questionColumns: questionCols,
        identifierColumn: lowerHeaders.includes('email address') ? headers[lowerHeaders.indexOf('email address')] : undefined,
        timestampColumn: lowerHeaders.includes('end date') ? headers[lowerHeaders.indexOf('end date')] : undefined,
      }
    }
  }

  // Typeform pattern: headers often start with question text and contain "submitted_at"/"token"
  if (lowerHeaders.includes('submitted_at') || lowerHeaders.includes('token')) {
    const skipCols = new Set(['submitted_at', 'token', 'landed_at', 'network_id'])
    const questionCols = headers.filter(h => !skipCols.has(h.toLowerCase()))
    if (questionCols.length >= 1) {
      return {
        type: 'typeform',
        questionColumns: questionCols,
        timestampColumn: lowerHeaders.includes('submitted_at') ? headers[lowerHeaders.indexOf('submitted_at')] : undefined,
      }
    }
  }

  // Generic Q&A: if most columns look like questions (long text, contain "?")
  const questionLikeHeaders = headers.filter(h => h.length > 20 || h.includes('?'))
  if (questionLikeHeaders.length >= Math.ceil(headers.length * 0.5) && headers.length >= 3) {
    return {
      type: 'generic_qa',
      questionColumns: questionLikeHeaders,
    }
  }

  return null
}

// Transform survey rows into feedback rows (Q: ... A: ... format)
function transformSurveyRows(rows: Record<string, string>[], format: SurveyFormat): Record<string, string>[] {
  const transformed: Record<string, string>[] = []

  for (const row of rows) {
    const answers = format.questionColumns
      .map(q => {
        const answer = row[q]?.trim()
        if (!answer) return null
        return `Q: ${q}\nA: ${answer}`
      })
      .filter(Boolean)
      .join('\n\n')

    if (answers.length < 10) continue

    transformed.push({
      productId: '', // Must be supplied via defaultProductId
      feedbackText: answers,
      userName: format.identifierColumn ? row[format.identifierColumn] || '' : '',
      userEmail: format.identifierColumn ? row[format.identifierColumn] || '' : '',
      category: 'survey_import',
    })
  }

  return transformed
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
