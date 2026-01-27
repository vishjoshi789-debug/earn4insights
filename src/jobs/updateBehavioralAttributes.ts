import { batchUpdateBehavioralAttributes } from '@/server/analyticsService'

/**
 * Background Job: Update user behavioral attributes
 * Should be run daily via cron job or Vercel Cron
 * 
 * To run manually: node --import tsx/register src/jobs/updateBehavioralAttributes.ts
 * To run via cron: Add to vercel.json crons array
 */

async function main() {
  console.log('[Job] Starting behavioral attributes update...')
  console.log('[Job] Started at:', new Date().toISOString())

  try {
    await batchUpdateBehavioralAttributes()
    console.log('[Job] ✓ Behavioral attributes updated successfully')
  } catch (error) {
    console.error('[Job] ✗ Error updating behavioral attributes:', error)
    process.exit(1)
  }

  console.log('[Job] Completed at:', new Date().toISOString())
}

main()
