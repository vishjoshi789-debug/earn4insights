import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../_auth'
import { validateCsrfToken } from '@/lib/csrf'
import { updateCost, deleteCost, isValidCostCategory } from '@/db/repositories/platformAnalyticsRepository'

/**
 * PUT    /api/admin/platform-analytics/costs/[id]
 *        body: partial { category?, description?, amount?, isRecurring?, currency? }
 * DELETE /api/admin/platform-analytics/costs/[id]
 *
 * Both routes admin-gated + CSRF-protected. The month/enteredBy fields
 * are intentionally NOT updatable post-create — if you typed the wrong
 * month, delete and re-add.
 */

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  if (!validateCsrfToken(req)) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
  }

  const { id } = await ctx.params
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const patch: Parameters<typeof updateCost>[1] = {}
  if (body?.category !== undefined) {
    if (!isValidCostCategory(body.category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }
    patch.category = body.category
  }
  if (body?.description !== undefined) {
    patch.description = body.description == null ? null : String(body.description).slice(0, 500)
  }
  if (body?.amount !== undefined) {
    const amount = Number(body.amount)
    if (!Number.isFinite(amount) || amount < 0 || !Number.isInteger(amount)) {
      return NextResponse.json({ error: 'amount must be a non-negative integer (paise)' }, { status: 400 })
    }
    patch.amount = amount
  }
  if (body?.isRecurring !== undefined) {
    patch.isRecurring = !!body.isRecurring
  }
  if (body?.currency !== undefined) {
    patch.currency = String(body.currency).slice(0, 3).toUpperCase()
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No updatable fields supplied' }, { status: 400 })
  }

  try {
    const row = await updateCost(id, patch)
    if (!row) return NextResponse.json({ error: 'Cost not found' }, { status: 404 })
    return NextResponse.json({ ok: true, cost: row })
  } catch (err) {
    console.error('[platform-analytics/costs PUT] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update cost' },
      { status: 500 },
    )
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return auth.response

  if (!validateCsrfToken(req)) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
  }

  const { id } = await ctx.params
  try {
    const ok = await deleteCost(id)
    if (!ok) return NextResponse.json({ error: 'Cost not found' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[platform-analytics/costs DELETE] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete cost' },
      { status: 500 },
    )
  }
}
