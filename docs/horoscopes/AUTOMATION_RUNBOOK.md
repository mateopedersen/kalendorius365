# Daily horoscope automation runbook

`.github/workflows/horoscope-automation.yml` runs on the default `main` branch at 06:20, with an 08:20 recovery run in `Europe/Vilnius`. `workflow_dispatch` can manually recover the current date.

## Run sequence

1. `publish.py --check-date` checks whether today's complete set is already published.
2. If current, it skips fetching and verifies production routes.
3. Otherwise, it fetches calculation-only data for all twelve signs, with one targeted retry for an affected sign.
4. The two independent Python QA gates must pass before `horoscope_current.json` is atomically replaced.
5. Ruby 3.4.11 and Bundler 2.6.9 build the Jekyll release and check all thirteen routes, canonicals, indexability and sitemap entries.
6. The action commits only horoscope data/pages and required generated files, then makes a normal fast-forward push to `main`. It never force-pushes.
7. The existing GitHub-to-Cloudflare Pages integration deploys `main`. The workflow then checks HTTP 200, `lang=lt`, self-canonical, indexability, date, complete copy and provider attribution on all thirteen production routes.

## Failure behavior

- Any missing sign, failed validation, build or push leaves the existing publication untouched.
- The 08:20 run retries the same local date. Concurrency prevents simultaneous publishing.
- If production verification fails, the Actions run fails and records the cause in its summary/log. Email notifications depend on the repository owner's GitHub notification settings.
- Roll back only the horoscope data/generated pages; do not alter calendar or print assets.

## Limits

Automation cannot claim native-language or professional astrology review. No Cloudflare API token is assumed; deployment uses the repository's current `main` Git integration and is confirmed by live route checks. Recheck the AstroWay plan's commercial-use permissions before adding advertising.
