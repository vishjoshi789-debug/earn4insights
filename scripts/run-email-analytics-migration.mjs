/**
 * Run Email Analytics Migration
 * 
 * Creates tables for send-time optimization:
 * - email_send_events
 * - send_time_cohorts
 * - send_time_analytics
 * - demographic_performance
 * 
 * Usage: node scripts/run-email-analytics-migration.mjs
 */

import { config } from 'dotenv'
import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

config({ path: '.env.local' })

const { Pool } = pg

async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  })

  try {
    console.log('[Migration] Connecting to database...')
    
    const migrationPath = path.join(__dirname, '..', 'drizzle', '0003_add_email_analytics_tables.sql')
    const sql = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('[Migration] Running email analytics migration...')
    await pool.query(sql)
    
    console.log('✅ Migration complete! Email analytics tables created.')
    
    // Verify tables were created
    const result = await pool.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('email_send_events', 'send_time_cohorts', 'send_time_analytics', 'demographic_performance')
      ORDER BY tablename
    `)
    
    console.log('\n📊 Created tables:')
    result.rows.forEach(row => {
      console.log(`  ✓ ${row.tablename}`)
    })
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

runMigration()
