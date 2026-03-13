import NextAuth, { type DefaultSession } from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { getUserByEmail, createUser } from "@/lib/user/userStore"
import { verifyPassword } from "@/lib/user/password"
import type { UserRole } from "@/lib/user/types"

// Extend NextAuth types
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: UserRole
    } & DefaultSession["user"]
  }
  
  interface User {
    role: UserRole
  }
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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
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

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
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
    async signIn({ user, account, profile }) {
      // For Google OAuth, check if user exists
      if (account?.provider === "google") {
        try {
          let existingUser = await getUserByEmail(user.email!)
          
          if (!existingUser) {
            // Auto-create user with Google OAuth
            console.log('[Auth] Creating new Google user:', user.email)
            try {
              existingUser = await createUser({
                email: user.email!,
                name: user.name || '',
                role: 'brand', // Default to brand, can be changed later
                googleId: user.id,
                acceptedTerms: true,
                acceptedPrivacy: true,
              })
            } catch (createError: any) {
              // Handle duplicate key constraint violations
              if (createError?.message?.includes('duplicate key') || 
                  createError?.message?.includes('unique constraint')) {
                console.log('[Auth] User already exists (duplicate key), fetching existing user')
                // Race condition: user was created between check and insert
                // Fetch the user that was created
                existingUser = await getUserByEmail(user.email!)
              } else {
                // Re-throw other errors
                throw createError
              }
            }
          }
          
          // Ensure we have a valid user before proceeding
          if (!existingUser) {
            console.error('[Auth] Failed to get or create user for:', user.email)
            return false // Reject sign-in
          }
          
          // User exists or was just created, allow sign in
          user.role = existingUser.role
          user.id = existingUser.id
          console.log('[Auth] Sign-in successful for:', user.email, 'Role:', user.role)
        } catch (error) {
          console.error('[Auth] signIn error:', error)
          return false // Reject sign-in on unexpected errors
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
      }
      
      return token
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as UserRole
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
