# Daily horoscope architecture

- `site/_data/horoscope_current.json` contains only the active, complete set of twelve signs. Daily archives are not retained.
- `scripts/horoscopes/fetch_daily.py` calls AstroWay's daily endpoint for the exact `Europe/Vilnius` date and requests only `sign,date,transits,aspects,events`. Horoscope prose fields are not requested and are rejected if returned.
- `scripts/horoscopes/editorial_lt.py` turns the date-bound Sun/Moon house and closest-aspect calculations into original, deterministic Lithuanian entertainment copy. It does not use or translate provider prose. No translation model runs.
- `scripts/horoscopes/publish.py` validates all twelve records and replaces the active JSON file atomically only after both content gates pass. It allows at most 24 requests per run: twelve normal requests plus one targeted retry for a failed sign, under the provider's documented 30 requests/hour/IP limit.
- `lib/horoscopes_pages.rb` creates the existing thirteen stable URLs as static HTML. It uses the site's Lithuanian layout, Lato font and existing set of twelve distinct zodiac SVGs. The generated pages are self-canonical, indexable and included in the sitemap.
- `K365_RELEASE=1 bundle exec ruby scripts/build.rb` runs the existing Jekyll release build and refreshes the tracked `public/` output. The automation commits only the horoscope content/pages and necessary generated files.
- `.github/workflows/horoscope-automation.yml` runs daily at 06:20 and retries the same Vilnius date at 08:20. Concurrency prevents overlapping publications. The second run is an API-free verification when today's set is already current.
- If publication fails, the previous set retains its real publication date. No older set is relabelled as today's content.

## Provenance shown to visitors

Each page displays its actual content date, that automated checks ran, that a native Lithuanian editor did not proofread the text, a link to AstroWay, and the provider's returned `_footer` attribution escaped as text. The pages describe astrology as entertainment and reflection, not as a scientific prediction.

The current site states that it does not display ads. Before adding AdSense or other paid advertising, recheck that the provider's then-current plan permits this commercial use.
