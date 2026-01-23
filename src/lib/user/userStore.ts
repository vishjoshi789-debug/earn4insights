import 'server-only'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import type { User, CreateUserInput } from './types'
import { hashPassword } from './password'

const DATA_DIR = join(process.cwd(), 'data')
const USERS_FILE = join(DATA_DIR, 'users.json')

/**
 * Ensure data directory and users file exist
 */
async function ensureDataFile() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true })
  }
  
  if (!existsSync(USERS_FILE)) {
    await writeFile(USERS_FILE, JSON.stringify([]), 'utf-8')
  }
}

/**
 * Read all users from file
 */
async function readUsers(): Promise<User[]> {
  await ensureDataFile()
  const data = await readFile(USERS_FILE, 'utf-8')
  return JSON.parse(data)
}

/**
 * Write users to file
 */
async function writeUsers(users: User[]): Promise<void> {
  await ensureDataFile()
  await writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8')
}

/**
 * Get user by ID
 */
export async function getUserById(id: string): Promise<User | null> {
  const users = await readUsers()
  return users.find(u => u.id === id) || null
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<User | null> {
  const users = await readUsers()
  return users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null
}

/**
 * Get user by Google ID
 */
export async function getUserByGoogleId(googleId: string): Promise<User | null> {
  const users = await readUsers()
  return users.find(u => u.googleId === googleId) || null
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

  const now = new Date().toISOString()
  
  const user: User = {
    id: `user_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    email: input.email.toLowerCase(),
    name: input.name,
    role: input.role,
    passwordHash,
    googleId: input.googleId,
    consent: {
      termsAcceptedAt: now,
      privacyAcceptedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  }

  // Initialize role-specific profiles
  if (input.role === 'brand') {
    user.brandProfile = {
      productsManaged: [],
    }
  } else {
    user.consumerProfile = {
      surveysCompleted: 0,
    }
  }

  const users = await readUsers()
  users.push(user)
  await writeUsers(users)

  // Return user without sensitive data
  const { passwordHash: _, ...safeUser } = user
  return safeUser as User
}

/**
 * Update user
 */
export async function updateUser(id: string, updates: Partial<User>): Promise<User | null> {
  const users = await readUsers()
  const index = users.findIndex(u => u.id === id)
  
  if (index === -1) {
    return null
  }

  users[index] = {
    ...users[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  }

  await writeUsers(users)
  return users[index]
}

/**
 * Get all users (admin only)
 */
export async function getAllUsers(): Promise<User[]> {
  return readUsers()
}

/**
 * Get users by role
 */
export async function getUsersByRole(role: 'brand' | 'consumer'): Promise<User[]> {
  const users = await readUsers()
  return users.filter(u => u.role === role)
}
