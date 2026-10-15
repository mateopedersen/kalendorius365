# Product development checkpoint

## Baseline / rollback — 2026-10-15
- Repository: mateopedersen/kalendorius365 (private). Development: feat/calendar-platform.
- Production baseline: 5df0a85750c0a6a1ae3a18bea5da2277695b7f92.
- Cloudflare Pages native Git integration, main production, output public, build command empty, build system v3. No GitHub Actions workflow exists.
- Automatic deployments enabled; preview deployments public. Never put secrets or personal test data in commits.
- Root HTTPS responds 200 with temporary noindex. Nameservers devin.ns.cloudflare.com / rosa.ns.cloudflare.com. DNS and registrar retained.
- Rollback: Pages Deployments → last successful baseline → Rollback; alternatively revert release commit(s) on main and push. Verify HTTPS, root/www redirects and response headers. Restoring this baseline needs no build command and output public.

## Scope and evidence
The master specification supplied on 2026-10-15 is the acceptance contract. The attachment contains text only; the referenced dashboard screenshot was not available. Three-column design follows the written specification; exact screenshot comparison remains pending receipt of that reference.

## Architecture
Ruby 3.4.11 / Jekyll 4.4.1. site/ is source, public/ is generated output. data/ holds canonical calendar definitions; lib/ implements Gregorian and statutory holiday calculations; scripts/ generates data, pages and print assets. Browser ES modules implement private local planning. Print assets are generated separately and cached by content fingerprints; ordinary Jekyll builds do not regenerate high-resolution files.

## Release gate
Production remains the baseline until date, UI, print, asset and deployment checks are complete. Preview resources retain noindex. No paid infrastructure or domain changes.

## Status
A: in progress. B–I: pending. No new product feature or downloadable composition has yet been accepted.

## Implementation checkpoint — 2026-10-15, before preview QA
- All three supplied reference images have now been received and inspected. Earlier missing-reference note is superseded. Homepage follows the original three-column hierarchy; monthly pages follow the supplied navigation/large-preview/download-panel/gallery composition.
- Ruby 3.4.11 + Jekyll 4.4.1 installed and built locally, dependencies locked.
- 41 generated canonical HTML pages + 404. 24 monthly pages each link ten real compositions. 240 monthly + 20 annual + 16 undated PDF/WebP pairs; separate thumbnails. 10 monthly design families (five restrained, five expressive).
- Date engine: 731 target dates cross-checked against Ruby and Python; 8 Node test groups pass (date grids, holidays, workdays, DST, recurrence, storage, ICS).
- Asset audit passed for all 276 PDFs (one A4 page, orientation, font embedding, Lithuanian glyphs, full holiday names), 276 high-resolution WebP files and 276 thumbnails, file sizes and SHA-256.
- Static audit: 42 HTML files including 404; 3,403 local link/asset targets; 0 broken targets; unique title/description, one H1, canonical/language/image dimensions/alt and parseable JSON-LD.
- Browser checks: event creation, notes/tasks persisted after reload; weather unavailable state; desktop geometry 1536/1440/1280 and mobile/tablet 768/390/360 without document overflow. Saved screenshots in the task deliverables directory. Further CRUD, tools, download, dark and inner-page review in progress.
- Production still baseline. Preview noindex retained. Production release gate remains CLOSED pending browser/tool checks, legal current-edition review, accessibility/performance evidence and successful preview weather/deployment check.
- Official school page currently gives Dec 21–Jan 3 and Mar 22–29 (primary/basic); an older legal-plan PDF differs. Public school page follows the current ministry information page and explicitly attributes it; reconcile again before release.
- e-Seimas and e-TAR full consolidated text retrieval encountered WAF/403. Official indexed 123 text confirms names and 16 dates; current consolidated metadata is 2026-06-07–2026-10-31. Do not describe a full current-law document retrieval as successful. Sources/known limitations must remain explicit in the final report.

Next: finish browser CRUD/import/export/generator tests and inner-page visual review; preview via existing Git integration; run complete audits again; release only after gates pass.

