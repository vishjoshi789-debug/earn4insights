import NextAuth, { type DefaultSession } from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { cookies } from "next/headers"
import { getUserByEmail, createUser } from "@/lib/user/userStore"
import { verifyPassword } from "@/lib/user/password"
import type { UserRole } from "@/lib/user/types"
import { loginRateLimit } from "@/lib/rate-limit-upstash"
import { ensureUserProfile } from "@/lib/auth/ensureUserProfile"
import { SIGNUP_INTENT_COOKIE, verifySignupIntent } from "@/lib/auth/signupIntent"

// Extend NextAuth types
declare module "next-auth" {
  interface Session {
    /** Per-login random nonce — binds the 2FA proof cookie to this login. */
    loginNonce?: string
    /** True while this login still needs to pass the 2FA challenge. */
    requires2FA?: boolean
    user: {
      id: string
      role: UserRole
    } & DefaultSession["user"]
  }

  interface User {
    role: UserRole
    /** Set by authorize() — 2FA is enabled and this device is not trusted. */
    twoFactorPending?: boolean
  }
}

/** Trusted-device cookie name — mirrors src/lib/twoFactor/devices.ts. */
const TRUSTED_DEVICE_COOKIE = 'e4i-trusted-device'

/** Read a single cookie value from a raw Cookie header. */
function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim()
    if (trimmed.startsWith(`${name}=`)) {
      try {
        return decodeURIComponent(trimmed.slice(name.length + 1))
      } catch {
        return trimmed.slice(name.length + 1)
      }
    }
  }
  return null
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  debug: process.env.NODE_ENV === 'development',
  logger: {
    error(code, ...message) {
      console.error('[NextAuth Error]', code, message)
    },
    warn(code, ...message) {
      console.warn('[NextAuth Warn]', code, message)
    },
    debug(code, ...message) {
      console.log('[NextAuth Debug]', code, message)
    },
  },
  providers: [
    // Google OAuth Provider
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code"
        }
      }
    }),
    
    // Email/Password Provider
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        // Rate limit login attempts by email (5 / 15 min, distributed via Upstash)
        const email = (credentials.email as string).toLowerCase()
        const rl = await loginRateLimit.limit(email)
        if (!rl.success) {
          console.warn('[Auth] Rate limited login attempt for:', email)
          return null
        }

        const user = await getUserByEmail(credentials.email as string)
        
        if (!user || !user.passwordHash) {
          return null
        }

        const isValid = await verifyPassword(
          credentials.password as string,
          user.passwordHash
        )

        if (!isValid) {
          return null
        }

        // Password is correct. Decide whether a 2FA challenge is still
        // required. 2FA applies to password accounts only — Google users
        // rely on Google's own 2FA.
        let twoFactorPending = false
        if (user.twoFactorEnabled) {
          twoFactorPending = true
          // Lazy import — keeps the 2FA service (otpauth/qrcode/bcrypt/DB)
          // out of the static graph this config shares with the Edge
          // middleware bundle.
          const { isDeviceTrusted } = await import('@/server/twoFactorService')
          const deviceCookie = readCookie(
            request?.headers?.get('cookie'),
            TRUSTED_DEVICE_COOKIE,
          )
          if (await isDeviceTrusted(user.id, deviceCookie)) {
            twoFactorPending = false // recognised device — skip the challenge
          }
        }

        // Diagnostic — surfaces in Vercel logs as `[2FA-DEBUG]`. Confirms
        // whether a fresh login picked up the DB two_factor_enabled flag
        // and whether this login still owes a 2FA challenge.
        console.log(
          '[2FA-DEBUG] authorize email:', email,
          'twoFactorEnabled:', user.twoFactorEnabled,
          'twoFactorPending:', twoFactorPending,
        )

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          twoFactorPending,
        }
      },
    }),
  ],

  pages: {
    signIn: "/login",
    signOut: "/login",
    error: "/login",
  },

  callbacks: {
    async signIn({ user, account }) {
      // ─────────────────────────────────────────────────────────────
      // Google OAuth branch.
      //
      // Decision matrix (see src/lib/auth/signupIntent.ts header):
      //
      //   user EXISTS                       → log them in (DB role wins,
      //                                       intent cookie ignored — a
      //                                       second click can't change role)
      //   user DOES NOT EXIST + valid intent → createUser(role = intent.role)
      //   user DOES NOT EXIST + no intent    → reject; redirect to
      //                                       /login?error=no_account
      //                                       (user must visit /signup to
      //                                       set their intended role)
      //
      // The /signup page POSTs to /api/auth/signup-intent before calling
      // signIn('google') so the intent cookie is present here. The /login
      // page never sets the cookie, so login attempts by brand-new users
      // are intentionally rejected — prevents silent account creation at a
      // guessed role (Stripe / Auth0 pattern).
      // ─────────────────────────────────────────────────────────────
      if (account?.provider === "google") {
        try {
          let existingUser = await getUserByEmail(user.email!)

          if (existingUser) {
            // Existing account — sign them in at their stored role.
            // Intent cookie (if any) is intentionally ignored so a second
            // visit to /signup cannot change a stored role.
            user.role = existingUser.role
            user.id = existingUser.id
            console.log('[Auth] Google sign-in for existing user:', user.email, 'role:', user.role)
            // Fall through to ensureUserProfile below.
          } else {
            // New Google identity — only proceed if a valid intent cookie
            // is present from the /signup flow. Use next/headers cookies()
            // since NextAuth v5 doesn't pass the Request to signIn callbacks.
            const cookieStore = await cookies()
            const intentCookieRaw = cookieStore.get(SIGNUP_INTENT_COOKIE)?.value ?? null
            const intent = await verifySignupIntent(intentCookieRaw)

            if (!intent) {
              // No valid intent → this was a Google LOGIN attempt by a
              // user who has never signed up. Reject with a redirect
              // string; the /login page renders the no_account banner.
              console.log('[Auth] Google sign-in rejected — no account, no signup intent:', user.email)
              return '/login?error=no_account'
            }

            // Valid intent → create the user at the chosen role.
            console.log('[Auth] Creating new Google user:', user.email, 'role:', intent.role)
            try {
              existingUser = await createUser({
                email: user.email!,
                name: user.name || '',
                role: intent.role,
                googleId: user.id,
                acceptedTerms: true,
                acceptedPrivacy: true,
              })
            } catch (createError: any) {
              // Race window between getUserByEmail and createUser — two
              // tabs completing OAuth simultaneously. Re-fetch and treat
              // as a normal existing-user sign-in.
              if (
                createError?.message?.includes('duplicate key') ||
                createError?.message?.includes('unique constraint') ||
                createError?.message?.includes('already exists')
              ) {
                console.log('[Auth] User already exists (race), fetching existing:', user.email)
                existingUser = await getUserByEmail(user.email!)
              } else {
                throw createError
              }
            }

            if (!existingUser) {
              console.error('[Auth] Failed to create or re-fetch Google user:', user.email)
              return false
            }

            user.role = existingUser.role
            user.id = existingUser.id
            console.log('[Auth] Google sign-up successful:', user.email, 'role:', user.role)
          }
        } catch (error) {
          console.error('[Auth] signIn error:', error)
          return false
        }
      }

      // Ensure a user_profiles row exists for every authenticated user.
      // Several tables (brand_icps, icp_match_scores, consent_records, etc.)
      // have FKs to user_profiles.id; without a profile row, those inserts
      // fail with a generic 500 in feature routes.
      //
      // ensureUserProfile is idempotent and handles its own duplicate-key
      // race conditions. We swallow errors so a transient DB hiccup never
      // blocks login — feature routes will surface any persistent issue
      // when they try to write profile-dependent data.
      if (user.id && user.email) {
        try {
          await ensureUserProfile(user.id, user.email)
        } catch (err) {
          console.error('[Auth] ensureUserProfile failed for', user.email, err)
        }
      }

      return true
    },

    async jwt({ token, user, account }) {
      // Initial sign in — populate token from user object
      if (user) {
        token.id = user.id
        token.role = user.role
        token.name = user.name
        token.email = user.email
        // Per-login nonce — the 2FA proof cookie is bound to this so it
        // cannot survive into a later login.
        token.loginNonce = crypto.randomUUID()
        // Whether this login still owes a 2FA challenge (credentials only;
        // Google sign-ins carry no twoFactorPending → falsy → false).
        token.twoFactorPending =
          (user as { twoFactorPending?: boolean }).twoFactorPending === true
      }

      return token
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
        session.loginNonce = token.loginNonce as string | undefined
        session.requires2FA = token.twoFactorPending === true
      }
      return session
    },
  },

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  secret: process.env.AUTH_SECRET,
  trustHost: true,
})
