-- Deep Analytics: every user interaction
CREATE TABLE IF NOT EXISTS "analytics_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id" text NOT NULL,
  "user_id" text,
  "user_role" text,
  "anonymous_id" text,
  "event_type" text NOT NULL,
  "event_name" text NOT NULL,
  "event_data" jsonb,
  "page_url" text NOT NULL,
  "page_title" text,
  "page_path" text,
  "referrer" text,
  "utm_source" text,
  "utm_medium" text,
  "utm_campaign" text,
  "element_tag" text,
  "element_text" text,
  "element_id" text,
  "element_class" text,
  "click_x" integer,
  "click_y" integer,
  "device_type" text,
  "browser" text,
  "os" text,
  "screen_width" integer,
  "screen_height" integer,
  "viewport_width" integer,
  "viewport_height" integer,
  "language" text,
  "country" text,
  "region" text,
  "city" text,
  "timezone" text,
  "ip" text,
  "session_start" timestamp,
  "time_on_page" integer,
  "scroll_depth" integer,
  "page_load_time" integer,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_analytics_events_session" ON "analytics_events" ("session_id");
CREATE INDEX IF NOT EXISTS "idx_analytics_events_created" ON "analytics_events" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_analytics_events_type" ON "analytics_events" ("event_type");
CREATE INDEX IF NOT EXISTS "idx_analytics_events_path" ON "analytics_events" ("page_path");
CREATE INDEX IF NOT EXISTS "idx_analytics_events_user" ON "analytics_events" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_analytics_events_device" ON "analytics_events" ("device_type");
CREATE INDEX IF NOT EXISTS "idx_analytics_events_country" ON "analytics_events" ("country");
