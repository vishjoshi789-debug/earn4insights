import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth/auth.config'
import { findDsarById } from '@/db/repositories/dsarRepository'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ requestId: string }> }
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const userId = (session.user as any).id as string
  const role = (session.user as any).role as string
  if (role !== 'consumer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { requestId } = await context.params
  const record = await findDsarById(requestId)

  if (!record) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (record.consumerId !== userId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (record.status !== 'completed') {
    return NextResponse.json({ error: 'Report not ready yet' }, { status: 404 })
  }
  if (!record.pdfUrl) {
    return NextResponse.json({ error: 'PDF not available' }, { status: 404 })
  }
  if (record.expiresAt && record.expiresAt < new Date()) {
    return NextResponse.json({ error: 'This download link has expired. Please submit a new request.' }, { status: 410 })
  }

  // Redirect to Blob URL — validated ownership + expiry above
  return NextResponse.redirect(record.pdfUrl)
}
