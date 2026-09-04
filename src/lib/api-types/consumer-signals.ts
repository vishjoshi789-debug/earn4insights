import type { Serialized } from './serialized'

/**
 * GET /api/consumer/signals
 *
 * ⚠️ FOUR RESPONSE SHAPES, selected by query params — not one contract:
 *
 *   ?latestOnly=true            -> { latest: … }        (used by my-signals)
 *   ?latestOnly=true&category=  -> { category, snapshot }
 *   (default)                   -> { signals: … }       (used by my-signals)
 *   consent-denied category     -> { snapshots: [], reason: 'consent_not_granted' }
 *
 * ⚠️⚠️ THE DIRECTION OF THIS FILE IS INVERTED from every other api-type here.
 *
 * Elsewhere the server type is authoritative and the page derives from it.
 * This route builds its responses into `Record<string, any>` accumulators, so
 * there was NOTHING to derive — deriving would have produced `any`, a shared
 * type that checks nothing. The page's hand-written types were strictly MORE
 * precise than the route's.
 *
 * So the contract lives here and the ROUTE is annotated against it. If a
 * future refactor gives the route real internal types this can flip back to
 * deriving — but do not simply drop the annotations, or both sides return to
 * `any` and agree only by luck.
 *
 * ⚠️ NOTE THE TWO LAYERS BELOW, and why the first attempt at this file was
 * wrong. The accumulators hold PRE-serialisation values (`snapshotAt` is a
 * `Date` from the repository); the client receives POST-serialisation values
 * (an ISO string). Annotating the server accumulator with the client type
 * fails — correctly — with "Type 'Date' is not assignable to type 'string'".
 * That error was the modelling being wrong, not the code: both ends were
 * already right about their own side.
 */

// ── Server side: what the route's accumulators hold ────────────────

export type SignalSnapshotPayload = {
  id?: string
  userId?: string
  signalCategory: string
  signals: Record<string, unknown>
  /** A real Date here; an ISO string by the time the client sees it. */
  snapshotAt: Date
  triggeredBy: string
  schemaVersion?: string
}

export type SignalCategoryDataPayload = {
  snapshots: SignalSnapshotPayload[]
  reason?: 'consent_not_granted'
}

export type ConsumerSignalsHistoryPayload = {
  signals: Record<string, SignalCategoryDataPayload>
}

/**
 * ⚠️ The route assigns the FULL snapshot row here, so `id`, `userId` and
 * `schemaVersion` genuinely cross the wire even though the page reads only
 * three fields. Modelled as optional rather than omitted: a type that under-
 * describes the payload is how someone later "discovers" a field and assumes
 * it is new.
 */
export type ConsumerSignalsLatestPayload = {
  latest: Record<string, SignalSnapshotPayload | null>
}

// ── Client side: what actually arrives after JSON ──────────────────

export type SignalSnapshot = Serialized<SignalSnapshotPayload>
export type SignalCategoryData = Serialized<SignalCategoryDataPayload>
export type ConsumerSignalsHistoryResponse = Serialized<ConsumerSignalsHistoryPayload>
export type ConsumerSignalsLatestResponse = Serialized<ConsumerSignalsLatestPayload>
