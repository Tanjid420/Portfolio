import { test, expect } from '@playwright/test'

test('top bar shows View CV and Download CV on the game screen', async ({ page }) => {
  await page.goto('./')
  const bar = page.getByTestId('top-bar')
  await expect(bar).toBeVisible()
  await expect(bar.getByTestId('view-cv')).toBeVisible()
  await expect(bar.getByTestId('download-cv')).toHaveAttribute('href', /Tangid_Khan_CV\.pdf$/)
})

test('View CV opens the CV page with every section', async ({ page }) => {
  await page.goto('./')
  await page.getByTestId('view-cv').click()
  const cv = page.getByTestId('cv-page')
  await expect(cv).toBeVisible()
  await expect(cv.getByRole('heading', { level: 1 })).toHaveText('Md. Tangid Khan')
  for (const section of ['About Me', 'Professional Experience', 'Contributions', 'Skills', 'Education']) {
    await expect(cv.getByRole('heading', { level: 2, name: section })).toBeVisible()
  }
  await expect(page.getByTestId('top-bar')).toBeVisible()
})

test('CV page link works directly', async ({ page }) => {
  await page.goto('./#/cv')
  await expect(page.getByTestId('cv-page')).toContainText('Resonian Inc.')
})

test('Download CV downloads the PDF', async ({ page }) => {
  await page.goto('./#/cv')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('download-cv').click(),
  ])
  expect(download.suggestedFilename()).toBe('Tangid_Khan_CV.pdf')
})
