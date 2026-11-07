# Bug Hunt Portfolio: Build Plan

A cute low-poly 3D island. You play a masked QA engineer with a bug net. Catching a bug opens a
"bug report" card with part of the CV. Hosted on GitHub Pages.

## Ground rules (from the owner)

- **Recruiters come first.** A fixed top bar with **View CV** and **Download CV** is visible at all times, in every screen.
- **Short and light.** 8 bugs in total, so the whole game takes about 2 minutes. No long tutorials or walls of text.
- **Cute, funny, easy to understand.** Plain wording on the cards.
- **Sound on by default** with a mute toggle. Browsers block audio until the first click, so the "Start" tap turns sound on.
- **Mobile works.** On-screen joystick and net button, lighter graphics, and the CV page as a fallback.
- **Testers welcome.** The repo ships a Playwright test suite and a "Test this site" guide for other QA engineers.
- **Build in small steps.** Stop after each step so token usage can be checked. Start each step in a fresh session.

## Colors

Island and UI follow the dark theme of the concept page. Keep text light on dark green (about 14:1 contrast).

| Use | Color |
|---|---|
| Grass (main island) | `#2E5E3E` deep forest green, lit by soft sun |
| Grass shadow / cliffs | `#1E3D2A` |
| UI panels, cards, signs | `#0F1712` background, `#17221B` surface |
| Text on panels and signs | `#E4EDE6` (muted: `#9BB0A2`) |
| Accent / highlights | `#5DBB8C` light green |
| Normal bugs | `#FF7452` ladybug red |
| Golden bugs (contributions) | `#F2C14E` |
| Ocean | `#2A8C9E` teal, lighter foam at the shore |
| Sand beaches | `#E3D3A8` |
| Mountains / rocks | `#6B7A72` grey-green |

3D lighting darkens colors, so check the grass in the real scene and lift it if it looks muddy.

## Zones (signs show game name + CV section in brackets)

| Zone sign | CV section | Bugs |
|---|---|---|
| Welcome Zone (About Me) | Summary at the top of the CV. Player starts here; a notice board shows the summary right away, no catching. | 0 |
| Office Zone (Professional Experience) | Resonian Inc., Software QA Engineer | 1 boss |
| Workshop Zone (Contributions) | Star section. 8 contributions, 2 per golden bug (bigger catch moment, card leads with its number): finding bugs / stopping bugs early / owning quality / leveling up | 4 golden |
| Test Lab Zone (Skills) | 8 skill groups, 4 per bug: "How I test" (testing types, platforms, methodology, debugging) / "What I test with" (automation, API testing, languages, AI tools) | 2 |
| Academy Zone (Education) | B.Sc CSE, SUST, 2019–2024 | 1 |

Total 8 bugs, about 2 minutes. Contact details live in the top bar, the Welcome board and the finish screen (no Dock zone).

### What each bug holds

- **Office boss bug:** Software QA Engineer at Resonian Inc. · Remote, California, USA · July 2024 – Present.
- **Workshop golden bugs** (2 contributions each, card leads with a headline number):
  1. *Finding bugs:* exploratory testing on high-risk flows (invoices, payments, VAT/tax) + reported 1,000+ bugs.
  2. *Stopping bugs early:* pre-feature risk analysis with devs and PMs + Smart Invoice AI feature testing.
  3. *Owning quality:* sole QA owner of POS, KIOSK, STOCK, OFFICE + maintenance (test suites, docs, weekly smoke/regression).
  4. *Leveling up:* mentored 2 junior engineers + self-taught Playwright in GitHub Actions CI/CD.
- **Test Lab bugs:** "How I test" (testing types, platforms, methodology, debugging tools) and "What I test with" (automation, API testing, languages, AI tools).
- **Academy bug:** B.Sc in Computer Science and Engineering, Shahjalal University of Science and Technology, 2019–2024, CGPA 3.16/4.00.

## Gameplay details

