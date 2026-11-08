# Test this site 🐞

You're a tester? Great. This portfolio is a small game, and it comes with its own Playwright suite.
Run it, break things, add a test. Bug reports and pull requests are welcome.

## Run the tests

You need Node 22 or newer.

```bash
npm ci
npx playwright install chromium
npx playwright test
```

The suite builds the site and serves it at `http://localhost:4173/Portfolio/`, the same build that goes to
GitHub Pages. It takes about 3 minutes, because the 3D island draws with software WebGL (no GPU needed).

Useful variations:

```bash
npx playwright test --project=mobile       # phone tests only (Pixel 7 size, touch screen)
npx playwright test tests/game.spec.ts     # one file
npx playwright test --ui                   # watch the tests run, step by step
npx playwright show-report                 # open the HTML report from the last run
```

GitHub Actions runs the whole suite on every push and pull request (`.github/workflows/tests.yml`).
When something fails there, download the `playwright-report` artifact: it has screenshots and traces.

## What's covered

| File | What it checks |
|---|---|
| `tests/smoke.spec.ts` | The page loads, the 3D canvas draws, the CV PDF is served |
| `tests/cv-page.spec.ts` | Top bar buttons, the CV page and all its sections, Download CV |
| `tests/game.spec.ts` | Start screen, Welcome board, walking, a real net-swing catch, report cards, the card queue, the "All tests passed" ending, Play again, mute, How to play, leaving for the CV and coming back |
| `tests/mobile.spec.ts` | Phone layout (no sideways scroll, CV buttons on screen), joystick and Swing button |
| `tests/fallback.spec.ts` | Without WebGL, the CV page shows instead of the game |

Every test also fails if the page throws an uncaught error.

## Test switches

Add these to the URL, in the tests or by hand in the browser:

| Switch | What it does |
|---|---|
| `?test=1` | Puts the game state on `window.__game` (a zustand store) and the bug positions on `window.__bugs` |
| `?touch=1` / `?touch=0` | Forces the phone controls on or off |
| `?quality=low` / `?quality=high` | Forces lighter or full graphics |
| `?webgl=0` | Pretends the browser has no WebGL, so the CV fallback shows |

With `?test=1` you can try things from the browser console, for example:

```js
window.__game.getState().caught                  // tickets caught so far
window.__game.getState().catchBug('BUG-001')     // "catch" the boss bug without chasing it
Object.keys(window.__bugs)                       // all bug IDs: BUG-001 to BUG-008
```

## Add a test

1. Import from `./support`, not `@playwright/test`. It gives you the same `test` and `expect`, plus the
   uncaught-error check and a few helpers:
   - `openGame(page)` opens the game with test switches on.
   - `startGame(page)` also presses Start and closes the Welcome board, so the hero can move.
   - `fakeCatch(page, 'BUG-003')` catches a bug instantly. Use it when the test is about what happens after a catch.
   - `readCard(page, 'BUG-003')` checks the report card on screen and closes it.
   - `closeWith(button)` waits until a dialog is ready, then clicks. Cards, the board and the ending ignore
     clicks for a moment after they open, so a mashed key can't skip them.
2. Find elements by `data-testid` (`page.getByTestId('coverage')`) or by role and name. Search the code for
   `data-testid` to see them all.
3. Files named `*.mobile.spec.ts` or `mobile.spec.ts` run on the phone project; everything else runs on desktop.

## Ideas for more tests

- Pick up the magnifying glass and find the three hidden bugs.
- Walk to the notice board and press E.
- Keyboard-only play: can you reach and close everything without a mouse?
- An accessibility scan with `@axe-core/playwright`.
- Firefox and WebKit projects.

## Found a bug?

Open an issue on [the repo](https://github.com/Tanjid420/Portfolio/issues). A bug report card would be fitting:
steps, expected, actual, and a screenshot. Severity is up to you. 🙂
