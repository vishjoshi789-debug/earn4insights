/**
 * Fix onboarding status for existing users
 * Marks users as having completed onboarding if they have demographics or interests
 */

import postgres from 'postgres'

async function fixOnboardingStatus() {
  console.log('\n=== Fixing Onboarding Status for Existing Users ===\n')
  
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
  
  if (!dbUrl) {
    console.error('❌ DATABASE_URL or POSTGRES_URL not found in environment')
    process.exit(1)
  }
  
  const sql = postgres(dbUrl)
  
  try {
    console.log('📊 Updating users who have completed onboarding...\n')
    
    const result = await sql`
      UPDATE user_profiles
      SET onboarding_complete = true
      WHERE 
        onboarding_complete = false
        AND (
          demographics IS NOT NULL 
          OR (
            interests IS NOT NULL 
            AND interests::jsonb->'productCategories' IS NOT NULL
            AND jsonb_array_length((interests::jsonb->'productCategories')::jsonb) > 0
          )
        )
      RETURNING id
    `
    
    console.log(`✅ Updated ${result.length} user(s)`)
    console.log('\n✅ Migration complete!')
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    throw error
  } finally {
    await sql.end()
  }
}

fixOnboardingStatus().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
