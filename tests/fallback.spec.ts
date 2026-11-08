import { expect, test } from './support'

test('without WebGL the CV page shows instead of the game', async ({ page }) => {
  await page.goto('./?webgl=0')
  await expect(page.getByTestId('game-fallback')).toBeVisible()
  await expect(page.getByTestId('cv-page')).toContainText('Resonian Inc.')
  await expect(page.locator('canvas')).toHaveCount(0)
  await expect(page.getByTestId('download-cv')).toBeVisible()
})
