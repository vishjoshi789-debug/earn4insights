import { NextRequest, NextResponse } from 'next/server'

/**
 * Simple authentication middleware for admin endpoints
 * Checks for API key in Authorization header or query param
 */
export function authenticateAdmin(request: NextRequest): boolean {
  const apiKey = process.env.ADMIN_API_KEY

  if (!apiKey) {
    console.warn('⚠️ ADMIN_API_KEY not set, admin endpoints are unprotected!')
    return true // Allow access if no key is configured (development mode)
  }

  // Check Authorization header
  const authHeader = request.headers.get('Authorization')
  if (authHeader === `Bearer ${apiKey}`) {
    return true
  }

  // Check query parameter (for convenience in development)
  const { searchParams } = new URL(request.url)
  const queryKey = searchParams.get('apiKey')
  if (queryKey === apiKey) {
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
      message: 'Valid API key required. Provide in Authorization header as "Bearer <key>" or ?apiKey=<key>' 
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
