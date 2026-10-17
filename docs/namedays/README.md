# Phase 5 release evidence

Reviewed 2026-10-17. Baseline production commit:
`b9320b0ef70ee0a1308dc091241f4503b1ef5fb0`.

## Scope and data

13 pre-rendered pages: `/vardadieniai/` and the twelve Lithuanian month
directories. No thin per-name or per-day landing pages were added.
366 unique source articles downloaded through the identified, serial Action
API importer; 366 real revisions, 366 nonempty date records, 2,374 unique
names, 3,161 name/date occurrences, 534 names with more than one date.
January 1 retains both source lists (11 names); February 29 has Gustis and
Tolvaldas. The largest day list has 27 names.

`DATE_SOURCE_QA.csv` maps every date to source, revision, extraction hash,
transformations, licensing notice and the two browser rounds.
`source-sample-60.json` records five sampled dates in every month, including
January 1, February 29 and December 31. All 60 immutable wikitext reads agree
with the HTML extraction. The second public calendar matches 23 samples
exactly; 37 have reviewed tradition/list differences. No second-source
names were imported. There are no source-coverage gaps. This establishes
faithful source coverage, not a government-certified name-day register or
a professional legal clearance.

## Functional and visual gates

* Original hero and 12 distinct seasonal botanical SVGs, real Lato glyphs,
  outlined 1200×630 social artwork. No licensed-photo dependencies.
* Native and accentless name lookup, partial search, full Lithuanian alphabet,
  month filters, complete multiple-date results, explicit occurrence choice.
* Europe/Vilnius today/tomorrow/seven-day display; midnight, year rollover,
  DST and 2027–2029 weekday tests independent of the visitor's timezone.
* One-off and annual all-day ICS, personal browser-only calendar integration,
  duplicate prevention, unchanged JSON backup schema. Leap-day recurrence
  remains on February 29 and skips non-leap years.
* 366 static annual ICS files checked with Python `icalendar` and `dateutil`;
  actual browser-downloaded per-name leap-day and all-name one-off files
  independently parsed as well.
* Round 1: 13×4 = 52 layout/axe states. Round 2: 13×4 = 52 independent
  interaction/form states. CSS viewport widths: 1440, 768, 390 and 360.
  No final measured horizontal overflow, clipped text or automated axe
  violations. Two 200% text samples and a 27-name mobile list also passed.
* 16 regression states on the existing home, Gemini, 2029 May and sun pages,
  including the 1761px header breakpoint. No header overflow or clipped
  labels. All tests used the available in-app browser; responsive states
  used real same-origin CSS-width frames. This is not a claim of testing
  physical devices or multiple browser engines.
* Keyboard Tab reaches the month filter from search. Calendar date selection
  retains stable links; an initial DOM replacement/focus defect was fixed.
  A prepared file remains available as an explicit download link for browsers
  that do not start an automatic download.

Automated checks cover the source importer, the actual Ruby generator through
two isolated offline regenerations, calendar arithmetic, every native name
and its search forms, every exported date, source boundaries, XSS-safe text
handling, and existing site functionality. The main Node runner reports
141 passing tests, with no failures; existing horoscope Python checks also
pass (7 validator checks and 12 pipeline checks).

`preservation.json`: two SHA-256 comparisons against the baseline preserve
all 6,474 selected files, including existing PDF/WebP files and workflow
files. No existing download bytes or GitHub workflow files changed.

## Licensing and updates

See root `SOURCES_AND_LICENSES.md`, the isolated licensed source snapshot,
the visible notices on all thirteen pages, and the downloadable adapted
JSON dataset. Specific article/revision/history attribution is retained.
The live project rights API confirms CC BY-SA 4.0. VLKK is a separate linked
CC BY 4.0 spelling reference, not a source of name-to-date mappings.

Ordinary builds are offline. Accepted source snapshots cannot be overwritten
by an incomplete or changed importer result. `update_candidate.py` explicitly
acquires an isolated candidate and writes a review diff; review it and open a
normal PR before accepting an update. Delayed updates do not stop the daily
clock-based tool. Existing daily horoscope automation is unchanged.

## Publication checks

`scripts/namedays/check_live.py` checks all thirteen real pages plus all new
distributed data, SVG/PNG, JavaScript/CSS and 366 ICS assets. Full-site release
verification additionally checks existing canonical pages and downloads.
The final external report records the actual PR, merge, Cloudflare deployment
and production results; this local evidence file does not claim deployment
success before those checks have run.
