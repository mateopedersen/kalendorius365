# Kalendorius365

Lithuanian calendar and local-first planner. Existing Cloudflare Pages native Git integration is preserved: production branch `main`, output directory `public`, no Cloudflare build command. Generated `public/` is versioned so Cloudflare does not need Python/Poppler or expensive print rendering during ordinary deployments. Source changes must be rebuilt before committing; tests check the generated output.

## Reproducible development

- Ruby **3.4.11**; Jekyll **4.4.1**, Bundler lockfile included.
- Node **22+**, native ES modules, no frontend framework or npm dependencies.
- Print tooling: Python 3.12, `requirements-print.txt`, Poppler `pdftoppm` on PATH.

```sh
bundle install
ruby scripts/prepare.rb
python3 -m venv .venv
.venv/bin/pip install -r requirements-print.txt
.venv/bin/python scripts/render_prints.py
bundle exec ruby scripts/build.rb
node --test test/*.test.js
.venv/bin/python scripts/validate_assets.py
.venv/bin/python scripts/audit_site.py
```

Print generation is independent of the static build. `.build-cache/` fingerprints skip unchanged compositions. The WebP is rasterized from the exact corresponding PDF at A4/300 PPI; thumbnails are separate. All 276 PDF/WebP pairs and thumbnails are listed with sizes and SHA-256 in `site/assets/data/manifest.json`.

`site/` contains Jekyll sources and precomputed print assets; `data/calendar.json` is the single holiday/localization source. `lib/calendar.rb` generates date data consumed by static pages and print scripts. Browser modules independently calculate dates from those definitions and are checked against Ruby and Python.

## Deployment and indexing

Development branch: `feat/calendar-platform`. Every push gets the existing Cloudflare preview deployment. Native Pages Functions bundles `functions/api/weather.js` for a same-origin cached LHMT weather proxy (no database, bindings, credentials or paid services). A plain local file server cannot execute this function; weather displays its tested unavailable state locally.

Preview output retains HTML and response-header `noindex`. Only after release QA, build using `K365_RELEASE=1 bundle exec ruby scripts/build.rb`, re-run audits, commit generated output, and merge to `main`. Preview deployments must continue to return `X-Robots-Tag: noindex` (Cloudflare default preview behavior; verify on the real preview URL). Production intended public pages get a sitemap; drafts do not.

Do not add personal test data, credentials, API tokens or local browser state to Git. See `docs/product-checkpoint.md` for exact progress and `docs/infrastructure.md` for domain ownership and rollback.

## Data boundaries

Events, notes, tasks and preferences use a versioned localStorage schema with JSON backup/restore. ICS supports dates, Vilnius/UTC times and simple recurrence; unsupported rules are reported. No accounts, synchronization, analytics or geolocation. Print customization stays in the browser. Statutory holidays are distinct from school and commemorative dates. Work hours include immediate preholiday one-hour reductions under documented schedule assumptions.

Inter is self-hosted under SIL OFL; source and license are in `site/assets/fonts/`. Calendar compositions are original vector artwork. LHMT data is attributed under CC BY-SA 4.0. See the public privacy page for operational details and import limitations.
