# Sources, assumptions and review boundaries — 2026-10-15

## Statutory dates
Canonical definitions: `data/calendar.json`; Ruby builds all target-year date/holiday data. Browser calculations are cross-checked against Ruby; Python independently checks all 731 Gregorian weekday/ISO date positions in 2027–2028.

- Labour Code Article 123, official act: https://e-seimas.lrs.lt/portal/legalAct/lt/TAD/10c6bfd07bd511e6a0f68fd135e6f40c/asr
- Official consolidated edition metadata (2026-06-07–2026-10-31): https://www.e-tar.lt/rs/actualedition/f6d686707e7011e6b969d7ae07280e89/jlrUauipfr/
- Official indexed Article 123 text, including the 2020 November 2 addition and current legal naming: https://e-seimas.lrs.lt/rs/actualedition/10c6bfd07bd511e6a0f68fd135e6f40c/eFmFBLUcGG/format/ISO_PDF/
- VDI preholiday shortening explanation: https://vdi.lrv.lt/lt/dazniausiai-uzduodami-klausimai/?lang=lt&pv=12&q=prie%C5%A1%C5%A1ventin

Full current e-Seimas/e-TAR consolidated-file requests were blocked with WAF/403. Do not claim that a complete current consolidated PDF was downloaded. Official indexed text and current edition metadata were inspected; the unchanged Article 123 list was also cross-checked with current-edition legal reproductions. The public data states its review date and links the official act. Future years apply the reviewed statutory rules, not an assurance against future legal amendments. Historical calculators apply current reviewed holiday rules, not historical legislative editions.

The 16 statutory dates are not all distinct legal numbered clauses: Easter has two days and Christmas has two days. No automatic substitute Monday is added. Commemorative and school dates are not included in statutory non-working-day calculations. Easter uses Gregorian Meeus/Jones/Butcher computus; 2027-03-28/29 and 2028-04-16/17 are explicit test cases.

## Working time
5-day example: Mon–Fri, 8 h/day. 6-day example: Mon–Fri 7 h/day plus Sat 5 h. Exclude statutory holidays on scheduled days, and subtract one hour only from a scheduled non-holiday immediately before a statutory holiday, including Dec 31 before Jan 1 next year. Exceptions for reduced statutory working-time norms, individual contracts, aggregated schedules, leave and shift work are stated publicly. These are planning estimates, not individualized employment determinations.

### Change effective 2026-11-01
The Seimas adopted amendment XV-1058 on 2026-06-25; it was published in TAR on 2026-06-29 and enters into force on 2026-11-01. Official text: https://www.e-tar.lt/portal/lt/legalAct/f74d61f0738e11f1b53dfa020e517810 . Its amendment to Labour Code Article 112(6) retains the one-hour pre-holiday reduction and the reduced-norm exception, and adds pay-retention, average-pay, and overtime-pay provisions. This does not change the calculator's arithmetic for its declared standard 5-/6-day examples, but it means those examples cannot determine an individual's entitlement or pay. The 2027/2028 workday page copy and Ruby source now describe this limit. Article 112(5) also changes for a defined public-sector caregiver group; the calculator does not model that special weekly norm. Review the current consolidated Article 112 again before future legal changes or releases.

## School schedules
Current ministry information page: https://smsm.lrv.lt/lt/veiklos-sritys-1/smm-svietimas/20252026-m-m-ir-20262027-m-m-mokiniu-atostogos/
The current page explicitly lists 2026-11-02–08; 2026-12-21–2027-01-03; 2027-02-15–21; Easter 2027-03-22–29 for primary/basic and 2027-03-29–04-04 for secondary. An older official education-plan PDF had different Christmas/Easter endpoints; the published page follows the current ministry information page and attributes it. 2027–2028 remains unverified in our sources and is labelled pending. Summer start varies by grade/program and is not fabricated.

## Weather
Official API and terms: https://api.meteo.lt/ (v1.4.9 inspected). LHMT attribution with CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/
Station codes were verified against the live station list for Vilnius, Kaunas, Klaipėda, Šiauliai and Panevėžys. Observations and forecasts are labelled separately. Browser and same-origin edge caches use 20-minute lifetimes; requests are not tied to clock ticks. The public API returned no browser CORS allowance, hence the small same-origin Pages Function. No key, precise geolocation, database or paid weather service. Actual upstream integration returned HTTP 200 with both observations and forecast before release; total/partial failure and unapproved-city requests also have automated tests.

## Print and fonts
Inter official source: https://github.com/google/fonts/tree/main/ofl/inter ; original copyright and SIL OFL retained. Distinct static PostScript identities prevent regular/bold PDF font deduplication. The two static faces and UI subset reproduce byte-for-byte from the committed source.
Ruby 3.4.11 / Jekyll 4.4.1 / Bundler 2.6.9; Node 24.19.0; Python 3.12.14; ReportLab 4.4.9; Pillow 12.3.0; pypdf 6.10.0; FontTools 4.60.1; Brotli 1.1.0; Poppler 26.05.0. Python dependencies are pinned. Ruby controls source data, orchestration, release gates and Jekyll build.
No placed raster images occur inside these PDFs. All text, lines and artwork are vector. Effective placed-raster PPI is therefore not applicable; no invented minimum is reported. Actual A4 proof rasterizations and full-resolution WebP are 4961×7016 or 7016×4961, over 600 PPI in both axes against the actual MediaBox. DeviceGray-only B/W PDFs and lossless equal-channel B/W WebP are validated. RGB color artwork is not labelled CMYK/PDF-X/PDF-A. Every page has a vector Kalendorius365.lt footer mark.

## Scope kept explicit
No account/cloud sync, moon phases, name-day dataset, unconfirmed school-year dates, A3 files or press-color certification is advertised. The generator disables annual personal-event/large-writing/font-size options that cannot remain legible. Browser print-to-PDF is labelled as such. ICS imports support only documented simple recurrence and Vilnius/UTC times; unsupported entries are reported. JSON backups and restores are local, versioned and validated.

## Language and terminology audit — 2026-10-15
Canonical month nominative/genitive forms, weekday abbreviations, and event categories are stored in `data/calendar.json`. A small preferred-term map was added there for recurring UI concepts (for example, „Išsaugoti“, „Nustatymai“, „Atsisiųsti“ and „Šiandien“). The static Lithuanian pages still contain component copy directly; a complete migration of every UI phrase to runtime dictionary keys remains outstanding. A structural scan of 42 generated HTML files (41 landing pages plus 404) counted 7,415 visible text/attribute fragments and 1,034 distinct normalized strings. It is a repeatable inventory, not a native-speaker grammar verdict. The scan found no visible English labels for Save/Settings/Download/Today; occurrences of “settings” and “download” in machine identifiers and icon paths are not user-facing copy. No Lithuanian editor performed a human review. The updated privacy and legal-method text are the concrete copy corrections in this phase; other editorial questions remain flagged for native review.
