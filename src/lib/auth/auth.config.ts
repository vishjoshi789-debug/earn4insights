import NextAuth, { type DefaultSession } from "next-auth"
import Google from "next-auth/providers/google"
import Credentials from "next-auth/providers/credentials"
import { getUserByEmail, getUserById } from "@/lib/user/userStore"
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
  providers: [
    // Google OAuth Provider
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
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
          throw new Error("Email and password required")
        }

        const user = await getUserByEmail(credentials.email as string)
        
        if (!user || !user.passwordHash) {
          throw new Error("Invalid email or password")
        }

        const isValid = await verifyPassword(
          credentials.password as string,
          user.passwordHash
        )

        if (!isValid) {
          throw new Error("Invalid email or password")
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
        const existingUser = await getUserByEmail(user.email!)
        
        if (!existingUser) {
          // User needs to complete signup with role selection
          // Redirect to signup completion
          return `/signup/complete?email=${encodeURIComponent(user.email!)}&name=${encodeURIComponent(user.name!)}&provider=google`
        }
        
        // User exists, allow sign in
        user.role = existingUser.role
        user.id = existingUser.id
      }
      
      return true
    },

    async jwt({ token, user, account }) {
      // Initial sign in
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      
      // Subsequent requests - fetch fresh user data
      if (token.id) {
        const freshUser = await getUserById(token.id as string)
        if (freshUser) {
          token.role = freshUser.role
          token.name = freshUser.name
          token.email = freshUser.email
        }
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
})
