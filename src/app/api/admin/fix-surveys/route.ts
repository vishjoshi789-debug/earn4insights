import { NextResponse } from 'next/server'
import { db } from '@/db'
import { surveys } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function POST() {
  const results: string[] = []

  try {
    // Fix question type: multiple_choice → multiple-choice in "Gauge customer intrests"
    const survey = await db.select().from(surveys).where(eq(surveys.id, '4772c081-4b4b-4c75-9412-81010271ee1c'))
    if (survey[0]) {
      const questions = (survey[0].questions as any[]).map((q: any) => ({
        ...q,
        type: q.type === 'multiple_choice' ? 'multiple-choice' : q.type,
      }))
      await db.update(surveys).set({ questions }).where(eq(surveys.id, '4772c081-4b4b-4c75-9412-81010271ee1c'))
      results.push('Fixed question type: multiple_choice → multiple-choice')
    } else {
      results.push('Survey not found')
    }

    return NextResponse.json({ success: true, results })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
