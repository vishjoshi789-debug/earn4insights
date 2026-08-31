/**
 * Who counts as actually being ON a campaign.
 *
 * ⚠️ ONE DEFINITION, DELIBERATELY. This predicate was written out three
 * separate times before this file existed — twice in
 * api/payments/release/[campaignId] and once in cron/process-payouts — and it
 * now also gates which campaigns a creator may submit work against. Three
 * copies that agree today are three copies that can disagree tomorrow, and the
 * consequences are not symmetric: the payment path uses it to decide who gets
 * money, and the content path uses it to decide who can create the approval
 * that authorises that money. They must be the same rule.
 *
 * 'invited' is EXCLUDED and that is the point. An invitation the creator has
 * not accepted is not participation. Offering an invited campaign in the
 * submission selector would let a creator attach work — and therefore
 * manufacture a brand-approvable artefact — on a campaign they never joined.
 *
 * 'rejected' is excluded for the obvious reason.
 */
export const PARTICIPATING_INVITATION_STATUSES = [
  'accepted',
  'active',
  'completed',
] as const

export type ParticipatingInvitationStatus =
  (typeof PARTICIPATING_INVITATION_STATUSES)[number]

/** Narrowing helper so callers don't re-spell the array inline. */
export function isParticipatingStatus(status: string | null | undefined): boolean {
  return !!status && (PARTICIPATING_INVITATION_STATUSES as readonly string[]).includes(status)
}
