import 'server-only'

/**
 * Signed OAuth `state` parameter for the social-connect flow.
 *
 * The state carries { platform, userId, returnTo } across the provider
 * round-trip. It is HMAC-SHA-256 signed with AUTH_SECRET and stamped with a
 * short expiry so it cannot be forged or replayed:
 *   - signing prevents a crafted callback link from injecting an arbitrary
 *     `returnTo` (open redirect) or spoofed `platform`/`userId`;
 *   - the expiry bounds how long a captured state stays usable.
 *
 * Generated server-side only (see /api/consumer/social/oauth-url) — the
 * browser never holds AUTH_SECRET. Web Crypto only, mirroring proofCookie.ts,
 * so this stays Edge-safe if ever imported there.
 */

export type OAuthStatePayload = {
  platform: string
  userId: string
  returnTo: string
}

/** How long a freshly minted state stays valid (the OAuth hop is seconds). */
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000 // 10 minutes

function getSecret(): string {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error('AUTH_SECRET is required to sign the OAuth state')
  return s
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Inferred return type (Uint8Array<ArrayBuffer>) — an explicit annotation
// widens it to ArrayBufferLike, which crypto.subtle rejects. See proofCookie.ts.
function b64urlToBytes(s: string) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

/** Build a signed, expiring state string for the OAuth redirect. */
export async function signOAuthState(
  payload: OAuthStatePayload,
  ttlMs: number = OAUTH_STATE_TTL_MS,
): Promise<string> {
  const body = { ...payload, e: Date.now() + ttlMs }
  const encoded = bytesToB64url(new TextEncoder().encode(JSON.stringify(body)))
  const sig = await crypto.subtle.sign('HMAC', await getKey(), new TextEncoder().encode(encoded))
  return `${encoded}.${bytesToB64url(new Uint8Array(sig))}`
}

/**
 * Verify a state string: signature valid and not expired. Returns the
 * payload on success, or null on any failure. Never throws.
 */
export async function verifyOAuthState(
  raw: string | null | undefined,
): Promise<OAuthStatePayload | null> {
  if (!raw) return null
  const dot = raw.indexOf('.')
  if (dot <= 0) return null
  const encoded = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)

  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await getKey(),
      b64urlToBytes(sig),
      new TextEncoder().encode(encoded),
    )
    if (!valid) return null

    const data = JSON.parse(new TextDecoder().decode(b64urlToBytes(encoded))) as {
      platform?: string
      userId?: string
      returnTo?: string
      e?: number
    }
    if (typeof data.e !== 'number' || Date.now() > data.e) return null
    if (!data.platform || !data.userId || !data.returnTo) return null
    return { platform: data.platform, userId: data.userId, returnTo: data.returnTo }
  } catch {
    return null
  }
}

/**
 * Whether a `returnTo` is a safe same-origin relative path. Belt-and-suspenders
 * guard applied even after signature verification — a signed state is trusted,
 * but this keeps an accidental external/protocol-relative value from ever
 * reaching NextResponse.redirect.
 */
export function isSafeReturnTo(value: string | null | undefined): value is string {
  if (!value) return false
  if (!value.startsWith('/')) return false
  if (value.startsWith('//')) return false
  return true
}
