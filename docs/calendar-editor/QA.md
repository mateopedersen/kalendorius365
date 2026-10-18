# Site-wide release QA — 2026-10-18

This record covers the current release candidate. It separates checks that ran locally from CI and production checks that have not yet run against the final commit.

## Reproduced defect and repair

The permanent editor regression reproduced a WebKit/Safari failure when saving a photo as a native `Blob` in IndexedDB: WebKit returned `UnknownError: Error preparing Blob/File data to be stored in object store`, so the project could not be restored after reload. New photo records now store bytes as `ArrayBuffer`; restore accepts both this format and existing `{ blob }` records. The repair leaves localStorage, IndexedDB records, calendar notes, and preferences intact.

## Executed source checks

- Release build with Ruby 3.4.11, Bundler 2.6.9, and the pinned Node runtime: **191 canonical pages, 4,560 generated static files, release revision `874ac7e1927f95c417e7`**. Three retained immutable releases are published. A clean repeat build reproduced the same revision and byte-for-byte identical 4,563-file public tree.
- `scripts/audit_site.py --release`: **192 HTML files including the 404 page; 191 canonical landing pages; 25,718 local targets; zero broken local links**. Canonical and sitemap parity, indexability, metadata, JSON-LD, the editor bundle, fonts, and 360 monthly image entries passed.
- `node --test test/*.test.js`: **353 passed, 0 failed**.
- Ruby static asset URL tests: **5 tests, 58 assertions, 0 failures**. CSS minifier tests: **2 tests, 14 assertions, 0 failures**.
- The generated Cloudflare `_headers` file has **97 rules**; every rule contains at most one wildcard, within the 100-rule limit. Immutable release assets use versioned paths; HTML and mutable data are revalidated.

## Executed browser checks

- Permanent editor regression: **12/12 passed** on desktop Chromium, desktop WebKit, Android Chrome emulation, and iPhone Safari/WebKit emulation. It exercised mobile editor controls, leap-day preview, event/note persistence, preservation of an existing note and 12-hour preference, unrelated localStorage data, photo-byte persistence across reload, ZIP import/export, a real generated PDF download, font loading, and no unexpected external or mutating requests.
- Search acceptance: **96 fixtures × 3 browser profiles = 288/288 passed** on the generated release using desktop Chromium, Android Chrome emulation, and iPhone WebKit emulation.
- Lithuanian name-day “Rytoj” regression: **4/4 passed** across the four editor/browser profiles. It compares the displayed “today” and “tomorrow” cards with consecutive dates in `Europe/Vilnius` rather than only recording rendered text.

## Release gates still pending

The full five-project CI route/component suite, production deployment, live-page crawl, live mobile search, production cache-header verification, production daily publication verification, and a post-deployment performance sample must run against the final commit and deployed release. The Cloudflare cache purge is also pending. These items are not counted as passed here. Browser profiles are emulations; no physical iPhone or Android handset, paper printer, or outgoing email delivery was tested.

## Known environment limitations

The default system Ruby 2.6.10 and system Node path are too old or incomplete for this repository. The executed release build used the repository's documented project Ruby 3.4.11/Bundler 2.6.9 toolchain and the pinned Node runtime. A direct build with the default system Ruby failed before generating the site; that failed attempt did not change the verified release tree.
