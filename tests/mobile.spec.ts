// Runs in the "mobile" project only (Pixel 7 size, touch screen). See playwright.config.ts.
import type { Page } from '@playwright/test'
import { expect, openGame, startGame, test } from './support'

/** True if the page is wider than the screen (sideways scrolling). */
const scrollsSideways = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)

test('top bar keeps both CV buttons on screen', async ({ page }) => {
  await openGame(page)
  for (const id of ['view-cv', 'download-cv']) {
    await expect(page.getByTestId(id)).toBeInViewport({ ratio: 1 })
  }
  expect(await scrollsSideways(page)).toBe(false)
})

test('CV page fits the phone width', async ({ page }) => {
  await page.goto('./#/cv')
  await expect(page.getByTestId('cv-page')).toBeVisible()
  expect(await scrollsSideways(page)).toBe(false)
})

test('touch controls show after Start', async ({ page }) => {
  await startGame(page)
  await expect(page.getByTestId('joystick')).toBeVisible()
  await expect(page.getByTestId('net-button')).toBeVisible()
})

test('the Swing button swings the net', async ({ page }) => {
  await startGame(page)
  await page.getByTestId('net-button').tap()
  await expect.poll(() => page.evaluate(() => window.__game.getState().swingStartedAt)).toBeGreaterThan(0)
})

test('dragging the joystick walks the hero', async ({ page }) => {
  await startGame(page)
  const box = (await page.getByTestId('joystick').boundingBox())!
  const [x0] = await page.evaluate(() => window.__game.getState().focus)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width, box.y + box.height / 2, { steps: 5 })
  await expect.poll(() => page.evaluate(() => window.__game.getState().focus[0])).toBeGreaterThan(x0 + 1)
  await page.mouse.up()
})

test('the Welcome board fits the screen without scrolling', async ({ page }) => {
  await openGame(page)
  await page.getByTestId('start').click()
  const board = page.getByTestId('welcome-board')
  await expect(board).toBeVisible()
  await expect(board.getByTestId('welcome-board-close')).toBeInViewport({ ratio: 1 })
  expect(await board.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1)
})
