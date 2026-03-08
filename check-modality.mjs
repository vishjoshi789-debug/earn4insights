import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { neon } from '@neondatabase/serverless'

const dbUrl = (process.env.DATABASE_URL || '').replace(/^"|"$/g, '')
const sql = neon(dbUrl)

try {
  // Check feedback modality values
  const rows = await sql`
    SELECT id, modality_primary, processing_status, user_name, 
           LEFT(feedback_text, 50) as text_preview,
           created_at
    FROM feedback 
    ORDER BY created_at DESC 
    LIMIT 10
  `
  console.log('=== FEEDBACK MODALITY VALUES ===')
  rows.forEach(r => {
    console.log(`  id=${r.id.slice(0,8)} modality=${r.modality_primary} status=${r.processing_status} user=${r.user_name} text="${r.text_preview}"`)
  })

  // Check feedback_media for these feedback items
  const ids = rows.map(r => r.id)
  const media = await sql`
    SELECT owner_id, media_type, status, storage_key 
    FROM feedback_media 
    WHERE owner_type = 'feedback' AND owner_id = ANY(${ids})
  `
  console.log(`\n=== FEEDBACK_MEDIA LINKED TO ABOVE (${media.length} rows) ===`)
  media.forEach(m => {
    console.log(`  owner=${m.owner_id.slice(0,8)} type=${m.media_type} status=${m.status} url=${(m.storage_key||'').slice(0,60)}`)
  })

  // Check ALL feedback_media rows
  const allMedia = await sql`SELECT count(*) as cnt FROM feedback_media`
  console.log(`\n=== TOTAL feedback_media rows: ${allMedia[0].cnt} ===`)

  // Check modality distribution
  const dist = await sql`
    SELECT modality_primary, count(*) as cnt 
    FROM feedback 
    GROUP BY modality_primary
  `
  console.log('\n=== MODALITY DISTRIBUTION ===')
  dist.forEach(d => console.log(`  ${d.modality_primary}: ${d.cnt}`))

} catch (err) {
  console.error('ERROR:', err.message)
}
