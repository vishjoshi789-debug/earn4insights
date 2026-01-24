import { drizzle } from 'drizzle-orm/vercel-postgres'
import { sql as vercelSql } from '@vercel/postgres'
import * as schema from './schema'

export const db = drizzle(vercelSql, { schema })
export { sql } from 'drizzle-orm'
