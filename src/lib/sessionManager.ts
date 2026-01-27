/**
 * Session Management for Event Tracking
 * Generates and manages session IDs for user activities
 */

import { cookies } from 'next/headers'
import { randomUUID } from 'crypto'

const SESSION_COOKIE_NAME = 'tracking_session_id'
const SESSION_DURATION = 30 * 60 * 1000 // 30 minutes

/**
 * Get or create a tracking session ID
 * Session persists for 30 minutes of inactivity
 */
export async function getOrCreateSessionId(): Promise<string> {
  const cookieStore = await cookies()
  let sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!sessionId) {
    // Generate new session ID
    sessionId = randomUUID()
    
    // Set cookie with 30 minute expiry
    cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATION / 1000, // Convert to seconds
      path: '/'
    })
  } else {
    // Refresh existing session expiry
    cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATION / 1000,
      path: '/'
    })
  }

  return sessionId
}

/**
 * Clear the tracking session
 */
export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

/**
 * Generate a one-time session ID (for client-side tracking without cookies)
 */
export function generateSessionId(): string {
  return randomUUID()
}
