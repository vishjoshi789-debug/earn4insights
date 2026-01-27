#!/usr/bin/env node
/**
 * Create a test user for local development/testing
 */

import { neon } from '@neondatabase/serverless';
import { hashPassword } from './src/lib/user/password.js';

const sql = neon(process.env.DATABASE_URL);

async function createTestUser() {
  console.log('🔧 Creating test user...\n');

  const testEmail = 'test@example.com';
  const testPassword = 'Test1234!';
  const testName = 'Test User';
  const testRole = 'brand';

  try {
    // Check if user already exists
    const existing = await sql`
      SELECT id, email FROM users WHERE email = ${testEmail}
    `;

    if (existing.length > 0) {
      console.log(`⚠️  User already exists: ${testEmail}`);
      console.log(`   User ID: ${existing[0].id}`);
      console.log(`\n   To reset password, run: node reset-password.mjs\n`);
      return;
    }

    // Hash password
    const passwordHash = await hashPassword(testPassword);

    // Create user
    const user = await sql`
      INSERT INTO users (email, name, role, password_hash, created_at, updated_at)
      VALUES (
        ${testEmail},
        ${testName},
        ${testRole},
        ${passwordHash},
        NOW(),
        NOW()
      )
      RETURNING id, email, name, role
    `;

    console.log('✅ Test user created successfully!\n');
    console.log('📋 Login Credentials:');
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);
    console.log(`   Role: ${testRole}`);
    console.log(`\n🌐 Sign in at: https://earn4insights.vercel.app/login\n`);

    // Create user profile
    await sql`
      INSERT INTO user_profiles (
        user_id,
        tracking_consent,
        email_notifications,
        demographics,
        interests
      )
      VALUES (
        ${user[0].id},
        true,
        true,
        NULL,
        NULL
      )
    `;

    console.log('✅ User profile created\n');

  } catch (error) {
    console.error('❌ Error creating test user:', error);
    console.error('\nMake sure DATABASE_URL is set in your .env or .env.local file\n');
    process.exit(1);
  }
}

createTestUser();
