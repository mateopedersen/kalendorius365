# Infrastructure and recovery notes

## Service ownership

- Domain registrar: Hostinger (registration remains there).
- Source: private GitHub repository [mateopedersen/kalendorius365](https://github.com/mateopedersen/kalendorius365), production branch `main`.
- Static hosting/CDN: Cloudflare Pages project `kalendorius365` on the Free plan.
- DNS: Cloudflare zone `kalendorius365.lt`; authoritative nameservers were changed at Hostinger to `devin.ns.cloudflare.com` and `rosa.ns.cloudflare.com` on 2026-10-15. Cloudflare still reported the zone as pending propagation when last checked.

## Verified state (2026-10-15)

- GitHub repository is private; branch `main` exists.
- The Cloudflare Workers and Pages GitHub App is installed for `mateopedersen` and restricted to this repository. Its listed permissions apply only to this selected repository.
- Cloudflare DNS zone is Free/manual DNS. Staged records are proxied CNAMEs: apex `kalendorius365.lt` → `kalendorius365.pages.dev`; `www` → `kalendorius365.lt`. Cloudflare showed both records and warned that the zone was pending until nameserver ownership could be verified.
- Hostinger previously showed `cosmos.dns-parking.com` and `nova.dns-parking.com`; these were replaced with Cloudflare's assigned nameservers. Hostinger confirmed the save and warned propagation could take up to 24 hours. Domain registration remains at Hostinger.
- Before the switch, Hostinger's DNS table showed only `www CNAME kalendorius365.lt` (TTL 300) and apex `A 2.57.91.91` (TTL 50). No MX, TXT, AAAA, or CAA records appeared in that table. The A record was not copied because its purpose was unverified and it appeared to be parking.
- Hostinger DNSSEC controls were blank (no Key Tag, Algorithm, Digest Type, or Digest). The registrar's DS state has not been independently verified. Recheck it if Cloudflare remains pending or DNS validation fails.
- Cloudflare warns that, without an MX record, mail to `@kalendorius365.lt` cannot be received. No mail records were present in the Hostinger DNS table. If domain email is needed, identify the mail provider and add its exact MX/SPF/DKIM/DMARC records in Cloudflare before relying on mail.
- Pages project URL: [https://kalendorius365.pages.dev/](https://kalendorius365.pages.dev/). The temporary page opened over HTTPS and displayed “Kalendorius365” and “Svetainė ruošiama.”
- First production deployment: commit `e8ade68fb53cbf7282c5ad04633cc5c4c8baf993`, success, 17 seconds.
- A harmless documentation commit `bcb25cceb2c86febbf5a29fe5f0ca3336c066dd7` triggered a second production deployment; Cloudflare reported success in 20 seconds. This verifies the native Git integration's automatic redeploy path.
- The project-specific preview URL for the first deployment returned a TLS version/cipher mismatch when checked. Use the project-level `kalendorius365.pages.dev` URL for the stable preview.
- Cloudflare's Redirect Rules table shows the active 301 rule “WWW to non-WWW canonical redirect”: wildcard source `http*://www.kalendorius365.lt/*`, target `https://kalendorius365.lt/${2}`, query preservation enabled. Live redirect behavior remains unverified while the zone is pending.
- Cloudflare Pages Custom Domains did not allow adding `kalendorius365.lt` while the zone was pending; root and www are not yet connected to Pages. SSL for the custom domain and live HTTP/HTTPS behavior remain unverified.
- `public/_headers` configures `X-Robots-Tag: noindex`; a valid header rule was parsed during a Pages build. The actual live response header has not yet been checked. Do not index or submit the unfinished placeholder.

## Deployment and rollback

Cloudflare Pages is natively connected to `mateopedersen/kalendorius365`; production branch is `main`, framework preset is None, build command is empty, and output directory is `public`. Future pushes to `main` deploy automatically. Confirm the commit and status in the project's Deployments tab and inspect the build log for errors.

For recovery, identify the last successful production deployment, fix source/settings, then push a commit or use Cloudflare Pages to retry/roll back to that known-good deployment. Confirm the project URL and expected content after recovery. Never publish credentials in source or build logs.

## DNS and domain activation

1. In Hostinger, confirm the domain still uses exactly `devin.ns.cloudflare.com` and `rosa.ns.cloudflare.com`.
2. In Cloudflare Overview, wait for zone status to become Active. Use “Check nameservers now” after propagation; Hostinger says this may take up to 24 hours.
3. If it remains pending, check registrar delegation and DS/DNSSEC state. Cloudflare must be authoritative and any stale DS record must be resolved safely.
4. In Cloudflare DNS, keep apex CNAME to `kalendorius365.pages.dev` and www CNAME to the apex, both proxied. Do not restore the old parking A record.
5. Once active, add both `kalendorius365.lt` and `www.kalendorius365.lt` under Pages → Custom domains. Wait for verification and managed SSL certificate issuance.
6. Enable Cloudflare “Always Use HTTPS” after activation. Keep the existing 301 WWW-to-root rule and test paths and query strings. Do not enable HSTS preload.
7. Verify root returns 200, HTTP redirects to HTTPS, and www redirects to the root over both HTTP and HTTPS. Check a live `X-Robots-Tag: noindex` response header on Pages and the production domain before launch.

No email records were found in the pre-migration Hostinger table. Confirm whether email is needed before configuring it; use only records supplied by its provider. Do not guess MX or authentication records. The site is still in development and the noindex policy must be removed and verified before public launch.

## Ruby/Jekyll migration

Reuse this repository and Pages project. Add Jekyll source/dependencies, set the supported Jekyll build command, and change the Pages output directory to `_site`. First verify a preview deployment, Lithuanian UTF-8 text, assets, downloads, and response headers; only then use the production branch. A static Jekyll site does not require a database or paid hosting.

## Launch checklist

- [ ] Cloudflare zone Active; Hostinger delegation verified; DS/DNSSEC state confirmed.
- [ ] Any needed email records copied from the mail provider and mail delivery checked.
- [ ] Pages custom domains verified and managed SSL certificates active.
- [ ] Root 200, HTTP-to-HTTPS, and www-to-root 301 tested with paths and query strings.
- [ ] Live noindex header checked on the preview and custom domain; remove it before public launch.
- [ ] Latest deployment is successful; keep deployment and rollback notes current.
