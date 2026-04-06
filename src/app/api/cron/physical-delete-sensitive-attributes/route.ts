/**
 * Cron: Physical Delete Sensitive Attributes
 * GET /api/cron/physical-delete-sensitive-attributes
 *
 * Runs daily at 01:00 UTC (see vercel.json), before the account-deletion cron (02:00 UTC).
 *
 * Permanently deletes consumer_sensitive_attributes rows that were soft-deleted
 * more than 30 days ago. This implements:
 *  - GDPR Art. 17 right to erasure (physical deletion after soft-delete grace period)
 *  - Automatic cascade when a sensitive consent category is revoked
 *    (softDeleteSensitiveAttribute is called by the consent revocation flow)
 *
 * The repository caps results at 500 rows per run to keep the function within
 * Vercel's execution time limit. Any overflow is processed on subsequent daily runs.
 *
 * Auth: Bearer CRON_SECRET header (Vercel Cron injects this automatically).
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getAttributesPendingPhysicalDeletion,
  physicallyDeleteAttribute,
} from '@/db/repositories/sensitiveAttributeRepository'

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const pending = await getAttributesPendingPhysicalDeletion()

    let deleted = 0
    let failed = 0

    for (const row of pending) {
      try {
        await physicallyDeleteAttribute(row.id, row.userId)
        deleted++
      } catch (err) {
        failed++
        console.error(
          `[Cron physical-delete-sensitive-attributes] Failed to delete attributeId=${row.id} userId=${row.userId}:`,
          err
        )
      }
    }

    return NextResponse.json({
      success: true,
      processed: pending.length,
      deleted,
      failed,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Cron physical-delete-sensitive-attributes] Fatal error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
