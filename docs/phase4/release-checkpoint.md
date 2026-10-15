# Phase 4 release checkpoint

Updated: 2026-10-15

## Implemented

- Added `/atostogu-planavimas/` with a Lithuanian vacation optimizer for 2027–2028, customizable five-, six-, or selected-weekday schedules, leave budget, preferred season, maximum/minimum break length, booked days, custom rest days, and blocked working days.
- Added one-period duration/efficiency comparisons, a deterministic multiple-period optimizer, annotated daily breakdowns for each proposed interval, manual interval evaluation across 2026–2029, ICS export, and an opt-in add-to-personal-calendar action.
- Inputs are stored only in the visitor's browser. The planner fetches only the site's static calendar data and does not send entered dates to the server.
- Added contextual internal links, search-index metadata, visible Lithuanian FAQs, primary legal sources, scope limits, and mobile-first layout styling.
- Withheld name-day pages because redistribution rights and a reliable mapping dataset were not verified. No third-party name-day data is included.

## Validation completed locally

- 25 JavaScript tests pass, including Gregorian/holiday edge cases and comparison with an exhaustive search on a reduced optimizer horizon.
- Ruby page generation and Jekyll release build pass with the repository's Ruby 3.4.11 / Bundler 2.6.9 toolchain.
- Static site audit passes: 42 canonical landing pages, unique metadata and canonical tags, Lithuanian document language, one H1 per page, all checked local targets resolve, and 240 monthly calendar/image mappings remain intact.
- Release SEO audit passes: all 42 canonical landing pages are indexable and in the sitemap; the 404 is noindex; the release headers contain no global noindex; all 240 monthly WebP images are listed.
- Local browser QA passes at 360 px and 1440 px widths. The 2027 and 2028 calculations, budget changes, cross-year manual evaluation, and annotated daily rows were inspected. The detail table is contained in its own labelled horizontal-scroll region on narrow screens.
- Print asset paths were not modified by this phase.

## Still required

- Cloudflare branch preview verification, then production verification after the authorized repository release flow.
- An axe/manual assistive-technology review remains outstanding; the static HTML audit and browser accessibility tree are not substitutes for that review.
- Name-day data licensing/provenance remains an external prerequisite for that feature.
