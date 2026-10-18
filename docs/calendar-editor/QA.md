# Site-wide release QA — 2026-10-18

This record covers the integrated source candidate after including the latest `main` calendar-package and sitemap changes. Production deployment and live verification remain pending; nothing below represents a live-site pass.

## Reproduced defects and repairs

- WebKit failed when saving a photo as a native `Blob` in IndexedDB. New photo records store bytes as `ArrayBuffer`, and restore remains backward-compatible with existing `{ blob }` records. No localStorage, IndexedDB, calendar notes, or preferences were cleared.
- The homepage holiday action called its editorial article array as a function, preventing the selected holiday from opening in the personal-calendar dialog. It now looks up the article directly; a browser regression checks the populated event dialog.
- Search recovery failed when the first search-index request failed, and the global index did not reliably rank names, holidays, astronomy, calendar downloads, and tools. The search path now retries, normalizes Lithuanian forms and aliases, and includes page content and direct homepage functions. The 96-query acceptance suite covers desktop Chromium, Android Chrome emulation, and iPhone WebKit emulation.
- Desktop Safari allowed a long printable-template option to widen the download panel and page. The shared active stylesheet now ellipsizes the selected value; a permanent regression checks viewport width and selector operation.
- Release asset URLs now use content-addressed paths, previous complete release trees survive Jekyll cleanup, and mutable HTML/data revalidate. The build caps Cloudflare Pages `_headers` rules and avoids clearing any visitor storage.

## Executed checks on the integrated local build

- Release build completed with the pinned Ruby 3.4.11, Bundler 2.6.9, and Node toolchain. It generated **191 canonical pages, 360 monthly image mappings, 390 calendar image sitemap URLs, and 4,564 public files including hosting metadata**. Release revision: `d5c5f2f231565ef9df1f`; retained immutable revisions: `d5c5f2f231565ef9df1f`, `2912795bde3e828fce38`, and `a21b07daf415b8f493a4`.
- `scripts/audit_site.py --release`: **192 HTML files including 404, 191 canonical landing pages, 25,716 local targets, zero broken links**. SEO metadata, canonical/sitemap parity, indexability, structured data, editor modules, published fonts, and all sitemap image references passed.
- `node --test test/*.test.js`: **353 passed, 0 failed**. Python regressions: **17 passed**. Ruby static asset URL tests: **5 tests, 58 assertions, 0 failures**. CSS minifier tests: **2 tests, 14 assertions, 0 failures**. Release preservation gates passed, including pinned lunar downloads and the imported calendar package.
- Search acceptance: **96 fixtures × 3 browser profiles = 288/288 passed** against the integrated local build (`d5c5f2f231565ef9df1f`).
- Focused real-browser run on the integrated local build: **16/16 passed** across desktop Chromium, desktop WebKit, Android Chromium emulation, and iPhone WebKit emulation. It covered printable selector overflow, recovery after a failed search-index request, Lithuanian name-day search, mobile open/close/outside-tap/submit, and query preservation.
- The Cloudflare `_headers` file contains **97 rules** and meets the 100-rule limit. Versioned application assets are immutable; mutable routes and data use revalidation; sitemap and robots metadata refresh within one hour.

## Full browser suites and production gates

- Browser workflow `39124201962` targets pre-integration commit `49145a9a446226ef6bef4ca4fb37b746a0f7b36d`. At the time of this record, Chromium, Firefox, and Android Chromium had completed successfully; desktop WebKit and iPhone WebKit were still running. This is not counted as a full-suite pass.
- A full five-profile browser suite against the final integrated commit must complete before release. The workflow enumerates 293 cases per profile (1,465 executions total).
- Production deployment, live route and cache verification, old-ETag revalidation, live search acceptance, production daily-publishing verification, Cloudflare hostname-scoped purge, and post-release performance sampling remain pending. These are not counted as passed.
- Browser profiles are emulations. No physical iPhone/Android handset, paper printer, or outgoing email delivery was tested. No broad browser storage clearing was performed.
