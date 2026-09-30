import { NextRequest, NextResponse } from 'next/server'
import { pgClient } from '@/db'

/**
 * Run migration 044: `product_claim_requests` — the claim approval queue.
 *
 * ✅ **ORDERING: SAFE EITHER WAY. This CREATES A NEW TABLE — it adds no column
 * to an existing one.** So the §5 database-first rule does not apply: no bare
 * `db.select()` anywhere can expand to a column that does not exist yet,
 * because nothing selects from a table that nothing knows about. Contrast 043,
 * which added `scored_by` to `contribution_events` and DID require the SQL
 * first because `api/contribution/intelligence/route.ts:37` selects bare.
 *
 * (Run it before or after the deploy; the only consequence of running it after
 * is that the claim pages 500 until it exists, rather than silently breaking
 * something unrelated.)
 *
 * ── WHY ──────────────────────────────────────────────────────────────────
 *
 * `POST /api/dashboard/products/claim` currently calls `claimProduct()`
 * directly with **no ownership proof of any kind** — any authenticated brand
 * could take any claimable product by id, including rows named `Apple`,
 * `Samsung` and `Walmart`. It has no UI, which is the only reason it was never
 * exercised, and "no UI" is not a control.
 *
 * Founder decision: **admin approval queue.** A claim creates a request; the
 * founder approves or rejects. Reasoning recorded because it is a product
 * decision, not a technical one: a consumer who reviewed Samsung shared that
 * feedback expecting it to reach Samsung, and routing it to an unverified
 * stranger contradicts the purpose they consented to. Domain matching was
 * considered and rejected — it fails for `Apple`/`Walmart`, which is arguably
 * correct, but leaves nothing for legitimate claims on consumer-created
 * products.
 *
 * ── THE PARTIAL UNIQUE IS THE CONCURRENCY CONTROL ────────────────────────
 *
 * Between request and approval the product stays `claimable = true`, so without
 * a constraint two brands could hold open requests on the same product and
 * both could be approved — the second approval would silently re-own a product
 * the first brand already owns. The partial UNIQUE makes that impossible at the
 * database level rather than by checking first and hoping.
 *
 * First-come; a rejection frees the product for the next claimant. Same shape
 * as migration 028's partial UNIQUE on open `influencer_verification_requests`.
 *
 * ── FK on-delete, per the 031 policy ─────────────────────────────────────
 *   product_id   CASCADE  — the request is a child of the product
 *   requester_id CASCADE  — operational child of the requester, matching
 *                           `influencer_verification_requests` (028). The audit
 *                           trail of an approved claim survives in `audit_log`,
 *                           which 031 deliberately keeps decoupled, and the
 *                           product itself survives with `claimed_by` SET NULL.
 *   reviewed_by  SET NULL — admin-actor reference; 031 retains these anonymised
 *                           rather than destroying the review record.
 */
export async function POST(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key')
  if (!process.env.ADMIN_API_KEY || apiKey !== process.env.ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await pgClient.unsafe(`
      CREATE TABLE IF NOT EXISTS product_claim_requests (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id   text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        requester_id text NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
        status       text NOT NULL DEFAULT 'pending',
        evidence     text,
        reviewed_by  text REFERENCES users(id) ON DELETE SET NULL,
        reviewed_at  timestamp,
        review_note  text,
        created_at   timestamp NOT NULL DEFAULT now(),
        updated_at   timestamp NOT NULL DEFAULT now()
      );
    `)

    await pgClient.unsafe(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'product_claim_requests_status_values'
        ) THEN
          ALTER TABLE product_claim_requests
            ADD CONSTRAINT product_claim_requests_status_values
            CHECK (status IN ('pending', 'approved', 'rejected', 'info_requested'));
        END IF;
      END $$;
    `)

    // ⚠️ THE CONCURRENCY CONTROL. One open request per product, enforced by the
    // database. Without it, two approvals race and the second silently re-owns
    // a product the first brand already owns.
    await pgClient.unsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS product_claim_requests_one_open_per_product
        ON product_claim_requests (product_id)
        WHERE status IN ('pending', 'info_requested');
    `)

    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS product_claim_requests_status_idx
        ON product_claim_requests (status, created_at DESC);
    `)

    await pgClient.unsafe(`
      CREATE INDEX IF NOT EXISTS product_claim_requests_requester_idx
        ON product_claim_requests (requester_id);
    `)

    const [coverage] = await pgClient.unsafe(`
      SELECT count(*)::int AS total_requests,
             count(*) FILTER (WHERE status = 'pending')::int AS pending,
             count(*) FILTER (WHERE status = 'approved')::int AS approved,
             count(*) FILTER (WHERE status = 'rejected')::int AS rejected
      FROM product_claim_requests;
    `)

    const [claimable] = await pgClient.unsafe(`
      SELECT count(*)::int AS claimable_products
      FROM products
      WHERE claimable = true AND lifecycle_status = 'pending_verification';
    `)

    return NextResponse.json({
      ok: true,
      message: 'Migration 044 completed: product_claim_requests',
      coverage,
      claimable,
      detail:
        'claimable_products is the population this queue exists to serve — ' +
        'consumer-created products with real feedback and no owner. Expect 8.',
    })
  } catch (error: any) {
    console.error('[Migration044]', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
