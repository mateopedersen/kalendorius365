# Horoscope source and content-model decision

Reviewed 2026-10-16.

## Decision

- Source endpoint: `https://api.astroway.info/v1/public/horoscope/daily`.
- API documentation: https://api.astroway.info/en/docs/api/operations/publichoroscopedaily/
- Service terms: https://api.astroway.info/en/terms/
- Requests contain a sign, explicit Lithuanian `YYYY-MM-DD` date, `lang=en`, and only `sign,date,transits,aspects,events` fields.
- Permission to republish or translate the provider's horoscope prose was not clearly established, so the system never requests, uses, translates or archives that prose.
- The permitted fallback is selected: the local `editorial_lt.py` rules create original Lithuanian text from date-specific calculations. Helsinki-NLP and other translation models are not used. AstroWay's returned `_footer` is retained, and each page links to the calculation source.
- A real 2026-10-16 live API run validated all twelve signs and dates with the requested calculation-only fields. Sanitized evidence is stored in `validation/horoscope-source-qa.json`.

## Rights and usage limits

AstroWay documents a public no-key endpoint and a limit of 30 requests per hour per IP. Its terms discuss building an own interpretation layer from calculation data; commercial use depends on the selected plan. The current website states that it has no advertising, so the plan's commercial permissions are not assumed. Before adding AdSense or other paid advertising, the owner must reconfirm the terms for the applicable plan.

If rights to the calculation data change or no longer fit the site's use, the workflow fails closed and keeps the previous publication with its real date. It will not fall back to copied or translated horoscope prose.
