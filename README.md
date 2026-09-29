# Moonshot Almanac website

The public website for the Moonshot Almanac Facebook Page. It's a static, dependency-free page hosted on GitHub Pages:
https://eriksoto01.github.io/moonshot-almanac/

- **This week's sky** is computed with Astronomy Engine for the central U.S. (39°N, 95°W). Event times are in Central Time, and viewing times are local clock time.
- **The sky dial** in the hero is drawn live in the visitor's browser: the sky right now, tonight at 9 p.m., or before dawn, plus the Moon's phase.
- **No tracking.** There are no cookies, analytics or third-party requests. Fonts and scripts are served from this repo.

## Weekly update (one command)

Run this from this folder, ideally on Friday when the week's sky guide goes up:

```bash
npm run week
```

It computes the next 7 days (starting today, Central Time) and picks the 3–5 best events. It renders the star chart for the top event using the studio in `../fb-page-studio`, then rebuilds `index.html`. To start the week on a specific date:

```bash
npm run week -- --from 2026-10-09
```

Then preview and publish:

```bash
npm run serve
```

Open http://localhost:4321, check it, and publish it through a branch and PR:

```bash
git switch -c week-2026-10-09 && git commit -am "Sky guide: week of Oct 9" && git push -u origin HEAD && gh pr create --fill
```

Merge the PR after the "Site checks" run passes. GitHub Pages redeploys in about a minute. If you don't update it, the site says so: once the week has passed, it shows a note pointing visitors to the Facebook Page.

## Newsletter and contact forms

Both forms work right away in "email app" mode: the visitor's email app opens with the signup or message filled in and addressed to `contactEmail`. To have the forms send straight from the page, add these keys to `site.config.json`, then run `node tools/build.js`:

- **Newsletter → Kit** (free up to 10,000 subscribers). In Kit, go to Grow → Landing Pages & Forms → Create new → Form → Inline. Pick any template and save it. Under Publish → HTML, the embed code contains `app.kit.com/forms/<number>/subscriptions`. Put that number in `newsletter.kitFormId`. Kit sends the confirmation ("double opt-in") email and adds an unsubscribe link to every issue. If you turn off "Send incentive email" in Kit, set `newsletter.doubleOptIn` to `false`.
- **Contact → Web3Forms** (free for 250 messages a month). Enter `contactEmail` on web3forms.com to get an access key by email, and put it in `contact.web3formsKey`. Messages arrive in that inbox, and hitting Reply answers the sender.

The Kit form ID and the Web3Forms access key are meant to be public, since they sit in the page source. They are not passwords. The privacy note on the page updates automatically to match whichever mode each form is in.

To test other settings without touching the live page: `SITE_CONFIG=/path/to/test.json OUT=test.html node tools/build.js`.

## Other commands

- `npm run images`: refreshes the gallery thumbnails, the link-preview image and the favicons from the studio's `out/` folder (needs `ffmpeg` and `cwebp`: `brew install ffmpeg webp`). Edit the `gallery` list in `site.config.json` to change which posts appear.
- `npm run check`: runs the checks CI runs: no missing files, alt text on every image, no third-party requests, and a page-weight budget.
- `node tools/build.js`: rebuilds `index.html` only, for example after editing copy in `src/index.html`.

## Settings (`site.config.json`)

- `facebookUrl`: the Page's URL. Until it's set, "Follow" buttons link to a Facebook search for "Moonshot Almanac".
- `contactEmail`: optional. It stays blank unless you choose to publish one.
- `siteUrl`: used for the canonical link, the sitemap and the link-preview image.

## Layout

- `src/index.html`: the page template. Edit copy here, not in `index.html`, which is generated.
- `assets/css/site.css`, `assets/js/site.js`: styles; the sky dial, moon widget and lightbox.
- `tools/lib/events.js`: the sky calculations (moon phases, oppositions, elongations, Moon–planet pairings, meteor showers, eclipses, seasons, clock changes).
- `data/week.json`: the current week's computed events.

## Credits

Astronomy Engine (MIT, Don Cross). Star catalog and constellation lines from d3-celestial (BSD-3-Clause, Olaf Frohn). Fonts: Fraunces, Inter and IBM Plex Mono (SIL Open Font License). Meteor-shower peaks use the International Meteor Organization's working list.
