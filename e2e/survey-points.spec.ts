import { test, expect } from '@playwright/test'

/**
 * B23 — survey completion credits points to the real users.id.
 *
 * Replaces the diagnosis-era assertion ("points did NOT increase") with the
 * fixed behavior:
 *   - logged-in consumer completes a survey → balance +50, exactly once
 *   - resubmitting the same survey → NO second credit (award-once guard)
 *   - anonymous respondent → response saved, no throw, no points
 *
 * Identity is resolved server-side in submitSurveyResponse via auth(); the
 * balance is read through GET /api/rewards (returns { balance }).
 *
 * Requires fixtures (skips cleanly if absent — no false CI failures):
 *   PLAYWRIGHT_BASE_URL      e.g. https://www.earn4insights.com
 *   E2E_CONSUMER_STORAGE     path to a Playwright storageState for a logged-in consumer
 *   E2E_SURVEY_ID            id of a simple ACTIVE survey the consumer has NOT completed
 *
 *   PLAYWRIGHT_BASE_URL=https://www.earn4insights.com E2E_CONSUMER_STORAGE=.auth/consumer.json \
 *     E2E_SURVEY_ID=<id> npx playwright test e2e/survey-points.spec.ts --project=chromium
 */

const SURVEY_ID = process.env.E2E_SURVEY_ID
const CONSUMER_STORAGE = process.env.E2E_CONSUMER_STORAGE
const SURVEY_COMPLETE_POINTS = 50

async function readBalance(request: import('@playwright/test').APIRequestContext): Promise<number> {
  const res = await request.get('/api/rewards')
  expect(res.ok(), 'GET /api/rewards should succeed for a logged-in consumer').toBeTruthy()
  const body = await res.json()
  return Number(body.balance ?? 0)
}

// Best-effort fill of a simple survey: answer the first option / type text, then submit.
async function completeSurvey(page: import('@playwright/test').Page, surveyId: string) {
  await page.goto(`/survey/${surveyId}`, { timeout: 180_000 })
  // rating (stars / NPS buttons) and multiple-choice render as <button type="button">
  const choiceButtons = page.locator('form button[type="button"]')
  const n = await choiceButtons.count()
  if (n > 0) await choiceButtons.first().click()
  // text questions
  for (const ta of await page.locator('form textarea').all()) {
    await ta.fill('Automated B23 test answer.')
  }
  await page.getByRole('button', { name: /submit response/i }).click()
  await expect(page.getByText(/thank you for your feedback/i)).toBeVisible({ timeout: 30_000 })
}

test.describe('B23 — logged-in consumer earns survey points', () => {
  test.skip(!CONSUMER_STORAGE || !SURVEY_ID, 'set E2E_CONSUMER_STORAGE + E2E_SURVEY_ID to run')
  test.use({ storageState: CONSUMER_STORAGE })

  test('completing a survey credits +50 once; resubmit does not double-credit', async ({ page }) => {
    const before = await readBalance(page.request)

    await completeSurvey(page, SURVEY_ID!)
    const afterFirst = await readBalance(page.request)
    expect(afterFirst, 'first completion credits exactly +50').toBe(before + SURVEY_COMPLETE_POINTS)

    // Resubmit the same survey — award-once guard (sourceId = surveyId) must hold.
    await completeSurvey(page, SURVEY_ID!)
    const afterSecond = await readBalance(page.request)
    expect(afterSecond, 'resubmit must NOT credit again (no points farming)').toBe(afterFirst)
  })
})

test.describe('B23 — anonymous respondent', () => {
  test.skip(!SURVEY_ID, 'set E2E_SURVEY_ID to run')
  // No storageState → anonymous context.
  test.use({ storageState: { cookies: [], origins: [] } })

  test('survey submits and saves with no throw (and no points to credit)', async ({ page }) => {
    await completeSurvey(page, SURVEY_ID!)
    // Reaching the "Thank you" panel proves submitSurveyResponse didn't throw
    // for an anonymous caller (the old email-as-id FK path would have).
    await expect(page.getByText(/thank you for your feedback/i)).toBeVisible()
  })
})
