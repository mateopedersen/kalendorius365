# Lithuanian copy and terminology audit

## Scope and method

Public routes are pre-rendered in Lithuanian and declare `lang="lt"`. The release audit checked unique page titles and H1s, descriptions, one canonical URL, UTF-8 HTML, image alt attributes, and internal links. Feature tests also exercise date and duration strings, Lithuanian characters, user-entered text safety and accessible control names in representative browser flows. This is a technical and product-copy review, not a certified linguistic review.

## Terminology decisions

- Shift tools use *pamainų grafikas*, *dieninė pamaina*, *naktinė pamaina*, *poilsio laikas* and *dirbtos valandos*. Totals are labelled as schedule estimates; the tool does not rule a rota lawful or calculate payroll.
- School tools use *pamokų tvarkaraštis*, *pamoka*, *dalykas* and *namų darbai*. Lesson times are configurable; the interface does not assume one universal lesson duration or claim state certification.
- Sun data uses *saulėtekis*, *saulėlydis*, *saulės vidurdienis* and *dienos ilgumas*. Moon data uses *jaunatis*, *priešpilnis*, *pilnatis* and *delčia*; event instants are converted from UTC to Europe/Vilnius.
- Calendar titles use the genitive month forms required by Lithuanian constructions, e.g. *2029 m. sausio kalendorius*, *2029 m. gegužės kalendorius* and *2029 m. rugsėjo kalendorius*. ASCII slugs remain stable.
- Informational commemorations are not counted as statutory days off. Future school dates not established by an official publication are marked unconfirmed instead of guessed.

## Glyph and collision evidence

- Locally served Lato regular/bold/black assets and the Inter print fonts are documented in `SOURCES_REGISTER.md` and their licenses remain in the repository.
- PDF preflight extracts embedded fonts and checks date glyph placements. The full 416-file run found embedded Inter regular/bold, no placed raster images, and no date-placement failures. The required Lithuanian glyph samples were visually inspected in representative print proofs.
- Responsive UI checks covered representative desktop, tablet and mobile routes; the complete prior matrix recorded 80 route/width checks at 320, 360, 390, 430, 768, 1024, 1280 and 1536 CSS pixels, with no document-width overflow. All 29 new routes were opened locally to inspect rendered title/H1/canonical/content. A later attempt to set the browser to 1440 CSS pixels did not apply to the selected preview tab, so it is not counted as a verified 1440-pixel check. Browser zoom at 200% was not independently re-established in this session and must not be represented as passed here.
- Twelve print compositions were inspected together in the saved sample sheet. Individual visual inspection of all 416 outputs and a physical printer proof were not performed.

## Editorial limitation

No independent Lithuanian native-speaker editor signed off this release. The copy is Lithuanian and was checked against the project's terminology, route metadata, source register and user-facing rendered strings, but that does not equal external linguistic certification. Re-review copy after changes to law, education terminology or official naming.
