// Shared helpers for the specs. Start here if you want to add a test.
import { test as base, expect, type Locator, type Page } from '@playwright/test'
import type { BugMotion } from '../src/game/bugs'
import type { useGame } from '../src/game/store'

// With ?test=1 the site exposes the game store and bug positions on window (see src/game/device.ts).
declare global {
  interface Window {
    __game: typeof useGame
    __bugs: Record<string, BugMotion>
  }
}

/** Every main bug, in ticket order. */
export const BUG_IDS = ['BUG-001', 'BUG-002', 'BUG-003', 'BUG-004', 'BUG-005', 'BUG-006', 'BUG-007', 'BUG-008']

/** Same as Playwright's `test`, but fails if the page throws an uncaught error. */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    async ({ page }, use) => {
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await use(errors)
      expect(errors, 'uncaught errors on the page').toEqual([])
    },
    { auto: true },
  ],
})
export { expect }

/** Opens the game with test hooks on. `query` adds more switches, e.g. '&touch=1'. */
export async function openGame(page: Page, query = '') {
  await page.goto(`./?test=1${query}`)
  await expect(page.getByTestId('start')).toBeVisible()
}

/** Dialogs ignore clicks for a moment after opening. Waits for the button to be ready, then clicks it. */
export async function closeWith(button: Locator) {
  await expect(button).toHaveAttribute('aria-disabled', 'false')
  await button.click()
}

/** Opens the game, presses Start and closes the Welcome board. The hero can move after this. */
export async function startGame(page: Page, query = '') {
  await openGame(page, query)
  await page.getByTestId('start').click()
  await expect(page.getByTestId('welcome-board')).toBeVisible()
  await closeWith(page.getByTestId('welcome-board-close'))
  await expect(page.getByTestId('welcome-board')).toBeHidden()
}

/** Marks a bug as caught without chasing it. Use this when the test is about what happens after a catch. */
export async function fakeCatch(page: Page, id: string) {
  await page.evaluate((id) => window.__game.getState().catchBug(id), id)
}

/** Closes the bug report card on screen and checks which ticket it was. */
export async function readCard(page: Page, id: string) {
  const card = page.getByTestId('bug-report')
  await expect(card).toBeVisible()
  await expect(card).toContainText(id)
  await closeWith(card.getByTestId('bug-report-close'))
  await expect(page.getByTestId('bug-report').filter({ hasText: id })).toHaveCount(0)
}
