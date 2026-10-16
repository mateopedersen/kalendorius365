# Horoscope content and quality policy

## Content origin

1. Each publication contains one complete set for all twelve Western tropical zodiac signs for the same Lithuanian date.
2. AstroWay is used only for date-bound calculation fields (date, transits, aspects and events). Provider horoscope prose is not requested, copied, translated or retained.
3. A local deterministic rule set creates the Lithuanian copy. The Sun's house selects the main theme; the Moon's house adds a variable focus; the closest calculated aspect supplies symbolic context. This is not a scientifically supported prediction of events.
4. Content is generated automatically and is not proofread daily by a native Lithuanian editor. Every page discloses this. The content is for entertainment and reflection; it does not provide health, legal, investment or financial advice, or promise outcomes.

## Two independent publication gates

**Gate 1 — source data:** HTTP 200, valid JSON, twelve unique sign keys, exact Lithuania date, required calculation fields, consistent provider footer, valid house/aspect ranges and per-response hashes. Unexpected `horoscope` or `sections` prose fields cause rejection.

**Gate 2 — copy and output:** twelve distinct Lithuanian entries, the required genitive form for each sign, Unicode NFC and Lithuanian diacritics, 150–300 words, a cross-sign similarity threshold, and no unsafe HTML, URLs or control characters. The publication validator and Ruby renderer then check canonical URLs, one H1, indexable metadata and sitemap entries.

Automated checks do not substitute for a native-language editor or professional astrologer. If any record or gate fails, the existing public set remains unchanged.
