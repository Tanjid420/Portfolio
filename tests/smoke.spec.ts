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

test('share preview tags and favicon are in place', async ({ page, request }) => {
  await page.goto('./')
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /QA Engineer/)
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /.+/)
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute('content', /.+/)
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', /tanjid420\.github\.io\/Portfolio/)
  const icon = await page.locator('link[rel="icon"]').getAttribute('href')
  const res = await request.get(icon!)
  expect(res.ok()).toBeTruthy()
})
