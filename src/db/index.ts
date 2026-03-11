import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Create postgres client
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL || ''

if (!connectionString) {
  throw new Error(
    '[DB] Missing POSTGRES_URL or DATABASE_URL environment variable. ' +
    'The application cannot start without a database connection.'
  )
}

const client = postgres(connectionString)

export const db = drizzle(client, { schema })
export { sql } from 'drizzle-orm'
