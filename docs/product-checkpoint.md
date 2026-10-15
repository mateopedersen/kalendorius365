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
