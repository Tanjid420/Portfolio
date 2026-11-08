import { test, expect } from './support'

test('page loads and draws the 3D canvas', async ({ page }) => {
  await page.goto('./')
  await expect(page).toHaveTitle(/Tangid Khan/)
  await expect(page.locator('canvas')).toBeVisible()
})

test('CV PDF is served', async ({ request }) => {
  const res = await request.get('Tangid_Khan_CV.pdf')
  expect(res.ok()).toBeTruthy()
  expect(res.headers()['content-type']).toContain('pdf')
})
