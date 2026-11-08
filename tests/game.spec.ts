import { BUG_IDS, closeWith, expect, fakeCatch, openGame, readCard, startGame, test } from './support'

test.describe('start and Welcome board', () => {
  test('start screen explains the game and links to the CV', async ({ page }) => {
    await openGame(page)
    const screen = page.getByTestId('start-screen')
    await expect(screen.getByRole('heading', { name: 'Catch the bugs, read the reports.' })).toBeVisible()
    await expect(page.getByTestId('how-to-play')).toBeVisible()
    await expect(screen.getByRole('link', { name: 'In a hurry? Read the CV' })).toHaveAttribute('href', '#/cv')
  })

  test('the hero cannot move before Start', async ({ page }) => {
    await openGame(page)
    const before = await page.evaluate(() => window.__game.getState().focus)
    await page.keyboard.down('ArrowRight')
    await page.waitForTimeout(500)
    await page.keyboard.up('ArrowRight')
    expect(await page.evaluate(() => window.__game.getState().focus)).toEqual(before)
  })

  test('Start opens the Welcome board with the summary and contact', async ({ page }) => {
    await openGame(page)
    await page.getByTestId('start').click()
    const board = page.getByTestId('welcome-board')
    await expect(board).toBeVisible()
    await expect(board.getByRole('heading', { level: 2 })).toContainText('Tangid')
    await expect(board.getByTestId('contact')).toBeVisible()
    await closeWith(board.getByTestId('welcome-board-close'))
    await expect(board).toBeHidden()
    await expect(page.getByTestId('coverage')).toContainText('0 / 8')
  })

  test('Escape closes the Welcome board', async ({ page }) => {
    await openGame(page)
    await page.getByTestId('start').click()
    await expect(page.getByTestId('welcome-board-close')).toHaveAttribute('aria-disabled', 'false')
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('welcome-board')).toBeHidden()
  })
})

