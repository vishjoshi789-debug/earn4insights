import { NextRequest, NextResponse } from 'next/server'
import { sendWhatsAppRankingNotification } from '@/server/whatsappNotifications'

/**
 * Test WhatsApp notification endpoint
 * POST /api/admin/test-whatsapp
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phoneNumber, name } = body

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required (format: +1234567890)' },
        { status: 400 }
      )
    }

    // Validate phone number format
    if (!phoneNumber.startsWith('+')) {
      return NextResponse.json(
        { error: 'Phone number must start with + and country code (e.g., +911234567890)' },
        { status: 400 }
      )
    }

    // Send test WhatsApp notification
    const result = await sendWhatsAppRankingNotification({
      productName: 'Test Product',
      rank: 1,
      category: 'Technology & SaaS',
      previousRank: 3,
      score: 8.5,
      phoneNumber,
      ownerName: name || 'Test User',
    })

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Test WhatsApp sent to ${phoneNumber}`,
        data: result.data,
      })
    } else {
      return NextResponse.json({
        success: false,
        message: 'Failed to send WhatsApp',
        error: result.error,
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Test WhatsApp error:', error)
    return NextResponse.json(
      { error: 'Failed to send test WhatsApp', details: String(error) },
      { status: 500 }
    )
  }
}
