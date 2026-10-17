# Sources and licenses

## Phase 5 name-day material

Reviewed 17 October 2026. This is a documented reuse implementation, not an
independent legal opinion or a warranty of third-party rights.

* **Authors:** Lithuanian Wikipedia contributors, attributable through each
  original article and its linked history. Every extracted date carries its
  real revision ID, permanent URL, retrieval timestamp and SHA-256 digests.
* **License:** [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
  The Lithuanian project's live Action API `rightsinfo` returned this license
  and the reviewed article footers link to it.
* **Primary terms:** [Wikimedia Terms of Use §7](https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use#7._Licensing_of_Content),
  [content reuse](https://www.mediawiki.org/wiki/Wikimedia_APIs/Content_reuse),
  [CC legal code](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en).
  Article/history URLs implement the attribution method recognized by §7.
* **Changes:** only the name-day section is extracted. HTML/citation numbers
  are removed; Unicode NFC/whitespace normalized; source parenthetical name
  alternatives are split without inventing variants; true within-day
  duplicates removed. Repeated dates for one name are retained.
* **ShareAlike:** `data/namedays/cc-by-sa-4.0/` and the complete downloadable
  `/assets/data/namedays/cc-by-sa-4.0.json`, compact derived dataset, adapted
  name/date lists in HTML, and reused material in ICS descriptions are
  offered under CC BY-SA 4.0. All our rights in the adapted database,
  including applicable database rights, are included. No additional
  contractual restrictions or DRM are applied to these materials.
  This is not an assertion that facts individually require copyright
  permission. The same terms are applied conservatively to the compilation.
* **Separation:** independently authored application code and vector artwork
  remain separate works. This does not remove ShareAlike from the data or
  its adapted presentation. User-visible attribution and a Lithuanian
  license notice are on all thirteen pages and in every exported event.
* **Quality:** community-edited calendar, not a government register.
  Differences against other calendar traditions are recorded as source
  discrepancies, never resolved by importing unlicensed competitor data.

## Supporting Lithuanian orthography reference

[VLKK linguistic name data](https://data.gov.lt/datasets/2664/) is published
by Valstybės duomenų agentūra under CC BY 4.0 (portal verified). It supplies
name forms, not name-day mappings. It is linked as a spelling aid; no VLKK
dataset rows are redistributed in this release and it is not described as
having certified every Wikipedia spelling.

Alphabet order is checked against the primary Lithuanian spelling reference
[Lietuvių kalbos rašyba](https://emokykla.lt/upload/files/2024/07/08/rasyba-2022-1.pdf).
Displayed source spellings are never silently romanized or corrected by
guessing. Accent-insensitive matching is a search convenience only.

## Acquisition and update procedure

Run `python3 scripts/namedays/import_wikipedia.py --cache <operator-cache>`
explicitly. Serial identified requests use maxlag, caching, at least 0.5s
pacing, Retry-After and bounded exponential retries. Ordinary builds and
visitors make **zero Wikipedia requests**. The importer fails on unresolved
dates. Candidate updates must pass both validators and be reviewed in a PR;
the existing snapshot continues to work if updates are delayed.

`scripts/namedays/update_candidate.py` is the explicit on-demand update path.
It compares a new isolated candidate with the committed snapshot and writes
a per-date diff. It never overwrites the accepted snapshot or publishes it.
After source review, copy the candidate into the licensed data directory,
run the full release gates and open a normal pull request. No daily content
publication token or horoscope workflow is changed by this feature.

## Original Phase 5 visuals

Thirteen original repo-native SVG still lifes by Kalendorius365, generated
by `scripts/namedays/artwork.py`. No photographs, portraits, Wikimedia logos,
stock images or third-party botanical artwork are included. Seasonal plants
are decorative motifs; no special folk meaning is claimed. Lato is already
distributed under its existing OFL notice in `site/assets/fonts/`.

Earlier holiday, lunar and zodiac source/license records in `docs/` and
their distributed notices remain in effect and are unchanged.
