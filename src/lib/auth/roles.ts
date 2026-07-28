/**
 * Role helpers.
 *
 * Single home for the admin-role check so the cast lives in one place. The
 * `UserRole` TS union only covers 'brand' | 'consumer' | 'influencer' while the
 * DB genuinely stores `role = 'admin'`, so every callsite would otherwise have
 * to repeat `(session.user.role as string) === 'admin'` (see CLAUDE.md §5,
 * "Admin role cast required").
 *
 * POLICY: admins bypass ownership checks platform-wide. Every ownership gate
 * added by the feedback/export access-control batches consults this helper, so
 * the rule is uniform rather than a patchwork of per-route exceptions. If that
 * policy ever narrows (e.g. read-only admin access), change it here and at the
 * callsites that consult it — do not reintroduce local casts.
 */

type SessionLike = { user?: { role?: unknown } | null } | null | undefined

/** True when the session belongs to a platform admin. */
export function isAdminSession(session: SessionLike): boolean {
  return (session?.user?.role as string) === 'admin'
}
