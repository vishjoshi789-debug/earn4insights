import { NextRequest, NextResponse } from 'next/server'
import { sendRankingNotification } from '@/server/emailNotifications'
import { authenticateAdmin } from '@/lib/auth'
import { auth } from '@/lib/auth/auth.config'

/**
 * Test email notification endpoint
 * POST /api/admin/test-email
 *
 * Auth: accepts either
 *  - ADMIN_API_KEY via Authorization / x-admin-api-key header (ops/curl), or
 *  - a logged-in session with role 'brand' or 'admin' (in-app UI at
 *    /dashboard/rankings/test-email).
 *
 * Consumers cannot send test emails.
 */
export async function POST(request: NextRequest) {
  const apiKeyOk = authenticateAdmin(request)
  if (!apiKeyOk) {
    const session = await auth()
    const role = (session?.user as any)?.role
    if (!session?.user?.email || (role !== 'brand' && role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const body = await request.json()
    const { email, name } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    // Send test ranking notification
    const result = await sendRankingNotification({
      productName: 'Test Product',
      rank: 1,
      category: 'Technology & SaaS',
      previousRank: 3,
      score: 8.5,
      ownerEmail: email,
      ownerName: name || 'Test User',
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Test email sent to ${email}`,
        data: result.data,
      })
    } else {
      return NextResponse.json({
        success: false,
        message: 'Failed to send email',
        error: result.error,
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Test email error:', error)
    return NextResponse.json(
      { error: 'Failed to send test email', details: String(error) },
      { status: 500 }
    )
  }
}
