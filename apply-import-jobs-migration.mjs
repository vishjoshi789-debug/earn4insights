import postgres from 'postgres'
import { readFileSync } from 'fs'

const url = process.env.POSTGRES_URL
if (!url) {
  console.error('POSTGRES_URL not set')
  process.exit(1)
}

const sql = postgres(url)

async function main() {
  const migration = readFileSync('create-import-jobs-table.sql', 'utf-8')
  console.log('Applying import_jobs table migration...')
  await sql.unsafe(migration)
  console.log('Done! import_jobs table created.')
  await sql.end()
}

main().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
