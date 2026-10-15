# Deployment and rollback procedure

## Verified delivery path

The repository is `mateopedersen/kalendorius365`; local production output is `public/`. `docs/infrastructure.md` and the open repository's main-branch history describe Cloudflare Pages project `kalendorius365`, GitHub native integration, production branch `main`, empty remote build command, output directory `public`, and automatic deployments. The owner-authorized repository is the only target.

## Release record

- Feature branch: `feature/phase-5-6-8`.
- Protected source checkpoint: `checkpoint/phase-5-6-8-before` at `235190c9b1e56743c2a7869566e4bd76efddb830`.
- The local feature branch is based on a commit that is an ancestor of the fetched `origin/main`; the current remote main observed before release was `684f49b`.
- Release commit, push time, Cloudflare deployment ID and final URL checks are to be filled after the production push completes. A local build is not a release.

## Publish gates

Before pushing, require the release build, 32-test JavaScript suite, site/link/indexability audit, all 416 PDF/WebP validations, the two January/February sample criteria, all 552 baseline checksums, and independent Pass 2 pre-deploy review to pass. Then push the release commit to `main` to use the existing auto-deploy path. Do not change DNS, nameservers, Cloudflare Pages settings, caching rules, security headers or GitHub app permissions for this release.

After deploy, wait for Cloudflare Pages to report success for the exact commit. Then check the homepage, all new canonical routes, 2029 PDF/WebP files, sitemap, robots, representative 404, redirects, CSP and cache headers. Record actual response statuses and hashes in the manifests and final report. Do not claim search-engine index acceptance.

## Rollback

The pre-change `checkpoint/phase-5-6-8-before` branch preserves the local baseline. The currently deployed pre-release remote-main commit is `684f49b` as observed immediately before publication. If the deployment fails or a critical live gate regresses, use Cloudflare Pages' previous known successful deployment or revert the release commit on `main`; verify the rollback site's routes and headers. Preserve the production 552 original downloadable files, and do not change DNS as a recovery shortcut.
