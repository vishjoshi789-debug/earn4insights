import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { products } from '@/db/schema'
import type { Product as DBProduct, NewProduct } from '@/db/schema'
import type { Product, ProductProfile } from '@/lib/types/product'

/**
 * Convert database product to app Product type
 */
function toProduct(dbProduct: DBProduct): Product {
  return {
    id: dbProduct.id,
    name: dbProduct.name,
    description: dbProduct.description || undefined,
    platform: dbProduct.platform || undefined,
    created_at: dbProduct.createdAt.toISOString(),
    features: {
      nps: dbProduct.npsEnabled,
      feedback: dbProduct.feedbackEnabled,
      social_listening: dbProduct.socialListeningEnabled,
    },
    profile: dbProduct.profile as ProductProfile,
  }
}

/**
 * Convert app Product to database format
 */
function toDBProduct(product: Partial<Product>): Partial<NewProduct> {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    platform: product.platform,
    npsEnabled: product.features?.nps ?? false,
    feedbackEnabled: product.features?.feedback ?? false,
    socialListeningEnabled: product.features?.social_listening ?? false,
    profile: product.profile as any,
  }
}

/**
 * Get all products
 */
export async function getAllProducts(): Promise<Product[]> {
  const dbProducts = await db.select().from(products)
  return dbProducts.map(toProduct)
}

/**
 * Get product by ID
 */
export async function getProductById(id: string): Promise<Product | null> {
  const [dbProduct] = await db.select().from(products).where(eq(products.id, id))
  return dbProduct ? toProduct(dbProduct) : null
}

/**
 * Create new product
 */
export async function createProduct(product: Product): Promise<Product> {
  const [created] = await db
    .insert(products)
    .values(toDBProduct(product) as NewProduct)
    .returning()
  
  return toProduct(created)
}

/**
 * Update product
 */
export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product | null> {
  const [updated] = await db
    .update(products)
    .set(toDBProduct(updates))
    .where(eq(products.id, id))
    .returning()
  
  return updated ? toProduct(updated) : null
}

/**
 * Update product profile
 */
export async function updateProductProfile(
  id: string,
  profileUpdater: (prev: ProductProfile) => ProductProfile
): Promise<Product | null> {
  const product = await getProductById(id)
  if (!product) return null

  const newProfile = profileUpdater(product.profile)
  
  const [updated] = await db
    .update(products)
    .set({ profile: newProfile as any })
    .where(eq(products.id, id))
    .returning()
  
  return updated ? toProduct(updated) : null
}

/**
 * Delete product
 */
export async function deleteProduct(id: string): Promise<boolean> {
  const result = await db.delete(products).where(eq(products.id, id))
  return result.length > 0
}
