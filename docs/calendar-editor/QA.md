# Calendar editor QA record — 2026-10-18

## Confirmed Safari/WebKit defect

Before the fix, a real WebKit browser test imported a photo and failed to save its project in IndexedDB. WebKit rejected the native `Blob` structured-clone record with `UnknownError: Error preparing Blob/File data to be stored in object store`; the unsaved project could not be restored after reload. The underlying code now stores the photo bytes as `ArrayBuffer`, restores both the new byte representation and existing `{ blob }` records, and keeps all records in place. It does not clear localStorage or IndexedDB.

The report below distinguishes executed checks from checks that still require the full CI and production rounds. Earlier unverified claims about twelve-photo visual comparisons, printer behavior, image modes and device testing have been removed from this record.

## Executed source checks

- Full package unit suite after merging the performance release: **352 passed, 0 failed** (`node --test test/*.test.js`); output: `outputs/final-performance-node-tests.log`.
- Release audit after the latest About-page publication: **192 HTML files including 404, 191 canonical pages, 25,718 local targets, 0 broken links**. It also checked indexability, canonical/sitemap parity, metadata/schema, the generated editor route, and its four published fonts. Output: `outputs/final-release-audit.log`.
- CSS minifier: **2 tests, 14 assertions, 0 failures**.
- Static asset URL checks: **4 tests, 47 assertions, 0 failures**.
- Inline and route-specific CSS checks: **14 tests, 0 failures**.
- Current full build: **191 canonical pages and 4,508 static files** at release revision `594925b46a5a7c775bc8`; 76 stylesheets were reduced by 123,201 bytes (4.1%) and 180 JavaScript modules by 110,611 bytes (3.0%). The generated headers contain 96 path rules.

## Executed browser checks — editor regression round 1

Playwright 1.56.1 ran the permanent editor spec against three generated source releases in four browser profiles: desktop Chromium, desktop WebKit, Android Chrome emulation, and iPhone Safari/WebKit emulation. **12/12 passed on each release** (three editor scenarios in each profile). Evidence is in `outputs/final-editor-browser-round1.json`, `outputs/final-editor-browser-round2.json`, and `outputs/final-editor-browser-round3.json`.

The scenarios exercised the mobile preview/settings tabs and overflow, leap-day preview, event and note save/restore, preservation of the existing home-calendar note and 12-hour preference, preservation of an unrelated localStorage value, exact photo-byte persistence in IndexedDB across reload, portable ZIP import/export, real PDF download, font loading, and absence of external or mutating requests.

The reproduced WebKit Blob failure passed after the ArrayBuffer change. The browser upload used one synthetic PNG created by the browser test; the PDF was generated and checked for its signature and nontrivial size. This run did not inspect a twelve-photo PDF visually or send a document to a physical printer.

## Scope and remaining verification

These are browser emulations, not tests on physical iOS or Android devices. The full 292-case browser suite across five profiles (1,460 planned profile executions), the independent live-site round, production cache/ETag checks, and Cloudflare purge evidence are not included in these editor checks. Local Firefox is available but hangs on launch in this macOS environment; Firefox coverage must come from the configured CI runner before release acceptance.

School dates are limited to the official 2026–2027 schedule in the dataset. Later dates require an official source update. Statutory rules for historical/future years are projections of current rules, not retrospective legal certification.
