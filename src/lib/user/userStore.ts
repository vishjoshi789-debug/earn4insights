import 'server-only'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { User, CreateUserInput } from './types'
import { hashPassword } from './password'

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<User | null> {
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!result[0]) return null
  
  return {
    ...result[0],
    name: result[0].name || '',
    role: result[0].role as 'brand' | 'consumer',
    passwordHash: result[0].passwordHash || undefined,
    googleId: result[0].googleId || undefined,
    createdAt: result[0].createdAt.toISOString(),
    updatedAt: result[0].updatedAt.toISOString(),
    consent: result[0].consent as { termsAcceptedAt: string; privacyAcceptedAt: string },
  }
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1)
  if (!result[0]) return null
  
  return {
    ...result[0],
    name: result[0].name || '',
    role: result[0].role as 'brand' | 'consumer',
    passwordHash: result[0].passwordHash || undefined,
    googleId: result[0].googleId || undefined,
    createdAt: result[0].createdAt.toISOString(),
    updatedAt: result[0].updatedAt.toISOString(),
    consent: result[0].consent as { termsAcceptedAt: string; privacyAcceptedAt: string },
  }
}

/**
 * Get user by Google ID
 */
export async function getUserByGoogleId(googleId: string): Promise<User | null> {
  const result = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1)
  if (!result[0]) return null
  
  return {
    ...result[0],
    name: result[0].name || '',
    role: result[0].role as 'brand' | 'consumer',
    passwordHash: result[0].passwordHash || undefined,
    googleId: result[0].googleId || undefined,
    createdAt: result[0].createdAt.toISOString(),
    updatedAt: result[0].updatedAt.toISOString(),
    consent: result[0].consent as { termsAcceptedAt: string; privacyAcceptedAt: string },
  }
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
  
  const newUser = {
    id: userId,
    email: input.email.toLowerCase(),
    name: input.name,
    role: input.role,
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

  return {
    id: newUser.id,
    email: newUser.email,
    name: newUser.name,
    role: newUser.role,
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
  return result.map(u => ({
    ...u,
    name: u.name || '',
    role: u.role as 'brand' | 'consumer',
    passwordHash: u.passwordHash || undefined,
    googleId: u.googleId || undefined,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    consent: u.consent as { termsAcceptedAt: string; privacyAcceptedAt: string },
  }))
}

/**
 * Get users by role
 */
export async function getUsersByRole(role: 'brand' | 'consumer'): Promise<User[]> {
  const result = await db.select().from(users).where(eq(users.role, role))
  return result.map(u => ({
    ...u,
    name: u.name || '',
    role: u.role as 'brand' | 'consumer',
    passwordHash: u.passwordHash || undefined,
    googleId: u.googleId || undefined,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    consent: u.consent as { termsAcceptedAt: string; privacyAcceptedAt: string },
  }))
}
