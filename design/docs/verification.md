# Release verification — local gate

- 41 canonical pages: actual 360 and 1440 CSS-pixel viewport checks, 82 passing results; one H1, Lato and no document overflow.
- 11 principal routes at 360 / 390 / 768 / 1024 / 1440 / 1920: 66 responsive checks.
- Axe WCAG A/AA checks: 11 routes in desktop light, desktop dark and mobile light; 33 runs, zero reported violations after fixes. Font loading and homepage initialization are awaited. Some automated rules remain manual-review candidates; this is not a blanket accessibility certification.
- 13 unit tests pass, including Ruby/JS parity, DST, storage, ICS and weather behaviour.
- 731 independently checked dates; 276 vector-first embedded-font PDFs and 276 600-PPI-size WebPs; existing SHA256 manifest matches. Renderer, calendar data and embedded print fonts unchanged.
- Actual browser PDF and WebP downloads match generated SHA256. Custom generator WebP exported at 4961 × 7016 and visually inspected with Lithuanian glyphs.
- Three Lato WOFF2 weights contain every uppercase/lowercase Lithuanian accented glyph.
- Event creation/edit/deletion, category layer synchronization, notes/task persistence, workweek switching, leap-day calculator, desktop/mobile search and menu Escape behaviour checked interactively.
- 42 HTML files (including 404), 41 canonical pages, all local targets, sitemap and release indexing audited.
- Local unthrottled performance samples: home LCP 92ms, CLS 0.0383; February page LCP 196ms, CLS 0.0016. These are local lab readings, not live field metrics or cross-device guarantees.

Detailed records are adjacent JSON/text files. Screenshots are in `../previews/`. Production deployment and fresh live-file verification are recorded in the user-facing delivery report after publishing.
