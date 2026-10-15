# Kalendorius365 — Baltic paper / Lato visual system

October 2026 redesign of the existing Ruby/Jekyll product. The repository, Cloudflare Pages project, domain, calendar engine and verified print collection are preserved.

## Package map

- `tokens.json`: implementation tokens, palette, typography and spacing.
- `docs/components.md`: component states and implementation map.
- `docs/asset-prompts.json`: original generation prompts, native sizes and exports.
- `docs/owner-brief.txt`: full approved redesign brief.
- `source/brand/`: scalable light/dark wordmarks and standalone mark. Lato lettering is outlined, so logo rendering does not depend on installed fonts.
- `source/icons/`: 35 original outline SVG icons, 24-unit grid, 1.7-unit strokes.
- `source/lato/`: official Lato source fonts and OFL license.
- `source/generate_assets.py`: optimized asset/font and logo production script, run from repository root with fontTools, Brotli and Pillow installed.
- `source/generate_board.py`: native vector design-board generator, run from repository root with fontTools installed.
- `masters/brand-ui-system-4k.svg`: native 3840 × 2160 scalable design board. All labels are outlined Lato paths.
- `masters/brand-ui-system-4k.png`: actual 3840 × 2160 raster render of that vector board.
- `masters/*-original.png`: five original AI-assisted illustrative scene masters, **1672 × 941 native pixels**. They are not native 4K photographs or documentary images. No artificial resolution claim is made.
- `previews/`: design board, before/after and browser evidence.

## Production assets

`site/assets/visuals/` contains optimized 640/1280-pixel WebP scenes, SVG logos, five weather symbols, the empty-calendar illustration, the woven Lithuanian ribbon and the SVG icon sprite. `site/assets/icons.js` exposes the same custom paths to interactive components. Scene masters stay out of the public build.

Four cultural scenes represent national independence/statehood, Easter, Joninės/Rasos and Kūčios/Christmas. They are original interpretive illustrations. The holiday pages explicitly disclose the generative illustration method. Weather observations come from the existing real-weather endpoint; the atmospheric Vilnius backdrop is labelled as illustration and never substituted for a measurement.

## Build and preservation

Use the established build: `K365_RELEASE=1 ruby scripts/build.rb` in the project's Ruby/Bundler environment. Commit the generated `public/` directory for the existing Cloudflare Pages Git deployment.

Do not regenerate print files merely for a UI redesign. Inter remains intentionally embedded in vector PDF output. The existing manifest fingerprint and preflight gates guard renderer/data/font consistency. Lato WOFF2 files are hosted locally and include Lithuanian characters; no external font request is required.

## Evidence and limitations

See the delivery report and QA JSON in `docs/` and the screenshots in `previews/`. Automated accessibility results are a bounded audit, not a claim of universal conformance. Local performance measurements are unthrottled lab observations, not field Core Web Vitals. School vacation dates remain source-qualified; unconfirmed future school-year dates are not invented.
