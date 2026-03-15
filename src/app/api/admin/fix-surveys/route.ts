import { NextResponse } from 'next/server'
import { db } from '@/db'
import { surveys } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function POST() {
  const results: string[] = []

  try {
    // 1. Delete "Customer NPS score" (duplicate of NPS Survey)
    const deleted = await db.delete(surveys).where(eq(surveys.id, '4498cab4-ab99-4327-9bb4-97b73027df42')).returning({ title: surveys.title })
    results.push(`Deleted: ${deleted[0]?.title || '(not found)'}`)

    // 2. Convert "user satisfaction survey" to CSAT
    const csatQuestions = [
      {
        id: 'q_csat_score',
        type: 'rating',
        question: 'How satisfied are you with our product overall?',
        scale: 5,
        required: true,
      },
      {
        id: 'q_csat_ease',
        type: 'rating',
        question: 'How easy is it to use our product?',
        scale: 5,
        required: true,
      },
      {
        id: 'q_csat_feedback',
        type: 'text',
        question: 'What could we do to improve your experience?',
        required: false,
      },
    ]

    const upd1 = await db.update(surveys).set({
      type: 'csat',
      questions: csatQuestions,
      description: 'Measure how satisfied users are with your product experience — covers overall satisfaction, ease of use, and open feedback.',
    }).where(eq(surveys.id, '9b8dff2b-aa0a-468a-b9af-5e6a04e54091')).returning({ title: surveys.title })
    results.push(`Converted to CSAT: ${upd1[0]?.title || '(not found)'}`)

    // 3. Convert "Gauge customer interests" to Custom
    const customQuestions = [
      {
        id: 'q_interest_area',
        type: 'multiple_choice',
        question: 'Which product categories interest you the most?',
        options: ['Technology', 'Health & Wellness', 'Finance', 'Education', 'Entertainment', 'Other'],
        required: true,
      },
      {
        id: 'q_feature_priority',
        type: 'rating',
        question: 'How important is pricing when choosing a product?',
        scale: 5,
        required: true,
      },
      {
        id: 'q_upcoming_interest',
        type: 'text',
        question: 'What features or products would you like to see us launch next?',
        required: false,
      },
    ]

    const upd2 = await db.update(surveys).set({
      type: 'custom',
      questions: customQuestions,
      description: 'Discover what your customers care about — their interests, priorities, and what they want to see next from your brand.',
    }).where(eq(surveys.id, '4772c081-4b4b-4c75-9412-81010271ee1c')).returning({ title: surveys.title })
    results.push(`Converted to Custom: ${upd2[0]?.title || '(not found)'}`)

    // Show final state
    const final = await db.select({ id: surveys.id, title: surveys.title, type: surveys.type }).from(surveys).orderBy(surveys.createdAt)
    results.push('', 'Final surveys:')
    final.forEach(s => results.push(`  [${s.type}] ${s.title} (${s.id})`))

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
