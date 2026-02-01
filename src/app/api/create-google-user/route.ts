import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const email = searchParams.get('email')
  const name = searchParams.get('name')
  const googleId = searchParams.get('googleId')

  if (!email || !name || !googleId) {
    return NextResponse.json({ 
      error: 'Missing required parameters: email, name, googleId' 
    }, { status: 400 })
  }

  try {
    // Check if user exists
    const existing = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1)
    
    if (existing.length > 0) {
      return NextResponse.json({ 
        success: true,
        message: 'User already exists',
        user: existing[0]
      })
    }

    // Create new user
    const newUser = await db.insert(users).values({
      id: googleId,
      email: email.toLowerCase(),
      name: name,
      role: 'brand', // Default to brand, you can change this
      googleId: googleId,
      consent: {
        termsAcceptedAt: new Date().toISOString(),
        privacyAcceptedAt: new Date().toISOString()
      }
    }).returning()

    return NextResponse.json({ 
      success: true,
      message: 'User created successfully',
      user: newUser[0]
    })
  } catch (error: any) {
    console.error('Create user error:', error)
    return NextResponse.json({ 
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
