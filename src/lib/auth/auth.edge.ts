import NextAuth, { type NextAuthConfig } from "next-auth"
import { jwtCallback, sessionCallback } from "./authCallbacks"

/**
 * Edge-safe NextAuth config for **middleware only**.
 *
 * Middleware runs on the Vercel Edge runtime, which can't load the Node-only
 * postgres.js driver. The full config (auth.config.ts) statically imports
 * `@/db` (via userStore / ensureUserProfile / signIn), so importing it into
 * middleware silently broke the Edge bundle and middleware never ran.
 *
 * This config has NO providers and NO DB imports — middleware only needs to
 * decode the existing JWT and run the `session` callback to populate
 * `req.auth` (id, role, capability flags, loginNonce, requires2FA). Sign-in,
 * the Credentials/Google providers, and the DB-heavy `signIn` callback all
 * live in auth.config.ts and run in the Node route handler.
 *
 * The shared jwt/session callbacks keep this in lockstep with the full config.
 */
export const edgeAuthConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
    signOut: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days — must match auth.config.ts
  },
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: [],
  callbacks: {
    jwt: jwtCallback,
    session: sessionCallback,
  },
}

export const { auth } = NextAuth(edgeAuthConfig)
