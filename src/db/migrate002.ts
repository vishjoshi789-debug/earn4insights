import postgres from 'postgres'
import fs from 'fs'
import path from 'path'

async function runMigration002() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || ''

  if (!connectionString) {
    throw new Error(
      '[migrate002] Missing POSTGRES_URL or DATABASE_URL environment variable.'
    )
  }

  // Use postgres.js with standard TCP — same driver as db/index.ts.
  // prepare:false required for Neon connection pooler (pgBouncer).
  const sql = postgres(connectionString, {
    prepare: false,
    connect_timeout: 30,
    max: 1,
  })

  try {
    console.log('🔄 Running migration 002: Hyper-Personalization Engine...')

    const migrationSQL = fs.readFileSync(
      path.join(process.cwd(), 'src/db/migrations/002_hyper_personalization.sql'),
      'utf-8'
    )

    // sql.unsafe() executes a raw multi-statement SQL string.
    // The migration file is wrapped in BEGIN/COMMIT so it's fully atomic.
    await sql.unsafe(migrationSQL)

    console.log('✅ Migration 002 completed successfully!')
    console.log('📊 New tables created:')
    console.log('  - consumer_signal_snapshots')
    console.log('  - consent_records')
    console.log('  - consumer_sensitive_attributes')
    console.log('  - brand_icps')
    console.log('  - icp_match_scores')
    console.log('  - consumer_social_connections')
    console.log('📝 Existing tables altered:')
    console.log('  - user_profiles        (+psychographic, +social_signals, +signal_version, +last_signal_computed_at)')
    console.log('  - brand_alert_rules    (+icp_id, +min_match_score)')
    console.log('  - brand_alerts         (+match_score_snapshot)')
    console.log('')
    console.log('⚠️  Next step: run the consent backfill migration.')
    console.log('   POST /api/admin/migrate-consent-records')

  } finally {
    await sql.end()
  }
}

if (require.main === module) {
  runMigration002()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Migration 002 failed:', error)
      process.exit(1)
    })
}

export { runMigration002 }
