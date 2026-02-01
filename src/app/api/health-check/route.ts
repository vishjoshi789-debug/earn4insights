import { db } from '@/db'
import { users } from '@/db/schema'
import { NextResponse } from 'next/server'

export async function GET() {
  const tests = []
  
  try {
    // Test 1: Check if DATABASE_URL exists
    const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
    tests.push({
      test: 'Environment Variable',
      status: dbUrl ? 'PASS' : 'FAIL',
      value: dbUrl ? 'Set (hidden for security)' : 'Not set'
    })

    // Test 2: Try to query users table
    try {
      const userCount = await db.select().from(users).limit(1)
      tests.push({
        test: 'Database Query',
        status: 'PASS',
        value: `Users table accessible, found ${userCount.length} users`
      })
    } catch (error: any) {
      tests.push({
        test: 'Database Query',
        status: 'FAIL',
        value: error.message
      })
    }

    // Test 3: Check AUTH_SECRET
    tests.push({
      test: 'AUTH_SECRET',
      status: process.env.AUTH_SECRET ? 'PASS' : 'FAIL',
      value: process.env.AUTH_SECRET ? 'Set' : 'Not set'
    })

    // Test 4: Check Google OAuth
    tests.push({
      test: 'GOOGLE_CLIENT_ID',
      status: process.env.GOOGLE_CLIENT_ID ? 'PASS' : 'FAIL',
      value: process.env.GOOGLE_CLIENT_ID ? 'Set' : 'Not set'
    })

    tests.push({
      test: 'GOOGLE_CLIENT_SECRET',
      status: process.env.GOOGLE_CLIENT_SECRET ? 'PASS' : 'FAIL',
      value: process.env.GOOGLE_CLIENT_SECRET ? 'Set' : 'Not set'
    })

    return NextResponse.json({
      success: true,
      tests,
      summary: {
        total: tests.length,
        passed: tests.filter(t => t.status === 'PASS').length,
        failed: tests.filter(t => t.status === 'FAIL').length
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
      tests
    }, { status: 500 })
  }
}