## Revised mandatory print brief — accepted locally before release
The 10-page ZIP and the entire final 600-PPI specification were read and all ten reference images inspected. The earlier 300-PPI/minimal-vs-bold implementation is superseded. `checkpoint/pre-600ppi` preserves that unreleased state.

- Two sample gate: color January 2027 design 06 and genuine monochrome February 2028 design 02. Physical A4 page and explicit TrimBox, real text/path operators, separate embedded regular/bold font identities, 31/29 actual date glyph positions, footer brand, 4961×7016 proof PNGs and matching full-resolution WebP inspected. Sample report: `docs/sample-preflight.json`.
- Full collection: 240 monthly PDF + 240 monthly 600-PPI WebP; each month has exactly 5 DeviceGray B/W and 5 RGB-color families, both groups have regular/bold hierarchies. Plus 20 annual and 16 undated PDF/WebP pairs. 276 primary and 276 small responsive previews. All 276 PDFs and WebP files passed preflight, font/glyph, page/trim, hash, holiday text, actual date-placement and monochrome pixel checks. No raster is placed in the PDFs, so embedded-image PPI is N/A; actual proof/WebP resolution is >=600 PPI.
- 41 canonical landing pages + 404, 3,450 internal link/asset targets audited, 0 broken targets. All ten required inner-page types implemented; design comparison is manual and functional, not a claimed pixel-identical copy of illustrative mockups.
- 11-page axe-core scan: 0 automated violations after fixing other-month date contrast. Tool leaves 1–2 incomplete checks for human review; no accessibility certification is claimed. Required six viewport sizes and critical mobile pages have no document overflow. Desktop three columns, tablet two columns, mobile calendar/clock/expandable day details.
- Browser CRUD, notes/tasks persistence, ICS import, JSON restore, filters, date/ISO tools, calendar views, keyboard navigation, PDF/WebP downloads and real generator 600-PPI output tested. Native downloaded PDF/WebP hashes matched source files. Synthetic QA data was deleted from local test storage.
- Initial mobile CLS fixed from ~0.5867 to ~0.00034. Representative local unthrottled LCP 80 ms home / 140 ms monthly; observed event duration 48 ms is not a field INP claim. See `docs/browser-qa.json` and `docs/sources-and-assumptions.md`.
- Existing Git integration preview 289d551 deployed successfully in 25 s, including the compiled weather Function, but all pages.dev hosts time out from this network. Main custom-domain HTTPS remains reachable. Actual function/upstream integration locally returned 200 with observation and forecast; no invented data. Final production smoke checks remain mandatory.

Phase status before production: A architecture complete; B app complete; C date/holiday/work engine complete with source-access caveat documented; D print engine complete; E monthly collection complete; F annual/blank complete; G specialized pages/tools complete; H local SEO/accessibility/mobile/print QA complete within the stated measurement scope; I production release pending.

## Production release verified — 2026-10-15
Release commit `0109a2ec3daf8c43fb0237ccd2268861576a35b3` reached the existing main deployment `0ca90b73-24dd-47a3-8cc5-034403dd1cfb`, success in 37 seconds. Cloudflare compiled the weather Worker and accepted five header rules. All 41 canonical live pages returned 200 with index/follow, correct canonical and security headers; all 552 live PDF/WebP downloads matched the verified source SHA-256 and byte counts. Initial propagation produced one page assertion mismatch; the complete second 41-page scan passed. Real weather returned 200 with both observation and forecast; invalid city 400. Unknown page 404/noindex, sitemap 41 canonical +240 images, robots allows crawling, HTTP and www redirect 301 retaining path/query. Live desktop and 390px mobile screenshots saved; no document overflow. All ten inner-page live desktop types captured. Google Rich Results public tool returned its own “Something went wrong” error; no external-validator pass claimed.

Phase I production release complete within documented QA scope. Remaining evidence limits: pages.dev unreachable from this network, full current consolidated legal file WAF/403, school 2027–2028 dates not verified and clearly pending, automated accessibility incomplete items and production field performance not certification. These are documented explicitly; no future-law or rich-result guarantee. Existing infrastructure and rollback baseline preserved.
