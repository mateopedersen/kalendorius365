# Daily horoscope automation runbook

`.github/workflows/horoscope-automation.yml` makes its first attempt at 00:17 and checks every 30 minutes through 23:47 in `Europe/Vilnius`. GitHub may delay or drop scheduled events. Use `workflow_dispatch` to check or recover the current date manually.

## Run sequence

1. `publish.py --check-date` checks whether today's complete set is already published.
2. If current, it skips fetching and verifies production routes.
3. Otherwise, it fetches calculation-only data for all twelve signs, with one targeted retry for an affected sign.
4. The two independent Python QA gates must pass before `horoscope_current.json` is atomically replaced.
5. Ruby 3.4.11 and Bundler 2.6.9 build the Jekyll release and check all thirteen routes, canonicals, indexability and sitemap entries.
6. The action commits only horoscope data/pages and required generated files, then makes a normal fast-forward push to `main`. It never force-pushes.
7. The existing GitHub-to-Cloudflare Pages integration deploys `main`. The workflow checks HTTP 200, `lang=lt`, self-canonical, indexability, date and complete copy on all thirteen production routes. It allows up to twenty minutes for a new release and one minute for an already committed edition. IndexNow runs after a new release passes live verification.

## Failure behavior

- Any missing sign, failed validation, build or push leaves the existing publication untouched.
- Each half-hour recovery run verifies the live edition when the local data is current, including after a previous deployment check failed. It uses the same Vilnius date throughout the run.
- If production verification fails, the Actions run fails and records the cause in its summary/log. Email notifications depend on the repository owner's GitHub notification settings.
- Roll back only the horoscope data/generated pages; do not alter calendar or print assets.

## Limits

Automation cannot claim native-language or professional astrology review. No Cloudflare API token is assumed; deployment uses the repository's current `main` Git integration and is confirmed by live route checks. Recheck the AstroWay plan's commercial-use permissions before adding advertising.
