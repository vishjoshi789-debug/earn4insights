import { NextResponse } from 'next/server'
import { db } from '@/db'
import { users, passwordResetTokens } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { Resend } from 'resend'
import { randomBytes, createHash } from 'crypto'
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit'

const resend = new Resend(process.env.RESEND_API_KEY)

const TOKEN_EXPIRY_MS = 60 * 60 * 1000 // 1 hour

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function POST(request: Request) {
  try {
    const { email } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Rate limit: 3 requests per 15 minutes per email
    const rl = checkRateLimit(`forgot-pwd:${normalizedEmail}`, {
      maxRequests: 3,
      windowSeconds: 900,
    })
    if (!rl.allowed) {
      // Still return 200 to prevent email enumeration
      return NextResponse.json({
        message: 'If an account with that email exists, a password reset link has been sent.',
      })
    }

    // Look up user — always return the same response to prevent email enumeration
    const [user] = await db
      .select({ id: users.id, email: users.email, name: users.name, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1)

    if (!user || !user.passwordHash) {
      // User doesn't exist or is Google-only — don't reveal this
      return NextResponse.json({
        message: 'If an account with that email exists, a password reset link has been sent.',
      })
    }

    // Generate secure token
    const rawToken = randomBytes(32).toString('hex')
    const tokenHash = hashToken(rawToken)
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS)

    // Store hashed token in DB
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    })

    // Build reset URL
    const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`

    // Send email via Resend
    if (process.env.RESEND_API_KEY) {
      const { error } = await resend.emails.send({
        from: process.env.EMAIL_FROM || 'noreply@earn4insights.com',
        to: normalizedEmail,
        subject: 'Reset your Earn4Insights password',
        html: buildResetEmailHTML(user.name || 'there', resetUrl),
      })

      if (error) {
        console.error('[ForgotPassword] Resend error:', error)
        return NextResponse.json(
          { error: 'Failed to send email. Please try again.' },
          { status: 500 }
        )
      }
    } else {
      // Dev fallback: log to console
      console.log(`[ForgotPassword] Reset link for ${normalizedEmail}: ${resetUrl}`)
    }

    return NextResponse.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    })
  } catch (error) {
    console.error('[ForgotPassword] Error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}

function buildResetEmailHTML(name: string, resetUrl: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f5;">
        <div style="max-width: 600px; margin: 40px auto; padding: 0;">
          <div style="background: #18181b; color: white; padding: 24px 32px; border-radius: 12px 12px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 22px; font-weight: 700;">Earn4Insights</h1>
            <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.7;">Real Voices. Measurable Intelligence.</p>
          </div>
          <div style="background: #ffffff; padding: 32px; border-radius: 0 0 12px 12px; border: 1px solid #e4e4e7; border-top: none;">
            <h2 style="margin: 0 0 16px; font-size: 20px;">Password Reset</h2>
            <p>Hi ${name},</p>
            <p>We received a request to reset your password. Click the button below to choose a new password:</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
                Reset Password
              </a>
            </div>
            <p style="font-size: 14px; color: #71717a;">
              This link expires in <strong>1 hour</strong>. If you didn't request this, you can safely ignore this email.
            </p>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
            <p style="font-size: 12px; color: #a1a1aa;">
              If the button doesn't work, copy and paste this URL into your browser:<br />
              <a href="${resetUrl}" style="color: #2563eb; word-break: break-all;">${resetUrl}</a>
            </p>
          </div>
        </div>
      </body>
    </html>
  `
}
