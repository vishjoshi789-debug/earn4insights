#!/usr/bin/env node
/**
 * Test Script: Run Behavioral Attribute Updates
 * 
 * This script manually triggers the behavioral attribute computation
 * for all active users.
 */

import { neon } from '@neondatabase/serverless';
import { batchUpdateBehavioralAttributes } from './src/server/analyticsService.ts';

const sql = neon(process.env.DATABASE_URL);

async function runBehavioralUpdate() {
  console.log('🚀 Running behavioral attribute updates...\n');

  try {
    // Get count of users before update
    const beforeStats = await sql`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN behavioral IS NOT NULL THEN 1 END) as users_with_behavioral
      FROM user_profiles
    `;

    console.log('📊 Before update:');
    console.log(`   Total users: ${beforeStats[0].total_users}`);
    console.log(`   Users with behavioral data: ${beforeStats[0].users_with_behavioral}\n`);

    // Run the update
    console.log('⏳ Computing behavioral attributes...');
    const result = await batchUpdateBehavioralAttributes();
    
    console.log(`✅ Update complete!`);
    console.log(`   Processed: ${result.processed} users`);
    console.log(`   Updated: ${result.updated} users`);
    console.log(`   Errors: ${result.errors}\n`);

    // Get count after update
    const afterStats = await sql`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN behavioral IS NOT NULL THEN 1 END) as users_with_behavioral
      FROM user_profiles
    `;

    console.log('📊 After update:');
    console.log(`   Total users: ${afterStats[0].total_users}`);
    console.log(`   Users with behavioral data: ${afterStats[0].users_with_behavioral}\n`);

    // Show sample of updated data
    const samples = await sql`
      SELECT 
        u.email,
        p.behavioral
      FROM user_profiles p
      JOIN users u ON u.id = p.user_id
      WHERE p.behavioral IS NOT NULL
      LIMIT 3
    `;

    if (samples.length > 0) {
      console.log('📋 Sample behavioral data:');
      samples.forEach((sample, i) => {
        console.log(`\n   ${i + 1}. ${sample.email}:`);
        const b = sample.behavioral;
        console.log(`      Engagement Score: ${b.engagementScore}`);
        console.log(`      Category Interests:`, JSON.stringify(b.categoryInterests).substring(0, 80));
        console.log(`      Active Hours:`, b.activeHours);
      });
    }

    console.log('\n✅ Behavioral update test complete!\n');

  } catch (error) {
    console.error('❌ Error running behavioral update:', error);
    process.exit(1);
  }
}

runBehavioralUpdate();
