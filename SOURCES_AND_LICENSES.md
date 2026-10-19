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

## Homepage weather city photographs

Reviewed 19 October 2026. The homepage weather card uses locally hosted,
city-specific images for every city in the selector. Changing the city also
changes the image. The existing Vilnius illustration is retained; the other
fourteen photos are optimized WebP copies of these Wikimedia Commons files.
The photo author and license link appear below the weather details whenever a
Commons photo is selected.

* **Kaunas:** Pudelek (Marcin Szala, *Kaunas Castle - panorama*),
  [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/),
  [source](https://commons.wikimedia.org/wiki/File:Kaunas_Castle_-_panorama.JPG).
* **Klaipėda:** Mantas Volungevicius, *Quiet summer evening in the port city
  Klaipėda*, [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/),
  [source](https://commons.wikimedia.org/wiki/File:Quite_summer_evening_in_the_port_city_Klaipeda.jpg).
* **Šiauliai:** Modris Putns, *Šiauliai - panoramio (8)*,
  [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/),
  [source](https://commons.wikimedia.org/wiki/File:%C5%A0iauliai_-_panoramio_(8).jpg).
* **Panevėžys:** Scotch Mist, *Senvagė Pond in Panevėžys*,
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/),
  [source](https://commons.wikimedia.org/wiki/File:Senvag%C4%97_Pond_in_Panev%C4%97%C5%BEys,_Lithuania_in_2019.jpg).
* **Alytus:** Vilensija, *White Rose Bridge*,
  [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/),
  [source](https://commons.wikimedia.org/wiki/File:Alytus,_Baltosios_ro%C5%BE%C4%97s_tiltas.JPG).
* **Marijampolė:** Raimundas Budzeika, *Marijampolė - panoramio*,
  [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/),
  [source](https://commons.wikimedia.org/wiki/File:Marijampol%C4%97_-_panoramio.jpg).
* **Mažeikiai:** Algirdas, *Mažeikiai panorama* (public domain),
  [source](https://commons.wikimedia.org/wiki/File:Mazeikiai_panorama_resize.JPG).
* **Jonava:** Pagulbi74, *Jonava Regional Museum*,
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/),
  [source](https://commons.wikimedia.org/wiki/File:Jonava_Regional_Museum_in_Jonava,_Lithuania_in_2014.jpg).
* **Utena:** Kalnuerelis, *Utena city - Real is beautiful*,
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/),
  [source](https://commons.wikimedia.org/wiki/File:Utena_city_-_Real_is_beautiful.jpg).
* **Kėdainiai:** Hugo.arg, *Nevėžis in Kėdainiai* (public domain),
  [source](https://commons.wikimedia.org/wiki/File:Nev%C4%97%C5%BEis_in_K%C4%97dainiai.jpg).
* **Telšiai:** Diliff, *Telšiai Cathedral Exterior*,
  [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/),
  [source](https://commons.wikimedia.org/wiki/File:Tel%C5%A1iai_Cathedral_Exterior,_Tel%C5%A1iai,_Lithuania_-_Diliff.jpg).
* **Ukmergė:** Tocekas, *Ukmergė city*,
  [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/),
  [source](https://commons.wikimedia.org/wiki/File:Ukmerge_city.jpg).
* **Tauragė:** MichalPL, *Tauragė Castle*,
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/),
  [source](https://commons.wikimedia.org/wiki/File:Taurag%C4%97_Castle,_Taurag%C4%97,_Lithuania,_June_2019.jpg).
* **Visaginas:** VietovesLt, *Visaginas, Lithuania - panoramio (197)*,
  [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/),
  [source](https://commons.wikimedia.org/wiki/File:Visaginas,_Lithuania_-_panoramio_(197).jpg).

Each Commons image is resized and encoded as WebP. The card crops the image to
fit its responsive shape; no source image is requested from Wikimedia while a
visitor is using the site. The displayed author, source page, license and
adaptation notice accompany each photo. ShareAlike images retain their
original license terms; no additional restrictions are imposed on those
image files.
