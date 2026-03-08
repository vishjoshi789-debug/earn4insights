import dotenv from 'dotenv'
import fs from 'fs'
dotenv.config({ path: '.env.local' })
import { neon } from '@neondatabase/serverless'

const dbUrl = (process.env.DATABASE_URL || '').replace(/^"|"$/g, '')
if (!dbUrl) { fs.writeFileSync('media-check-result.txt', 'ERROR: DATABASE_URL not set\n'); process.exit(1) }
const sql = neon(dbUrl)
const lines = []
const log = (msg) => { lines.push(String(msg)); console.log(msg) }

try {
  // 1. Check if moderation_status column exists
  const colCheck = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'feedback_media' AND column_name = 'moderation_status'`
  log('moderation_status column exists: ' + (colCheck.length > 0 ? 'YES - migration applied' : 'NO - migration NOT applied'))

  // 2. All columns in feedback_media
  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'feedback_media' ORDER BY ordinal_position`
  log('feedback_media columns: ' + cols.map(c => c.column_name).join(', '))

  // 3. Total rows in feedback_media
  const total = await sql`SELECT count(*) as cnt FROM feedback_media`
  log('TOTAL MEDIA RECORDS IN DB: ' + total[0].cnt)

  // 4. Find vishweshwar joshi feedback
  const items = await sql`SELECT id, product_id, user_name, modality_primary, created_at FROM feedback WHERE LOWER(user_name) LIKE '%vishweshwar%' OR LOWER(user_name) LIKE '%joshi%' ORDER BY created_at DESC LIMIT 10`
  log('FEEDBACK FROM VISHWESHWAR JOSHI: ' + items.length + ' found')
  items.forEach(f => log('  id=' + f.id + ' modality=' + f.modality_primary + ' user=' + f.user_name))

  if (items.length > 0) {
    const ids = items.map(f => f.id)
    const media = await sql`SELECT id, owner_id, media_type, status, storage_key FROM feedback_media WHERE owner_id = ANY(${ids})`
    log('MEDIA FOR THESE FEEDBACK IDS: ' + media.length + ' records')
    media.forEach(m => log('  ownerId=' + m.owner_id + ' type=' + m.media_type + ' status=' + m.status + ' url=' + (m.storage_key || '').substring(0, 60)))
  }

  // 5. All user names
  const users = await sql`SELECT DISTINCT user_name FROM feedback WHERE user_name IS NOT NULL ORDER BY user_name LIMIT 30`
  log('ALL USER NAMES: ' + users.map(u => u.user_name).join(' | '))

} catch (err) {
  log('ERROR: ' + err.message)
}

fs.writeFileSync('media-check-result.txt', lines.join('\n') + '\n')
console.log('Written to media-check-result.txt')

