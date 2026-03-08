import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { neon } from '@neondatabase/serverless';
const dbUrl = process.env.DATABASE_URL?.replace(/^"|"$/g, '');
const sql = neon(dbUrl);
const rows = await sql`SELECT id, media_type, status, error_code, retry_count FROM feedback_media ORDER BY created_at DESC`;
console.log("ROWS:", JSON.stringify(rows, null, 2));
