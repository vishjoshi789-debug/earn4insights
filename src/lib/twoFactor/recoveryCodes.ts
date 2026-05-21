import 'server-only'

import { randomInt } from 'crypto'
import bcrypt from 'bcryptjs'

/**
 * Single-use recovery codes — the fallback when a user loses their
 * authenticator. Plaintext is shown to the user exactly once; only
 * bcrypt hashes are persisted.
 */

const CODE_COUNT = 10
const CODE_LENGTH = 8
// Crockford-style alphabet — no 0/O/1/I to avoid transcription errors.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const BCRYPT_ROUNDS = 10

/** Generate 10 recovery codes, formatted `XXXX-XXXX` for readability. */
export function generateRecoveryCodes(): string[] {
  const codes: string[] = []
  for (let i = 0; i < CODE_COUNT; i++) {
    let raw = ''
    for (let j = 0; j < CODE_LENGTH; j++) {
      raw += ALPHABET[randomInt(ALPHABET.length)]
    }
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4)}`)
  }
  return codes
}

/** Normalise a code for hashing/comparison: uppercase, no spaces or dashes. */
export function normalizeRecoveryCode(code: string): string {
  return (code || '').toUpperCase().replace(/[\s-]/g, '')
}

export async function hashRecoveryCode(code: string): Promise<string> {
  return bcrypt.hash(normalizeRecoveryCode(code), BCRYPT_ROUNDS)
}

/** Constant-time-ish bcrypt compare of a submitted code against a stored hash. */
export async function matchesRecoveryCode(plain: string, hash: string): Promise<boolean> {
  const normalized = normalizeRecoveryCode(plain)
  if (normalized.length !== CODE_LENGTH) return false
  try {
    return await bcrypt.compare(normalized, hash)
  } catch {
    return false
  }
}

export const RECOVERY_CODE_COUNT = CODE_COUNT
