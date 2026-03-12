import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Create postgres client optimized for serverless (Vercel + Neon)
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || ''

if (!connectionString) {
  throw new Error(
    '[DB] Missing POSTGRES_URL or DATABASE_URL environment variable. ' +
    'The application cannot start without a database connection.'
  )
}

const client = postgres(connectionString, {
  prepare: false,       // Required for Neon connection pooler (pgBouncer)
  idle_timeout: 20,     // Close idle connections after 20s in serverless
  max: 10,              // Limit connection pool size
  connect_timeout: 10,  // 10s connection timeout
})

export const db = drizzle(client, { schema })
export { sql } from 'drizzle-orm'
