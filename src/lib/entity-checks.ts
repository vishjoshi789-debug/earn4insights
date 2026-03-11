/**
 * Application-level foreign key validation.
 * Since DB schema doesn't enforce FK constraints, these helpers
 * verify that referenced entities exist before inserts.
 */
import { db } from '@/db'
import { products, surveys } from '@/db/schema'
import { eq } from 'drizzle-orm'

/** Returns true if a product with the given ID exists */
export async function productExists(productId: string): Promise<boolean> {
  const result = await db.select({ id: products.id })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)
  return result.length > 0
}

/** Returns true if a survey with the given ID exists */
export async function surveyExists(surveyId: string): Promise<boolean> {
  const result = await db.select({ id: surveys.id })
    .from(surveys)
    .where(eq(surveys.id, surveyId))
    .limit(1)
  return result.length > 0
}
