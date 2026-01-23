'use server'

import 'server-only'

/**
 * Migration Script: Add Categories to Existing Products
 * 
 * This script helps add categories to existing products that were created
 * before the ranking system was implemented.
 * 
 * Run this ONCE after deploying the ranking system.
 */

import { getAllProducts, updateProductProfile } from '@/lib/product/store'
import type { ProductCategory } from '@/lib/categories'

type CategoryMapping = Record<string, ProductCategory>

/**
 * Manual category mapping for existing products
 * Update this based on your actual products
 */
const PRODUCT_CATEGORY_MAP: CategoryMapping = {
  // Example mappings - replace with your actual product IDs
  // 'product-id-123': 'TECH_SAAS',
  // 'product-id-456': 'FINTECH',
  // 'product-id-789': 'ECOMMERCE',
}

/**
 * Auto-categorize based on product type or keywords
 */
function inferCategory(productName: string, productType?: string, description?: string): ProductCategory {
  const searchText = `${productName} ${productType || ''} ${description || ''}`.toLowerCase()

  // SaaS & Productivity
  if (searchText.match(/saas|software|productivity|cloud|app|platform|tool|crm|erp/)) {
    return 'TECH_SAAS'
  }

  // Fintech
  if (searchText.match(/finance|payment|banking|crypto|invest|trading|wallet|loan/)) {
    return 'FINTECH'
  }

  // E-Commerce
  if (searchText.match(/ecommerce|e-commerce|shop|store|retail|marketplace|seller|merchant/)) {
    return 'ECOMMERCE'
  }

  // Health & Wellness
  if (searchText.match(/health|wellness|fitness|medical|doctor|therapy|nutrition|mental/)) {
    return 'HEALTH'
  }

  // Education
  if (searchText.match(/education|learning|course|tutor|school|university|training|skill/)) {
    return 'EDUCATION'
  }

  // Food & Beverage
  if (searchText.match(/food|restaurant|meal|delivery|recipe|beverage|drink|cafe/)) {
    return 'FOOD'
  }

  // Consumer Electronics
  if (searchText.match(/electronics|phone|smartphone|laptop|gadget|device|wearable|smart home/)) {
    return 'CONSUMER_ELECTRONICS'
  }

  // Gaming
  if (searchText.match(/game|gaming|esports|video game|console|stream/)) {
    return 'GAMING'
  }

  // Social & Communication
  if (searchText.match(/social|messaging|chat|community|communication|network/)) {
    return 'SOCIAL'
  }

  // Marketplace
  if (searchText.match(/marketplace|peer-to-peer|p2p|gig|freelance|sharing economy/)) {
    return 'MARKETPLACE'
  }

  // Developer Tools
  if (searchText.match(/developer|dev|api|framework|library|sdk|devops|ide|code/)) {
    return 'DEVELOPER_TOOLS'
  }

  // Default
  return 'OTHER'
}

/**
 * Migrate all products without categories
 */
export async function migrateProductCategories(dryRun: boolean = true): Promise<{
  success: boolean
  migratedCount: number
  skippedCount: number
  errorCount: number
  details: Array<{
    productId: string
    productName: string
    category: ProductCategory
    status: 'migrated' | 'skipped' | 'error'
    message?: string
  }>
}> {
  console.log(`🔄 Starting category migration (dry run: ${dryRun})...`)

  const products = await getAllProducts()
  const results: Array<{
    productId: string
    productName: string
    category: ProductCategory
    status: 'migrated' | 'skipped' | 'error'
    message?: string
  }> = []

  let migratedCount = 0
  let skippedCount = 0
  let errorCount = 0

  for (const product of products) {
    const productName = product.name
    const productId = product.id

    // Skip if already has category
    if (product.profile?.data?.category) {
      results.push({
        productId,
        productName,
        category: product.profile.data.category,
        status: 'skipped',
        message: 'Already has category',
      })
      skippedCount++
      continue
    }

    try {
      // Determine category
      const category = PRODUCT_CATEGORY_MAP[productId] ||
        inferCategory(
          productName,
          product.profile?.data?.productType,
          product.description
        )

      if (!dryRun) {
        // Actually update the product
        await updateProductProfile(productId, (prev) => ({
          ...prev,
          data: {
            ...prev.data,
            category,
          },
        }))
      }

      results.push({
        productId,
        productName,
        category,
        status: 'migrated',
        message: dryRun ? 'Would be migrated' : 'Migrated successfully',
      })
      migratedCount++

      console.log(`✅ ${productName} → ${category}`)
    } catch (error) {
      results.push({
        productId,
        productName,
        category: 'OTHER',
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
      errorCount++

      console.error(`❌ Failed to migrate ${productName}:`, error)
    }
  }

  console.log(`\n📊 Migration Summary:`)
  console.log(`   Total products: ${products.length}`)
  console.log(`   Migrated: ${migratedCount}`)
  console.log(`   Skipped: ${skippedCount}`)
  console.log(`   Errors: ${errorCount}`)

  return {
    success: errorCount === 0,
    migratedCount,
    skippedCount,
    errorCount,
    details: results,
  }
}

/**
 * Example usage in a script or API endpoint
 */
export async function runMigration() {
  // First, run in dry-run mode to see what will happen
  console.log('=== DRY RUN ===')
  const dryRunResult = await migrateProductCategories(true)
  
  console.log('\nDry run complete. Review the results above.')
  console.log('To actually migrate, call: migrateProductCategories(false)')
  
  return dryRunResult
}
