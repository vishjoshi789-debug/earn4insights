import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { neon } from '@neondatabase/serverless'

const dbUrl = (process.env.DATABASE_URL || '').replace(/^"|"$/g, '')
const sql = neon(dbUrl)

try {
  const rows = await sql`
    SELECT id, owner_id, media_type, status, error_code, error_detail, 
           retry_count, LEFT(storage_key, 80) as url_preview
    FROM feedback_media 
    ORDER BY created_at DESC 
    LIMIT 5
  `
  console.log('=== FEEDBACK_MEDIA DETAILS ===')
  rows.forEach(r => {
    console.log(JSON.stringify(r, null, 2))
  })
} catch (err) {
  console.error('ERROR:', err.message)
}
