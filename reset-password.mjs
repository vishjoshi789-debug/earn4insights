#!/usr/bin/env node
/**
 * Reset password for a user
 */

import { neon } from '@neondatabase/serverless';
import { hashPassword } from './src/lib/user/password.js';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const sql = neon(process.env.DATABASE_URL);
const rl = readline.createInterface({ input, output });

async function resetPassword() {
  console.log('🔒 Password Reset Tool\n');

  try {
    // Ask for email
    const email = await rl.question('Enter email address: ');

    // Check if user exists
    const users = await sql`
      SELECT id, email, name FROM users WHERE email = ${email}
    `;

    if (users.length === 0) {
      console.log(`\n❌ User not found: ${email}`);
      console.log('Create a new user: node create-test-user.mjs\n');
      rl.close();
      return;
    }

    const user = users[0];
    console.log(`\nFound user: ${user.name} (${user.email})`);

    // Ask for new password
    const newPassword = await rl.question('\nEnter new password (min 8 characters): ');

    if (newPassword.length < 8) {
      console.log('\n❌ Password must be at least 8 characters\n');
      rl.close();
      return;
    }

    // Hash password
    const passwordHash = await hashPassword(newPassword);

    // Update password
    await sql`
      UPDATE users 
      SET password_hash = ${passwordHash},
          updated_at = NOW()
      WHERE id = ${user.id}
    `;

    console.log('\n✅ Password updated successfully!');
    console.log('\n📋 New Login Credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${newPassword}`);
    console.log(`\n🌐 Sign in at: https://earn4insights.vercel.app/login\n`);

    rl.close();

  } catch (error) {
    console.error('\n❌ Error resetting password:', error);
    rl.close();
    process.exit(1);
  }
}

resetPassword();
