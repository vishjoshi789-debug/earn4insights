#!/usr/bin/env node
/**
 * Test Script: Personalized Recommendations
 * 
 * This script tests the recommendation engine and shows personalized
 * product recommendations for active users.
 */

import { neon } from '@neondatabase/serverless';
import { getPersonalizedRecommendations, explainRecommendation } from './src/server/personalizationEngine.ts';

const sql = neon(process.env.DATABASE_URL);

async function testRecommendations() {
  console.log('🔍 Testing Recommendation Engine...\n');

  try {
    // 1. Get users with behavioral data
    const users = await sql`
      SELECT 
        u.id,
        u.email,
        p.behavioral
      FROM user_profiles p
      JOIN users u ON u.id = p.user_id
      WHERE p.behavioral IS NOT NULL
      ORDER BY (p.behavioral->>'engagementScore')::float DESC
      LIMIT 3
    `;

    if (users.length === 0) {
      console.log('⚠️  No users with behavioral data found.');
      console.log('👉 Run: node test-behavioral-update.mjs first\n');
      return;
    }

    console.log('👥 Users with behavioral data:');
    users.forEach((user, i) => {
      const score = user.behavioral?.engagementScore || 0;
      console.log(`   ${i + 1}. ${user.email} (Engagement: ${score})`);
    });

    // 2. Test recommendations for first user
    const testUser = users[0];
    console.log(`\n🎯 Getting recommendations for: ${testUser.email}\n`);

    const recommendations = await getPersonalizedRecommendations(testUser.id, 5);

    if (recommendations.length === 0) {
      console.log('⚠️  No recommendations generated.');
      console.log('   Make sure products exist in the database.\n');
      return;
    }

    console.log(`📦 Top ${recommendations.length} Recommended Products:\n`);
    
    for (let i = 0; i < recommendations.length; i++) {
      const rec = recommendations[i];
      console.log(`   ${i + 1}. ${rec.productName} (ID: ${rec.productId})`);
      console.log(`      Match Score: ${rec.matchScore}/100`);
      console.log(`      Category: ${rec.category || 'N/A'}`);
      console.log(`      Reasons:`);
      rec.reasons.forEach(reason => {
        console.log(`         • ${reason}`);
      });
      console.log('');
    }

    // 3. Get detailed explanation for top recommendation
    if (recommendations.length > 0) {
      const topRec = recommendations[0];
      console.log('🔎 Detailed explanation for top recommendation:\n');
      
      const explanation = await explainRecommendation(testUser.id, topRec.productId);
      
      console.log(`   Product: ${explanation.productName}`);
      console.log(`   Overall Score: ${explanation.overallScore}/100\n`);
      console.log('   Score Breakdown:');
      console.log(`      Category Match: ${explanation.breakdown.categoryScore}/40`);
      console.log(`      Behavioral Match: ${explanation.breakdown.behavioralScore}/30`);
      console.log(`      Engagement Bonus: ${explanation.breakdown.engagementScore}/20`);
      console.log(`      Demographics Match: ${explanation.breakdown.demographicsScore}/10\n`);
      console.log('   Explanation:');
      explanation.reasons.forEach(reason => {
        console.log(`      • ${reason}`);
      });
    }

    // 4. Show category interest alignment
    console.log('\n🏷️  Category Interest Analysis:');
    const userInterests = testUser.behavioral?.categoryInterests || {};
    const interestEntries = Object.entries(userInterests)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    
    if (interestEntries.length > 0) {
      interestEntries.forEach(([category, score]) => {
        console.log(`   ${category}: ${(score * 100).toFixed(1)}%`);
      });
    } else {
      console.log('   No category interests computed yet');
    }

    console.log('\n✅ Recommendation test complete!\n');

  } catch (error) {
    console.error('❌ Error testing recommendations:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

testRecommendations();
