import { sql } from '@vercel/postgres'
import fs from 'fs'
import path from 'path'

async function runMigration() {
  try {
    console.log('🔄 Running database migration...')
    
    // Read the SQL file
    const migrationSQL = fs.readFileSync(
      path.join(process.cwd(), 'src/db/migrations/001_init.sql'),
      'utf-8'
    )
    
    // Execute the migration
    await sql.query(migrationSQL)
    
    console.log('✅ Database migration completed successfully!')
    console.log('📊 Created tables:')
    console.log('  - products')
    console.log('  - surveys')
    console.log('  - survey_responses')
    console.log('  - weekly_rankings')
    console.log('  - ranking_history')
    console.log('  - social_posts')
    console.log('  - feedback')
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

export { runMigration }
