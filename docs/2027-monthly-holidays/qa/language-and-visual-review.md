# Two-pass language, typography and visual review

Review date: 2026-10-17. Reviewer: Codex AI. No independent human-native or legal certification is implied.

## Pass 1: source and authoring review

All 126 records were checked for date, weekday, category, Lithuanian names and original short summaries. All 101 legal commemorative titles were compared with the saved official current law. The 16 statutory dates use the existing calendar engine and published 2027 DK edition. Nine additional dates have distinct cultural/international sources; they do not receive statutory status. All twelve H1s, intros, FAQs, 36 spotlight notes, image alternatives and captions were reviewed. Movable dates were calculated and independently compared with Python's calendar and JS UTC weekday checks.

## Pass 2: completed-page review

The full 126-record list and all twelve sets of editorial text were read again after generation. Six awkward constructions using “vienoje datoje” were rewritten as natural Lithuanian sentences. Official legal titles retain their required capitalization, diacritics and punctuation. Month genitives, weekday names, dates, labels, source explanations and download wording were checked in the rendered pages. All 12 original illustration compositions were visually inspected in the contact sheet and in pages; the social captions use Lato with Lithuanian glyph coverage.

The separate browser fixture exercised each guide at 1440, 390 and 360 CSS pixels and at 200% root text size, with measured child viewports. This is text enlargement, not a claim of physical-device testing. Initial failures in unmarked-day contrast and narrow weekday columns were repaired. Date headings use the full card width on mobile. Text-enlarged two-dimensional calendar tables scroll within their panel without widening the page. Category cues and numbers were measured for overlap; long source links wrap. No final fixture failures or automated axe WCAG A/AA violations remain.

Manual review of axe's incomplete findings:

- Existing header search's aria-controls target exists in the DOM and is hidden while suggestions are closed. The mobile search is intentionally closed until the search action opens it; the overlapping/hidden input is not a new visible-text contrast defect.
- Single-digit calendar text and primary gradient buttons were checked using their actual colors: unmarked numbers #5f7063 on #fafbf9; white button labels against the lightest green stop. Neither depends solely on color.
- Native details/summary, normal hrefs and standard buttons retain keyboard behavior. Calendar arrow keys, reset, search with/without diacritics, no-results state, filtered-next selection, two-entry dates, source disclosure, FAQ and the existing print handler were exercised.

The contact sheets are visual-review aids. Original full screenshots and machine results remain in `qa/`. No photographic authenticity, historical crown reconstruction, human proofreading or ranking score is claimed.
