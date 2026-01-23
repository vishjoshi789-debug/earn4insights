import { auth } from "./auth.config"
import { getUserById } from "../user/userStore"
import type { User } from "../user/types"

/**
 * Get the currently authenticated user (server-side only)
 * Returns null if not authenticated
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = await auth()
  
  if (!session?.user?.id) {
    return null
  }

  const user = await getUserById(session.user.id)
  
  if (!user) {
    return null
  }

  // Remove sensitive data
  const { passwordHash, ...safeUser } = user
  return safeUser as User
}

/**
 * Require user to be authenticated
 * Throws error if not authenticated
 */
export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser()
  
  if (!user) {
    throw new Error("Unauthorized")
  }
  
  return user
}

/**
 * Require user to have specific role
 */
export async function requireRole(role: 'brand' | 'consumer'): Promise<User> {
  const user = await requireAuth()
  
  if (user.role !== role) {
    throw new Error(`Forbidden: ${role} access required`)
  }
  
  return user
}
