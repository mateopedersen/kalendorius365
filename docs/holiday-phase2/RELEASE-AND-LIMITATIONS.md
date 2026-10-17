# Phase 2 release record

This record describes the implementation and pre-publication acceptance evidence. Actual production deployment identifiers and URL checks are recorded in the delivery report after Cloudflare publishes the merged revision.

## Scope

- Sixteen existing detail URLs retained and upgraded; fifteen new detail guides.
- Existing monthly, annual, lunar, weather, search, horoscope, ascendant and personal-calendar infrastructure preserved.
- Thirty-one authenticated image records with original Commons links and visible attribution. Fifteen existing photographic subjects retained; sixteen new subjects/derivatives selected, including authentic documentary reproductions. No fabricated historical image or stock-library substitution.
- Thirty-one supporting SVG vignettes and one five-symbol SVG control sprite (32 SVG files); 43 new responsive WebPs; no external image hotlink.
- Ninety-three ICS calendars, containing ninety-nine distinct all-day events across 2027–2029. No claimed direct write into Google or Outlook accounts.
- All 978 existing PDF/WebP downloads remain byte-identical. No new print-calendar generation.

## Review boundaries

Two different verification methods are used: independent static/date/binary checks and browser geometry/interaction review. Language and visual review are by AI. This is not an independent human, legal or rights-holder certification, and no ranking, rich-result eligibility or field-performance guarantee is claimed.

Commons file pages, current license metadata, exact revisions and original binary hashes were independently checked twice. Some source institutions and legal registries block automated readers (403); these restrictions are recorded in `source-evidence`, and are not represented as missing pages or silently bypassed. Existing independently saved official law text and readable primary-source search records support the legal/history review. Metadata and photographic licenses are evidence, not a warranty against every possible third-party claim.

Family photographs for Mother's and Father's Day are contextual, with their non-Lithuanian or unassigned location stated explicitly. Historical photographs and reproductions are dated; no old photograph is described as a current holiday event.

The in-app browser reports a 0.5 device pixel ratio on localhost/canonical URLs. Exact CSS widths 1440, 1280, 768, 390 and 360 are therefore tested with same-origin browser frames; 200% root text is tested at 768, 390 and 360. Measurements record the actual CSS document width. This is a browser-engine reflow test, not a physical phone-device certification.

## Rollback

Revert the Phase 2 merge only, then let the existing GitHub/Cloudflare pipeline redeploy baseline `fd3de337d7832d719a059fea1222e2200ecfa4fc` or the appropriate subsequent safe main revision. Do not force-push or rewrite history.

## Acceptance results

55 Node tests; 20,230 local destinations; 248 responsive/text-scale cases; 93 browser year selections including keyboard activation; 31 independently rechecked image source/license records. All passed. The 122 non-target canonical pages retain identical DOM content after cache-version normalization. Local warm-cache lab observations are recorded in QA2-BROWSER-REVIEW.json (31 available LCP observations out of 31, 68 ms median, 104 ms maximum; CLS maximum 0.00221). These are not field or throttled-mobile results.

The existing sixteen planner-prefill actions and page-print action are retained. New guides provide an actual ICS download and print action. New ICS directories are marked binary in .gitattributes so RFC-required CRLF survives Git checkouts.

## Final live interaction finding

The initial production release exposed a pre-existing prefill bug: the compact home metadata omitted title/category values consumed by the event form. The follow-up restores those original fields for all sixteen records and versions the request to avoid a cached incomplete payload. All sixteen local form prefills were checked without saving any event. The preservation gates validate the exact original identifiers/date fields and restored title/category values; every other old source asset and all 978 binary downloads remain unchanged. Production confirmation is saved in the final delivery report.
