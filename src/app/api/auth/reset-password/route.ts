import { NextResponse } from 'next/server'
import { db } from '@/db'
import { users, passwordResetTokens } from '@/db/schema'
import { eq, and, isNull, gt } from 'drizzle-orm'
import { createHash } from 'crypto'
import { hashPassword } from '@/lib/user/password'
import { checkRateLimit } from '@/lib/rate-limit'

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json()

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Reset token is required' },
        { status: 400 }
      )
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    // Rate limit: 5 attempts per 15 minutes per token
    const tokenPrefix = token.slice(0, 16)
    const rl = checkRateLimit(`reset-pwd:${tokenPrefix}`, {
      maxRequests: 5,
      windowSeconds: 900,
    })
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429 }
      )
    }

    // Hash the incoming token and look it up
    const tokenHash = hashToken(token)
    const now = new Date()

    const [resetRecord] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, now)
        )
      )
      .limit(1)

    if (!resetRecord) {
      return NextResponse.json(
        { error: 'Invalid or expired reset link. Please request a new one.' },
        { status: 400 }
      )
    }

    // Hash the new password and update the user
    const newPasswordHash = await hashPassword(password)

    await db
      .update(users)
      .set({ passwordHash: newPasswordHash, updatedAt: now })
      .where(eq(users.id, resetRecord.userId))

    // Mark the token as used
    await db
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(eq(passwordResetTokens.id, resetRecord.id))

    return NextResponse.json({
      message: 'Password reset successfully. You can now sign in with your new password.',
    })
  } catch (error) {
    console.error('[ResetPassword] Error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
