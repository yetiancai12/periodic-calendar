# Kept Calendar

Kept Calendar is a sidebar calendar for Obsidian. It reads the folders, filename formats, and template paths already stored by Daily notes, Calendar, and Periodic Notes, then opens or creates the daily, weekly, monthly, quarterly, or yearly note you click. Week numbers follow the weekly filename, including ISO weeks across the new year.

The calendar, periodic notes, and a basic weekly review are free. Pro is optional.

The directory id `periodic-calendar` is already published by another plugin, so this project ships as **Kept Calendar** (`kept-calendar`).

## Payment

Core features stay free. Pro is $25 per year, sold as a Gumroad license key. Paste the key under Settings → Kept Calendar → License. There is no device limit and no use limit.

Pro adds weekly and monthly reviews that list notes created or changed during the period and open tasks (`- [ ]`) from that period's daily notes. You do not write a query. Refreshing a review replaces only the marked block, so text you wrote stays put.

If the subscription ends, is refunded, is chargebacked, or is cancelled, Pro commands turn off. The calendar and every note already in the vault stay as they are.

The Gumroad product id in `src/constants.ts` is a placeholder until the product exists. Until it is replaced, license checks stay off and Pro stays unavailable.

## Network use

The free plugin does not use the network. Pro checks the license key with Gumroad at `https://api.gumroad.com/v2/licenses/verify`, through Obsidian's `requestUrl`. The request sends the license key and the product id. Note contents are not sent. A successful check is cached for 7 days. Offline, a license that last checked out successfully keeps working for 14 days. That verify call is the only network request in this plugin.

## Upgrade line

The free weekly review lists links to that week's daily notes and one static line: "Upgrade to Pro to include notes changed during this period and open tasks." The same sentence is shown in plugin settings. There is no pop-up.

## What you can do

- Open the calendar from the ribbon or the command "Open calendar". It works on desktop and mobile (`isDesktopOnly` is false).
- Click a day, a week number, the month name, the year, or the quarter to open or create that note. If the file is already there, it opens.
- On first launch, folders, formats, and templates are copied from Daily notes and Periodic Notes. Week start is copied from Calendar when that setting is a weekday. Change week start in Kept Calendar settings; it is saved across restarts.
- Commands open today's note, this week, this month, this quarter, and this year.
- "Create or refresh weekly review" works without a license. With a valid license it also lists other notes touched in the week and open tasks. "Create or refresh monthly review" requires Pro.
- Exclude folders from the Pro note list in settings.
- The generated block sits between `%% kept-calendar:generated:start %%` and `%% kept-calendar:generated:end %%`.

Filename formats use the tokens people already store in Daily notes and Periodic Notes: `YYYY`, `MM`, `DD`, `GGGG`, `WW`, `gggg`, `ww`, `Q`, and text in square brackets such as `[W]`. A letter that is also a token, including the W in a word, is formatted unless the word sits in brackets. The default weekly review name is `GGGG-[W]WW [Weekly Review]`. Month and weekday names in filenames are English.

## Install from a release

Copy `main.js`, `manifest.json`, and `styles.css` into `<vault>/.obsidian/plugins/kept-calendar/`, then enable Kept Calendar in Community plugins.

## Development

```bash
npm install
npm test
npm run build
```

`npm run build` typechecks and writes `main.js`. Tag a commit `x.y.z` (the same version as `manifest.json`) to run the release workflow, which attaches `main.js`, `manifest.json`, and `styles.css` to the GitHub release.

Manual checks that need Obsidian, including mobile emulation with `app.emulateMobile(true)`, are written in [docs/acceptance.md](docs/acceptance.md).

## License

MIT. See [LICENSE](LICENSE).
