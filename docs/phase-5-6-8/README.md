# Phase 5, 6 and 8 delivery index

This directory records the Lithuanian workforce/school planning tools (Phase 5), Lithuania-focused sun and lunar data (Phase 6), and 2029 plus reusable printable collections (Phase 8). Public UI copy remains Lithuanian. The project keeps the existing Ruby/Jekyll build and GitHub → Cloudflare Pages delivery path.

## Public route mapping

Every route below is represented separately in [`PUBLIC-PAGE-MANIFEST.json`](PUBLIC-PAGE-MANIFEST.json), together with its title, description, H1, canonical, index directive, HTML links, media and sitemap membership.

### Phase 5 — work and school

- [Shift-cycle planner](https://kalendorius365.lt/pamainu-grafikas/) — rotating/custom shifts, month/week/year summaries, rest reminders, local backup and ICS.
- [Lesson timetable and homework planner](https://kalendorius365.lt/pamoku-tvarkarastis/) — editable weekly lessons and private local homework data.
- [Printable lesson-timetable templates](https://kalendorius365.lt/pamoku-tvarkarascio-sablonai/).
- [Printable shift-schedule templates](https://kalendorius365.lt/darbo-grafiko-sablonai/).
- The existing [annual-leave planner](https://kalendorius365.lt/atostogu-planavimas/) remains part of the baseline; it is not counted as new Phase 5 work here.

### Phase 6 — sun and Moon

- [Sunrise, sunset and daylight](https://kalendorius365.lt/saule/) — five supported city-centre coordinate sets and Europe/Vilnius time.
- [Moon phases](https://kalendorius365.lt/menulio-fazes/).
- [Moon calendars: 2027](https://kalendorius365.lt/menulio-kalendorius/2027/), [2028](https://kalendorius365.lt/menulio-kalendorius/2028/) and [2029](https://kalendorius365.lt/menulio-kalendorius/2029/).
- [Astronomy hub](https://kalendorius365.lt/astronominis-kalendorius/) links the related tools and date information.

### Phase 8 — 2029 and reusable printables

- [2029 year calendar](https://kalendorius365.lt/2029/), [statutory holidays](https://kalendorius365.lt/sventes/2029/), [workdays](https://kalendorius365.lt/darbo-dienos/2029/) and [ISO weeks](https://kalendorius365.lt/savaites/2029/).
- Monthly pages: [January](https://kalendorius365.lt/2029/sausis/), [February](https://kalendorius365.lt/2029/vasaris/), [March](https://kalendorius365.lt/2029/kovas/), [April](https://kalendorius365.lt/2029/balandis/), [May](https://kalendorius365.lt/2029/geguze/), [June](https://kalendorius365.lt/2029/birzelis/), [July](https://kalendorius365.lt/2029/liepa/), [August](https://kalendorius365.lt/2029/rugpjutis/), [September](https://kalendorius365.lt/2029/rugsejis/), [October](https://kalendorius365.lt/2029/spalis/), [November](https://kalendorius365.lt/2029/lapkritis/) and [December](https://kalendorius365.lt/2029/gruodis/).
- Reusable [weekly](https://kalendorius365.lt/savaitiniai-planuokliai/), [daily](https://kalendorius365.lt/dienos-planuoklis/) and [family](https://kalendorius365.lt/seimos-kalendorius/) planners.

## Printed-file inventory

`ASSET-MANIFEST.json` covers all 416 manifest entries and all 832 downloadable files. The collection contains 360 monthly, 30 annual and 26 blank designs; each has a PDF and matching WebP, with 416 preview derivatives. The 2029 addition is 140 design pairs (120 monthly, 10 annual and 10 blank planner templates), i.e. 280 new download files.

`PRINT-PREFLIGHT.json` contains the file-level machine report. `docs/print-preflight.json` passed for all 416 pairs; 12 representative samples separately passed the visual review gate, including the required 2027 January color and 2028 February monochrome designs. PDF vectors have selectable text, embedded Inter weights, A4 page/trim boxes and no placed raster elements. WebPs are measured at 600 PPI or slightly above. Color PDFs are RGB; no CMYK or PDF/X claim is made. Not every one of the 416 layouts was visually inspected individually.

## Privacy, law and update notes

Personal schedule, class and homework entries remain in local browser storage. The tools are planning aids, not legal, payroll or school-compliance determinations. School-year periods not confirmed by an official source remain unpublished. The source register records inaccessible consolidated legal pages and update triggers. No Google Search Console submissions, indexing requests, ranking campaigns, advertising, accounts, cloud sync, PWA or astrology were introduced.

## Release evidence

See `PASS1_REPORT.json`, `PASS2_INDEPENDENT_REPORT.json`, `DEPLOYMENT-AND-ROLLBACK.md` and `FINAL_STATUS.md`. A local build or preview is not proof of a live release; live statuses in the route manifest must only be filled from post-deployment requests.
