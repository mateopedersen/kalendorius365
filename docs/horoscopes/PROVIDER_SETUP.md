# Provider setup and cost notes

The daily pipeline uses AstroWay's public endpoint; it needs no API key and does not call a paid LLM or translation service.

1. `.github/workflows/horoscope-automation.yml` is scheduled on the default `main` branch.
2. The 06:20 run tries to publish the current date. The 08:20 run retries if that same `Europe/Vilnius` date is still incomplete. If the set is already current, the second run makes no API requests.
3. One run makes at most 24 requests: twelve primary requests and one targeted retry for each failed sign. For 429/5xx responses, it retries only that sign using `Retry-After` or bounded exponential delay.
4. GitHub Actions uses Ruby 3.4.11 / Bundler 2.6.9 and Python 3.12. It does not download or cache a 473 MB translation model.
5. The provider documents a 30-request/hour/IP limit. The workflow runs are two hours apart and each has a 24-request maximum. Provider quotas and free runner minutes can depend on plan/account settings, so the full service is not asserted to be free for every account.
6. Requests contain public sign/date/calculation data only. Visitor data is not sent, and raw API responses are not archived.

The code incurs no paid model/API calls. GitHub Actions Linux-minute allowances depend on the repository owner's plan, which is not visible from this checkout and cannot be confirmed here.
