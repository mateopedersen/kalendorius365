# Kalendorius365

Official infrastructure and website source repository for Kalendorius365.lt, a Lithuanian calendar platform.

The repository currently contains a temporary static placeholder. The production website is planned as a Ruby/Jekyll static site and will replace the placeholder in this repository.

## Current status

- Website source: `public/`
- Planned deployment: Cloudflare Pages, connected to this repository's `main` branch
- Domain registrar: Hostinger
- Planned authoritative DNS: Cloudflare
- Temporary pages include `X-Robots-Tag: noindex`; remove this before the public launch only after launch readiness is confirmed.

See [infrastructure and recovery notes](docs/infrastructure.md) for the deployment plan and recovery guidance. These notes describe the intended setup and must be updated with verified account-specific values as setup is completed.

## Local preview

Open `public/index.html` in a browser. No build tools or external assets are required for the temporary page.

## Future Jekyll migration

Keep this repository and Cloudflare Pages project. Add the Jekyll source, configure Cloudflare Pages to build the site with Ruby/Jekyll, and change the output directory to `_site`. Preserve the production branch and custom domains during the transition. Verify deployment previews and indexing headers before launch.

## Ownership and security

The domain remains registered with Hostinger. GitHub is the source of truth for website files. Never commit passwords, access tokens, private keys, or account recovery codes. Limit repository and Cloudflare Git integration access to the project owner and this repository.
