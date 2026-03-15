/**
 * Fix duplicate/mistyped surveys in the database.
 * 
 * Before: 4 NPS surveys with identical questions
 * After:
 *   - "NPS Survey" stays as NPS (unchanged)
 *   - "Customer NPS score" deleted (exact duplicate)  
 *   - "user satisfaction survey" → converted to CSAT type
 *   - "Gauge customer interests" → converted to Custom type with interest questions
 */

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
const connStr = process.env.DATABASE_URL.replace(/^"|"$/g, '')
const sql = neon(connStr)

async function run() {
  // First, show current surveys
  const current = await sql`SELECT id, title, type FROM surveys ORDER BY created_at`
  console.log('Current surveys:')
  current.forEach(s => console.log(`  [${s.type}] ${s.title} (${s.id})`))
  console.log('')

  // 1. Delete "Customer NPS score" (duplicate of NPS Survey)
  const del = await sql`DELETE FROM surveys WHERE id = '4498cab4-ab99-4327-9bb4-97b73027df42' RETURNING title`
  console.log('Deleted:', del[0]?.title || '(not found)')

  // 2. Convert "user satisfaction survey" to CSAT
  const csatQuestions = JSON.stringify([
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
  ])

  const upd1 = await sql`
    UPDATE surveys 
    SET type = 'csat', 
        questions = ${csatQuestions}::jsonb,
        description = 'Measure how satisfied users are with your product experience — covers overall satisfaction, ease of use, and open feedback.'
    WHERE id = '9b8dff2b-aa0a-468a-b9af-5e6a04e54091' RETURNING title`
  console.log('Converted to CSAT:', upd1[0]?.title || '(not found)')

  // 3. Convert "Gauge customer interests" to Custom
  const customQuestions = JSON.stringify([
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
  ])

  const upd2 = await sql`
    UPDATE surveys 
    SET type = 'custom', 
        questions = ${customQuestions}::jsonb,
        description = 'Discover what your customers care about — their interests, priorities, and what they want to see next from your brand.'
    WHERE id = '4772c081-4b4b-4c75-9412-81010271ee1c' RETURNING title`
  console.log('Converted to Custom:', upd2[0]?.title || '(not found)')

  // Show final state
  console.log('')
  const final = await sql`SELECT id, title, type FROM surveys ORDER BY created_at`
  console.log('Final surveys:')
  final.forEach(s => console.log(`  [${s.type}] ${s.title} (${s.id})`))

  console.log('\nDone! Survey types are now differentiated.')
}

run().catch(err => { console.error(err); process.exit(1) })
