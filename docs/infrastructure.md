# Infrastructure and recovery notes

## Service ownership and roles

- **Domain registration:** Hostinger retains the `kalendorius365.lt` registration.
- **Website source:** the private GitHub repository `https://github.com/mateopedersen/kalendorius365` stores the website source on `main`.
- **Static hosting and CDN:** Cloudflare Pages is intended to deploy the static site from GitHub.
- **Authoritative DNS:** Cloudflare is intended to provide DNS after Hostinger nameservers are changed to the exact nameservers assigned to this zone.

Record the verified Cloudflare Pages project URL, `pages.dev` hostname, zone nameservers, DNSSEC/DS status, and deployment commit here after setup. Do not guess these values.

## Initial inventory (2026-10-15)

- Hostinger's authenticated dashboard lists `kalendorius365.lt` in the account. The domain overview did not finish rendering during inspection, so expiry and verification details were not independently confirmed.
- Hostinger nameservers shown: `cosmos.dns-parking.com` and `nova.dns-parking.com`.
- Hostinger DNS records shown: `www` CNAME to `kalendorius365.lt` (TTL 300) and apex A to `2.57.91.91` (TTL 50). The apex A record appears consistent with placeholder or parking use, but its purpose has not been verified; do not copy it blindly.
- No MX or TXT email-related records appeared in the Hostinger DNS record table. This is not proof that no separate email service exists.
- Hostinger's DNSSEC page showed no configured key tag, algorithm, digest type, or digest. Confirm the registrar's DS status before nameserver cutover.
- The browser returned `ERR_NAME_NOT_RESOLVED` for `kalendorius365.lt` during initial inspection.
- A Cloudflare Free zone for `kalendorius365.lt` has been created in manual DNS mode. It has no DNS records and is not activated at the registrar; Cloudflare nameservers have not yet been recorded.
- The private GitHub repository has been created. No Pages project has been created yet.

## Deployment flow

The intended configuration deploys the `public/` directory from the repository's `main` branch without a build command. A push to `main` should create a Cloudflare Pages production deployment. Review build logs in the Cloudflare dashboard under the Pages project and its deployments. Keep preview deployments available for review.

The temporary response header in `public/_headers` applies to the placeholder on production, preview, and `pages.dev` Pages hosts. Verify the live response header before relying on it. **Remove the `X-Robots-Tag: noindex` line before the full public launch** and verify the resulting production response. Do not submit the unfinished site to search engines.

## Failed deployment recovery

1. Open the Cloudflare Pages project and inspect the most recent deployment's build log and commit.
2. Check that the production branch is `main`, the repository connection is healthy, and the output directory points to `public` while this placeholder layout is in use.
3. Correct the source or build settings and push a new commit. If necessary, retry or roll back to a known-good deployment in Pages.
4. Confirm the active deployment serves the expected page and response headers.

## DNS recovery

Before changing nameservers, preserve a copy of every active Hostinger DNS record, especially MX, SPF, DKIM, DMARC, CAA, and verification records. Check whether email or another service uses the zone. Compare the Cloudflare zone against that inventory before activation. Use only the exact nameservers Cloudflare assigns to this domain. If DNSSEC is enabled, coordinate the registrar DS record with Cloudflare's DNSSEC state to avoid stale DS data. If resolution fails after a change, compare delegation at the registrar with Cloudflare's assigned nameservers, then check the Cloudflare zone status and DNS records. Do not remove records whose purpose is unknown.

## Ruby/Jekyll migration

Reuse this repository, Cloudflare Pages project, and custom domains. Add the Ruby/Jekyll source and dependencies, change the Pages build command to the appropriate Jekyll build command, and set the output directory to `_site`. Test a preview deployment, UTF-8 Lithuanian text, response headers, assets, and downloadable files before switching the production build. Keep the static architecture; no database or paid hosting is required for a static Jekyll site.

## Launch checklist

- Remove the temporary `X-Robots-Tag: noindex` rule only when the finished site is ready to launch.
- Confirm root and `www` custom domains, valid HTTPS, redirects, DNS, and all needed email records.
- Confirm the active production deployment and smoke-test representative pages and downloads.
- Update this document with verified service-specific values and current recovery contacts/process.
