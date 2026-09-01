/**
 * What a server value becomes AFTER `NextResponse.json()` and `res.json()`.
 *
 * ⚠️⚠️ READ THIS BEFORE "SIMPLIFYING" A PAGE TO IMPORT A SERVICE TYPE DIRECTLY.
 *
 * The obvious move — share the service's own return type with the client page —
 * produces a contradiction that TYPECHECKS, which makes it quieter and worse
 * than the untyped `any` it replaces:
 *
 *   server:  { createdAt: Date }     ← what the service returns
 *   wire:    { createdAt: "2026-…" } ← JSON has no Date; it becomes a string
 *   client:  page believes it holds a Date, calls .toISOString(), throws
 *
 * TypeScript cannot catch that, because the shared type asserts the server's
 * shape and nothing checks it against what actually crosses the wire. It is the
 * same class as the Content Review crash (page and route disagreeing while both
 * compile), just harder to spot — there the mismatch was visible in two files,
 * here it hides inside one shared definition that looks authoritative.
 *
 * So a client page imports `Serialized<ServiceReturn>`, never `ServiceReturn`.
 *
 * WHY A MAPPED TYPE rather than hand-writing a response type per endpoint:
 * hand-written types drift from the service the moment someone adds a field,
 * and the drift is silent — exactly the failure we are removing. Deriving from
 * the service means a new field appears on the client type automatically, and a
 * REMOVED field breaks compilation at the page. The transform is mechanical, so
 * a mapped type expresses it once instead of ~10 times.
 *
 * Covered:
 *   Date              → string        (JSON.stringify emits an ISO string)
 *   Date | null       → string | null (conditional types distribute over unions)
 *   arrays / nested   → recursively serialised
 *
 * ⚠️ NOT modelled: `undefined`-valued keys are DROPPED by JSON.stringify, so an
 * optional field the server left `undefined` is absent on the client rather
 * than present-and-undefined. Declared optional (`?:`) fields already read
 * correctly; a required field assigned `undefined` would not, and that is a bug
 * on the server side worth fixing there rather than modelling here.
 */
export type Serialized<T> =
  T extends Date ? string
  : T extends (infer U)[] ? Serialized<U>[]
  : T extends object ? { [K in keyof T]: Serialized<T[K]> }
  : T
