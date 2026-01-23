import { NextRequest, NextResponse } from 'next/server'
import { createUser } from '@/lib/user/userStore'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, name, role, provider, acceptedTerms, acceptedPrivacy } = body

    // Validate required fields
    if (!email || !name || !role || !acceptedTerms || !acceptedPrivacy) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Validate role
    if (role !== 'brand' && role !== 'consumer') {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      )
    }

    // Create user without password (OAuth user)
    await createUser({
      email,
      name,
      role,
      password: '', // OAuth users don't have passwords
      acceptedTerms: true,
      acceptedPrivacy: true,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Complete signup error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to complete signup' },
      { status: 500 }
    )
  }
}
