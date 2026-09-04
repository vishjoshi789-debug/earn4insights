import type { Serialized } from './serialized'
import type { rewards, pointTransactions, challenges, userPoints } from '@/db/schema'
import type { getRedemptionsForConsumer } from '@/db/repositories/rewardRedemptionRepository'

/**
 * Response types for the consumer rewards page, which aggregates FIVE
 * endpoints: /api/rewards, /api/challenges, /api/user/points,
 * /api/payouts/accounts and /api/consumer/payment-history.
 *
 * All derive — category B. Three of the routes return FULL Drizzle rows
 * (`db.select().from(table)`), so the schema type is already the contract and
 * nothing needs hand-writing.
 *
 * ⚠️ These are DELIBERATELY WIDER than the page's previous local copies. Those
 * listed only the fields the page reads (RewardItem had 6 of the row's
 * columns), which under-describes what actually crosses the wire. Same
 * reasoning as the consumer-signals `latest` payload: a type that hides fields
 * is how someone later "discovers" one and assumes it is new — or worse,
 * assumes it is absent and adds it a second time.
 */

/** GET /api/rewards → catalog[] — a full `rewards` row. */
export type RewardItemResponse = Serialized<typeof rewards.$inferSelect>

/** GET /api/user/points → transactions[] — a full `point_transactions` row. */
export type PointTransactionResponse = Serialized<typeof pointTransactions.$inferSelect>

/** GET /api/user/points → balance. Falls back to a zeroed literal when absent. */
export type PointsBalanceResponse = Serialized<
  typeof userPoints.$inferSelect | { totalPoints: number; lifetimePoints: number }
>

/**
 * GET /api/challenges → challenges[] — the full row spread, plus per-user
 * progress merged in by the route.
 */
export type ChallengeItemResponse = Serialized<
  typeof challenges.$inferSelect & {
    currentCount: number
    completed: boolean
    completedAt?: Date | null
  }
>

/** GET /api/consumer/payment-history → redemptions[] — a repository result. */
export type ConsumerRedemptionResponse = Serialized<
  Awaited<ReturnType<typeof getRedemptionsForConsumer>>[number]
>
