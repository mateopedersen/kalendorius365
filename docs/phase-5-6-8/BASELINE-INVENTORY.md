# Phase 5, 6 and 8 baseline inventory

Captured 2026-10-15 before feature changes, from local commit `235190c9b1e56743c2a7869566e4bd76efddb830` (`fix/planner-result-spacing`). A rollback branch, `checkpoint/phase-5-6-8-before`, points to that exact commit. Implementation is on `feature/phase-5-6-8`.

## Repository and delivery

- Repository remote: `https://github.com/mateopedersen/kalendorius365.git` (private repo; configured `origin` remote verified locally).
- Site source: Ruby/Jekyll static site. Ruby 3.4.11, Jekyll 4.4.1, Bundler 2.6.9 per checked-in Gemfile and lockfile. `scripts/build.rb` orchestrates preparation, page generation and Jekyll output to versioned `public/`.
- Existing hosting notes describe native Cloudflare Pages GitHub integration, production branch `main`, output directory `public`, and no remote build command. These settings are preserved; actual deployment controls will be rechecked before release.
- JavaScript uses native ES modules; the project declares Node >=22 and no npm dependencies. Print generation uses Python/ReportLab, Pillow and Poppler, separated from routine Jekyll builds.
- Existing inputs include `data/calendar.json`, `site/assets/data/years.json`, `site/assets/data/manifest.json`, page generators in `scripts/pages.rb`, Ruby date logic in `lib/calendar.rb`, print code in `scripts/render_prints.py`, and Node tests under `test/`.

## Measured public baseline

- `public/` contains 43 HTML files: 42 public landing pages and one `404.html` error page. The 42 canonical routes match the 42 sitemap entries; `404.html` is `noindex` and omitted from the sitemap.
- `public/downloads/` contains exactly 552 assets: 276 PDF and 276 WebP files. The 276 manifest entries each represent a paired PDF/WebP composition. Every pre-change download path, byte size and SHA-256 is preserved in `ASSET-CHECKSUMS-BEFORE.json`.
- `public/sitemap.xml` and `public/robots.txt` exist. All measured landing pages use an absolute canonical and `index, follow`; the error page alone uses `noindex, follow`. The site generator creates release-mode indexable HTML and preview-mode noindex responses.
- `data/calendar.json` stores Gregorian calendar, ISO-week and Lithuanian statutory-date rules and points at legal sources. It also contains school date information; future unverified academic dates must remain marked as pending.
- Existing product includes the calendar UI, holiday/day-count utilities, printable calendar builder, school-holiday information and the Phase 4 annual-leave planner. The live homepage loaded in the user's existing browser and its accessibility tree showed the calendar, weather, local events, tasks, search and current holiday widgets. This is browser-visible evidence, not an HTTP status/header check.
- Local shell DNS resolution and the GitHub repository connector returned network errors/404 during this capture. Live HTTP headers and current remote branch metadata were therefore not independently fetched from the command line in this preflight. Prior verification records are retained as historic evidence, not treated as a fresh check.
- Local default Ruby is 2.6.10 and cannot activate locked Bundler 2.6.9. A project-adjacent isolated Ruby 3.4.11 and Bundler executables are available and were used as the build recovery path. A bundled Node runtime is available at `/Users/melihozcan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`.

## Design and typography snapshot

The checked-in `design/tokens.json` has been copied verbatim to `DESIGN-TOKENS-SNAPSHOT.json`. It specifies Lato UI typography (400/700/900), 15 px base text, 1.5 body line height, 1.65 paragraph line height, Baltic yellow/green/red accents, and 4–40 px spacing tokens. Lato and Inter OFL license files are present. This snapshot records the declared tokens; independent glyph coverage and layout behavior are release checks.

## Baseline limitations

- Browser-visible live content was inspected. A current direct HTTP response, headers, deployed commit and complete live inventory were not captured in this environment at this stage.
- No Phase 5, 6 or 8 feature is counted as present based on the specification or old screenshots. Each route, interaction, data source and downloadable asset must be verified independently after implementation.
- No changes to the existing 552 downloadable files are authorized by this feature baseline.
