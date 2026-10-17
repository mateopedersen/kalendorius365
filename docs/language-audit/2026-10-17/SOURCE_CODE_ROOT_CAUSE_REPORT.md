# Source-code causes and durable repairs

Date: 2026-10-17. Scope: 185 previously identified public routes plus the legitimate new `/apie/` methodology page, **186 canonical routes**. Review was AI-assisted; no native-human, legal-professional or search-engine endorsement is claimed.

## Fix the source that republishes the words

| Family | Root cause | Durable repair | Evidence |
|---|---|---|---|
| Calendar years/months, navigation, tools | Repeated promotional fragments, awkward day-count inflection, an orientation translation and generic metadata were emitted by shared Ruby methods. | `scripts/pages.rb`, `lib/page_designs.rb` and `lib/phase_5_6_8_pages.rb` now express the actual task, date scope and output. Dynamic strings were corrected in their JavaScript sources. | `root-changes.json`; 63-route independent review. |
| Holiday detail | A first-sentence extractor treated periods in `šv.` and `2016 m.` as sentence endings, truncating Joninės and Mother's Day summaries. The author disclosure also personified AI as a professional editor. | `scripts/holiday_phase2/pages.py` preserves complete abbreviation-bearing sentences and truthfully describes AI assistance. Original date/status/reference fields remain intact. | `independent-qa-astronomy.json`, two `FIX_VERIFIED_IN_FINAL_RENDER` findings; `agent-holidays.json`. |
| Monthly holidays | Meta descriptions reused long article introductions; copied registry wording could outlive the editorial source. | Twelve authored snippets in `scripts/monthly_holidays/editorial.py`; `scripts/monthly_holidays/pages.py` reads current approved editorial summaries. Dates, categories, identifiers and legal titles are preserved. | Isolated generation of all 12 guides and 126 event records; `holiday-isolated-generator-qa.json`. |
| Lunar/season/solar | Poetic headings concealed the section's function; selected-date text incorrectly said yesterday/today; some download labels implied adding rather than downloading. | `scripts/lunar/pages.py`, `scripts/seasons/pages.py`, `lib/phase_5_6_8_pages.rb`, `site/assets/sunrise.js` and `phase-5-6-8.js` use concrete labels and selected-date wording. | 48-route specialist review; independent 62-route cross-review; astronomy regression tests. |
| Daily horoscope prose | Nominative planet names were inserted before `aspektas`; an accusative Moon-focus fragment followed a topic label; decimal output used a point; repetitive filler was added by a date-dependent variation function. | `scripts/horoscopes/editorial_lt.py` supplies genitives and complete noun phrases, formats displayed decimal commas, and removes filler. Publisher engine label is `original-lithuanian-calculation-copy-v1.1`. | Fifteen offline pipeline tests, current checksum validation, next-day/DST fixtures and two isolated Ruby publications. |
| Horoscope/zodiac pages and ascendant results | Metadata repeated date-heavy titles; result text had ambiguous gender/plural subjects; nonexistent DST time advice suggested changing a birth time. | `lib/horoscopes_pages.rb`, `lib/zodiac_pages.rb`, profile JSON and `ascendant-calculator.js` use clear purpose/limitations, sign-explicit wording and document-checking advice. | All 14 routes reviewed; 16 ascendant tests; real Ruby generator survival test. |
| Namedays | Awkward source-history wording and a false implication that Easter and a nameday can never coincide came from shared Ruby/JS copy. | `lib/namedays_pages.rb`, `site/assets/namedays.js` and `namedays-engine.js` clarify the UI and source scope. Names are not normalized or substituted. | All 13 rendered routes, all 366 source records and exported source/license byte comparisons. |
| Privacy/about | The privacy text said the search phrase never reaches a server, although the results URL uses a GET query. It also mentioned a removed dark-theme preference. | `site/_includes/privacy-policy-lt.html` describes actual browser search and URL/log implications; `/apie/` describes actual sourcing and AI assistance without invented credentials. | `root-changes.json`; independent About corrections verified in rendered HTML. |

## Preservation, rather than broad exemptions

Provider response hashes, source dates, source licensing and calculation inputs were retained. The current horoscope prose/checksum changed because its Lithuanian was corrected; its recorded provider, license and publication date were not rewritten. The preserved source/calculation evidence is in `horoscope-current-source-preservation.json`.

For monthly holiday JSON, a narrow, versioned allowance identifies **17 exact reviewed text paths**. Reversing those precise strings reproduces the original compact JSON hash. The original baseline was not replaced and the asset was not ignored. Evidence: `holiday-editorial-v1.json` in this directory, `agent-holidays.json` preservation follow-up, and 17 preservation/generation tests.

The independent print check found **1,203 PDF/WebP/SVG files byte-identical** to baseline. Thirty-six changed holiday ICS files retained their exact UID, DTSTART and DTEND identities. CRLF folding required by ICS was preserved. See `print-protection-independent-qa.json`.

## Duplication and indexability

The reproducible [`duplicates.py`](../../../scripts/sitewide_audit/duplicates.py) compares all **17,205 pairs** for exact main text and five-word shingle similarity, then records each route's actual purpose, dates, controls and downloads. No exact main-text or duplicate title/description/canonical groups were found in the recorded local crawl. Similar calendar templates were preserved. Search Console, traffic and backlink inventories were unavailable; no absence of valuable traffic was inferred.

Release-vs-preview indexing is handled by the build policy and separately audited; a preview's `noindex` must not be copied into a production release. Local HTML eligibility and actual production response verification are distinct gates. This report does not certify the deployed release.

## Evidence location

Artifact names above refer to the operator evidence bundle at:

`/Users/melihozcan/Documents/Codex/2026-10-17/sitewide-lithuanian-seo-audit/`

The per-change logs retain exact before/after values and source locations. Generated HTML was rebuilt from corrected sources; the work is not limited to hand edits of output pages.
