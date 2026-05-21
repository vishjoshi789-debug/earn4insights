import 'server-only'

/**
 * `e4i-2fa` proof cookie — proves the current login passed the 2FA
 * challenge. HMAC-SHA-256 signed with AUTH_SECRET and bound to the
 * session's loginNonce, so it cannot outlive the login it was issued for.
 *
 * Web Crypto only (no node:crypto) — this module is imported by
 * middleware, which Next bundles for the Edge runtime.
 */

export const TWO_FACTOR_PROOF_COOKIE = 'e4i-2fa'

/**
 * How long a passed 2FA challenge stays valid. Set to the session length
 * (30 days) so 2FA is once per login — the loginNonce binding still
 * forces a re-challenge on every genuine new login.
 */
export const TWO_FACTOR_PROOF_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

function getSecret(): string {
  const s = process.env.AUTH_SECRET
  if (!s) throw new Error('AUTH_SECRET is required for the 2FA proof cookie')
  return s
}

function bytesToB64url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Return type is intentionally inferred (Uint8Array<ArrayBuffer>) — an
// explicit `Uint8Array` annotation widens it to ArrayBufferLike, which
// TypeScript 5.7+ rejects where crypto.subtle expects a BufferSource.
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

/** Build a signed proof cookie value bound to `loginNonce`. */
export async function signProofCookie(
  loginNonce: string,
  ttlMs: number = TWO_FACTOR_PROOF_TTL_MS,
): Promise<string> {
  const payload = bytesToB64url(
    new TextEncoder().encode(JSON.stringify({ n: loginNonce, e: Date.now() + ttlMs })),
  )
  const sig = await crypto.subtle.sign('HMAC', await getKey(), new TextEncoder().encode(payload))
  return `${payload}.${bytesToB64url(new Uint8Array(sig))}`
}

/**
 * Verify a proof cookie: signature valid, not expired, and — when a
 * loginNonce is supplied — bound to that login. Never throws.
 */
export async function verifyProofCookie(
  cookieValue: string | null | undefined,
  expectedLoginNonce: string | null | undefined,
): Promise<boolean> {
  if (!cookieValue) return false
  const dot = cookieValue.indexOf('.')
  if (dot <= 0) return false
  const payload = cookieValue.slice(0, dot)
  const sig = cookieValue.slice(dot + 1)

  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await getKey(),
      b64urlToBytes(sig),
      new TextEncoder().encode(payload),
    )
    if (!valid) return false

    const data = JSON.parse(new TextDecoder().decode(b64urlToBytes(payload))) as {
      n?: string
      e?: number
    }
    if (typeof data.e !== 'number' || Date.now() > data.e) return false
    if (expectedLoginNonce && data.n !== expectedLoginNonce) return false
    return true
  } catch {
    return false
  }
}
