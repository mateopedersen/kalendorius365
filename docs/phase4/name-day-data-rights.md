# Phase 4: Lithuanian name-day data and redistribution rights

Reviewed: 2026-10-15

## Findings

1. The Lithuanian Open Data portal's [VLKK linguistic name-data dataset](https://data.gov.lt/datasets/2664/) is published under CC BY 4.0 and contains linguistic information about names. The reviewed dataset version does not provide a reliable calendar mapping from each name to the dates on which it is celebrated, so it cannot power an honest name-day calendar by itself.
2. [Calendar.lt API documentation](https://calendar.lt/api-docs) describes name-day API access that requires an API key. The reviewed public documentation did not establish a redistribution/commercial license for republishing its mappings on Kalendorius365. No key, written permission, API contract, or license was obtained.
3. Public pages at [vardadieniai.lt](https://vardadieniai.lt/) and its date lookup were reviewed as possible references. No explicit redistribution license or verifiable data provenance was established from those pages. Public visibility alone is not permission to copy or republish the dataset.

## Publication decision

No third-party name-day mappings have been copied, scraped, bundled, or published. The `/vardadieniai/` route is deliberately withheld until a complete and current dataset has documented provenance and redistribution rights. This also follows the product requirement that published content pages be useful, accurate, and indexable: the site will not publish a thin or noindex placeholder for a feature that it cannot yet support.

To resume this feature, obtain either a legally redistributable authoritative dataset with documented attribution/version rules or written API terms that explicitly permit the intended public display and caching. Then validate names, Lithuanian diacritics, duplicate-date conventions, update cadence, and 2027–2028 coverage before adding an indexable route.
