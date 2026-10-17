# Final hub layout regression

The final public-URL review found that the annual holiday hub embeds the new
month selector in a narrow sidebar. Its viewport-based four-column rule let
card contents extend past that sidebar at desktop widths. A separate narrow
label at the full-width hub was also found at 720 CSS px.

The new selector now chooses columns from the available container width.
Its label track can shrink and wrap, and the hub heading and description
stack. All changes are scoped to the new monthly-guide selectors.

Independent rendered regression: both hubs at 1440, 1024, 720, 390 and 360 CSS
px, with normal and 200% text (20 runs). Every run passed overflow, label
clipping, card containment, Lato availability and twelve-link checks.

All twelve monthly guides were then rechecked at 1440/390/360 CSS px with
normal and 200% text (72 runs), including every filter, search/reset, date
selection, keyboard navigation, print handler, disclosures, calendar cue
separation and automated axe A/AA checks. No assertion or axe violation
remained. Raw results: `browser-hubs.json` and `browser-final-layout.json`.

The existing build fingerprints all interface assets together. Its generated
cache query strings therefore change across the existing HTML pages and
font declarations; no pre-existing source CSS, font binary, PDF or WebP
download was modified. The complete release gate still preserves all 3,152
baseline assets and all 978 original PDF/WebP binaries.
