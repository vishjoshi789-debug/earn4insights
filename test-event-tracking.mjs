import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function testEventTracking() {
  console.log('=== Phase 3 Event Tracking Test ===\n');

  // Test 1: Check if tracking events exist
  console.log('1. Checking recent tracking events...');
  const recentEvents = await sql`
    SELECT 
      event_type,
      COUNT(*) as count,
      MAX(created_at) as last_tracked
    FROM user_events
    WHERE created_at > NOW() - INTERVAL '7 days'
    GROUP BY event_type
    ORDER BY count DESC
  `;
  
  console.log('Recent event types:');
  console.table(recentEvents);

  // Test 2: Check onboarding completion tracking
  console.log('\n2. Checking onboarding_complete events...');
  const onboardingEvents = await sql`
    SELECT user_id, metadata, created_at
    FROM user_events
    WHERE event_type = 'onboarding_complete'
    ORDER BY created_at DESC
    LIMIT 5
  `;
  console.log(`Found ${onboardingEvents.length} onboarding events`);

  // Test 3: Check product view tracking
  console.log('\n3. Checking product_view events...');
  const productViews = await sql`
    SELECT product_id, COUNT(*) as views, MAX(created_at) as last_view
    FROM user_events
    WHERE event_type = 'product_view'
    GROUP BY product_id
    ORDER BY views DESC
    LIMIT 10
  `;
  console.log('Top viewed products:');
  console.table(productViews);

  // Test 4: Check session tracking
  console.log('\n4. Checking session tracking...');
  const sessions = await sql`
    SELECT session_id, COUNT(*) as events
    FROM user_events
    WHERE session_id IS NOT NULL
      AND created_at > NOW() - INTERVAL '1 day'
    GROUP BY session_id
    ORDER BY events DESC
    LIMIT 5
  `;
  console.log('Active sessions:');
  console.table(sessions);

  // Test 5: Check metadata quality
  console.log('\n5. Checking metadata enrichment...');
  const eventsWithCategory = await sql`
    SELECT COUNT(*) as count
    FROM user_events
    WHERE event_type = 'product_view'
      AND metadata->>'category' IS NOT NULL
  `;
  const totalProductViews = await sql`
    SELECT COUNT(*) as count
    FROM user_events
    WHERE event_type = 'product_view'
  `;
  
  const enrichmentRate = eventsWithCategory[0].count / totalProductViews[0].count * 100;
  console.log(`Metadata enrichment rate: ${enrichmentRate.toFixed(1)}%`);

  // Test 6: Check consent compliance
  console.log('\n6. Checking consent compliance...');
  const usersWithTracking = await sql`
    SELECT COUNT(DISTINCT user_id) as count
    FROM user_events
  `;
  const usersWithConsent = await sql`
    SELECT COUNT(*) as count
    FROM user_profiles
    WHERE consent->>'tracking' = 'true'
  `;
  console.log(`Users tracked: ${usersWithTracking[0].count}`);
  console.log(`Users with tracking consent: ${usersWithConsent[0].count}`);

  console.log('\n=== Test Complete ===');
}

testEventTracking().catch(console.error);
