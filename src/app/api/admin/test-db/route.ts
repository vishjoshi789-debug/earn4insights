import { NextResponse } from 'next/server'
import { db } from '@/db'
import { products } from '@/db/schema'

/**
 * Test database connection
 * GET /api/admin/test-db
 */
export async function GET() {
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
