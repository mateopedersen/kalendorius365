# Pre-deployment release validation

Date: 2026-10-17. Status: **local release build and recorded pre-deploy checks passed; final production verification is not certified by this document.** The final deployment report must supply actual live URLs, response evidence and browser outcomes.

## Executed evidence

| Gate | Observed result | Artifact |
|---|---|---|
| Release generation/Jekyll build | 186 canonical HTML pages; 4,174 static files; `release=true` | `evidence/build-release.txt` |
| Release static audit | 187 HTML files including 404, 186 canonical landing pages, 24,001 local targets, zero broken links | `evidence/release-audit.txt` |
| Semantics and metadata | Unique metadata, one H1, Lithuanian language, canonicals, image attributes, OG/Twitter metadata, valid JSON-LD and 360 monthly mappings passed the release audit | `evidence/release-audit.txt` |
| Release indexing configuration | 186 sitemap canonicals; 404 intentionally `noindex`; no global noindex header | `evidence/release-audit.txt` |
| Earlier full executed suite | 151 Node tests passed, zero failed; related Python/Ruby gates are also present in the log | `evidence/full-tests-first.txt` |
| Independent content cross-review | 62 + 61 + 63 = 186 unique routes; follow-up corrections verified in local output | [QA_PASS_2.md](QA_PASS_2.md) and its JSON evidence |
| Duplicate screening | All 17,205 pairs; zero exact main-text or duplicate title/description/canonical groups; all 186 routes preserved | `evidence/duplicates/qa1/summary.json` |
| Existing URL variations | 1,109 observed variations; permanent 301/308 redirects or tracking-query canonicals; all target HTTP 200s corroborated in the supplied earlier live evidence | `evidence/duplicates/qa1/variants-reviewed.json` |
| Download protection | 1,203 PDF/WebP/SVG files unchanged; 36 changed holiday ICS files retain UID/date identity | `print-protection-independent-qa.json` |

The earlier full-suite and crawl artifacts are point-in-time observations. They must not be described as a new complete test execution after every subsequent editorial follow-up. In particular, the QA1 local crawl initially retained the older homepage metadata; the latest generated HTML was checked separately for the corrected 2027–2029 scope. The coordinator reruns the crawler for final output.

## Build-policy isolation

The preview-policy integration used an isolated repository copy, excluding `.git` and `public`; its context records `root_source_not_modified=true`. Saved preview-page assertions verify `noindex, follow`, keeping previews out of search. This expected preview behavior must remain distinct from the release policy. The coordinator owns the completed main-vs-preview integration result and final production headers; the existence of preview assertion files alone does not prove all deployment contexts passed.

Lunar release preservation passed: all 146 downloads match both preflight passes and all 832 original assets remained unchanged. The twelve monthly holiday guide preservation gate also passed. The narrow editorial data allowance is versioned in `holiday-editorial-v1.json`; no baseline replacement or blanket asset exemption was used.

## Final production acceptance evidence required

After deploying the intended commit, reacquire every canonical URL, robots.txt and sitemap, check HTML and HTTP noindex directives, self-canonicals and links, and record actual response hashes/headers. Recheck observed URL variants and their final targets without redirect chains. Rerun the duplicate script with fresh second-round evidence; it must not relabel a QA1 crawl as QA2. Browser results must identify which viewports/interactions were actually inspected.

The publication status, final commit/deployment identity and verified live URLs belong to the coordinator's final release verification. Technical eligibility is distinct from confirmed Google indexing, which is not guaranteed without search-engine evidence. Search Console, traffic and backlink inventories were unavailable in this audit.

Evidence bundle: `/Users/melihozcan/Documents/Codex/2026-10-17/sitewide-lithuanian-seo-audit/`.
