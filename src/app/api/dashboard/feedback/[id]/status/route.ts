import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { updateFeedbackStatus } from '@/db/repositories/feedbackRepository'

const VALID_STATUSES = ['new', 'reviewed', 'addressed'] as const
type ValidStatus = (typeof VALID_STATUSES)[number]

/**
 * PATCH /api/dashboard/feedback/[id]/status
 * 
 * Update the review status of a feedback entry.
 * Brand workflow: new → reviewed → addressed
 * 
 * Body: { status: 'new' | 'reviewed' | 'addressed' }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const { status } = body

    if (!status || !VALID_STATUSES.includes(status as ValidStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    const updated = await updateFeedbackStatus(id, status as ValidStatus)

    if (!updated) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      feedbackId: id,
      status: updated.status,
    })
  } catch (error) {
    console.error('Feedback status update error:', error)
    return NextResponse.json(
      { error: 'Failed to update feedback status' },
      { status: 500 }
    )
  }
}
