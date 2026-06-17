import type { DefaultSession, Session, User } from "next-auth"
import type { JWT } from "next-auth/jwt"
import type { UserRole } from "@/lib/user/types"

/**
 * Shared, DB-free NextAuth callbacks + type augmentation.
 *
 * These run in BOTH the full config (auth.config.ts, Node — sign-in route +
 * server `auth()`) and the edge config (auth.edge.ts — middleware). Keeping
 * them in one module guarantees the two configs can't drift, and keeping them
 * free of any `@/db` / postgres import is what lets middleware bundle for the
 * Edge runtime. (The DB-heavy `signIn` callback stays in auth.config.ts.)
 *
 * `crypto.randomUUID()` is a global in both the Node and Edge runtimes.
 */

// ── NextAuth type augmentation (lives here so every importer sees it) ──
declare module "next-auth" {
  interface Session {
    /** Per-login random nonce — binds the 2FA proof cookie to this login. */
    loginNonce?: string
    /** True while this login still needs to pass the 2FA challenge. */
    requires2FA?: boolean
    user: {
      id: string
      role: UserRole
      // 3.5E — multi-role capability flags. Drive the RoleSwitcher
      // visibility + the sidebar primary-view filter. Mirror the
      // boolean columns on users (migration 022).
      isBrand?: boolean
      isConsumer?: boolean
      isInfluencer?: boolean
    } & DefaultSession["user"]
  }

  interface User {
    role: UserRole
    /** Set by authorize() — 2FA is enabled and this device is not trusted. */
    twoFactorPending?: boolean
    isBrand?: boolean
    isConsumer?: boolean
    isInfluencer?: boolean
  }
}

/**
 * Copy identity + capability flags + the per-login nonce onto the JWT at
 * sign-in. `user` is only present on the initial sign-in pass (Node route
 * handler); on every later pass (including any middleware invocation) `user`
 * is undefined and the token is returned unchanged — so no new nonce is ever
 * minted outside a real login.
 */
export async function jwtCallback({
  token,
  user,
}: {
  token: JWT
  user?: User
}): Promise<JWT> {
  if (user) {
    token.id = user.id
    token.role = user.role
    token.name = user.name
    token.email = user.email
    // 3.5E — capability flags propagated to JWT so they survive
    // across requests without re-reading from DB.
    token.isBrand = (user as { isBrand?: boolean }).isBrand === true
    token.isConsumer = (user as { isConsumer?: boolean }).isConsumer === true
    token.isInfluencer = (user as { isInfluencer?: boolean }).isInfluencer === true
    // Per-login nonce — the 2FA proof cookie is bound to this so it
    // cannot survive into a later login.
    token.loginNonce = crypto.randomUUID()
    // Whether this login still owes a 2FA challenge (credentials only;
    // Google sign-ins carry no twoFactorPending → falsy → false).
    token.twoFactorPending =
      (user as { twoFactorPending?: boolean }).twoFactorPending === true
  }

  return token
}

/**
 * Shape `session` (and thus middleware's `req.auth`) from the JWT. This is the
 * callback middleware relies on to expose `req.auth.user.role`,
 * `req.auth.loginNonce` (B7 — 2FA proof binding), and `req.auth.requires2FA`
 * (the 2FA interlock). DB-free: every field comes straight off the token.
 */
export async function sessionCallback({
  session,
  token,
}: {
  session: Session
  token: JWT
}): Promise<Session> {
  if (token) {
    session.user.id = token.id as string
    session.user.role = token.role as UserRole
    session.user.isBrand = token.isBrand === true
    session.user.isConsumer = token.isConsumer === true
    session.user.isInfluencer = token.isInfluencer === true
    session.loginNonce = token.loginNonce as string | undefined
    session.requires2FA = token.twoFactorPending === true
  }
  return session
}
