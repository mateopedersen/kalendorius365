# Infrastructure and recovery notes

## Service ownership and roles

- Domain registration: Hostinger retains kalendorius365.lt.
- Source: private GitHub repository https://github.com/mateopedersen/kalendorius365, main branch.
- Static hosting and CDN: Cloudflare Pages project kalendorius365.
- Authoritative DNS: currently Hostinger nameservers; Cloudflare zone is not yet active at the registrar.

## Verified state (2026-10-15)

- GitHub repository is private; production branch is main.
- Cloudflare Workers and Pages GitHub App is installed for mateopedersen and restricted to this repository. Its installation has metadata read access and administration, checks, code, deployments, and pull requests read/write permissions within the selected repository.
- Cloudflare Free zone for kalendorius365.lt exists in manual DNS mode. No zone records were added and the zone is not active at the registrar.
- Hostinger currently shows nameservers cosmos.dns-parking.com and nova.dns-parking.com. Its DNS table showed www CNAME to kalendorius365.lt (TTL 300) and apex A 2.57.91.91 (TTL 50). The A record appears to be parking but its purpose is unverified. No MX or TXT records appeared; this does not rule out separate email services.
- Hostinger DNSSEC controls showed no configured Key Tag, Algorithm, Digest Type, or Digest. The registry DS state is not independently verified.
- Hostinger Emails page did not render account details; email usage is not confirmed. Recheck services and preserve all necessary records before nameserver migration.
- The website project is available at https://kalendorius365.pages.dev/ and its first production deployment succeeded on 2026-10-15 from main commit e8ade68fb53cbf7282c5ad04633cc5c4c8baf993. Cloudflare reported 17 seconds. The temporary homepage displayed Kalendorius365 and Svetainė ruošiama.
- The deployment-specific preview URL cbbfc5cc.kalendorius365.pages.dev returned a browser TLS version/cipher mismatch at the time checked. The project-level pages.dev URL loaded successfully over HTTPS.
- Root and www custom domains are not yet connected. Nameservers have not been changed.

## Deployment

Cloudflare Pages is natively connected to mateopedersen/kalendorius365. Production branch is main, framework preset is None, build command is empty, and output directory is public. Cloudflare shows automatic deployments enabled. The first production deployment succeeded. A subsequent harmless commit is still required to verify automatic redeployment end to end.

Inspect build logs from the Pages project Deployments tab. The temporary X-Robots-Tag: noindex response header is configured in public/_headers for Pages deployments. A live HTTP response-header check is still required. Keep the noindex rule until the finished public website is ready; remove it before launch and verify the production response. Do not submit the unfinished site to search engines.

## Failed deployment recovery

1. Open the Cloudflare Pages project and inspect the most recent deployment build log and commit.
2. Confirm the production branch is main, repository integration is healthy, and output directory is public for the current placeholder.
3. Correct the source or build settings and push a commit, or retry/roll back to a known-good deployment in Pages.
4. Confirm the active deployment serves the expected page and response headers.

## DNS migration and recovery

Before changing nameservers, recheck and preserve every active Hostinger DNS record, especially A, AAAA, CNAME, MX, SPF, DKIM, DMARC, CAA, TXT verification, NS, and DNSSEC/DS state. Confirm whether email or another service uses the domain. Compare the Cloudflare zone against that inventory. Add only records whose purpose is understood and required; do not copy the obsolete parking A record. Obtain the exact nameservers Cloudflare assigns to this zone. Coordinate DNSSEC and any registrar DS record to avoid stale validation.

After migration, verify Hostinger delegation, Cloudflare zone activation, the required DNS records, and resolution. If resolution fails, compare registrar delegation with Cloudflare-assigned nameservers and check for missing records or stale DS configuration. Do not remove records of unknown purpose. The domain registration must remain at Hostinger.

## Ruby/Jekyll migration

Reuse this repository, Pages project, and custom domains. Add the Jekyll source and dependencies, set the Pages build command to the supported Jekyll build command, and change output directory to _site. Test a preview deployment, Lithuanian UTF-8 text, response headers, assets, and downloads before switching production. A static Jekyll site does not require a database or paid hosting.

## Launch checklist

- Confirm email/service dependencies, DNSSEC/DS state, and copy all required DNS records before nameserver migration.
- Verify nameserver delegation, active Cloudflare zone, Pages custom domains, valid HTTPS, redirects, and needed email records.
- Verify production and www/HTTP redirects, live noindex response headers during development, and remove noindex before public launch.
- Confirm the active deployment and test representative pages and downloads.
- Keep deployment logs and recovery notes current.
