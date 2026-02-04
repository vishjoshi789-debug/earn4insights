/**
 * Apply database migrations to production
 * Runs the email analytics migration SQL directly
 */

import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import postgres from 'postgres'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function applyMigrations() {
  console.log('\n=== Applying Database Migrations ===\n')
  
  // Load DATABASE_URL from environment
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
  
  if (!dbUrl) {
    console.error('❌ DATABASE_URL or POSTGRES_URL not found in environment')
    process.exit(1)
  }
  
  console.log('✅ Database connection loaded')
  
  // Connect to database
  const sql = postgres(dbUrl)
  
  try {
    // Read the email analytics migration file
    const migrationPath = path.join(__dirname, 'drizzle', '0003_add_email_analytics_tables.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    console.log('📄 Read migration file: 0003_add_email_analytics_tables.sql')
    console.log('\n🔄 Applying migration...\n')
    
    // Execute the migration
    await sql.unsafe(migrationSQL)
    
    console.log('✅ Migration applied successfully!')
    console.log('\nTables created:')
    console.log('  - email_send_events')
    console.log('  - send_time_cohorts')
    console.log('  - email_hourly_metrics')
    
  } catch (error) {
    if (error.message && error.message.includes('already exists')) {
      console.log('ℹ️  Tables already exist - migration previously applied')
    } else {
      console.error('❌ Migration failed:', error.message)
      throw error
    }
  } finally {
    await sql.end()
  }
}

applyMigrations().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
