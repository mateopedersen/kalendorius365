# Calendar editor acceptance evidence — 2026-10-18

## Automated checks

- Full Node suite: **199 passed, 0 failed**, including 17 focused editor tests.
- Editor suite under `Pacific/Honolulu` and `Pacific/Kiritimati`: **17/17 each**.
- Independent Python datetime/calendar oracle covers every day of 2027–2029, ISO boundaries and Gregorian century cases. Statutory holiday fixtures are independent known dates.
- Layout tests cover all supported paper sizes/orientations, modes, compact photos and dense events. Archive tests reject invalid CRC, unsafe paths, oversized/unsupported data; a failed IndexedDB transaction must reject.

## Actual browser output checks

- Twelve original synthetic 3600×2400 photographs, visibly numbered 1–12, were imported, assigned and exported in chronological order.
- Year PDF: 12 A4 pages, 595.28×841.89 points. First/last pages rendered and visually inspected; all 12 Lithuanian month titles extracted.
- PDF/WebP ZIP: CRC passed; 24 entries = 12 matching monthly pairs. Each PDF has one A4 page; every WebP is 2480×3508 pixels.
- Portable project: 12 original photographs and 12 month assignments. All original image SHA256 values match the input files. Two personal records survive import/export.
- Monthly PDF: embedded TrueType fonts; all Lithuanian lowercase/uppercase test glyphs and heart preserved as extractable text. Long text receives a complete appendix.
- One-sheet annual PDF: one A4 page, rendered and inspected.
- EXIF orientation 6: 1200×800 stored image correctly displayed as 800×1200; grayscale/contain PDF rendered and inspected.
- Photo interior in the February PDF rasterized at 300 PPI vs actual WebP: mean absolute RGB channel differences below 0.84/255. Poppler rounds A4 width to 2481; WebP follows rounded physical target 2480. Shared crop/filter appearance verified visually.
- Direct print opened the native print dialog and returned the Lithuanian status. The user cancelled the dialog. Physical paper printing is not claimed. Print document contains only fixed-size calendar sections, embedded fonts and 300 PPI images.

## Browser and accessibility checks

Safari responsive design mode: CSS widths 320, 390, 768 and 1440; screenshots saved outside the repo in the task output folder. At 390, native file upload, keyboard brightness adjustment, photo palette, adding a dated family event and a real PDF download were completed. The tablet native select overflow was corrected and rechecked. Chromium-based in-app browser completed project restoration, import/export, EXIF, unsupported upload, year package and same-day holiday/birthday/vacation flows. Date dialog retains hidden-layer records. Controls have labels and date buttons are keyboard reachable.

These are desktop browser responsive emulations, not physical iOS/Android device tests. No hardware, Lighthouse score, cross-device synchronization or printer color calibration is claimed. RGB exports are for normal home/office printing, without CMYK profiles or bleed.

## Sources and maintenance

See IMPLEMENTATION.md and the visible static guide for source links, review dates and validity. School dates are restricted to ministry-published 2026–2027; later school years require published source updates. Historical and future statutory dates are projections of current rules, not historical legal certification. Optional ICS/CSV import, account synchronization and public sharing are outside this release.
