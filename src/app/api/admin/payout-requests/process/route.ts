/**
 * POST /api/admin/payout-requests/process
 *
 * Action a consumer payout request.
 *
 *   { requestId, action: 'approve', note? }
 *   { requestId, action: 'pay', paymentReference, note? }
 *   { requestId, action: 'deny', reason }
 *
 * ⚠️ 'pay' DOES NOT SEND MONEY, AND MUST NOT PRETEND TO. RazorpayX is an
 * unimplemented build-time constant, so every payout on this platform is a
 * manual bank or UPI transfer made by a human. What this endpoint does is make
 * the RECORD match what that human did, with a transaction reference to prove
 * it. That is the honest capability available today; automation is a separate
 * project needing an approved RazorpayX account.
 *
 * The naming matters: an endpoint called 'pay' that only writes a status is
 * exactly the false affordance this codebase keeps removing. Hence the required
 * `paymentReference` — you cannot record a payment you did not make.
 *
 * Auth: admin only.
 */
import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { isAdminSession } from '@/lib/auth/roles'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { db } from '@/db'
import { payoutRequests } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { awardPoints } from '@/server/pointsService'
import { logDataAccess } from '@/lib/audit-log'

export async function POST(req: NextRequest) {
  if (!validateCsrfToken(req)) return csrfErrorResponse()

  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'Admin access only' }, { status: 403 })
    }
    const adminId = session.user.id

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })

    const { requestId, action, note, paymentReference, reason } = body
    if (!requestId || !['approve', 'pay', 'deny'].includes(action)) {
      return NextResponse.json(
        { error: 'requestId and action (approve | pay | deny) are required' },
        { status: 400 },
      )
    }

    // ⚠️ A payment reference is REQUIRED to mark something paid. Without it
    // 'paid' is an unfalsifiable claim — nobody can later confirm the money
    // moved, which is the exact gap migration 041 exists to close.
    if (action === 'pay' && (typeof paymentReference !== 'string' || !paymentReference.trim())) {
      return NextResponse.json(
        { error: 'paymentReference is required to mark a request paid — record the bank/UPI transaction id' },
        { status: 400 },
      )
    }
    if (action === 'deny' && (typeof reason !== 'string' || !reason.trim())) {
      return NextResponse.json(
        { error: 'reason is required to deny a request' },
        { status: 400 },
      )
    }

    const [request] = await db
      .select()
      .from(payoutRequests)
      .where(eq(payoutRequests.id, requestId))
      .limit(1)

    if (!request) {
      return NextResponse.json({ error: 'Payout request not found' }, { status: 404 })
    }

    // ── approve: authorised, money has NOT moved ──────────────────
    if (action === 'approve') {
      // ⚠️ CONDITIONAL CLAIM, not a status read. Guarding in the WHERE means two
      // admins clicking at once cannot both succeed — the loser updates 0 rows
      // and is told so. Same shape as claimResolutionNotification (v16) and the
      // scheduled-launch cron guard. Reading `request.status` and then updating
      // would race.
      const claimed = await db
        .update(payoutRequests)
        .set({
          status: 'approved',
          processedAt: new Date(),
          processedBy: adminId,
          note: note || request.note,
        })
        .where(and(eq(payoutRequests.id, requestId), eq(payoutRequests.status, 'pending')))
        .returning({ id: payoutRequests.id })

      if (claimed.length === 0) {
        return NextResponse.json(
          { error: `Only a pending request can be approved (this one is '${request.status}')` },
          { status: 409 },
        )
      }
    }

    // ── pay: money has left; record it ────────────────────────────
    if (action === 'pay') {
      // Payable from 'pending' or 'approved' — an admin who transfers first and
      // records after should not be forced through a fictitious approve step.
      const claimed = await db
        .update(payoutRequests)
        .set({
          status: 'paid',
          paidAt: new Date(),
          paymentReference: paymentReference.trim(),
          processedAt: request.processedAt ?? new Date(),
          processedBy: adminId,
          note: note || request.note,
        })
        .where(
          and(
            eq(payoutRequests.id, requestId),
            // Never re-pay something already paid or denied.
            eq(payoutRequests.status, request.status === 'approved' ? 'approved' : 'pending'),
          ),
        )
        .returning({ id: payoutRequests.id })

      if (claimed.length === 0) {
        return NextResponse.json(
          { error: `Only a pending or approved request can be marked paid (this one is '${request.status}')` },
          { status: 409 },
        )
      }
    }

    // ── deny: refund the points ───────────────────────────────────
    if (action === 'deny') {
      const claimed = await db
        .update(payoutRequests)
        .set({
          status: 'denied',
          processedAt: new Date(),
          processedBy: adminId,
          note: reason.trim(),
        })
        .where(
          and(
            eq(payoutRequests.id, requestId),
            // Cannot deny what has been paid.
            eq(payoutRequests.status, request.status === 'approved' ? 'approved' : 'pending'),
          ),
        )
        .returning({ id: payoutRequests.id })

      if (claimed.length === 0) {
        return NextResponse.json(
          { error: `Only a pending or approved request can be denied (this one is '${request.status}')` },
          { status: 409 },
        )
      }

      // ⚠️ Refund only if the requester still exists. user_id is SET NULL on
      // erasure (031) and their user_points row was CASCADE-deleted, so there
      // is nothing to credit — a silent skip, not an error.
      //
      // The refund runs AFTER the claim succeeds, so a losing racer never
      // double-credits.
      if (request.userId) {
        await awardPoints(
          request.userId,
          request.points,
          'refund',
          requestId,
          `Payout request denied — ${reason.trim()}`,
        )
      }
    }

    await logDataAccess({
      userId: request.userId ?? 'deleted-user',
      action: 'write',
      dataType: 'events',
      accessedBy: adminId,
      reason: `Payout request ${action}`,
      metadata: {
        requestId,
        action,
        points: request.points,
        amount: request.amount,
        paymentReference: action === 'pay' ? paymentReference : undefined,
        previousStatus: request.status,
      },
    })

    return NextResponse.json({ success: true, action })
  } catch (error) {
    console.error('[AdminPayoutRequests POST]', error)
    return NextResponse.json({ error: 'Failed to process payout request' }, { status: 500 })
  }
}
