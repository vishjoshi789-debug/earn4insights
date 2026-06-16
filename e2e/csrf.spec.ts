import { test, expect } from '@playwright/test'

/**
 * B9 — CSRF wiring smoke test.
 *
 * Guards the double-submit plumbing the app relies on:
 *   - the root layout renders <meta name="csrf-token"> populated by middleware
 *   - middleware sets the `e4i-csrf` cookie
 *   - the two agree (the double-submit check compares header vs cookie)
 *
 * Runs against PLAYWRIGHT_BASE_URL when set (e.g. the Vercel deploy) so it
 * doesn't depend on the slow local dev server:
 *   PLAYWRIGHT_BASE_URL=https://www.earn4insights.com \
 *     npx playwright test e2e/csrf.spec.ts --project=chromium
 */

// 32-byte token rendered as hex → 64 chars. Assert a non-trivial length
// rather than an exact value so the test isn't brittle to token-size changes.
const MIN_TOKEN_LEN = 32

test.describe('CSRF wiring', () => {
  test('csrf-token meta tag is present and populated', async ({ page }) => {
    await page.goto('/', { timeout: 180_000 })
    const meta = page.locator('meta[name="csrf-token"]')
    await expect(meta).toBeAttached()
    const content = await meta.getAttribute('content')
    expect(content, 'csrf-token meta must be non-empty (middleware wiring)').toBeTruthy()
    expect((content ?? '').length).toBeGreaterThanOrEqual(MIN_TOKEN_LEN)
  })

  test('e4i-csrf cookie is set and matches the meta token', async ({ page, context }) => {
    await page.goto('/', { timeout: 180_000 })

    const cookies = await context.cookies()
    const csrf = cookies.find((c) => c.name === 'e4i-csrf')
    expect(csrf, 'e4i-csrf cookie must be set by middleware').toBeTruthy()
    expect((csrf?.value ?? '').length).toBeGreaterThanOrEqual(MIN_TOKEN_LEN)

    // Double-submit only passes if the meta token equals the cookie token.
    const metaContent = await page.locator('meta[name="csrf-token"]').getAttribute('content')
    expect(metaContent).toBe(csrf?.value)
  })
})
