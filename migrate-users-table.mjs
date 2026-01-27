#!/usr/bin/env node
/**
 * Migration: Create users table
 * 
 * This migration creates the users table for authentication.
 * Run this before deploying the auth fixes.
 */

import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function migrate() {
  console.log('🚀 Creating users table...\n');

  try {
    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        name TEXT,
        role TEXT NOT NULL CHECK (role IN ('brand', 'consumer')),
        password_hash TEXT,
        google_id TEXT,
        consent JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `;

    console.log('✅ Users table created successfully');

    // Create index on email for faster lookups
    await sql`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)
    `;

    console.log('✅ Email index created');

    // Create index on google_id for OAuth lookups
    await sql`
      CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL
    `;

    console.log('✅ Google ID index created');

    // Check if table was created
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'users'
    `;

    if (tables.length > 0) {
      console.log('\n✅ Migration complete! Users table is ready.\n');
    } else {
      console.log('\n⚠️  Warning: Table creation may have failed\n');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('\nMake sure DATABASE_URL is set in your environment\n');
    process.exit(1);
  }
}

migrate();
