import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './src/db/schema'

async function runMigration() {
  const connectionString = process.env.POSTGRES_URL!
  
  if (!connectionString) {
    throw new Error('POSTGRES_URL environment variable is not set')
  }

  const client = postgres(connectionString)
  const db = drizzle(client, { schema })

  console.log('Creating tables...')

  // The tables are automatically created when we import the schema
  // We just need to execute a simple query to ensure connection works
  try {
    // Create user_profiles table
    await client`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        demographics JSONB,
        interests JSONB,
        notification_preferences JSONB NOT NULL,
        consent JSONB NOT NULL,
        behavioral JSONB,
        sensitive_data JSONB
      )
    `

    // Create user_events table
    await client`
      CREATE TABLE IF NOT EXISTS user_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        product_id TEXT,
        survey_id TEXT,
        notification_id TEXT,
        metadata JSONB,
        session_id TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `

    // Create notification_queue table
    await client`
      CREATE TABLE IF NOT EXISTS notification_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        channel TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'pending' NOT NULL,
        priority INTEGER DEFAULT 5 NOT NULL,
        subject TEXT,
        body TEXT NOT NULL,
        metadata JSONB,
        scheduled_for TIMESTAMP NOT NULL,
        sent_at TIMESTAMP,
        failed_at TIMESTAMP,
        failure_reason TEXT,
        retry_count INTEGER DEFAULT 0 NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `

    console.log('✅ Tables created successfully!')
  } catch (error) {
    console.error('❌ Error creating tables:', error)
    throw error
  } finally {
    await client.end()
  }
}

runMigration()
  .then(() => {
    console.log('Migration complete!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
