ZODIAC IMPLEMENTATION

Source generator: lib/zodiac_pages.rb; called from scripts/pages.rb before the daily horoscope generator.
Daily integration: lib/horoscopes_pages.rb. The daily workflow and provider pipeline are unchanged.
Month/day finder: site/assets/zodiac-engine.js. Conventional dates, not an ephemeris.
Progressive enhancement: all twelve profiles and links are present in generated HTML.

Artwork rebuild (optional, not required for Cloudflare):
  python scripts/zodiac/artwork.py       # fontTools and existing full-glyph Lato Bold
  node scripts/zodiac/render-og.cjs      # sharp; NODE_PATH may identify installed library
The original outlined SVG master is stored here; the optimized RGB PNG is deployed.
No external illustrations or photographs are used. Lato retains its existing OFL files.

Tests run by the existing Node test command include the independent Python audit and two real isolated Ruby daily regenerations.
K365_RUBY / K365_PYTHON can select the local project runtimes; K365_QA_TMP can select a writable fixture folder.
No real provider requests, real birth inputs, future publication or actual daily data modification occurs in those tests.

Responsive QA used the available in-app browser with same-origin frames at 360/390/768/1280/1440 CSS pixels and 200% text. Additional browser engines and physical devices were unavailable.
No guarantee of search-engine ranking or native-human language certification is made.
