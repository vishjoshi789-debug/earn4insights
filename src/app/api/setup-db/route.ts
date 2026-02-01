import { sql } from '@/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Read the migration SQL file content
    const migrationSQL = `
CREATE TABLE IF NOT EXISTS "user_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"demographics" jsonb,
	"interests" jsonb,
	"behavioral" jsonb,
	"notification_preferences" jsonb NOT NULL,
	"consent" jsonb NOT NULL,
	"sensitive_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_email_unique" UNIQUE("email")
);

CREATE TABLE IF NOT EXISTS "user_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"event_type" text NOT NULL,
	"event_data" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "notification_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"channel" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 5 NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"metadata" jsonb,
	"scheduled_for" timestamp NOT NULL,
	"sent_at" timestamp,
	"failed_at" timestamp,
	"failure_reason" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"platform" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"nps_enabled" boolean DEFAULT false NOT NULL,
	"feedback_enabled" boolean DEFAULT false NOT NULL,
	"social_listening_enabled" boolean DEFAULT false NOT NULL,
	"profile" jsonb NOT NULL
);
    `

    // Execute the migration
    await sql(migrationSQL)

    return NextResponse.json({ 
      success: true, 
      message: 'Database tables created successfully' 
    })
  } catch (error: any) {
    console.error('Database setup error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}
