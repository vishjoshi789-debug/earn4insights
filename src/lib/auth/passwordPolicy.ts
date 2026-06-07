// Single source of truth for password complexity rules.
// Imported by:
//   - signup Zod schema (src/lib/actions/auth.actions.ts)
//   - reset-password API (src/app/api/auth/reset-password/route.ts)
//   - PasswordInput component (src/components/auth/PasswordInput.tsx)
// Keeping client + server on the same rules prevents the "UI says ok,
// server says no" drift that bit us before.

export const PASSWORD_SPECIAL_CHARS_REGEX = /[!@#$%^&*()_+\-=\[\]{}]/

export type PasswordRule = {
  id: 'length' | 'uppercase' | 'lowercase' | 'number' | 'special'
  label: string
  test: (value: string) => boolean
}

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: 'length',
    label: 'At least 8 characters',
    test: (v) => v.length >= 8,
  },
  {
    id: 'uppercase',
    label: 'One uppercase letter',
    test: (v) => /[A-Z]/.test(v),
  },
  {
    id: 'lowercase',
    label: 'One lowercase letter',
    test: (v) => /[a-z]/.test(v),
  },
  {
    id: 'number',
    label: 'One number',
    test: (v) => /[0-9]/.test(v),
  },
  {
    id: 'special',
    label: 'One special symbol (!@#$%^&*)',
    test: (v) => PASSWORD_SPECIAL_CHARS_REGEX.test(v),
  },
] as const

export type PasswordValidation = {
  met: PasswordRule[]
  failed: PasswordRule[]
  allMet: boolean
}

export function validatePassword(value: string): PasswordValidation {
  const met: PasswordRule[] = []
  const failed: PasswordRule[] = []
  for (const rule of PASSWORD_RULES) {
    if (rule.test(value)) met.push(rule)
    else failed.push(rule)
  }
  return { met, failed, allMet: failed.length === 0 }
}

export type PasswordStrength = 'empty' | 'weak' | 'medium' | 'strong'

export function getPasswordStrength(value: string): PasswordStrength {
  if (value.length === 0) return 'empty'
  const metCount = PASSWORD_RULES.filter((r) => r.test(value)).length
  // Length bonus — 12+ chars meeting all rules pushes into 'strong'
  // regardless of which characters they used.
  if (metCount === 5 && value.length >= 12) return 'strong'
  if (metCount >= 4) return 'medium'
  if (metCount >= 2) return 'weak'
  return 'weak'
}

export type PolicyAssertion =
  | { ok: true }
  | { ok: false; reason: string }

// Server-side gate. Returns the first failed rule's label as the reason
// so API responses match the UI's wording exactly.
export function assertPasswordPolicy(value: unknown): PolicyAssertion {
  if (typeof value !== 'string') {
    return { ok: false, reason: 'Password is required' }
  }
  const { failed, allMet } = validatePassword(value)
  if (allMet) return { ok: true }
  return { ok: false, reason: `Password must have: ${failed[0].label.toLowerCase()}` }
}
