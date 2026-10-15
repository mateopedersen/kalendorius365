# Implemented components

## Typography and identity

Lato 400 for body/control text, 700 for labels/actions, 900 for page and widget headings. Base 15px; large-text preference 17px. Body line height 1.5, prose 1.65. Native UI elements inherit Lato. Print SVG/PDF uses Inter deliberately. The custom wordmark combines a calendar/check symbol, a restrained Lithuanian tricolour edge and an outlined Lato wordmark. Dark mode has a brighter green wordmark and light text.

## Button family

| Variant | Implementation | Behaviour |
| --- | --- | --- |
| Primary | `.primary` | Green surface, white text; darker hover; visible focus ring |
| Secondary | base `button`, `.button` | Paper surface, subtle border, stronger hover |
| Ghost / icon | `.icon-button` | Compact quiet surface with custom outline icon |
| Destructive | `.danger` | Red action treatment in deletion controls |
| Success | selected / checked states | Green checkmark and confirmed state |
| Filter chip | `.category-chips button`, `.design-filters button` | `aria-pressed`; selected tinted surface; inactive dashed border; no opacity-based text contrast loss |
| Segmented | calendar views, design filters | Current selection has filled green state |
| Download | PDF/WebP anchors | Real manifest file targets; file-type icon; no placeholder |
| Print/export | print buttons | Custom print/download symbols and clear Lithuanian text |

Buttons retain disabled and keyboard focus semantics. Mobile navigation and principal controls use enlarged touch areas. Hover is never the only indication of state. Reduced-motion preference suppresses decorative transitions.

## Panels and page map

| Page | Implementation |
| --- | --- |
| Homepage | `site/index.html`, `app.js`, `weather.js`: three-column calendar, integrated clock/weather illustration, category controls, agenda, lined notes, tasks and metrics |
| 24 months | `lib/visual_design.rb`, `page_designs.rb`: framed previews, 5 BW / 5 colour filter, typography/style labels, visible PDF/WebP choices |
| 2 years | 12-month paper overview, metrics, annual collection and selectors |
| Blank library | purpose-oriented introductory cards, category filters, original print previews |
| Holiday years | readable official data table plus four original cultural image stories |
| Workday years | clear 5/6-day selector, totals, shortened-day data and export controls |
| School vacations | source notice, readable table and learning planners |
| Builder | grouped period/design/content controls, print settings and preview |
| Calculator / tools / ISO | calm form hierarchy, result blocks and responsive tables |
| Global | shared header, native SVG logo, search, footer, mobile bottom navigation, theme/large text/high contrast |

The visual layer is `site/assets/design-system.css`, loaded after the preserved base layout rules. `lib/visual_design.rb` adds presentation without replacing calendar logic. Wide tables expose labelled keyboard-focusable scroll regions. Theme preferences apply before first paint to avoid flashing light colours in dark mode.

## Asset dimensions and loading

The atmosphere/holiday sources are 1672 × 941 native pixels; production derivatives are 640 and 1280 pixels wide. Width/height reserve image space and `srcset` selects the appropriate size. Holiday scenes are lazy loaded. The 4K board is a genuine 3840 × 2160 vector composition and raster export, not a 4K claim for the scene masters. All logos/icons/motifs are vector. UI fonts are locally served WOFF2 subsets with Lithuanian glyph coverage.

The static print library remains 276 genuine PDF/WebP pairs. PDF raster objects remain absent; the 600-PPI raster criterion is therefore not applicable inside those vector PDFs. High-resolution WebP dimensions remain 4961 × 7016 or 7016 × 4961. Browser-generated custom calendars use the print dialog for PDF and a true 600-PPI-size canvas for WebP; this is explicitly distinguished in the UI.
