/**
 * Phase 2 of the Blob public-read remediation: rotate every live
 * feedback_media object onto a fresh, unguessable Blob path and destroy the
 * old one.
 *
 * WHY
 * ---
 * Media is stored in Vercel Blob with `access: 'public'` (Vercel Blob has no
 * private-read mode), so a storageKey URL is unauthenticated and permanent.
 * Those URLs were rendered directly into dashboard pages until a66cb16, which
 * means any URL emitted during that window still works for anyone who captured
 * it — from page source, a screenshot, a referrer log, or the ownership hole
 * closed in 61b31af.
 *
 * Phase 1 (a66cb16) stopped NEW leakage by routing all playback through the
 * ownership-checked proxy. It could not un-publish URLs already handed out.
 * This script does that: new object at a new random path, DB updated, old
 * object deleted — after which every previously-leaked URL 404s.
 *
 * DESTRUCTIVE. Deletes production Blob objects and rewrites storage_key.
 *
 * SAFETY PROPERTIES
 * -----------------
 * - Ordering is upload -> update DB -> delete old, per row. A crash at any
 *   point leaves the row pointing at an object that EXISTS (either the old or
 *   the new one). It never leaves a row pointing at something deleted.
 * - A failed delete is logged, not fatal: the row is already safe on the new
 *   URL; the stale object is an orphan to sweep, not a broken reference.
 * - Idempotent. Rotated objects live under `feedback-media-v2/`, and rows
 *   already on that prefix are skipped, so re-running is safe.
 * - Skips status='deleted' rows (retention already removed the object).
 * - --dry-run prints the plan and writes nothing.
 *
 * RUN
 * ---
 *   dotenv -e .env.local -- node scripts/rotate-feedback-media-urls.mjs --dry-run
 *   dotenv -e .env.local -- node scripts/rotate-feedback-media-urls.mjs
 *
 * Needs POSTGRES_URL (or DATABASE_URL) and BLOB_READ_WRITE_TOKEN in env.
 */

import postgres from 'postgres'
import { put, del } from '@vercel/blob'

const DRY_RUN = process.argv.includes('--dry-run')
const ROTATED_PREFIX = 'feedback-media-v2'

const url = process.env.POSTGRES_URL || process.env.DATABASE_URL
if (!url) {
  console.error('Missing POSTGRES_URL / DATABASE_URL.')
  process.exit(1)
}
if (!DRY_RUN && !process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('Missing BLOB_READ_WRITE_TOKEN (required to upload/delete).')
  process.exit(1)
}

const sql = postgres(url, { ssl: 'require', max: 1, idle_timeout: 10 })

/** Derive a stable-ish filename so the new object keeps a sensible extension. */
function extensionFor(mimeType, mediaType) {
  const m = (mimeType || '').toLowerCase()
  if (m.includes('webm')) return 'webm'
  if (m.includes('ogg')) return 'ogg'
  if (m.includes('mp4')) return 'mp4'
  if (m.includes('mpeg')) return 'mp3'
  if (m.includes('wav')) return 'wav'
  if (m.includes('png')) return 'png'
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg'
  if (m.includes('gif')) return 'gif'
  if (m.includes('webp')) return 'webp'
  return mediaType === 'image' ? 'img' : 'bin'
}

let rotated = 0
let skipped = 0
let failed = 0
const orphanedBlobs = []

try {
  const rows = await sql`
    SELECT id, owner_type, owner_id, media_type, mime_type, storage_key, status
    FROM feedback_media
    WHERE status <> 'deleted'
      AND storage_key IS NOT NULL
      AND storage_key <> ''
    ORDER BY created_at
  `

  console.log(`\n=== rotate feedback media ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE)'} ===`)
  console.log(`candidates: ${rows.length}\n`)

  for (const row of rows) {
    const oldUrl = row.storage_key

    if (oldUrl.includes(`/${ROTATED_PREFIX}/`)) {
      console.log(`skip     ${row.id}  already rotated`)
      skipped++
      continue
    }

    const ext = extensionFor(row.mime_type, row.media_type)
    // Path carries no guessable identifier beyond the media id, and
    // addRandomSuffix appends entropy so the URL can't be derived.
    const pathname = `${ROTATED_PREFIX}/${row.owner_type}/${row.owner_id}/${row.media_type}.${ext}`

    if (DRY_RUN) {
      console.log(`would    ${row.id}  ${row.media_type.padEnd(5)} -> ${pathname}`)
      rotated++
      continue
    }

    try {
      // 1. Read the existing object. Still public at this point, so a plain
      //    fetch works; no token needed for the read.
      const res = await fetch(oldUrl)
      if (!res.ok) {
        console.error(`FAIL     ${row.id}  source fetch ${res.status} — leaving row untouched`)
        failed++
        continue
      }
      const body = Buffer.from(await res.arrayBuffer())
      const contentType = res.headers.get('content-type') || row.mime_type || undefined

      // 2. Upload to the new path FIRST. Still access:'public' (Blob has no
      //    private mode) but the URL is fresh, unguessable, and — post-a66cb16
      //    — never rendered to a browser.
      const blob = await put(pathname, body, {
        access: 'public',
        addRandomSuffix: true,
        contentType,
      })

      // 3. Point the row at the new object BEFORE destroying the old one.
      await sql`
        UPDATE feedback_media
        SET storage_key = ${blob.url}
        WHERE id = ${row.id}
      `

      // 4. Destroy the previously-exposed object. Any URL captured earlier
      //    now 404s. Non-fatal: the row is already safe on the new URL.
      try {
        await del(oldUrl)
      } catch (delErr) {
        orphanedBlobs.push(oldUrl)
        console.warn(`WARN     ${row.id}  rotated, but old blob delete failed: ${delErr.message}`)
      }

      console.log(`rotated  ${row.id}  ${row.media_type.padEnd(5)} ${body.length} bytes`)
      rotated++
    } catch (err) {
      console.error(`FAIL     ${row.id}  ${err.message}`)
      failed++
    }
  }

  console.log(`\n--- summary ---`)
  console.log(`rotated : ${rotated}${DRY_RUN ? ' (planned)' : ''}`)
  console.log(`skipped : ${skipped}`)
  console.log(`failed  : ${failed}`)
  if (orphanedBlobs.length) {
    console.log(`\nold blobs that could NOT be deleted (delete manually in the Vercel Blob UI):`)
    for (const u of orphanedBlobs) console.log('  ', u)
  }
  if (failed > 0) {
    console.log(`\n${failed} row(s) failed — safe to re-run; rotated rows are skipped.`)
    process.exitCode = 1
  }
  console.log()
} catch (err) {
  console.error('Fatal:', err.message)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 10 })
}
