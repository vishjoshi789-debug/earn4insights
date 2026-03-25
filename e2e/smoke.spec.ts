import { test, expect } from '@playwright/test'

// ── Public pages ──────────────────────────────────────────────────

test.describe('Public pages', () => {
  test('homepage loads with hero heading', async ({ page }) => {
    // First navigation may trigger dev server compilation — allow extra time
    await page.goto('/', { timeout: 180_000 })
    await expect(page).toHaveTitle(/Earn4Insights/)
    const h1 = page.locator('h1')
    await expect(h1).toBeVisible()
  })

  test('login page loads', async ({ page }) => {
    await page.goto('/login')
    await expect(page).toHaveURL(/login/)
    // Should contain a sign-in form or auth UI
    await expect(page.locator('body')).not.toBeEmpty()
  })

  test('top-products page loads', async ({ page }) => {
    await page.goto('/top-products')
    await expect(page).toHaveURL(/top-products/)
    await expect(page.locator('body')).not.toBeEmpty()
  })
})

// ── Accessibility basics ──────────────────────────────────────────

test.describe('Accessibility basics', () => {
  test('homepage has lang attribute', async ({ page }) => {
    await page.goto('/')
    const lang = await page.locator('html').getAttribute('lang')
    expect(lang).toBe('en')
  })

  test('homepage has skip-to-content link', async ({ page }) => {
    await page.goto('/')
    const skipLink = page.locator('a[href="#main-content"]')
    await expect(skipLink).toBeAttached()
  })

  test('homepage main has id for skip link target', async ({ page }) => {
    await page.goto('/')
    const main = page.locator('main#main-content')
    await expect(main).toBeAttached()
  })

  test('images have alt text', async ({ page }) => {
    await page.goto('/')
    const images = page.locator('img')
    const count = await images.count()
    for (let i = 0; i < count; i++) {
      const alt = await images.nth(i).getAttribute('alt')
      expect(alt, `Image ${i} missing alt text`).toBeTruthy()
    }
  })
})

// ── Viewport responsiveness ───────────────────────────────────────

test.describe('Viewport responsiveness', () => {
  test('homepage renders at mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    const h1 = page.locator('h1')
    await expect(h1).toBeVisible()
    // No horizontal scrollbar
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1) // 1px tolerance
  })

  test('homepage renders at tablet width', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/')
    await expect(page.locator('h1')).toBeVisible()
  })

  test('homepage renders at desktop width', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await expect(page.locator('h1')).toBeVisible()
  })
})

// ── Navigation smoke ─────────────────────────────────────────────

test.describe('Navigation', () => {
  test('can navigate from homepage to login', async ({ page }) => {
    await page.goto('/')
    // Look for a link or button that navigates to login
    const loginLink = page.locator('a[href="/login"], a[href*="login"]').first()
    if (await loginLink.isVisible()) {
      await loginLink.click()
      await expect(page).toHaveURL(/login/)
    }
  })
})
