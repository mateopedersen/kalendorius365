# Kalendorius365.lt — site-wide release QA, 2026-10-18

This is the integrated source candidate after merging the latest calendar and workday-planning changes from `main`. Production deployment, live-site checks, and Cloudflare purge are still pending; no live-site result is claimed here.

## Candidate and executed checks

- Release build: **191 canonical pages**, 192 HTML files including the 404 page, 390 calendar-image sitemap URLs, 4,564 static files, and release `a05956737bce4a4944d6`. Three complete release trees are retained. The cache-header file contains 97 rules, within Cloudflare Pages' 100-rule limit.
- A second clean release build produced the identical 4,564-file tree: **zero added, removed, or changed files**. Evidence is in `outputs/a059-reproducibility.json`.
- `python3 scripts/audit_site.py --release`: passed. It checked 25,716 local targets with zero broken links, canonical/sitemap parity, indexability, structured data, localized page metadata, calendar image URLs, editor module imports, and published fonts.
- `node --test test/*.test.js`: **357 passed, 0 failed**. Python regressions: **17 passed**. Ruby static-asset URL tests: **5 tests / 58 assertions passed**. CSS minifier tests: **2 tests / 14 assertions passed**.
- Search acceptance against the local release: **96 queries × desktop Chromium, Android Chrome emulation, and iPhone WebKit emulation = 288/288 passed**.
- New date-calculator browser regression: **4/5 local profiles passed** (Chromium, WebKit, Android Chromium, iPhone WebKit). Firefox's local process consumed a CPU core without completing startup and was interrupted; it is not counted as passed. The integrated PR browser workflow must execute all five profiles.
- Prior full browser workflow `39124201962` passed **1,465/1,465** on earlier commit `49145a9a446226ef6bef4ca4fb37b746a0f7b36d`. It predates this latest merge, so it is supporting history only. Current inventory is **294 cases × 5 profiles = 1,470 executions**.

## Source repairs carried into this candidate

- Global search retries after index fetch failure and ranks Lithuanian forms, aliases, page content, holidays, name days, astronomy, calendar downloads, and tools. Permanent browser coverage checks the query and accessible result actions on mobile and desktop layouts.
- Date calculations now cover calendar-month durations, leap-day and month-end boundaries, Lithuanian holidays in workday offsets, shareable query parameters, and result copying.
- Cache publication gives mutable routes and data revalidation behavior and content-addressed release paths for static assets. Rebuilds stash prior releases, clear only generated release trees before Jekyll/minification, and restore only complete module graphs. This prevents stale/conflicted generated bundles from breaking repeat daily builds.
- Incomplete historical bundles are not retained as supported releases. Visitor localStorage, IndexedDB, Cache Storage, notes, calendar records, and preferences are not broadly cleared.

## Remaining release gates

- Complete the current PR's five-profile browser and scheduled-publishing checks against the exact integrated head.
- Deploy that verified head, then confirm the live manifest/revision, public routes, cache headers, old-ETag revalidation, downloads, data preservation, and 288-query search acceptance.
- Purge only the authorized `kalendorius365.lt` and `www.kalendorius365.lt` hostnames after the production revision is verified; do not use “Purge Everything”. Verify the purge result and revalidate assets afterward.
- Run the second independent live/browser QA round and post-release performance samples. Device profiles are emulations; no physical handset or printer is claimed as tested.

No broad browser storage clearing was performed. The only non-passing local check listed above is Firefox startup; its current integrated workflow result remains outstanding.
