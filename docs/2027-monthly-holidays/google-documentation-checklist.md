# Google documentation applied to the twelve 2027 holiday guides

Reviewed 2026-10-17, before implementation. These are implementation decisions and observable checks, not ranking, indexing or rich-result guarantees.

| Official Google Search Central page | Applied decision | Evidence |
|---|---|---|
| [Helpful, reliable, people-first content](https://developers.google.com/search/docs/fundamentals/creating-helpful-content) | Lead with dates, legal status, real calendar interactions and source notes; do not invent author credentials or experience. E-E-A-T has no numeric score here. | 126 reviewed records, 36 short monthly focus notes, visible methodology; AI review disclosed. |
| [Search Essentials](https://developers.google.com/search/docs/essentials) | Public HTML, valid response, index/follow, meaningful visible content. | Gate 1 metadata checks; Gate 2 production responses. |
| [Spam policies](https://developers.google.com/search/docs/essentials/spam-policies) | Twelve useful distinct guides, no keyword stuffing or extra annual/monthly doorway pages. | Exact twelve-route allowlist and sitemap gate. |
| [Get started for developers](https://developers.google.com/search/docs/fundamentals/get-started-developers) | Render all dates and navigation in static HTML, then enhance with JavaScript. | Static parser checks every record, date, href and heading. |
| [Crawlable links](https://developers.google.com/search/docs/crawling-indexing/links-crawlable) | Normal anchors for hubs, months, detailed holiday pages and printable calendars. | Build audit checks local targets and fragments. |
| [Google Images](https://developers.google.com/search/docs/appearance/google-images) | Descriptive Lithuanian image alternatives, dimensions, lightweight SVG and small responsive thumbnails. | SVG safety/size checks, image decode checks, media ledger. |
| [Title links](https://developers.google.com/search/docs/appearance/title-link) | Distinct concise Lithuanian H1 and title identify month, year and subject. | Twelve titles/H1s checked for uniqueness and agreement. |
| [Canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) | One self-canonical per guide, included in sitemap; filters do not generate duplicate indexable URLs. | Gate 1, live verification. |
| [Breadcrumb structured data](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb) | Visible four-level path and matching BreadcrumbList. | JSON-LD parser + visible href checks. |
| [Structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies) | CollectionPage/ItemList describes exactly the visible date records; no hidden unsupported claims. | Item count and names match static cards. |
| [Article](https://developers.google.com/search/docs/appearance/structured-data/article) | No fabricated author, credentials, reporting experience or Article rich-result claim. | No Article type added. |
| [Event](https://developers.google.com/search/docs/appearance/structured-data/event) | Statutory dates are not organized events with venues, tickets and programmes. | No Event JSON-LD added; ICS uses transparent all-day calendar entries. |
| [How Search works](https://developers.google.com/search/docs/fundamentals/how-search-works) | Make discovery/crawling possible; distinguish that from Google's actual indexing choices. | HTTP, robots, canonical and sitemap evidence only. |
| [Visual elements gallery](https://developers.google.com/search/docs/appearance/visual-elements-gallery) | Social OG artwork is not a promise of any Google presentation. | Twelve 1200×630 OG images, tested file references. |

## Limits

Search Console, URL Inspection, Google's Rich Results Test service and real-user field Core Web Vitals were not available as authenticated verification tools for this release. Local structured-data parsing and browser performance observations are reported under their actual method. No claim of guaranteed indexing, ranking, rich results, formal native-human proofreading or legal certification is made.
