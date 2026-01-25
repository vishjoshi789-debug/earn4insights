import { NextResponse } from 'next/server'
import { db } from '@/db'
import { sql } from 'drizzle-orm'

export async function GET() {
  try {
    console.log('Creating personalization tables...')

    // Create user_profiles table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        demographics JSONB,
        interests JSONB,
        notification_preferences JSONB NOT NULL,
        consent JSONB NOT NULL,
        behavioral JSONB,
        sensitive_data JSONB
      )
    `)

    // Create user_events table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS user_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        product_id TEXT,
        survey_id TEXT,
        notification_id TEXT,
        metadata JSONB,
        session_id TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `)

    // Create notification_queue table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS notification_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        channel TEXT NOT NULL,
        type TEXT NOT NULL,
        status TEXT DEFAULT 'pending' NOT NULL,
        priority INTEGER DEFAULT 5 NOT NULL,
        subject TEXT,
        body TEXT NOT NULL,
        metadata JSONB,
        scheduled_for TIMESTAMP NOT NULL,
        sent_at TIMESTAMP,
        failed_at TIMESTAMP,
        failure_reason TEXT,
        retry_count INTEGER DEFAULT 0 NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `)

    console.log('✅ Tables created successfully!')

    return NextResponse.json({
      success: true,
      message: 'Personalization tables created successfully',
      tables: ['user_profiles', 'user_events', 'notification_queue']
    })
  } catch (error) {
    console.error('Error creating tables:', error)
    return NextResponse.json(
      { error: 'Failed to create tables', details: String(error) },
      { status: 500 }
    )
  }
}