- **Camera:** top-down angle that follows the player.
- **Character:** generic cute QA hero wearing a mask, carrying a bug net.
- **Controls:** arrows/WASD + Space to swing on desktop; joystick + net button on phones.
- **Catch loop:** walk → spot a bug (it wanders, scurries away when you get close) → swing → bug report card opens → coverage goes up.
- **Bug report cards:** Jira-ticket style. ID (`BUG-003`), severity pill, "Resolved" pill, title, then label/value rows (Found in, Period, Steps, Tools). Short, plain text.
- **Golden bugs:** bigger catch moment (sparkle + special sound).
- **Welcome board:** opens by itself when the game starts. One tap closes it; walking back to the board reopens it. Shows summary + contact.
- **HUD:** "Test coverage: 4 / 8 bugs caught · 50%" bar at the top, plus a small minimap of the zones.
- **Hidden bugs (optional, step 6):** a magnifying glass reveals easter-egg bugs with fun facts. They don't count toward coverage, so they never slow anyone down. Fun facts to be supplied by the owner.
- **Ending:** at 8/8, confetti + "All tests passed ✅" screen with contact details and Download CV.
- **CV page ("View CV"):** plain, fast page with all CV sections, summary first. Also the fallback when 3D can't load.
- **Projects:** none yet. When the owner adds some later, they need a new spot (Workshop is now Contributions).

## Reference files

