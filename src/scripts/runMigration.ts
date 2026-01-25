import { migrateJSONData } from '../db/migrateData'

async function main() {
  console.log('Starting data migration...')
  try {
    const result = await migrateJSONData()
    console.log('Migration completed successfully!')
    console.log('Result:', result)
  } catch (error) {
    console.error('Migration failed:', error)
    process.exit(1)
  }
}

main()
