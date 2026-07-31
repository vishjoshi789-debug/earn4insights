/**
 * Post-rotation verification for the Blob public-read remediation.
 *
 * Checks, for every live feedback_media row:
 *   1. storage_key points at the rotated (`feedback-media-v2/`) prefix
 *   2. the NEW object is reachable (HTTP 200) — media still plays
 *   3. the OLD object is gone (404/403) — previously-leaked URLs are dead
 *
 * (3) requires the pre-rotation URLs, which this script cannot know after the
 * fact. Capture them first:
 *   dotenv -e .env.local -- node scripts/verify-feedback-media-rotation.mjs --snapshot > pre-rotation-urls.json
 * then after rotating:
 *   dotenv -e .env.local -- node scripts/verify-feedback-media-rotation.mjs --check pre-rotation-urls.json
 *
 * Plain run (no args) does (1) and (2) only.
 *
 * READ-ONLY against the database. Issues HTTP GETs against Blob storage.
 */

import postgres from 'postgres'
import fs from 'fs'

const ROTATED_PREFIX = 'feedback-media-v2'
const args = process.argv.slice(2)
const SNAPSHOT = args.includes('--snapshot')
const checkIdx = args.indexOf('--check')
const CHECK_FILE = checkIdx >= 0 ? args[checkIdx + 1] : null

const url = process.env.POSTGRES_URL || process.env.DATABASE_URL
if (!url) {
  console.error('Missing POSTGRES_URL / DATABASE_URL.')
  process.exit(1)
}

const sql = postgres(url, { ssl: 'require', max: 1, idle_timeout: 10 })

/** HEAD-ish reachability probe; falls back to GET since Blob may not allow HEAD. */
async function probe(u) {
  try {
    const res = await fetch(u, { method: 'GET', headers: { range: 'bytes=0-0' } })
    return res.status
  } catch (err) {
    return `ERR ${err.message}`
  }
}

try {
  const rows = await sql`
    SELECT id, media_type, storage_key, status
    FROM feedback_media
    WHERE status <> 'deleted'
    ORDER BY created_at
  `

  if (SNAPSHOT) {
    const snap = rows.map((r) => ({ id: r.id, oldUrl: r.storage_key }))
    console.log(JSON.stringify(snap, null, 2))
    process.exit(0)
  }

  console.log('\n=== rotation verification ===\n')

  let onNewPrefix = 0
  let reachable = 0
  let problems = 0

  for (const r of rows) {
    const rotatedOk = String(r.storage_key || '').includes(`/${ROTATED_PREFIX}/`)
    const status = await probe(r.storage_key)
    const liveOk = status === 200 || status === 206

    if (rotatedOk) onNewPrefix++
    if (liveOk) reachable++
    if (!rotatedOk || !liveOk) problems++

    console.log(
      `${rotatedOk ? 'v2  ' : 'OLD '} ${liveOk ? 'live' : 'DEAD'}  ${String(r.media_type).padEnd(5)} ${r.id}  (HTTP ${status})`
    )
  }

  console.log(`\n--- summary ---`)
  console.log(`rows                  : ${rows.length}`)
  console.log(`on rotated prefix     : ${onNewPrefix}/${rows.length}`)
  console.log(`new object reachable  : ${reachable}/${rows.length}`)

  if (CHECK_FILE) {
    console.log(`\n--- old URLs (must be dead) ---`)
    // Strip a UTF-8 BOM: PowerShell's `>` redirect writes one, and JSON.parse
    // rejects it ("Unexpected token '﻿'"). The snapshot is routinely
    // produced via `... --snapshot > file.json` on Windows, so handle it.
    const raw = fs.readFileSync(CHECK_FILE, 'utf8').replace(/^﻿/, '')
    const prev = JSON.parse(raw)
    let stillLive = 0
    for (const p of prev) {
      const status = await probe(p.oldUrl)
      const dead = status === 404 || status === 403
      if (!dead) stillLive++
      console.log(`${dead ? 'dead' : 'STILL LIVE'}  ${p.id}  (HTTP ${status})`)
    }
    console.log(`\nold URLs still reachable: ${stillLive} (must be 0)`)
    if (stillLive > 0) process.exitCode = 1
  }

  if (problems > 0) {
    console.log(`\n${problems} row(s) need attention.`)
    process.exitCode = 1
  }
  console.log()
} catch (err) {
  console.error('Fatal:', err.message)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 10 })
}