- Concept page (all decisions, visual): https://claude.ai/artifact/XWomrT5zh6BUJTxZU2GwRA · local copy `../bug-hunt-concept.html` · Desktop copy `C:\Users\User\Desktop\bug-hunt-concept.html`.
- CV PDF: `../TangidKhan_QA_ki.pdf`. Extracted text: `../cv-text.txt` (use this instead of re-parsing the PDF; `pdftotext`/`pypdf` aren't installed).

## Steps

Each step is sized for one session. Tick it when done.

- [x] **0. Setup:** Vite + React + TypeScript, three.js, React Three Fiber, drei, zustand (game state), howler (sound), Playwright. GitHub Action deploys to Pages. Result: a spinning test cube live at `tanjid420.github.io/Portfolio`.
- [x] **1. CV content + CV page:** turn the CV into `src/data/cv.ts`. Build the plain CV page and the fixed top bar (View CV / Download CV). The site is useful to recruiters from this step on.
- [x] **2. The island:** low-poly ground, water, lighting, five zone spots, path in CV order, camera that follows from above.
- [x] **3. The player:** cute masked QA character with a net, walking, net swing, keyboard controls, island edges.
  - Notes from step 2: layout lives in `src/game/world.ts` (`ZONES`, `PATH_POINTS`, `isOnIsland()` for the edges). The camera follows `useGame().focus` in `src/game/store.ts`; the player should set it. Remove the temporary zone buttons (`ZonePreview` in `Game.tsx`, `.zone-preview` in `index.css`). Grass was lifted to `#3A7550`.
  - Notes from step 3: hero lives in `src/game/Player.tsx`. Each frame it writes `focus` (position), `facing`, `netPos` (net ring [x, z]) and `swingStartedAt` (scene clock seconds) to the store. For catching in step 4: the net comes down between 0.3 and 0.55 of `SWING_TIME` (0.4 s); check bugs near `netPos` in that window. `isWalkable()` in `world.ts` blocks the coast, mountains, trees and rocks (bugs can use it too). Mobile joystick comes in step 8.
- [x] **4. The bugs:** bug models, wander and flee behavior, catching with the net.
  - Notes from step 4: bug list and movement live in `src/game/bugs.ts` (`BUGS`: ticket ID, kind, zone, and which CV part the card shows). Models, catch check and catch effects are in `src/game/Bugs.tsx`. Catching calls `catchBug(id)` in the store, which fills `caught` and `lastCatch`; the step 5 card should open from these. Two bugs can be caught by one swing, so the cards need a small queue. Catching is forgiving on purpose: anywhere between the hero and the net ring counts. In dev, `window.__game` (store) and `window.__bugs` (bug positions) help tests; a bot caught all 8 in about a minute.
- [x] **5. Bug reports + HUD:** ticket-style cards filled from `cv.ts`, test coverage bar, minimap.
  - Notes from step 5: card text is built in `src/game/reports.ts` (`reportFor(def)`: severity Critical/Major/Minor for boss/golden/normal, rows from `cv.ts`). Catching pushes the ticket ID onto `cardQueue` in the store; `BugReportCard.tsx` shows the first one and `closeCard()` moves to the next. The hero stops moving and swinging while a card is open. The card ignores closing for 0.65 s so mashing Space can't skip it, then focuses its button (Space, Enter or Esc close it, so does clicking outside). Coverage bar and minimap live in `src/game/Hud.tsx`; the minimap shows bugs left per zone and moves the hero arrow without React re-renders. For step 7, play the card sound when `cardQueue[0]` changes.
- [x] **6. Zone details:** buildings and props for each zone, boss bugs for jobs, hidden bugs and the magnifying glass.
  - Notes from step 6: building spots, the notice board and the magnifier pedestal live in `src/game/world.ts` (`BUILDINGS`, `NOTICE_BOARD`, `MAGNIFIER_SPOT`); all are solid in `isWalkable()` and trees keep clear of them. Models are in `src/game/Buildings.tsx`. The magnifying glass sits next to the start; walking into it sets `hasGlass` and opens a `TOOL-01` card. Three hidden bugs (`src/game/hidden.ts`, `HiddenBugs.tsx`) grow into view within 7 units once the glass is held; catching one calls `findHidden(id)` and opens an `EGG-0x` card with a fun fact. They never touch `caught` or coverage; the HUD shows "Hidden bugs: n / 3" after pickup. Fun facts in `src/data/funFacts.ts` are placeholders until the owner sends theirs (one hidden bug per fact). The notice board is only a prop so far: opening the summary from it belongs in step 9. Step 7: play a pickup sound when `hasGlass` turns true.
- [x] **7. Sound:** background music, catch/swing/card sounds, mute toggle that remembers the choice.
  - Notes from step 7: all sounds are made in code with the Web Audio API (`src/game/sound.ts`), so there are no audio files; howler is installed but unused. `useGameAudio()` in `Game.tsx` unlocks audio on the first click or key press, plays a gentle 4-bar music loop, and listens to the store for swing, catch (normal/golden/boss each differ), hidden bug and magnifier pickup. `BugReportCard.tsx` plays the card sound when a card shows. The mute setting lives in `src/soundSettings.ts` (localStorage key `bughunt-muted`); the 🔊 button sits in the top bar on the game screen only, and M toggles it. Muting, leaving for the CV page or hiding the tab suspends the audio. Step 9's Start tap counts as the first click, so sound will begin there. To tweak volumes, change `MASTER_VOLUME`, `MUSIC_VOLUME`, `SFX_VOLUME` at the top of `sound.ts`.
- [ ] **8. Mobile + performance:** joystick and net button, lower detail on phones, fallback to the CV page if 3D fails.
- [ ] **9. Start and finish:** start screen ("Catch the bugs, read the reports", one line of controls), "All tests passed" ending with contact details, funny copy pass.
- [ ] **10. Playwright suite:** tests for the CV page, top bar, game start, catching a bug, mobile layout. `TESTING.md` invites testers to run and extend them. CI runs the tests on every push.
- [ ] **11. Launch:** page title and share preview, final check on phone and desktop, README.

## Needed from the owner

- CV file: received (see Reference files). Already copied to `public/Tangid_Khan_CV.pdf` (allowed through `.gitignore`). In step 1, the Download CV button links to it with `<a href={`${import.meta.env.BASE_URL}Tangid_Khan_CV.pdf`} download>`.
- Project links and screenshots: later, whenever ready.
- Fun facts for hidden bugs: optional. Placeholders are in `src/data/funFacts.ts`; send your own to replace them.
