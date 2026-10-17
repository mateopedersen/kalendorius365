# Twelve Lithuanian monthly holiday guides for 2027

## Scope and baseline

Feature branch: `feature/2027-monthly-holiday-visuals`.
Baseline main/production commit: `8891cae18c413ea122da0074601b28e1bd712ca4` (lunar PR #29).
Existing site: 139 canonical pages, including 12 existing `/2027/<month>/` printable calendars and the annual holiday hub. No canonical `/sventes/2027/<month>/` guides existed. This change adds exactly those twelve guides and month selectors to two existing holiday hubs: 151 canonical pages total.

## Data, sources and visuals

- `data/monthly-holidays-2027.json`: 126 records: 16 statutory dates, 101 current legal commemorative entries and 9 additional sourced cultural/international dates. Multiple observances grouped in one law point stay together; they are not counted as extra days off.
- `verified-dates-and-classifications.csv`: every date, weekday, category, recurrence and source.
- `sources-ledger.csv`: 196 claim/source relations, official versions and review dates.
- `original-media-ledger.csv`: 12 original SVG compositions (112,029 bytes total), 10 original UI symbols in one sprite, 12 social PNGs, 12 640px WebPs and 12 240px WebPs. No stock art, photographs, copied paths or external image/font requests were added. Existing Lato/OFL is preserved.
- Cultural imagery is explicitly stylized. Symbolic crowns/documents do not claim to reconstruct historical artifacts.

## Build and reproducibility

Normal release: `K365_RELEASE=1 bundle exec ruby scripts/build.rb`. The existing Ruby calendar engine and Jekyll remain in use. The new Python page renderer requires only Python's standard library. Original images are prebuilt assets; release does not require image libraries, remote APIs or network access.

Authoring-only source registry: `PYTHONDONTWRITEBYTECODE=1 python3 scripts/monthly_holidays/registry.py`. It reads saved official source evidence and existing engine output. Do not run it as a substitute for reviewing new legal editions.

Artwork: `scripts/monthly_holidays/artwork.py` writes original SVG geometry. For raster derivatives, use the local `docs/2027-monthly-holidays/capture.html?month=N` at 1200×800. Capture each browser-rendered SVG with CUA, retaining the 1200×800 art region, to `/private/tmp/k365-holiday-renders/N.png`. Run `raster_assets.py` with Pillow to produce OG PNGs and both WebP sizes; it also updates the media metadata. Browser rendering is required: a tested PDF SVG renderer did not correctly render gradients and was rejected. No bad render was retained as a public asset.

`documentation.py` refreshes the source/date/media ledgers. It does not assert browser or production verification. Browser results are written separately after actual execution.

## QA

- Gate 1: `check_release.py`, invoked by the release build. Static HTML, independent calendar calculations, 101 legal-title comparisons, SVG safety, JSON-LD, metadata, canonical/sitemap, local links, ICS folding/dates and saved asset hashes.
- Gate 2: independent local rendered fixture `browser_harness.py` plus CUA browser interaction against production. The fixture creates temporary `public/__monthly_qa/`, removed by the next normal build. **Never publish that directory, its axe script, or the temporary performance HTML.**
- Local browser runs: all 12 guides × 1440/390/360 CSS px at normal and 200% root text. Real previous/next links, all 12 actual ICS downloads, an independent `icalendar` parse, detail-page navigation, disclosures, keyboard date navigation, empty search, diacritic search and print-handler invocation.
- Raw throttled observations are in `qa/performance-mobile.json`. A whole-body initial-paint shift also occurs on the unchanged baseline in the instrumented browser environment; raw CLS is retained, not relabelled as a certified field metric. No full PDF/WebP download was loaded during normal guide viewing.
- `google-documentation-checklist.md` lists all 14 official documents and applied decisions. Search Console, Google's remote testing tools, field CWV and actual Google indexing/ranking are not verified.
- `qa/language-and-visual-review.md` records two AI review passes and manual follow-up of incomplete automated findings. No native-human/editor/legal certification is claimed.

## Preservation and rollback

Gate 1 checks 3,152 prior asset/data/workflow/function files against recorded exact hashes. One existing CSV has separate exact hashes for its original macOS CRLF working copy and the canonical Git LF checkout; all 978 PDF/WebP binaries require exact byte equality. The global search JSON intentionally grows to include the twelve new guides. Original calendar rules, lunar data, daily horoscope automation, weather, solar tools and downloads are not changed. Public HTML and JS import query hashes change through the existing fingerprint process. Two holiday hubs gain selectors; other source pages stay unchanged.

`qa/download-preservation.json` contains exact original asset hashes: 978 PDF/WebP downloads and two download manifests. The prior lunar gates also continue to run. Revert the feature merge normally and redeploy baseline if rollback is needed; do not force-push or rewrite unrelated history.

Production status, merge/deployment identity, route matrix and live checks are recorded separately after actual deployment. No claim of publication is made by this README alone.
