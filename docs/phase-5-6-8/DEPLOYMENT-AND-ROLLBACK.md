# Deployment and rollback procedure

## Release record

- Repository: `mateopedersen/kalendorius365`.
- Production branch: `main`; Cloudflare Pages project: `kalendorius365`; automatic GitHub deployments remain enabled.
- Release commit: [`d78d343`](https://github.com/mateopedersen/kalendorius365/commit/d78d343f88bda887c8101ef5129fe8e373765015).
- Push and live verification: `2026-10-15T22:10:52Z`.
- Cloudflare production deployment: `5ae04511-1992-4372-884c-ad1fa0948d9b`.
- Deployment URL: [5ae04511.kalendorius365.pages.dev](https://5ae04511.kalendorius365.pages.dev/).
- Cloudflare Deployments showed the matching `main` commit under Production with a green success check.

## Live release checks

- All 71 sitemap canonical pages returned HTTP 200. Every page had Lithuanian `lang`, `index, follow`, one matching self-canonical, one title and H1, and no `X-Robots-Tag: noindex` response header. This includes all 29 new routes.
- The sitemap returned 200 and contained exactly 71 page URL entries matching the manifest, plus 360 image locations. `robots.txt` returned 200, allowed `/`, and linked the sitemap.
- All 832 downloadable files were streamed from production: 416 PDFs and 416 WebPs. Every response returned 200, correct media type, exact byte length, and SHA-256 identical to the local release file (91,500,372 bytes total).
- CSP was present on the sampled pages, CSS, JavaScript and 404 response. Unknown paths returned 404 with `Cache-Control: no-store`. HTTP and `www` sample routes redirected 301 to the HTTPS root-domain URL and ended at 200.
- Exact per-route and per-download evidence is in `LIVE-VERIFICATION.json`, `PUBLIC-PAGE-MANIFEST.json`, and `ASSET-MANIFEST.json`.

## Release gate result and limitations

The production release gates passed. This establishes technical crawlability and the published sitemap, not acceptance or indexing by a search engine. No Search Console submission or ranking campaign was run. No external Lithuanian native-speaker sign-off, physical printer proof or formal axe-core/WCAG certification is claimed. The leave planner had no horizontal overflow at the live browser’s measured 480 CSS-pixel minimum width; the updated results panel was not re-established at 390 CSS pixels, and no 200%-zoom screenshot is claimed.

## Rollback

The previously deployed production commit was `684f49bc97249f29bf7e6c1cb15d7a08d2d678b4`. If a critical live regression appears, use Cloudflare Pages' previous successful production deployment or revert the release commit on `main`, then repeat the route, header and download smoke checks. Do not change DNS or cache settings as a recovery shortcut.
