/**
 * Campaign status → the word a user actually sees.
 *
 * The DB stores `proposed` for "published to the marketplace and accepting
 * applications" (see campaignMarketplaceRepository: the marketplace filter is
 * `isPublic = true AND status IN ('proposed','active')`). The brand-facing UI
 * has always CALLED that action "Publish" — the button says Publish, and the
 * success toast says "Campaign published" — but the status badge rendered the
 * raw column value, so a brand clicked **Publish** and then saw a chip reading
 * **proposed**. Two names for one state, one of them internal.
 *
 * Renaming the column was the alternative and was rejected: `proposed` is
 * load-bearing in the marketplace query, the transition table, the schema's
 * `$type` union and existing rows. This is a presentation problem, so it gets
 * a presentation fix.
 *
 * ⚠️ Use this at EVERY campaign-status render site. The reason the mismatch
 * survived this long is that each page kept its own local map, so there was no
 * single place where the vocabulary was decided.
 */
export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  proposed: 'Published',
  negotiating: 'Negotiating',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
  disputed: 'Disputed',
}

/**
 * Falls back to the raw status rather than a blank or a placeholder: an
 * unrecognised value is a bug worth SEEING in the badge, and silently
 * rendering nothing would hide it. Only a null/undefined status — no campaign
 * loaded — degrades to a dash.
 */
export function campaignStatusLabel(status: string | null | undefined): string {
  if (!status) return '—'
  return CAMPAIGN_STATUS_LABELS[status] ?? status
}
