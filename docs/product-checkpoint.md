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
