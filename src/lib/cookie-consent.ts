/**
 * Cookie consent storage helpers (client-side only).
 *
 * Shared between the CookieConsent banner and the AnalyticsTracker so
 * the banner is the single source of truth for what tracking is allowed.
 * Bump CONSENT_VERSION when the cookie policy materially changes — older
 * stored consent will be treated as expired and the banner will re-show.
 */

export const CONSENT_STORAGE_KEY = 'e4i-cookie-consent'
export const CONSENT_VERSION = 1

export type CookieConsent = {
  essential: true
  analytics: boolean
  preferences: boolean
  version: number
  acceptedAt: string
}

/** Read the stored consent, or null if absent / older version / corrupted. */
export function readConsent(): CookieConsent | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CookieConsent>
    if (!parsed || parsed.version !== CONSENT_VERSION) return null
    return {
      essential: true,
      analytics: Boolean(parsed.analytics),
      preferences: Boolean(parsed.preferences),
      version: CONSENT_VERSION,
      acceptedAt: typeof parsed.acceptedAt === 'string' ? parsed.acceptedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

/** Persist a new consent choice. Sets version + acceptedAt automatically. */
export function writeConsent(choice: { analytics: boolean; preferences: boolean }): CookieConsent {
  const consent: CookieConsent = {
    essential: true,
    analytics: choice.analytics,
    preferences: choice.preferences,
    version: CONSENT_VERSION,
    acceptedAt: new Date().toISOString(),
  }
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(consent))
    } catch {
      // Quota exceeded or storage disabled — fail silently
    }
  }
  return consent
}

/** True only if the user has explicitly opted in to analytics. */
export function hasAnalyticsConsent(): boolean {
  return readConsent()?.analytics === true
}
