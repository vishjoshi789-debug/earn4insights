-- Email Analytics Tables for Send-Time Optimization
-- Tracks email engagement metrics by send time and demographics

-- Email Send Events: Track when emails are sent to users
CREATE TABLE IF NOT EXISTS "email_send_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL,
  "notification_id" uuid REFERENCES "notification_queue"("id") ON DELETE SET NULL,
  "email_type" text NOT NULL, -- 'survey_notification', 'weekly_digest', etc.
  "sent_at" timestamp NOT NULL,
  "send_hour" integer NOT NULL, -- Hour of day (0-23) for quick filtering
  "send_day_of_week" integer NOT NULL, -- Day of week (0=Sunday, 6=Saturday)
  
  -- User demographics at time of send (snapshot for analysis)
  "user_age_bracket" text, -- '<25', '25-34', '35-44', '45-54', '55+'
  "user_income_bracket" text, -- '<$50K', '$50K-$75K', '$75K-$100K', '$100K+'
  "user_industry" text,
  
  -- Engagement tracking
  "opened" boolean DEFAULT false,
  "opened_at" timestamp,
  "clicked" boolean DEFAULT false,
  "clicked_at" timestamp,
  "converted" boolean DEFAULT false, -- Completed survey, etc.
  "converted_at" timestamp,
  
  -- Time-to-engagement metrics (in minutes)
  "time_to_open" integer, -- Minutes from send to open
  "time_to_click" integer, -- Minutes from send to click
  "time_to_convert" integer, -- Minutes from send to conversion
  
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS "idx_email_send_events_user_id" ON "email_send_events"("user_id");
CREATE INDEX IF NOT EXISTS "idx_email_send_events_sent_at" ON "email_send_events"("sent_at");
CREATE INDEX IF NOT EXISTS "idx_email_send_events_send_hour" ON "email_send_events"("send_hour");
CREATE INDEX IF NOT EXISTS "idx_email_send_events_clicked" ON "email_send_events"("clicked");
CREATE INDEX IF NOT EXISTS "idx_email_send_events_industry" ON "email_send_events"("user_industry");
CREATE INDEX IF NOT EXISTS "idx_email_send_events_age_bracket" ON "email_send_events"("user_age_bracket");

-- Send Time Optimization Cohorts: Define A/B test cohorts for send-time experiments
CREATE TABLE IF NOT EXISTS "send_time_cohorts" (
  "id" serial PRIMARY KEY,
  "user_id" text NOT NULL UNIQUE,
  "cohort_name" text NOT NULL, -- 'morning', 'lunch', 'evening', 'night', 'weekend', 'control'
  "send_hour_min" integer NOT NULL, -- Minimum hour for this cohort (0-23)
  "send_hour_max" integer NOT NULL, -- Maximum hour for this cohort (0-23)
  "assigned_at" timestamp DEFAULT now() NOT NULL,
  
  -- Performance metrics (updated periodically)
  "emails_sent" integer DEFAULT 0,
  "emails_clicked" integer DEFAULT 0,
  "click_rate" decimal(5,4), -- 0.0000 to 1.0000
  "avg_time_to_click" integer, -- Average minutes from send to click
  
  "last_updated" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_send_time_cohorts_user_id" ON "send_time_cohorts"("user_id");
CREATE INDEX IF NOT EXISTS "idx_send_time_cohorts_cohort_name" ON "send_time_cohorts"("cohort_name");

-- Send Time Analytics: Aggregated statistics for decision-making
CREATE TABLE IF NOT EXISTS "send_time_analytics" (
  "id" serial PRIMARY KEY,
  "analysis_date" date NOT NULL,
  "send_hour" integer NOT NULL, -- Hour analyzed (0-23)
  
  -- Overall metrics
  "emails_sent" integer DEFAULT 0,
  "emails_opened" integer DEFAULT 0,
  "emails_clicked" integer DEFAULT 0,
  "emails_converted" integer DEFAULT 0,
  
  -- Rates
  "open_rate" decimal(5,4),
  "click_rate" decimal(5,4),
  "conversion_rate" decimal(5,4),
  
  -- Timing metrics
  "avg_time_to_open" integer,
  "avg_time_to_click" integer,
  "avg_time_to_convert" integer,
  
  -- Statistical significance
  "sample_size" integer,
  "variance" decimal(10,6), -- Variance in click rates
  "optimization_enabled" boolean DEFAULT false,
  
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  
  UNIQUE("analysis_date", "send_hour")
);

CREATE INDEX IF NOT EXISTS "idx_send_time_analytics_date" ON "send_time_analytics"("analysis_date");
CREATE INDEX IF NOT EXISTS "idx_send_time_analytics_hour" ON "send_time_analytics"("send_hour");
CREATE INDEX IF NOT EXISTS "idx_send_time_analytics_click_rate" ON "send_time_analytics"("click_rate");

-- Demographic Performance: Track engagement by demographic segments
CREATE TABLE IF NOT EXISTS "demographic_performance" (
  "id" serial PRIMARY KEY,
  "analysis_date" date NOT NULL,
  "segment_type" text NOT NULL, -- 'age', 'income', 'industry'
  "segment_value" text NOT NULL, -- '25-34', '$50K-$75K', 'tech_saas', etc.
  
  -- Metrics
  "emails_sent" integer DEFAULT 0,
  "emails_clicked" integer DEFAULT 0,
  "click_rate" decimal(5,4),
  "avg_time_to_click" integer,
  
  -- Best send time for this segment
  "optimal_send_hour" integer,
  "optimal_hour_click_rate" decimal(5,4),
  
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  
  UNIQUE("analysis_date", "segment_type", "segment_value")
);

CREATE INDEX IF NOT EXISTS "idx_demographic_performance_date" ON "demographic_performance"("analysis_date");
CREATE INDEX IF NOT EXISTS "idx_demographic_performance_segment" ON "demographic_performance"("segment_type", "segment_value");
