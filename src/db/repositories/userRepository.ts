import 'server-only'

import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Lightweight user-table reads. The full user/profile blob lives in
 * userProfileRepository — this file is for direct `users` queries
 * (id-based lookups, role-based lookups) without joining the profile.
 */

// ── Admin id cache ───────────────────────────────────────────────
//
// Admin set changes rarely. We cache it in-memory for 5 minutes to avoid
// querying the users table on every support-event fan-out. A stale cache
// is fine — at worst, a newly-promoted admin sees support pushes 5 min
// late; a newly-demoted admin sees a few extra pushes for 5 min. Neither
// is a security concern: admin role is also checked at the route layer.

const ADMIN_CACHE_TTL_MS = 5 * 60 * 1000
let adminCache: { ids: string[]; expiresAt: number } | null = null

export async function getAdminUserIds(force = false): Promise<string[]> {
  const now = Date.now()
  if (!force && adminCache && adminCache.expiresAt > now) return adminCache.ids
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin'))
  const ids = rows.map((r) => r.id)
  adminCache = { ids, expiresAt: now + ADMIN_CACHE_TTL_MS }
  return ids
}

/** Force-invalidate the admin cache — call after promoting/demoting an admin. */
export function invalidateAdminCache(): void {
  adminCache = null
}

export async function findUserById(userId: string) {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  return rows[0] ?? null
}

export async function findUserEmail(userId: string): Promise<string | null> {
  const rows = await db.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1)
  return rows[0]?.email ?? null
}
