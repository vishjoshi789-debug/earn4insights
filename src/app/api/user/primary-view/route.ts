/**
 * Update the user's primary view / default dashboard.
 * POST /api/user/primary-view  body: { role: 'brand' | 'consumer' | 'influencer' }
 *
 * Updates users.role to the requested value. The user must have the
 * matching capability flag (is_brand / is_consumer / is_influencer)
 * — you can't switch to a role you've never enabled.
 *
 * Admin is excluded — it's runtime-only and never self-assignable
 * via this route, same as the signup intent allowlist.
 *
 * CSRF-gated. Auth required.
 *
 * Lives behind the RoleSwitcher's "Make X my default view" link
 * (3.5E). Session-only toggles don't hit this route — only the
 * permanent-change action does.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { validateCsrfToken, csrfErrorResponse } from '@/lib/csrf'
import { db } from '@/db'
import { users, auditLog } from '@/db/schema'
import { eq } from 'drizzle-orm'

const ALLOWED_VIEWS = new Set(['brand', 'consumer', 'influencer'])

export async function POST(req: NextRequest) {
  if (!validateCsrfToken(req)) return csrfErrorResponse()

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const requestedRole = body?.role
  if (typeof requestedRole !== 'string' || !ALLOWED_VIEWS.has(requestedRole)) {
    return NextResponse.json(
      { error: 'role must be one of: brand, consumer, influencer' },
      { status: 400 },
    )
  }

  const userId = session.user.id as string

  // Load the user fresh — don't trust the session for capability checks
  // (session can be stale after a recent flag flip).
  const [row] = await db
    .select({
      role: users.role,
      isBrand: users.isBrand,
      isConsumer: users.isConsumer,
      isInfluencer: users.isInfluencer,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!row) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Capability gate — must own the flag for the requested role.
  const hasCapability =
    (requestedRole === 'brand' && row.isBrand) ||
    (requestedRole === 'consumer' && row.isConsumer) ||
    (requestedRole === 'influencer' && row.isInfluencer)
  if (!hasCapability) {
    return NextResponse.json(
      { error: `You don't have ${requestedRole} access on this account` },
      { status: 403 },
    )
  }

  if (row.role === requestedRole) {
    // No-op — already the default. Return success so the UI flows the
    // same regardless.
    return NextResponse.json({ ok: true, role: row.role, changed: false })
  }

  const previousRole = row.role
  await db
    .update(users)
    .set({ role: requestedRole, updatedAt: new Date() })
    .where(eq(users.id, userId))

  // Audit — primary-view change is operationally interesting (drives
  // default dashboard + sidebar). Cheap insurance for "I clicked
  // something and now my dashboard looks different" support tickets.
  await db.insert(auditLog).values({
    userId,
    action: 'primary_view_changed',
    dataType: 'user',
    accessedBy: userId,
    metadata: { from: previousRole, to: requestedRole },
    reason: `Primary view changed: ${previousRole} → ${requestedRole}`,
  })

  return NextResponse.json({ ok: true, role: requestedRole, changed: true })
}
