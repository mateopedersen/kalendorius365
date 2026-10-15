# Phase 4: Lithuanian product and organic-search research

Reviewed: 2026-10-15

## Search intent and product scope

The planner is aimed at people who need to compare possible vacation periods in Lithuania, including the effect of the statutory holiday calendar and their own workweek. Relevant Lithuanian query wording to cover naturally includes “atostogų planavimas 2027”, “atostogų dienų skaičiuoklė”, “kada geriausia atostogauti”, and “ilgieji savaitgaliai 2027”. These are content hypotheses based on the tool's use case and reviewed local pages; no keyword-volume or ranking claims are made.

Existing Lithuanian pages already offer vacation planning, holiday calendars, long-weekend information, workday counts, or a leave-day optimizer:

- [Atostogų Planas: 2027 calendar](https://atostoguplanas.lt/kalendorius/2027)
- [Skaičiuoklė24: 2027 calendar](https://www.skaiciuokle24.lt/kalendorius-2027)
- [Kiekliko: vacation optimizer](https://kiekliko.lt/lt/atostogu-optimizatorius/2027)
- [Calendar.lt: working-time calendar](https://www.calendar.lt/darbo-laiko-kalendorius/2027)

The reviewed feature direction for Kalendorius365 is to make the comparison inspectable: configurable workdays, booked leave, optional rest dates and blocked dates; a deterministic comparison of one long interval versus multiple separated intervals; an annotated day-by-day breakdown; and local-only storage of the visitor's settings. This is a product-design distinction, not a claim that other sites lack any particular feature.

## Crawlable content

The planner has its own short path at `/atostogu-planavimas/`, unique Lithuanian title/description, canonical URL, static explanatory copy, visible FAQ, and links to relevant 2027 calendar, holiday, workday, and privacy pages. It is in the site's generated internal search index and shared footer. On a release build, all canonical landing pages are indexable, the 404 remains `noindex`, and the sitemap contains the canonical pages and the existing 240 monthly WebP image entries. Preview output remains `noindex`.

Each public page is expected to answer a distinct calendar or planning intent; the existing monthly, annual, holiday, blank-template, school-break, workday, and tool pages remain in place. The planner does not create thin year/month parameter pages or duplicate URLs. Organic visibility is not guaranteed by technical indexability, and search demand has not been quantified.

