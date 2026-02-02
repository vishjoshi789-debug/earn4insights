/**
 * Enrich existing products with targeting data for personalization engine
 * Run with: node enrich-products-for-personalization.mjs
 */

import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.POSTGRES_URL);

async function enrichProducts() {
  console.log('🔍 Fetching existing products...');
  
  const products = await sql`
    SELECT id, name, profile
    FROM products
  `;

  console.log(`📦 Found ${products.length} products`);

  for (const product of products) {
    const currentProfile = product.profile || {};
    
    // Enhanced profile with targeting data
    const enrichedProfile = {
      ...currentProfile,
      // Keep existing category data
      category: currentProfile.category || 'TECH_SAAS',
      categoryName: currentProfile.categoryName || 'Technology & SaaS',
      
      // Add target audience (broad to ensure matches)
      targetAudience: currentProfile.targetAudience || {
        ageRanges: ['18-24', '25-34', '35-44', '45-54'],
        genders: ['all'],
        educationLevels: ['High School', 'Bachelor\'s Degree', 'Master\'s Degree', 'PhD'],
        locations: ['United States', 'United Kingdom', 'Canada', 'India', 'Australia', 'Germany']
      },
      
      // Add cultural relevance (medium for all initially)
      culturalRelevance: currentProfile.culturalRelevance || {
        'American': 'high',
        'British': 'high',
        'Indian': 'high',
        'Chinese': 'medium',
        'European': 'high',
        'African': 'medium',
        'Latin American': 'medium',
        'Middle Eastern': 'medium'
      },
      
      // Add aspiration alignment
      aspirationAlignment: currentProfile.aspirationAlignment || [
        'career-growth',
        'learning-skills',
        'financial-freedom',
        'entrepreneurship'
      ],
      
      // Add price segment
      priceSegment: currentProfile.priceSegment || 'mid-range',
      
      // Add platform preferences
      platformPreferences: currentProfile.platformPreferences || {
        'Amazon': 'high',
        'Shopify': 'medium',
        'Other E-commerce': 'medium'
      }
    };

    console.log(`✏️  Enriching: ${product.name}`);
    
    await sql`
      UPDATE products
      SET profile = ${JSON.stringify(enrichedProfile)}
      WHERE id = ${product.id}
    `;
  }

  console.log('✅ All products enriched!');
  console.log('\n📊 Enriched fields added:');
  console.log('  - targetAudience (age, gender, education, locations)');
  console.log('  - culturalRelevance (8 cultural groups)');
  console.log('  - aspirationAlignment (4 key aspirations)');
  console.log('  - priceSegment (budget/mid-range/premium/luxury)');
  console.log('  - platformPreferences (Amazon, Shopify, etc.)');
  
  await sql.end();
}

enrichProducts().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
