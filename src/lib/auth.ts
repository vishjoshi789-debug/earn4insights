import { NextRequest, NextResponse } from 'next/server'

/**
 * Simple authentication middleware for admin endpoints
 * Accepts API key via:
 *  - Authorization: Bearer <key>  (recommended)
 *  - x-admin-api-key: <key>       (alternative header)
 *
 * Query parameter auth (?apiKey=) has been REMOVED for security
 * (keys leak in logs, browser history, and referrer headers).
 */
export function authenticateAdmin(request: NextRequest): boolean {
  const apiKey = process.env.ADMIN_API_KEY

  if (!apiKey) {
    // In production, NEVER allow unprotected access
    if (process.env.NODE_ENV === 'production') {
      console.error('🚨 ADMIN_API_KEY not set in production! Admin endpoints blocked.')
      return false
    }
    console.warn('⚠️ ADMIN_API_KEY not set, admin endpoints are unprotected!')
    return true // Allow access if no key is configured (development mode)
  }

  // Check Authorization header (primary method)
  const authHeader = request.headers.get('Authorization')
  if (authHeader === `Bearer ${apiKey}`) {
    return true
  }

  // Check x-admin-api-key header (alternative)
  const headerKey = request.headers.get('x-admin-api-key')
  if (headerKey === apiKey) {
    return true
  }

  return false
}

/**
 * Create unauthorized response
 */
export function unauthorizedResponse() {
  return NextResponse.json(
    { 
      error: 'Unauthorized', 
      message: 'Valid API key required. Provide via Authorization header as "Bearer <key>" or x-admin-api-key header.' 
    },
    { status: 401 }
  )
}

/**
 * Wrapper for admin route handlers
 */
export function withAdminAuth(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest) => {
    if (!authenticateAdmin(request)) {
      return unauthorizedResponse()
    }
    return handler(request)
  }
}
