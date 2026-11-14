# Acceptance checks

Each item from the product MVP is covered by an automated test, a manual check in Obsidian, or both. Automated cases live in `tests/acceptance.test.ts` and the unit tests next to it.

## Acceptance 1

Install in a vault that already uses Periodic Notes with weekly format `GGGG-[W]WW` and Calendar week start Monday. Do not change those files. Open this week's note. The file name matches that ISO week. Quit Obsidian and open it again. Settings → Kept Calendar still shows Monday.

Automated: `tests/acceptance.test.ts` imports a Periodic Notes `data.json` shape plus Calendar `weekStart: "monday"`, resolves `2026-12-28` to `Weekly/2026-W53.md`, and round-trips `weekStart` through `resolveSettings`.

Manual: confirm the first launch reads `.obsidian/plugins/periodic-notes/data.json`, `.obsidian/daily-notes.json`, and `.obsidian/plugins/calendar/data.json`, then reload the app.

## Acceptance 2

The week Monday 2026-12-28 through Sunday 2027-01-03 is ISO week 2026-W53. The weekly filename and the week number on that calendar row both say 53. 2027-01-04 is 2027-W01.

Automated: `tests/dates.test.ts`, `tests/moment-compat.test.ts` (compared with Moment's ISO tokens), and `tests/acceptance.test.ts`.

## Acceptance 3

Click the month name and the year. Each opens or creates the monthly or yearly note. When the file already exists, it opens and the plugin does not report an error.

Automated: `openPeriodNote` on a vault that already contains `Monthly/2026-12.md` and `Yearly/2026.md` returns `opened` and does not call create. A create that throws "already exists" still opens the file.

Manual: click the month and the year in the calendar, including a note that is already in the vault.

## Acceptance 4

With the network off, the calendar, day/week/month/quarter/year notes, and the free weekly review still work.

Automated: opening the calendar and opening a note do not call `resolveLicense` or `requestUrl` (`tests/mobile-and-policy.test.ts`). A weekly review with no key, or with a failed license request, still builds the free review (`tests/acceptance.test.ts`).

Manual: enable airplane mode, open the calendar, open a daily note, and run "Create or refresh weekly review".

## Acceptance 5

The free weekly review contains links to that week's daily notes and one upgrade line. It does not list other notes or open tasks.

Automated: `tests/review.test.ts` and `tests/acceptance.test.ts`. The sentence is `Upgrade to Pro to include notes changed during this period and open tasks.`

## Acceptance 6

With a valid license, the weekly review contains daily links, other notes created or changed in the week, and unchecked `- [ ]` tasks from those daily notes. Refresh again after typing outside the markers. That typing remains once, and list items are not duplicated.

Automated: `tests/review.test.ts`.

Manual: paste a valid key, run the weekly review twice, and edit between the markers' outside text.

## Acceptance 7

The license check requires a key Gumroad accepts, an active subscription, and a purchase that is not refunded, chargebacked, disputed, cancelled, or ended. Invalid, refunded, chargebacked, cancelled, and ended keys show a specific message, Pro stays off, and the message says the calendar still works.

Automated: `tests/license.test.ts` for each of those purchase flags, for a 7-day cache, and for the 14-day offline grace. A failed request inside 14 days of a successful check stays valid. After 14 days it does not. A fresh invalid result is not turned into a grace period.

Manual: the live call needs a real Gumroad product id in `src/constants.ts`. Until that placeholder is replaced, the settings button reports that license checks are not configured.

## Acceptance 8

Simulate Obsidian's mobile mode and open the calendar and a review.

Automated: `manifest.json` has `isDesktopOnly: false`. `simulateMobileMode` places the calendar on the current leaf (mobile has no right sidebar), still builds the December 2026 week number, and still builds a review. Source is scanned for Node, Electron, `innerHTML`, and regex lookbehind.

Manual, in the desktop app's developer console:

```js
this.app.emulateMobile(true);
```

Open the calendar from the ribbon, click a day, and run "Create or refresh weekly review". Turn emulation off with `this.app.emulateMobile(false)`. A physical phone is not part of this pass.

## Acceptance 9

The README states the price, the Gumroad license check (and that note contents are not sent), and the in-app upgrade line. The repo is public. The source is written for this project and does not vendor Calendar or Periodic Notes. `isDesktopOnly` is false, there is no default hotkey, and `versions.json` matches the manifest. Official directory review is a manual step after the first tagged release.

Automated: `tests/mobile-and-policy.test.ts` reads the README, manifest, and source.

Manual: submit the plugin only after the Gumroad product id is real, and choose Optional payment in the directory form.
