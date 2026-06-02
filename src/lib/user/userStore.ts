import 'server-only'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { User, CreateUserInput, UserRole } from './types'
import { hashPassword } from './password'
import { sendWelcomeNotifications } from '@/server/welcomeNotifications'

/**
 * Map a raw DB users row to the User domain type. Centralises the role
 * cast + boolean-flag exposure so getUserById / getUserByEmail /
 * getUserByGoogleId stay in lock-step. Phase 3.5A added the boolean
 * flags; surfacing them here gives downstream code (OnboardingGuard,
 * dashboard role-switcher, etc.) a single source of truth.
 */
function rowToUser(row: typeof users.$inferSelect): User {
  return {
    ...row,
    name: row.name || '',
    role: row.role as UserRole,
    isBrand: row.isBrand,
    isConsumer: row.isConsumer,
    isInfluencer: row.isInfluencer,
    passwordHash: row.passwordHash || undefined,
    googleId: row.googleId || undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    consent: row.consent as { termsAcceptedAt: string; privacyAcceptedAt: string },
  }
}

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<User | null> {
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!result[0]) return null
  return rowToUser(result[0])
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1)
  if (!result[0]) return null
  return rowToUser(result[0])
}

/**
 * Get user by Google ID
 */
export async function getUserByGoogleId(googleId: string): Promise<User | null> {
  const result = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1)
  if (!result[0]) return null
  return rowToUser(result[0])
}

/**
 * Create a new user
 */
export async function createUser(input: CreateUserInput): Promise<User> {
  // Validate consent
  if (!input.acceptedTerms || !input.acceptedPrivacy) {
    throw new Error('Terms and Privacy Policy must be accepted')
  }

  // Check if user already exists
  const existingUser = await getUserByEmail(input.email)
  if (existingUser) {
    throw new Error('User with this email already exists')
  }

  // Hash password if provided
  let passwordHash: string | undefined
  if (input.password) {
    passwordHash = await hashPassword(input.password)
  }

  const now = new Date()
  const userId = `user_${Date.now()}_${Math.random().toString(36).substring(7)}`

  // 3.5A — set the matching capability flag at create time so a fresh
  // signup is immediately self-consistent with the multi-role model.
  // role itself stays the "primary view" — boolean flags are the
  // cross-cutting feature gates.
  const isBrand = input.role === 'brand'
  const isConsumer = input.role === 'consumer'
  const isInfluencer = input.role === 'influencer'

  const newUser = {
    id: userId,
    email: input.email.toLowerCase(),
    name: input.name,
    role: input.role,
    isBrand,
    isConsumer,
    isInfluencer,
    passwordHash: passwordHash || null,
    googleId: input.googleId || null,
    consent: {
      termsAcceptedAt: now.toISOString(),
      privacyAcceptedAt: now.toISOString(),
    },
    createdAt: now,
    updatedAt: now,
  }

  await db.insert(users).values(newUser)

  // Await welcome email + WhatsApp. On Vercel serverless, fire-and-forget
  // promises are killed when the lambda response is sent — Resend never
  // receives the API call. Adds ~500ms-1s to signup but ensures the email
  // actually goes out.
  await sendWelcomeNotifications({
    email: newUser.email,
    name: newUser.name,
    role: newUser.role,
  })

  return {
    id: newUser.id,
    email: newUser.email,
    name: newUser.name,
    role: newUser.role as UserRole,
    isBrand,
    isConsumer,
    isInfluencer,
    passwordHash: newUser.passwordHash || undefined,
    googleId: newUser.googleId || undefined,
    consent: newUser.consent as { termsAcceptedAt: string; privacyAcceptedAt: string },
    createdAt: newUser.createdAt.toISOString(),
    updatedAt: newUser.updatedAt.toISOString(),
  }
}

/**
 * Update user
 */
export async function updateUser(id: string, updates: Partial<User>): Promise<User> {
  // Convert string dates to Date objects if present
  const dbUpdates: any = {
    ...updates,
    updatedAt: new Date(),
  }
  
  // Remove fields that shouldn't be updated directly
  delete dbUpdates.createdAt
  delete dbUpdates.id

  await db.update(users).set(dbUpdates).where(eq(users.id, id))

  const user = await getUserById(id)
  if (!user) {
    throw new Error('User not found after update')
  }

  return user
}

/**
 * Get all users (admin only)
 */
export async function getAllUsers(): Promise<User[]> {
  const result = await db.select().from(users)
  return result.map(rowToUser)
}

/**
 * Get users by role
 */
export async function getUsersByRole(role: UserRole): Promise<User[]> {
  const result = await db.select().from(users).where(eq(users.role, role))
  return result.map(rowToUser)
}
