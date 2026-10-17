# Vardadieniai: Lithuanian and source-preservation QA

Date: 2026-10-17. All **13 routes** were reviewed individually: `/vardadieniai/` and its twelve month directories. This document reports source/rendered-content evidence, not a native-human certificate, legal clearance or completed production deployment.

## Data remained source-derived

The accepted `data/namedays/cc-by-sa-4.0/snapshot.json` contains **366 date records**, including February 29. Every recorded source section was re-extracted and compared with its stored names; all name lists and section SHA-256 values matched. Each rendered month list preserves the exact name order/spelling, date key, permanent revision URL, history URL and dated ICS link. The hub's complete 366-date fallback list matches the same records and is present in HTML without JavaScript.

The published full source JSON and `LICENCIJA.txt` were byte-identical to their accepted source files. Search normalization does not rewrite visible names. Different dates for the same name, source variants and January 1's separate source lists are deliberately retained. No name was “corrected” merely because it looked unusual.

Evidence: `progress/independent-qa-horoscopes.json` includes each route's HTML/main-text hashes, name/source checks and download checks. The dataset's origin should not be confused with the user's selected year or the browser's current Lithuanian date.

## Language changes are in the generators

| Before | After | Reason |
|---|---|---|
| `autorių istorija` | `straipsnio keitimų istorija` | The link exposes an article's revision history, from which contributors can be found. |
| `Aprėptis: 366 mėnesio dienos, įskaitant vasario 29-ąją.` | `Rinkinyje – 366 kalendorinės datos, įskaitant vasario 29-ąją.` | The dataset contains year-cycle date keys, not 366 days within one month. |
| `Įrašas nebus sukurtas, kol data neužpildyta.` | `Prieš kurdami įrašą pasirinkite datą.` | Direct, actionable validation instruction. |
| `Vardadienis ir Velykos yra skirtingos datos` | `Vardadienių datos šiame kalendoriuje nekinta` | A nameday may coincide with Easter in a particular year; their calculation rules differ. |

The last row quotes the relevant exact fragments; full before/after sentences and file locations are in `root-changes.json` and [the sample ledger](BEFORE_AFTER_SAMPLES.md). Underlying fixes are in `lib/namedays_pages.rb`, `site/assets/namedays.js` and `namedays-engine.js`.

## Attribution and reuse evidence

Every hub/month page exposes the Lithuanian Wikipedia contributors, specific article revision/history links, an explanation of extraction changes, the **CC BY-SA 4.0** link, downloadable attributed data and a licensing explanation. The page distinguishes a community calendar from an official government nameday register. The VLKK name-spelling resource is identified as a spelling aid, not a nameday-date register and not an imported data source.

Relevant primary terms checked: [Wikimedia Terms of Use, licensing of content](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content), [Wikimedia content reuse](https://www.mediawiki.org/wiki/Wikimedia_APIs/Content_reuse), and [CC BY-SA 4.0 Lithuanian legal code](https://creativecommons.org/licenses/by-sa/4.0/legalcode.lt). Attribution, change notices, same-license availability and lack of added reuse restrictions are recorded in the actual published license text. This is an implementation/evidence review, not a third-party rights warranty.

## Calendar and function evidence

The recorded full test suite exercised native/accentless/uppercase/partial-name search, alphabet/month filters, all name/date occurrences, one-off and recurring ICS, February 29 behavior, stable identifiers, Vilnius midnight/DST and independent 2027–2029 weekdays. It also ran the actual Ruby generator repeatedly offline for all 13 pages and 366 ICS files. These results are in `evidence/full-tests-first.txt`; they are not a new claim that each interaction was clicked on every live URL.

Browser interactions, responsive layout and production HTTP checks belong to the release verifier. Their pending status must be resolved from actual deployment evidence, not inferred from this source review.
