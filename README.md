# 🐞 Bug Hunt: Tangid Khan's QA portfolio

**Live site: https://tanjid420.github.io/Portfolio/**

I'm Md. Tangid Khan, a Software QA Engineer (manual testing, Playwright automation, CI/CD). My portfolio is a
tiny 3D game: you're a QA engineer with a bug net on a bug island. Catch the 8 bugs and each one opens a
bug report with a part of my CV. The whole run takes about 2 minutes.

In a hurry? The top bar always has **View CV** and **Download CV**, on every screen.

## How to play

| | Desktop | Phone |
|---|---|---|
| Walk | WASD or arrow keys | Joystick |
| Swing the net | Space | Swing button |
| Read About Me at the notice board | E | Tap the bubble |
| Mute | M or 🔊 | 🔊 |

- **8 bugs** carry the CV: 1 boss bug (experience), 4 golden bugs (contributions), 2 skill bugs, 1 education bug.
- **3 hidden bugs** show up once you pick up the magnifying glass by the start. They hold fun facts.
- At 8 / 8 you get the "All tests passed ✅" screen.

If the device can't run 3D, the site shows the plain CV page instead.

## Test this site

You're a tester? The repo ships a Playwright suite (desktop and phone), and GitHub Actions runs it on every push.
Run it, try to break the site, and add your own tests. See **[TESTING.md](TESTING.md)**.

```bash
npm ci
npx playwright install chromium
npx playwright test
```

## Run it locally

Needs Node 22 or newer.

```bash
npm ci
npm run dev        # http://localhost:5173/Portfolio/
npm run build      # production build in dist/
npm run preview    # serve the build at http://localhost:4173/Portfolio/
```

## Built with

React, TypeScript and Vite · three.js with React Three Fiber and drei · zustand for game state · Web Audio API for
all sounds (made in code, no audio files) · Playwright for tests · GitHub Actions and GitHub Pages.

## Project layout

| Path | What's there |
|---|---|
| `src/data/cv.ts` | All CV text. The CV page and the bug report cards read from here. |
| `src/components/` | Top bar, CV page, fallback, How to play |
| `src/game/` | The island, hero, bugs, report cards, HUD, sound and screens |
| `tests/` | Playwright tests |
| `public/Tangid_Khan_CV.pdf` | The CV behind the Download CV button |

## Contact

- Email: tangidkhan67@gmail.com
- LinkedIn: [linkedin.com/in/mdtangidkhan](https://linkedin.com/in/mdtangidkhan)
- GitHub: [github.com/Tanjid420](https://github.com/Tanjid420)
