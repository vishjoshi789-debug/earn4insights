// retry-failed-audio.mjs — Reset failed audio media to 'uploaded' so the cron can re-process
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { neon } from '@neondatabase/serverless';

const dbUrl = process.env.DATABASE_URL?.replace(/^"|"$/g, '');
if (!dbUrl) { console.error('DATABASE_URL not set'); process.exit(1); }
const sql = neon(dbUrl);

// 1. Show current failed audio
const failed = await sql`
  SELECT id, owner_id, media_type, status, error_code, error_detail, retry_count
  FROM feedback_media
  WHERE media_type = 'audio' AND status = 'failed'
`;

if (failed.length === 0) {
  console.log('No failed audio rows found.');
  process.exit(0);
}

console.log(`Found ${failed.length} failed audio row(s):`);
for (const row of failed) {
  console.log(`  id=${row.id.slice(0,8)} owner=${row.owner_id.slice(0,8)} error=${row.error_code} retries=${row.retry_count}`);
}

// 2. Reset to 'uploaded' with retry_count=0, clear error fields
const ids = failed.map(r => r.id);
const updated = await sql`
  UPDATE feedback_media
  SET status = 'uploaded',
      error_code = NULL,
      error_detail = NULL,
      retry_count = 0,
      updated_at = NOW()
  WHERE id = ANY(${ids})
  RETURNING id, status
`;

console.log(`\nReset ${updated.length} row(s) to 'uploaded':`);
for (const row of updated) {
  console.log(`  id=${row.id.slice(0,8)} → status=${row.status}`);
}

// 3. Also reset the parent feedback processing_status if it was 'failed'
const ownerIds = failed.map(r => r.owner_id);
const parentUpdate = await sql`
  UPDATE feedback
  SET processing_status = 'pending',
      updated_at = NOW()
  WHERE id = ANY(${ownerIds}) AND processing_status = 'failed'
  RETURNING id, processing_status
`;

if (parentUpdate.length > 0) {
  console.log(`\nReset ${parentUpdate.length} parent feedback row(s) to 'pending':`);
  for (const row of parentUpdate) {
    console.log(`  feedback id=${row.id.slice(0,8)} → processing_status=${row.processing_status}`);
  }
}

console.log('\nDone. The cron /api/cron/process-feedback-media will now pick these up.');
