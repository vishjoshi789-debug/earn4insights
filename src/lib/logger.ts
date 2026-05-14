/**
 * Production-safe structured logger.
 * Ensures sensitive data (passwords, tokens, API keys) is never logged.
 * All errors include a correlation context (service, operation) for debugging.
 */

const REDACTED_KEYS = new Set([
  'password', 'passwordHash', 'password_hash',
  'token', 'accessToken', 'refreshToken', 'access_token', 'refresh_token',
  'apiKey', 'api_key', 'secret', 'authorization',
  'creditCard', 'credit_card', 'ssn', 'sensitiveData', 'sensitive_data',
])

/** Recursively redact sensitive keys from an object for safe logging */
function redact(obj: unknown, depth = 0): unknown {
  if (depth > 5) return '[nested]'
  if (obj === null || obj === undefined) return obj
  if (typeof obj === 'string') return obj.length > 500 ? obj.slice(0, 500) + '...[truncated]' : obj
  if (typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.slice(0, 10).map(item => redact(item, depth + 1))
  }

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (REDACTED_KEYS.has(key)) {
      result[key] = '[REDACTED]'
    } else {
      result[key] = redact(value, depth + 1)
    }
  }
  return result
}

/**
 * Mask an email for logs: keep first character + domain, e.g. j***@example.com.
 * Use anywhere an email would otherwise be logged verbatim — full emails are
 * PII and should not appear in Vercel/Datadog/etc. logs.
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email || typeof email !== 'string') return '<no-email>'
  const at = email.indexOf('@')
  if (at <= 0) return '***'
  return `${email[0]}***${email.slice(at)}`
}

/**
 * Mask a phone number for logs: keep only the last 4 digits, e.g. ***1234.
 * Full numbers are PII; the suffix is enough to disambiguate which account
 * a log line belongs to during debugging.
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone || typeof phone !== 'string') return '<no-phone>'
  const digits = phone.replace(/\D/g, '')
  return digits.length <= 4 ? '***' : `***${digits.slice(-4)}`
}

/** Safely extract error info without leaking stack traces in production */
function safeError(error: unknown): { message: string; name?: string } {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
    }
  }
  return { message: String(error) }
}

export const logger = {
  /** Log an external service failure (OpenAI, Resend, Twilio, etc.) */
  serviceError(service: string, operation: string, error: unknown, meta?: Record<string, unknown>) {
    console.error(JSON.stringify({
      level: 'error',
      type: 'service_failure',
      service,
      operation,
      error: safeError(error),
      meta: meta ? redact(meta) : undefined,
      timestamp: new Date().toISOString(),
    }))
  },

  /** Log an API route error */
  apiError(route: string, method: string, error: unknown, meta?: Record<string, unknown>) {
    console.error(JSON.stringify({
      level: 'error',
      type: 'api_error',
      route,
      method,
      error: safeError(error),
      meta: meta ? redact(meta) : undefined,
      timestamp: new Date().toISOString(),
    }))
  },

  /** Log a cron job result */
  cronResult(job: string, success: boolean, meta?: Record<string, unknown>) {
    const level = success ? 'info' : 'error'
    console[level === 'info' ? 'log' : 'error'](JSON.stringify({
      level,
      type: 'cron_result',
      job,
      success,
      meta: meta ? redact(meta) : undefined,
      timestamp: new Date().toISOString(),
    }))
  },

  /** General warning */
  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(JSON.stringify({
      level: 'warn',
      message,
      meta: meta ? redact(meta) : undefined,
      timestamp: new Date().toISOString(),
    }))
  },

  /** General info */
  info(message: string, meta?: Record<string, unknown>) {
    console.log(JSON.stringify({
      level: 'info',
      message,
      meta: meta ? redact(meta) : undefined,
      timestamp: new Date().toISOString(),
    }))
  },
}
