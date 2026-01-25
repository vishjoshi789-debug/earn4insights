import { createProduct } from '@/db/repositories/productRepository'
import { createSurvey, createSurveyResponse } from '@/db/repositories/surveyRepository'
import type { Product } from '@/lib/types/product'
import type { Survey, SurveyResponse } from '@/lib/survey-types'

// Import JSON data directly (works in both Node and Vercel)
import productsData from '../../data/products.json'
import surveysData from '../../data/surveys.json'
import responsesData from '../../data/survey-responses.json'

/**
 * Migrate existing JSON data to Postgres database
 */
export async function migrateJSONData() {
  console.log('🔄 Starting JSON data migration...')

  try {
    // Migrate products
    console.log('📦 Migrating products...')
    
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
