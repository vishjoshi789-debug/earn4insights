import type { Serialized } from './serialized'
// import type — erased at compile time, so no server module reaches the client
// bundle. See campaign-payments.ts for why these live in a neutral directory.
import type { CampaignDeepDive } from '@/server/influencerEarningsService'

/**
 * GET /api/influencer/earnings/[campaignId]
 *
 * The route returns the service result verbatim, so the response shape IS
 * CampaignDeepDive after serialisation.
 *
 * ⚠️ Wrapped in Serialized<> even though CampaignDeepDive currently has NO Date
 * fields — it already declares startDate/endDate as `string | null`, so the
 * transform is a no-op today. That is deliberate, not cargo cult: the moment
 * someone adds a `Date` to the service type, the client type follows
 * automatically. Importing the raw type would silently start lying at exactly
 * that point, which is the failure this whole pattern exists to prevent.
 *
 * Replaces a hand-copied `DeepDiveData` in CampaignDeepDive.tsx that duplicated
 * the server interface field for field. It agreed with the server the day it
 * was written — the same "two definitions that agree today" shape that produced
 * the Content Review crash once they stopped agreeing.
 */
export type CampaignDeepDiveResponse = Serialized<CampaignDeepDive>
