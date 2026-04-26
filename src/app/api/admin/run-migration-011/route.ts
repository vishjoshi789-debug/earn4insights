import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 011: Deals + Community FK CASCADE Hardening (GDPR Art. 17)
 * POST /api/admin/run-migration-011
 * Header: x-api-key: <ADMIN_API_KEY>
 *
 * Migration 009 created the deals/community tables with raw text user_id columns
 * and no FK constraints. This left 9 tables orphaned on user account deletion,
 * violating GDPR Article 17 (right to erasure).
 *
 * This migration:
 *   1. Cleans up any pre-existing orphan rows (DELETE for required cols, NULL for optional cols).
 *   2. Adds FK CASCADE on user references (deletes consumer's content with the account).
 *   3. Adds FK SET NULL on optional staff/admin references (preserves audit history).
 *   4. Adds FK CASCADE on entity references (post_id, comment_id, deal_id) so that
 *      deleting a deal/post properly cascades its votes/saves/comments.
 *
 * Idempotent: each constraint is wrapped in a DO block that checks pg_constraint.
 * Cleanup runs unconditionally (safe — DELETE WHERE NOT IN is a no-op on clean data).
 *
 * Prerequisites: migrations 001-010 must be applied first.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: { step: string; status: string; affected?: number }[] = []

  // Helper: clean orphans by DELETE then add CASCADE FK to users(id)
  async function addUserCascade(opts: {
    table: string
    column: string
    constraintName: string
  }) {
    const { table, column, constraintName } = opts
    const del = await pgClient.unsafe(
      `DELETE FROM ${table} WHERE ${column} IS NOT NULL AND ${column} NOT IN (SELECT id FROM users)`
    )
    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${constraintName}') THEN
          ALTER TABLE ${table}
            ADD CONSTRAINT ${constraintName}
            FOREIGN KEY (${column}) REFERENCES users(id) ON DELETE CASCADE;
        END IF;
      END $$
    `)
    results.push({ step: `${table}.${column} CASCADE`, status: 'ok', affected: del.count ?? 0 })
  }

  // Helper: clean orphans by NULL then add SET NULL FK to users(id)
  async function addUserSetNull(opts: {
    table: string
    column: string
    constraintName: string
  }) {
    const { table, column, constraintName } = opts
    const upd = await pgClient.unsafe(
      `UPDATE ${table} SET ${column} = NULL WHERE ${column} IS NOT NULL AND ${column} NOT IN (SELECT id FROM users)`
    )
    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${constraintName}') THEN
          ALTER TABLE ${table}
            ADD CONSTRAINT ${constraintName}
            FOREIGN KEY (${column}) REFERENCES users(id) ON DELETE SET NULL;
        END IF;
      END $$
    `)
    results.push({ step: `${table}.${column} SET NULL`, status: 'ok', affected: upd.count ?? 0 })
  }

  // Helper: entity reference (post_id, deal_id, comment_id) CASCADE
  async function addEntityCascade(opts: {
    table: string
    column: string
    refTable: string
    constraintName: string
  }) {
    const { table, column, refTable, constraintName } = opts
    const del = await pgClient.unsafe(
      `DELETE FROM ${table} WHERE ${column} IS NOT NULL AND ${column} NOT IN (SELECT id FROM ${refTable})`
    )
    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${constraintName}') THEN
          ALTER TABLE ${table}
            ADD CONSTRAINT ${constraintName}
            FOREIGN KEY (${column}) REFERENCES ${refTable}(id) ON DELETE CASCADE;
        END IF;
      END $$
    `)
    results.push({ step: `${table}.${column} → ${refTable} CASCADE`, status: 'ok', affected: del.count ?? 0 })
  }

  async function addEntitySetNull(opts: {
    table: string
    column: string
    refTable: string
    constraintName: string
  }) {
    const { table, column, refTable, constraintName } = opts
    const upd = await pgClient.unsafe(
      `UPDATE ${table} SET ${column} = NULL WHERE ${column} IS NOT NULL AND ${column} NOT IN (SELECT id FROM ${refTable})`
    )
    await pgClient.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '${constraintName}') THEN
          ALTER TABLE ${table}
            ADD CONSTRAINT ${constraintName}
            FOREIGN KEY (${column}) REFERENCES ${refTable}(id) ON DELETE SET NULL;
        END IF;
      END $$
    `)
    results.push({ step: `${table}.${column} → ${refTable} SET NULL`, status: 'ok', affected: upd.count ?? 0 })
  }

  try {
    // ── User-reference FKs (GDPR Art. 17 — required for user deletion cascade) ──

    // deals: brand owns their deals — CASCADE
    await addUserCascade({ table: 'deals', column: 'brand_id', constraintName: 'fk_deals_brand_id' })

    // community_deals_posts: author owns the post — CASCADE
    await addUserCascade({ table: 'community_deals_posts', column: 'author_id', constraintName: 'fk_cdposts_author_id' })
    // brand mentioned in a post is not the post owner — SET NULL preserves the post
    await addUserSetNull({ table: 'community_deals_posts', column: 'brand_id', constraintName: 'fk_cdposts_brand_id' })
    // verified_by / sponsored_by are admin/staff references — SET NULL preserves the post
    await addUserSetNull({ table: 'community_deals_posts', column: 'verified_by', constraintName: 'fk_cdposts_verified_by' })
    await addUserSetNull({ table: 'community_deals_posts', column: 'sponsored_by', constraintName: 'fk_cdposts_sponsored_by' })

    // votes / saves / redemptions / comments: voter/saver/redeemer/commenter — CASCADE
    await addUserCascade({ table: 'community_deals_post_votes', column: 'user_id', constraintName: 'fk_cdpvotes_user_id' })
    await addUserCascade({ table: 'community_deals_post_saves', column: 'user_id', constraintName: 'fk_cdpsaves_user_id' })
    await addUserCascade({ table: 'community_deals_comments', column: 'author_id', constraintName: 'fk_cdcomments_author_id' })
    await addUserCascade({ table: 'community_deals_comment_votes', column: 'user_id', constraintName: 'fk_cdcvotes_user_id' })
    await addUserCascade({ table: 'deal_saves', column: 'user_id', constraintName: 'fk_dsaves_user_id' })
    await addUserCascade({ table: 'deal_redemptions', column: 'consumer_id', constraintName: 'fk_dredemptions_consumer_id' })

    // flags: flagger CASCADE (their flag goes with them); reviewer SET NULL (preserve flag history)
    await addUserCascade({ table: 'community_deals_flags', column: 'flagged_by', constraintName: 'fk_cdflags_flagged_by' })
    await addUserSetNull({ table: 'community_deals_flags', column: 'reviewed_by', constraintName: 'fk_cdflags_reviewed_by' })

    // ── Entity-reference FKs (delete a deal/post → its dependent rows go too) ──

    // post_id → community_deals_posts
    await addEntityCascade({ table: 'community_deals_post_votes', column: 'post_id', refTable: 'community_deals_posts', constraintName: 'fk_cdpvotes_post_id' })
    await addEntityCascade({ table: 'community_deals_post_saves', column: 'post_id', refTable: 'community_deals_posts', constraintName: 'fk_cdpsaves_post_id' })
    await addEntityCascade({ table: 'community_deals_comments', column: 'post_id', refTable: 'community_deals_posts', constraintName: 'fk_cdcomments_post_id' })

    // parent_comment_id → community_deals_comments (SET NULL: keep replies alive when parent deleted)
    await addEntitySetNull({ table: 'community_deals_comments', column: 'parent_comment_id', refTable: 'community_deals_comments', constraintName: 'fk_cdcomments_parent_id' })

    // comment_id → community_deals_comments
    await addEntityCascade({ table: 'community_deals_comment_votes', column: 'comment_id', refTable: 'community_deals_comments', constraintName: 'fk_cdcvotes_comment_id' })

    // deal_id → deals
    await addEntityCascade({ table: 'deal_saves', column: 'deal_id', refTable: 'deals', constraintName: 'fk_dsaves_deal_id' })
    await addEntityCascade({ table: 'deal_redemptions', column: 'deal_id', refTable: 'deals', constraintName: 'fk_dredemptions_deal_id' })
    await addEntitySetNull({ table: 'community_deals_posts', column: 'deal_id', refTable: 'deals', constraintName: 'fk_cdposts_deal_id' })

    return NextResponse.json({
      success: true,
      message: 'Migration 011 completed: Deals/Community FK CASCADE hardening (GDPR Art. 17)',
      results,
    })
  } catch (error) {
    console.error('[Migration 011] Error:', error)
    return NextResponse.json(
      {
        error: 'Migration 011 failed',
        details: error instanceof Error ? error.message : String(error),
        completedSteps: results,
      },
      { status: 500 }
    )
  }
}
