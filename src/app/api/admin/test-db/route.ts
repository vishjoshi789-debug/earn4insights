import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { products } from '@/db/schema'
import { authenticateAdmin, unauthorizedResponse } from '@/lib/auth'

/**
 * Test database connection
 * GET /api/admin/test-db
 */
export async function GET(request: NextRequest) {
  if (!authenticateAdmin(request)) return unauthorizedResponse()
  try {
    // Try to query products
    const result = await db.select().from(products).limit(1)
    
    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      productCount: result.length,
    })
  } catch (error: any) {
    console.error('Database test error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500 })
  }
}
