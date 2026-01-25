import { readFileSync } from 'fs'
import { join } from 'path'
import { createProduct } from '@/db/repositories/productRepository'
import { createSurvey, createSurveyResponse } from '@/db/repositories/surveyRepository'
import type { Product } from '@/lib/types/product'
import type { Survey, SurveyResponse } from '@/lib/survey-types'

/**
 * Migrate existing JSON data to Postgres database
 */
export async function migrateJSONData() {
  console.log('🔄 Starting JSON data migration...')

  try {
    // Migrate products
    console.log('📦 Migrating products...')
    const productsPath = join(process.cwd(), 'data', 'products.json')
    const productsData = JSON.parse(readFileSync(productsPath, 'utf-8'))
    
    let productCount = 0
    for (const product of productsData as Product[]) {
      try {
        await createProduct(product)
        productCount++
        console.log(`  ✅ Migrated product: ${product.name}`)
      } catch (error: any) {
        // Skip if already exists (unique constraint)
        if (error.code === '23505') {
          console.log(`  ⏭️  Product already exists: ${product.name}`)
        } else {
          console.error(`  ❌ Failed to migrate product ${product.name}:`, error)
        }
      }
    }

    // Migrate surveys
    console.log('📋 Migrating surveys...')
    const surveysPath = join(process.cwd(), 'data', 'surveys.json')
    const surveysData = JSON.parse(readFileSync(surveysPath, 'utf-8'))
    
    let surveyCount = 0
    for (const survey of surveysData as Survey[]) {
      try {
        await createSurvey(survey)
        surveyCount++
        console.log(`  ✅ Migrated survey: ${survey.title}`)
      } catch (error: any) {
        if (error.code === '23505') {
          console.log(`  ⏭️  Survey already exists: ${survey.title}`)
        } else {
          console.error(`  ❌ Failed to migrate survey ${survey.title}:`, error)
        }
      }
    }

    // Migrate survey responses
    console.log('💬 Migrating survey responses...')
    const responsesPath = join(process.cwd(), 'data', 'survey-responses.json')
    const responsesData = JSON.parse(readFileSync(responsesPath, 'utf-8'))
    
    let responseCount = 0
    for (const response of responsesData as SurveyResponse[]) {
      try {
        await createSurveyResponse(response)
        responseCount++
      } catch (error: any) {
        if (error.code === '23505') {
          // Skip duplicates
        } else {
          console.error(`  ❌ Failed to migrate response:`, error.message)
        }
      }
    }
    console.log(`  ✅ Migrated ${responseCount} responses`)

    console.log('\n✅ Migration completed successfully!')
    console.log(`   Products: ${productCount}`)
    console.log(`   Surveys: ${surveyCount}`)
    console.log(`   Responses: ${responseCount}`)

    return {
      success: true,
      products: productCount,
      surveys: surveyCount,
      responses: responseCount,
    }
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  }
}

// Run migration if executed directly
if (require.main === module) {
  migrateJSONData()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
