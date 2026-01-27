#!/usr/bin/env node
/**
 * Test Script: Analytics & Behavioral Attributes
 * 
 * This script tests the analytics service and checks computed behavioral attributes.
 */

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function testAnalytics() {
  console.log('🔍 Testing Analytics System...\n');

  try {
    // 1. Get a user with events
    const users = await sql`
      SELECT 
        u.id,
        u.email,
        COUNT(e.id) as event_count
      FROM users u
      LEFT JOIN user_events e ON e.user_id = u.id
      GROUP BY u.id, u.email
      HAVING COUNT(e.id) > 0
      ORDER BY event_count DESC
      LIMIT 5
    `;

    if (users.length === 0) {
      console.log('⚠️  No users with events found. Generate some events first.');
      return;
    }

    console.log('👥 Users with events:');
    users.forEach((user, i) => {
      console.log(`   ${i + 1}. ${user.email}: ${user.event_count} events`);
    });

    const testUser = users[0];
    console.log(`\n🎯 Testing analytics for: ${testUser.email}\n`);

    // 2. Get event counts by type for this user
    const eventCounts = await sql`
      SELECT event_type, COUNT(*) as count
      FROM user_events
      WHERE user_id = ${testUser.id}
      GROUP BY event_type
      ORDER BY count DESC
    `;

    console.log('📊 Event breakdown:');
    eventCounts.forEach(row => {
      console.log(`   ${row.event_type}: ${row.count}`);
    });

    // 3. Check if user has behavioral attributes
    const profile = await sql`
      SELECT 
        demographics,
        interests,
        behavioral
      FROM user_profiles
      WHERE user_id = ${testUser.id}
    `;

    console.log('\n📋 User Profile:');
    if (profile.length > 0) {
      const p = profile[0];
      
      console.log('   Demographics:', p.demographics ? '✅ Set' : '❌ Not set');
      console.log('   Interests:', p.interests ? JSON.stringify(p.interests) : '❌ Not set');
      
      if (p.behavioral) {
        console.log('   Behavioral Attributes: ✅ Computed');
        const behavioral = p.behavioral;
        console.log(`      Engagement Score: ${behavioral.engagementScore || 'N/A'}`);
        console.log(`      Category Interests:`, behavioral.categoryInterests || 'N/A');
        console.log(`      Active Hours:`, behavioral.activeHours || 'N/A');
        console.log(`      Survey Completion Rate: ${behavioral.surveyCompletionRate || 'N/A'}%`);
      } else {
        console.log('   Behavioral Attributes: ❌ Not computed yet');
        console.log('   👉 Run: node test-behavioral-update.mjs to compute');
      }
    } else {
      console.log('   ⚠️  No profile found');
    }

    // 4. Check category interests from events
    const categoryViews = await sql`
      SELECT 
        metadata->>'category' as category,
        COUNT(*) as views
      FROM user_events
      WHERE user_id = ${testUser.id}
        AND event_type = 'product_view'
        AND metadata->>'category' IS NOT NULL
      GROUP BY metadata->>'category'
      ORDER BY views DESC
    `;

    console.log('\n🏷️  Category viewing behavior:');
    if (categoryViews.length > 0) {
      categoryViews.forEach(row => {
        console.log(`   ${row.category}: ${row.views} views`);
      });
    } else {
      console.log('   No category-specific views tracked yet');
    }

    console.log('\n✅ Analytics test complete!\n');

  } catch (error) {
    console.error('❌ Error testing analytics:', error);
    process.exit(1);
  }
}

testAnalytics();
