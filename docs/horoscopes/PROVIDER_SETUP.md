# Provider setup and cost notes

The daily pipeline uses AstroWay's public endpoint; it needs no API key and does not call a paid LLM or translation service.

1. `.github/workflows/horoscope-automation.yml` is scheduled on the default `main` branch.
2. The 00:17 run tries to publish the current `Europe/Vilnius` date. Later half-hour runs retry any incomplete set or verify the live edition when the complete set is already committed.
3. One run makes at most 24 requests: twelve primary requests and one targeted retry for each failed sign. For 429/5xx responses, it retries only that sign using `Retry-After` or bounded exponential delay.
4. GitHub Actions uses Ruby 3.4.11 / Bundler 2.6.9 and Python 3.12. It does not download or cache a 473 MB translation model.
5. The provider documents a 30-request/hour/IP limit. Each run has a 24-request maximum, and runs which already have the day's valid data never request it again. Multiple failed runs sharing one IP can encounter the provider's hourly limit.
6. Requests contain public sign/date/calculation data only. Visitor data is not sent, and raw API responses are not archived.

The code incurs no paid model/API calls. GitHub Actions Linux-minute allowances depend on the repository owner's plan, which is not visible from this checkout and cannot be confirmed here.
