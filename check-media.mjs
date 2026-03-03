import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
const connStr = process.env.DATABASE_URL.replace(/^"|"$/g, '')
const sql = neon(connStr)

const feedbackItems = await sql`
  SELECT id, product_id, user_name, modality_primary, created_at
  FROM feedback
  WHERE product_id = 'f370660e-3711-45c7-8b92-635253fc6bc6'
  ORDER BY created_at DESC LIMIT 10
`
console.log('=== FEEDBACK ===')
feedbackItems.forEach(f => console.log(f.id, '|', f.modality_primary, '|', f.user_name, '|', f.created_at))

const ids = feedbackItems.map(f => f.id)
if (ids.length > 0) {
  const media = await sql`SELECT id, owner_id, media_type, status, moderation_status, storage_key FROM feedback_media WHERE owner_id = ANY(${ids})`
  console.log('\n=== MEDIA FOR THESE FEEDBACK IDS ===')
  console.log('Count:', media.length)
  media.forEach(m => console.log(m.id, '|', m.media_type, '|', m.status, '|', m.moderation_status, '|', (m.storage_key||'').substring(0,80)))
}

const total = await sql`SELECT count(*) as cnt FROM feedback_media`
console.log('\n=== TOTAL MEDIA IN DB:', total[0].cnt, '===')
