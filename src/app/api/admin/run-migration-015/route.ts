import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 015: Customer Support System
 * POST /api/admin/run-migration-015
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Creates:
 *   - pgvector extension (for chatbot semantic FAQ matching)
 *   - support_ticket_seq sequence (E4I-0001 numbering)
 *   - support_tickets (with FK CASCADE → users)
 *   - support_ticket_messages (FK CASCADE → tickets, SET NULL → users)
 *   - chat_conversations (FK CASCADE → users, SET NULL → tickets)
 *   - faq_articles (search_vector tsvector + embedding vector(1536) + trigger)
 *   - support_analytics
 *
 * Idempotent: CREATE … IF NOT EXISTS / DO blocks.
 * Prerequisites: migrations 001–014 applied first.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { name: string; status: string }[] = []

  try {
    // ── pgvector extension (for chatbot semantic FAQ matching) ──
    await pgClient.unsafe(`CREATE EXTENSION IF NOT EXISTS vector`)
    results.push({ name: 'pgvector extension', status: 'enabled' })

    // ── Ticket-number sequence (atomic, gapless E4I-XXXX) ──
    await pgClient.unsafe(`CREATE SEQUENCE IF NOT EXISTS support_ticket_seq START 1`)
    results.push({ name: 'support_ticket_seq', status: 'created' })

    // ── 1. support_tickets ──
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS support_tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_number TEXT NOT NULL UNIQUE,
        user_id TEXT NOT NULL,
        user_email TEXT NOT NULL,
        user_role TEXT NOT NULL,
        category TEXT NOT NULL,
        subject TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        priority TEXT NOT NULL DEFAULT 'medium',
        assigned_to TEXT,
        resolution_notes TEXT,
        resolved_at TIMESTAMP,
        closed_at TIMESTAMP,
        satisfaction_rating INTEGER,
        satisfaction_feedback TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    results.push({ name: 'support_tickets', status: 'created' })

    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_tickets_user_status ON support_tickets(user_id, status, created_at DESC)`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_tickets_admin_queue ON support_tickets(status, priority, created_at ASC)`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_tickets_number ON support_tickets(ticket_number)`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON support_tickets(assigned_to, status) WHERE assigned_to IS NOT NULL`)
    results.push({ name: 'support_tickets indexes', status: 'created' })

    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_support_tickets_user') THEN
          ALTER TABLE support_tickets
            ADD CONSTRAINT fk_support_tickets_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      END $$
    `)
    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_support_tickets_assigned') THEN
          ALTER TABLE support_tickets
            ADD CONSTRAINT fk_support_tickets_assigned
            FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END $$
    `)
    results.push({ name: 'support_tickets FKs', status: 'created' })

    // ── 2. support_ticket_messages ──
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS support_ticket_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id UUID NOT NULL,
        sender_type TEXT NOT NULL,
        sender_id TEXT,
        message TEXT NOT NULL,
        attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
        is_internal_note BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    results.push({ name: 'support_ticket_messages', status: 'created' })

    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_msgs_ticket_created ON support_ticket_messages(ticket_id, created_at ASC)`)
    results.push({ name: 'support_ticket_messages indexes', status: 'created' })

    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_msgs_ticket') THEN
          ALTER TABLE support_ticket_messages
            ADD CONSTRAINT fk_msgs_ticket
            FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE;
        END IF;
      END $$
    `)
    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_msgs_sender') THEN
          ALTER TABLE support_ticket_messages
            ADD CONSTRAINT fk_msgs_sender
            FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END $$
    `)
    results.push({ name: 'support_ticket_messages FKs', status: 'created' })

    // ── 3. chat_conversations ──
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS chat_conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id TEXT NOT NULL,
        user_role TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        escalated_to_ticket_id UUID,
        messages JSONB NOT NULL DEFAULT '[]'::jsonb,
        context JSONB DEFAULT '{}'::jsonb,
        satisfaction_rating INTEGER,
        total_messages INTEGER NOT NULL DEFAULT 0,
        resolved_by_ai BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    results.push({ name: 'chat_conversations', status: 'created' })

    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_chat_user_status ON chat_conversations(user_id, status, created_at DESC)`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_chat_status ON chat_conversations(status, created_at DESC)`)
    results.push({ name: 'chat_conversations indexes', status: 'created' })

    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_chat_user') THEN
          ALTER TABLE chat_conversations
            ADD CONSTRAINT fk_chat_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      END $$
    `)
    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_chat_ticket') THEN
          ALTER TABLE chat_conversations
            ADD CONSTRAINT fk_chat_ticket
            FOREIGN KEY (escalated_to_ticket_id) REFERENCES support_tickets(id) ON DELETE SET NULL;
        END IF;
      END $$
    `)
    results.push({ name: 'chat_conversations FKs', status: 'created' })

    // ── 4. faq_articles (with tsvector + pgvector) ──
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS faq_articles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        excerpt TEXT NOT NULL,
        category TEXT NOT NULL,
        target_roles TEXT[] NOT NULL DEFAULT '{}',
        tags TEXT[] DEFAULT '{}',
        view_count INTEGER NOT NULL DEFAULT 0,
        helpful_count INTEGER NOT NULL DEFAULT 0,
        not_helpful_count INTEGER NOT NULL DEFAULT 0,
        is_published BOOLEAN NOT NULL DEFAULT true,
        display_order INTEGER NOT NULL DEFAULT 0,
        search_vector tsvector,
        embedding vector(1536),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    results.push({ name: 'faq_articles', status: 'created' })

    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_faq_cat_published ON faq_articles(category, is_published)`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_faq_slug ON faq_articles(slug)`)
    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_faq_search ON faq_articles USING GIN(search_vector)`)
    // ivfflat for vector cosine similarity. Lists tuned for small corpus (<10k articles).
    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS idx_faq_embedding
        ON faq_articles USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 10)
    `)
    results.push({ name: 'faq_articles indexes', status: 'created' })

    // tsvector trigger — keeps search_vector in sync with title + content + tags.
    await pgClient.unsafe(`
      CREATE OR REPLACE FUNCTION update_faq_search() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector := to_tsvector('english',
          COALESCE(NEW.title,'') || ' ' ||
          COALESCE(NEW.excerpt,'') || ' ' ||
          COALESCE(NEW.content,'') || ' ' ||
          COALESCE(array_to_string(NEW.tags,' '),'')
        );
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql
    `)
    await pgClient.unsafe(`
      DROP TRIGGER IF EXISTS trg_faq_search ON faq_articles
    `)
    await pgClient.unsafe(`
      CREATE TRIGGER trg_faq_search
      BEFORE INSERT OR UPDATE OF title, excerpt, content, tags
      ON faq_articles
      FOR EACH ROW EXECUTE FUNCTION update_faq_search()
    `)
    results.push({ name: 'faq_articles search trigger', status: 'created' })

    // ── 5. support_analytics ──
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS support_analytics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_type TEXT NOT NULL,
        user_id TEXT,
        data JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `)
    results.push({ name: 'support_analytics', status: 'created' })

    await pgClient.unsafe(`CREATE INDEX IF NOT EXISTS idx_support_analytics_type ON support_analytics(event_type, created_at DESC)`)
    results.push({ name: 'support_analytics indexes', status: 'created' })

    return NextResponse.json({
      success: true,
      message: 'Migration 015 completed: Customer Support System (5 tables + pgvector)',
      results,
    })
  } catch (error) {
    console.error('[Migration 015] Error:', error)
    return NextResponse.json(
      {
        error: 'Migration 015 failed',
        details: error instanceof Error ? error.message : String(error),
        completedSteps: results,
      },
      { status: 500 }
    )
  }
}
