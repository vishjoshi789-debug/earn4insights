#!/usr/bin/env node
/**
 * List all users in the database
 */

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function listUsers() {
  console.log('👥 Fetching users...\n');

  try {
    const users = await sql`
      SELECT 
        u.id,
        u.email,
        u.name,
        u.role,
        u.created_at,
        CASE 
          WHEN u.password_hash IS NOT NULL THEN 'password'
          ELSE 'oauth'
        END as auth_type
      FROM users u
      ORDER BY u.created_at DESC
    `;

    if (users.length === 0) {
      console.log('⚠️  No users found in database\n');
      console.log('Create a test user: node create-test-user.mjs\n');
      return;
    }

    console.log(`Found ${users.length} user(s):\n`);
    
    users.forEach((user, i) => {
      console.log(`${i + 1}. ${user.email}`);
      console.log(`   Name: ${user.name || 'N/A'}`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Auth Type: ${user.auth_type}`);
      console.log(`   Created: ${new Date(user.created_at).toLocaleDateString()}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error fetching users:', error);
    console.error('\nMake sure DATABASE_URL is set in your .env or .env.local file\n');
    process.exit(1);
  }
}

listUsers();