test.describe('playing', () => {
  test('arrow keys walk the hero', async ({ page }) => {
    await startGame(page)
    const [x0] = await page.evaluate(() => window.__game.getState().focus)
    await page.keyboard.down('ArrowRight')
    await expect.poll(() => page.evaluate(() => window.__game.getState().focus[0])).toBeGreaterThan(x0 + 1)
    await page.keyboard.up('ArrowRight')
  })

  test('swinging the net at a bug catches it', async ({ page }) => {
    await startGame(page)
    await page.waitForFunction(() => Object.keys(window.__bugs).length === 8)
    // Hold BUG-006 inside the net for a moment, then really swing with Space. The game's own catch check does the rest.
    await page.evaluate(() => {
      const bug = window.__bugs['BUG-006']
      const until = performance.now() + 1500
      const pin = () => {
        const [x, z] = window.__game.getState().netPos
        bug.x = x
        bug.z = z
        if (performance.now() < until) requestAnimationFrame(pin)
      }
      pin()
    })
    await page.keyboard.press('Space')
    const card = page.getByTestId('bug-report')
    await expect(card).toContainText('BUG-006')
    await expect(card).toContainText('Resolved')
    await expect(page.getByTestId('coverage')).toContainText('1 / 8')
  })

  test('a caught bug opens its report card, then coverage goes up', async ({ page }) => {
    await startGame(page)
    await fakeCatch(page, 'BUG-001')
    const card = page.getByTestId('bug-report')
    await expect(card).toContainText('BUG-001')
    await expect(card).toContainText('Critical')
    await expect(card).toContainText('Resonian Inc.')
    await readCard(page, 'BUG-001')
    await expect(page.getByTestId('coverage')).toContainText('1 / 8')
    await expect(page.getByRole('progressbar', { name: 'Test coverage' })).toHaveAttribute('aria-valuenow', '1')
  })

  test('two catches at once queue their cards', async ({ page }) => {
    await startGame(page)
    await fakeCatch(page, 'BUG-002')
    await fakeCatch(page, 'BUG-003')
    await expect(page.getByTestId('bug-report-close')).toHaveText('Next report (1 more)')
    await readCard(page, 'BUG-002')
    await readCard(page, 'BUG-003')
    await expect(page.getByTestId('bug-report')).toBeHidden()
  })

  test('the hero stays still while a card is open', async ({ page }) => {
    await startGame(page)
    await fakeCatch(page, 'BUG-008')
    await expect(page.getByTestId('bug-report')).toBeVisible()
    const before = await page.evaluate(() => window.__game.getState().focus)
    await page.keyboard.down('ArrowLeft')
    await page.waitForTimeout(500)
    await page.keyboard.up('ArrowLeft')
    expect(await page.evaluate(() => window.__game.getState().focus)).toEqual(before)
  })

  test('catching all 8 bugs shows "All tests passed"', async ({ page }) => {
    // Eight cards to read: give slow machines (like CI runners) extra time.
    test.slow()
    await startGame(page)
    for (const id of BUG_IDS) await fakeCatch(page, id)
    for (const id of BUG_IDS.slice(0, -1)) await readCard(page, id)
    await expect(page.getByTestId('bug-report-close')).toHaveText('See test results')
    await readCard(page, BUG_IDS.at(-1)!)

    const end = page.getByTestId('end-screen')
    await expect(end.getByRole('heading', { name: 'All tests passed ✅' })).toBeVisible()
    await expect(end).toContainText('100%')
    await expect(end.getByTestId('contact')).toBeVisible()
    await expect(end.getByTestId('test-this-site')).toHaveAttribute('href', /TESTING\.md$/)
    await expect(page.getByTestId('top-bar').getByTestId('download-cv')).toBeVisible()

    await closeWith(end.getByTestId('keep-exploring'))
    await expect(end).toBeHidden()
  })

  test('Play again starts a fresh game', async ({ page }) => {
    // Eight cards to read: give slow machines (like CI runners) extra time.
    test.slow()
    await startGame(page)
    for (const id of BUG_IDS) await fakeCatch(page, id)
    for (const id of BUG_IDS) await readCard(page, id)
    // The ending ignores clicks for a moment; "Keep exploring" shows when it's ready.
    await expect(page.getByTestId('keep-exploring')).toHaveAttribute('aria-disabled', 'false')
    await page.getByTestId('play-again').click()
    await expect(page.getByTestId('start-screen')).toBeVisible()
    await page.getByTestId('start').click()
    await closeWith(page.getByTestId('welcome-board-close'))
    await expect(page.getByTestId('coverage')).toContainText('0 / 8')
  })
})

test.describe('top bar on the game screen', () => {
  test('View CV and back keeps the game going', async ({ page }) => {
    await startGame(page)
    await fakeCatch(page, 'BUG-008')
    await readCard(page, 'BUG-008')
    await page.getByTestId('view-cv').click()
    await expect(page.getByTestId('cv-page')).toBeVisible()
    const back = page.getByTestId('play-game')
    await expect(back).toContainText('Back')
    await back.click()
    await expect(page.getByTestId('coverage')).toContainText('1 / 8')
    await expect(page.getByTestId('start-screen')).toBeHidden()
  })

  test('mute button toggles sound and remembers the choice', async ({ page }) => {
    await openGame(page)
    const mute = page.getByTestId('mute')
    await expect(mute).toHaveAttribute('aria-pressed', 'false')
    await mute.click()
    await expect(mute).toHaveAttribute('aria-pressed', 'true')
    await page.reload()
    await expect(page.getByTestId('mute')).toHaveAttribute('aria-pressed', 'true')
  })

  test('M key toggles sound', async ({ page }) => {
    await startGame(page)
    await page.keyboard.press('KeyM')
    await expect(page.getByTestId('mute')).toHaveAttribute('aria-pressed', 'true')
  })

  test('How to play opens and closes', async ({ page }) => {
    await startGame(page)
    await page.getByTestId('how-to-play-button').click()
    const panel = page.getByTestId('help-panel')
    await expect(panel.getByRole('heading', { name: 'How to play' })).toBeVisible()
    await expect(panel.getByTestId('test-this-site')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(panel).toBeHidden()
  })

  test('desktop shows no touch controls', async ({ page }) => {
    await startGame(page)
    await expect(page.getByTestId('touch-controls')).toHaveCount(0)
  })
})
