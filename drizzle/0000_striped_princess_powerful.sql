CREATE TABLE IF NOT EXISTS "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" text NOT NULL,
	"user_name" text,
	"user_email" text,
	"feedback_text" text NOT NULL,
	"rating" integer,
	"sentiment" text,
	"category" text,
	"status" text DEFAULT 'new' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ranking_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" text NOT NULL,
	"category" text NOT NULL,
	"week_start" timestamp NOT NULL,
	"rank" integer NOT NULL,
	"score" real NOT NULL,
	"metrics" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "social_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"platform" text NOT NULL,
	"content" text NOT NULL,
	"url" text,
	"author" text,
	"sentiment" text,
	"engagement_score" real,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"scraped_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "survey_responses" (
	"id" text PRIMARY KEY NOT NULL,
	"survey_id" text NOT NULL,
	"product_id" text NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"user_name" text,
	"user_email" text,
	"answers" jsonb NOT NULL,
	"nps_score" integer,
	"sentiment" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "surveys" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"questions" jsonb NOT NULL,
	"settings" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"event_type" text NOT NULL,
	"product_id" text,
	"survey_id" text,
	"notification_id" text,
	"metadata" jsonb,
	"session_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"demographics" jsonb,
	"interests" jsonb,
	"notification_preferences" jsonb NOT NULL,
	"consent" jsonb NOT NULL,
	"behavioral" jsonb,
	"sensitive_data" jsonb,
	CONSTRAINT "user_profiles_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "weekly_rankings" (
	"id" text PRIMARY KEY NOT NULL,
	"week_start" timestamp NOT NULL,
	"week_end" timestamp NOT NULL,
	"category" text NOT NULL,
	"category_name" text NOT NULL,
	"products" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
