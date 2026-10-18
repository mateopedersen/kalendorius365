# Personal calendar editor

Route: `/kurti-kalendoriu/`. Scoped, native browser modules in `site/assets/calendar-editor/`; activated by `calendar_editor: true`. Existing tools and shared date API remain unchanged.

- `lt.js`: central Lithuanian interface, validation and export dictionary, contextual month names, filename forms and weekday labels.
- `model.js`: strict versioned project, 1900–2100 date-only arithmetic, event recurrence with explicit Feb29 policy, current statutory rules, independently toggled layers, custom working week and inclusive leave counts.
- `scene.js`: single point-based layout for SVG preview, vector PDF, raster and print; short complete legends stay on the month page; longer records and notes paginate into appendices. Page sizes are physical millimetres converted to PDF points. Sunday rows show both ISO week numbers where needed.
- `photos.js`: byte-signature/type/size checks, oriented image decoding, retained originals, normalized focal coordinates, rotation and nondestructive filters. Effective PPI is calculated from the cropped original, never inferred from enlarged raster dimensions.
- `storage.js`: transactional IndexedDB projects including blobs; restore prompt, named copies, versioned portable ZIP with embedded originals. Own portable archive format uses ZIP STORE, CRC checks, bounded bytes/counts and a strict filename allowlist. Unsupported compression or versions are rejected without replacing the working project.
- `export.js`: lazy local jsPDF 4.2.1 (MIT, vendored provenance included), real embedded Lato/Inter fonts, vector text/lines and original-derived images. Export takes an immutable state snapshot, processes pages sequentially and checks cancellation at page boundaries. RGB WebP/PNG are created at 300 PPI physical dimensions. No CMYK, bleed, archival-PDF or lossless-WebP claims.
- `editor.js`: Lithuanian controls, six templates, global/month overrides, photos, event CRUD, drafts, undo/redo (slider gestures coalesced), palette extraction, reversible ink-saving mode, explicit leave suggestion application, keyboard and mobile views.

## Source maintenance

Statutory rules remain in `data/calendar.json`. Preserve statutory vs commemorative classification. Do not add substitute Mondays. Historic/future years use current rules and are explicitly labelled projections, not historic legal certification. Official basis: Labour Code article 123, linked in the static guide. Editorial commemorations and source metadata are reduced into `calendar-editor/data.json` to avoid loading the full article catalog.

School data is restricted to the ministry-published 2026–2027 school year; primary/basic and secondary Easter breaks differ. Source and review date are visible in the guide and in editor data. Do not extrapolate unpublished school breaks. When an official new school-year schedule is published, update the authoritative calendar dataset, editor metadata and independent fixtures together, then rebuild and audit the site.

## Validation

`node --test test/calendar-editor.test.js` compares every date in 2027–2029 and Gregorian century boundaries with committed Python `datetime`/`calendar` fixtures, plus recurrence, layout, overflow retention, layers, leave and archive validation. Run the full existing suite after the release build. Real browser-created PDF/WebP/ZIP files and device checks are recorded separately in the delivery report; unit tests alone do not establish visual/export correctness.

Lato and Inter retain their existing SIL OFL distribution. jsPDF's UMD distribution must remain byte-for-byte intact in the minifier; its filename includes the pinned version. All rendering and project data stay in the browser; external links are informational sources only.
