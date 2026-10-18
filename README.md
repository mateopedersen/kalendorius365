# Kalendorius365

Lithuanian calendar and local-first planner. Existing Cloudflare Pages native Git integration is preserved: production branch `main`, output directory `public`, release build command `K365_RELEASE=1 bundle exec ruby scripts/build.rb`. Generated `public/` is versioned so Cloudflare does not need Python/Poppler or expensive print rendering during ordinary deployments. Source changes must be rebuilt before committing; tests check the generated output.

## Reproducible development

- Ruby **3.4.11**; Jekyll **4.4.1**, Bundler lockfile included.
- Node **24** in release CI (22+ supported), native ES modules, no frontend framework. Pinned esbuild is a build dependency; no compiler is downloaded by visitors.
- Print tooling: Python 3.12, `requirements-print.txt`, Poppler `pdftoppm` on PATH.

```sh
bundle install
npm ci
ruby scripts/prepare.rb
python3 -m venv .venv
.venv/bin/pip install -r requirements-print.txt
K365_PYTHON=.venv/bin/python bundle exec ruby scripts/prints.rb samples
# Visually inspect the two PDFs and actual 600-PPI proof PNGs, then:
K365_PYTHON=.venv/bin/python bundle exec ruby scripts/prints.rb accept-samples
K365_PYTHON=.venv/bin/python bundle exec ruby scripts/prints.rb all
bundle exec ruby scripts/build.rb
node --test test/*.test.js
.venv/bin/python scripts/validate_assets.py
.venv/bin/python scripts/audit_site.py
```

Print generation is independent of the static build. `.build-cache/` fingerprints skip unchanged compositions. The WebP is rasterized from the exact corresponding PDF at A4/600 PPI; thumbnails are separate. All 276 PDF/WebP pairs and 276 primary thumbnails are listed with sizes and SHA-256 in `site/assets/data/manifest.json`.

`site/` contains Jekyll sources and precomputed print assets; `data/calendar.json` is the single holiday/localization source. `lib/calendar.rb` generates date data consumed by static pages and print scripts. Browser modules independently calculate dates from those definitions and are checked against Ruby and Python.

The release build embeds conservatively pruned CSS for each complete page, including its interactive states and print rules. Local CSS/JS, images, fonts and downloadable assets use content-derived version URLs and one-year immutable browser caches. Public HTML revalidates; private API responses remain non-cacheable. Build-only print manifests and year maps are excluded from `public/`. The homepage loads a compact 1.3 KB holiday index instead of the full editorial dataset, and the print-template picker reads metadata already present in its page instead of downloading a separate catalog. The site's Pages Functions expose only read-only GET endpoints.

Initial module files and their static imports are preloaded in the head, then execute asynchronously after all document controls exist. Dynamic search, birth-city and astronomy imports remain driven by intent.

Generated JavaScript modules are minified independently with pinned esbuild, retaining exports, dynamic imports, function names and legal notices. Compiler and dependency-lock changes participate in cache version hashes. The already minified astronomy vendor is retained byte for byte. `docs/performance/js-sizes.json` records raw module sizes.

UI fonts use disjoint Unicode ranges: Latin and Lithuanian glyphs load first, and all original extended glyphs remain available on demand. The complete original fonts and printable assets are retained. Optional font preparation from the repository root is `python3 scripts/subset_ui_fonts.py` with `fonttools[woff]==4.67.0`; this is not a deployment dependency. `docs/performance/font-subsets.json` records sizes, character coverage and hashes. Search and astronomy modules load when needed; the name-day search caches Unicode normalization without changing search results or stored calendar data. `docs/performance/route-css-sizes.json` records every generated page's CSS size.

## Deployment and indexing

Development branch: `feature/holiday-editorial-module`. Every push gets the existing Cloudflare preview deployment. Native Pages Functions use Cloudflare request geolocation only to return a non-cacheable default city code from `functions/api/location.js`; `functions/api/weather.js` then uses a same-origin cached LHMT weather proxy (no database, bindings, credentials or paid services). A plain local file server cannot execute these functions; automatic selection falls back to Vilnius and weather displays its unavailable state locally.

Preview output retains HTML and response-header `noindex`. Only after release QA, build using `K365_RELEASE=1 bundle exec ruby scripts/build.rb`, re-run audits, commit generated output, and merge to `main`. Preview deployments must continue to return `X-Robots-Tag: noindex` (Cloudflare default preview behavior; verify on the real preview URL). Production intended public pages get a sitemap; drafts do not.

Do not add personal test data, credentials, API tokens or local browser state to Git. See `docs/product-checkpoint.md` for exact progress and `docs/infrastructure.md` for domain ownership and rollback.

## Data boundaries

Events, notes, tasks and preferences use a versioned localStorage schema with JSON backup/restore. ICS supports dates, Vilnius/UTC times and simple recurrence; unsupported rules are reported. No accounts, synchronization, analytics or browser GPS geolocation. Cloudflare's approximate request country/city metadata selects the homepage's default weather city; the app does not persist the IP address or coordinates, and visitors can choose among 15 Lithuanian cities. Print customization stays in the browser. Statutory holidays are distinct from school and commemorative dates. Work hours include immediate preholiday one-hour reductions under documented schedule assumptions.

Inter is self-hosted under SIL OFL; source and license are in `site/assets/fonts/`. Calendar compositions are original vector artwork. LHMT data is attributed under CC BY-SA 4.0. See the public privacy page for operational details and import limitations.

## Print preflight gate

Five monthly families are authored with DeviceGray vector paint only; full-resolution monochrome WebP is lossless and every pixel has equal RGB channels. Five families use restrained RGB vector artwork. Both groups contain distinct regular and bold embedded Inter faces. There are no raster images placed inside the PDFs, so effective embedded-raster PPI is not applicable. The actual proof raster and downloadable WebP are >=600 PPI in both axes at the measured A4 MediaBox; vector text has no fixed DPI. No PDF/X, PDF/A or press CMYK certification is claimed.

`docs/sample-preflight.json` records the color January 2027 and monochrome February 2028 gate. `docs/print-preflight.json` records every PDF's operators, fonts, date glyph positions, physical page/trim box, branding and WebP resolution. Release builds reject changed renderer/data/font fingerprints or missing/stale preflight results. Full print manifests and layout maps remain build-only and are not published as browser data. `scripts/responsive_previews.py` creates separate 340px responsive previews from the 680px thumbnails. CSS edits never regenerate high-resolution print files.

Print source and the licensed original font are versioned. `scripts/fonts.py` uses deterministic timestamps and distinct PostScript face identities when fonts are regenerated; changed font bytes require a fresh sample gate and complete preflight. Historical working-day tools apply the reviewed current holiday rules, not historical editions of Lithuanian law.
