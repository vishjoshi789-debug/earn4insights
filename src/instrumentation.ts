/**
 * Next.js Instrumentation Hook
 * Runs once when the server starts. Used for environment validation.
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnvironment } = await import('@/lib/env')
    validateEnvironment()
  }
}
