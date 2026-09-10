import type { db } from '@/db'

/**
 * A Drizzle transaction handle.
 *
 * Derived from `db.transaction`'s own callback signature rather than
 * hand-written, so it cannot drift from the driver.
 *
 * ⚠️ ONE DEFINITION. This started as `PointsTx` in pointsService, and a second
 * copy was about to be written in razorpayRepository for the payout/redemption
 * link — two identical types describing the same handle, which is how they
 * quietly stop being identical. Repositories that accept a transaction import
 * it from here.
 *
 * Lives in `db/` rather than `server/` so a repository can import it without
 * depending on a service.
 *
 * Pass one whenever two writes must land together — a points deduction and the
 * redemption that explains it, a payout completion and the redemption row it
 * closes. A function taking `tx?: DbTx` should run on `(tx ?? db)` so it works
 * standalone and inside a caller's transaction without nesting.
 */
export type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0]
