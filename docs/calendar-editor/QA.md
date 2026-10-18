# Site-wide release QA — 2026-10-18

This record covers the current release candidate. It separates checks that ran locally from CI and production checks that have not yet run against the final commit.

## Reproduced defect and repair

The permanent editor regression reproduced a WebKit/Safari failure when saving a photo as a native `Blob` in IndexedDB: WebKit returned `UnknownError: Error preparing Blob/File data to be stored in object store`, so the project could not be restored after reload. New photo records now store bytes as `ArrayBuffer`; restore accepts both this format and existing `{ blob }` records. The repair leaves localStorage, IndexedDB records, calendar notes, and preferences intact.

The full Chromium route run also exposed a broken holiday-to-personal-calendar action: the homepage treated its holiday article array as a function and stopped while opening the selected holiday. The source now looks up the article directly; a browser regression follows a 2028 Easter link from the holiday guide and verifies the populated event dialog.

The full WebKit route run found horizontal overflow on the printable-calendar page. Safari let the long selected design option extend the download panel's scroll area past the viewport. The shared active stylesheet now clips the single-line select value with an ellipsis, and a permanent regression checks both page width and selector operation.

## Executed source checks

- Release build with Ruby 3.4.11, Bundler 2.6.9, and the pinned Node runtime: **191 canonical pages, 4,560 generated static files, release revision `a21b07daf415b8f493a4`**. The retained immutable release paths are `a21b07daf415b8f493a4`, `7dfc976a697cd53a4f44`, and `874ac7e1927f95c417e7`.
- `scripts/audit_site.py --release`: **192 HTML files including the 404 page; 191 canonical landing pages; 25,718 local targets; zero broken local links**. Canonical and sitemap parity, indexability, metadata, JSON-LD, the editor bundle, fonts, and 360 monthly image entries passed.
- `node --test test/*.test.js`: **353 passed, 0 failed**.
- Ruby static asset URL tests: **5 tests, 58 assertions, 0 failures**. CSS minifier tests: **2 tests, 14 assertions, 0 failures**.
- The generated Cloudflare `_headers` file has **97 rules**; every rule contains at most one wildcard, within the 100-rule limit. Immutable release assets use versioned paths; HTML and mutable data are revalidated.

## Executed browser checks

- Permanent editor regression: **12/12 passed** on desktop Chromium, desktop WebKit, Android Chrome emulation, and iPhone Safari/WebKit emulation. It exercised mobile editor controls, leap-day preview, event/note persistence, preservation of an existing note and 12-hour preference, unrelated localStorage data, photo-byte persistence across reload, ZIP import/export, a real generated PDF download, font loading, and no unexpected external or mutating requests.
- Candidate search acceptance: **96 fixtures × 3 browser profiles = 288/288 passed** on both releases `7dfc976a697cd53a4f44` and `a21b07daf415b8f493a4`, using desktop Chromium, Android Chrome emulation, and iPhone WebKit emulation.
- New holiday-link, contact-form lazy-load, and mobile outside-tap regressions: **12/12 passed** across desktop Chromium, desktop WebKit, Android Chrome emulation, and iPhone Safari/WebKit emulation on the current generated candidate.
- Printable-template selector and affected route: **10/10 passed** in executed local browser checks across Chromium, WebKit, Android Chromium, and iPhone WebKit; two local Firefox checks were interrupted during browser startup and are not counted. The final five-project source CI rerun is pending.
- Lithuanian name-day “Rytoj” regression: **4/4 passed** across the four editor/browser profiles. It compares the displayed “today” and “tomorrow” cards with consecutive dates in `Europe/Vilnius` rather than only recording rendered text.

## Release gates still pending

The final five-project CI route/component suite is pending for current release `a21b07daf415b8f493a4`. Production deployment, live-page crawl, live mobile search, production cache-header verification, production daily publication verification, and a post-deployment performance sample remain outside this source record. The Cloudflare cache purge is pending. These items are not counted as passed here. Browser profiles are emulations; no physical iPhone or Android handset, paper printer, or outgoing email delivery was tested.

## Known environment limitations

The default system Ruby 2.6.10 and system Node path are too old or incomplete for this repository. The executed release build used the repository's documented project Ruby 3.4.11/Bundler 2.6.9 toolchain and the pinned Node runtime. A direct build with the default system Ruby failed before generating the site; that failed attempt did not change the verified release tree.
