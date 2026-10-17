# Automation and regeneration evidence

Date: 2026-10-17. These are executed offline/isolation tests and local build observations. Fixture dates are explicitly **not** real future API publications. This audit did not change the daily schedule, API credentials, provider-fetch behavior or accepted source dates/licenses.

## Horoscope publication survives regeneration

| Executed check | Result | Saved evidence |
|---|---|---|
| Calculation fetch/editorial/publish suite | 15 tests passed | `horoscope-offline-tests.txt` |
| Current dataset, checksum tampering, DST and false-human-review protection | 7 tests passed | `horoscope-data-tests.txt` |
| Actual ascendant engine boundaries, numeric results and Vilnius clock changes | 16 tests passed | `ascendant-tests.txt` |
| Actual Ruby page generators for isolated publications dated 2026-10-18 and 2027-01-01 | Each produced hub + 12 details; all 12 profiles retained; real daily dataset not modified | `horoscope-isolated-ruby-test.json` |
| Next-day and spring clock-change copy fixtures, 2026-10-18 and 2027-03-28 | Each generated and validated 12 forecasts under engine v1.1 | `horoscope-next-day-fixture-results.json` and two explicitly named fixture files |

The generation checks assert the corrected lowercase inline date ranges, complete Moon-topic sentences, decimal-comma display, metadata punctuation, calculator/profile presence and methodology links. The current corrected content checksum is:

`3ae9878de56be504fd8245d05cbb31ac0fbbae77f0c834c69dbbc110c7867a14`

The source response hashes, sign/house/aspect inputs, provider, source licensing and content date were preserved. The new engine label records a real editorial-generator change: `original-lithuanian-calculation-copy-v1.1`.

Both calculation fixtures intentionally use identical substantive input, so their content checksums match. Removing randomized safety filler means a date change alone no longer manufactures different prose. Real publication still uses that day's actual provider calculations. No fixture result is described as an observed future provider response.

## Other generated families

- **Holiday detail/months:** isolated generation retained all 31 detail guides, 12 monthly guides, 126 monthly event records and ICS date/UID identities. Abbreviation-safe summaries preserve complete text after `šv.` and `2016 m.`. The narrow 17-path editorial JSON allowance reproduces the original hash when its exact text changes are reversed; 17 related tests passed.
- **Namedays:** the recorded actual Ruby regeneration test retains 13 routes and all 366 ICS files through repeated offline builds. The accepted source snapshot is not reacquired on every build.
- **Astronomy:** 50 existing targeted tests and four copy regressions passed. Stored event instants and calculation engines were retained. Lunar HTML language/semantic checks passed for all 41 lunar/phase routes in the release build.
- **Full release:** `evidence/build-release.txt` records **186 canonical HTML pages and 4,174 static files**. Its preservation gates passed: all 146 lunar downloads match both preflight passes, all 832 original lunar assets unchanged, and the twelve-guide holiday preservation check passed.

The specialist counts above overlap the full test suite; they must not be added together as a count of distinct tests. `evidence/full-tests-first.txt` separately records 151 Node tests passing at that earlier checkpoint. Later editorial follow-ups were checked in rebuilt HTML; the final release verifier owns the final-suite/deployment status.

## Re-run after deployment

Rebuild from the corrected generators, run the repository's release audit and tests, acquire a fresh live crawl, then run `scripts/sitewide_audit/duplicates.py` with that crawl and its URL-variation evidence. Use `--qa-round 2` only with new second-round production observations. The script refuses to relabel a `qa1` acquisition as QA2 and never treats local file existence as an HTTP response.

Scheduling a future job is different from observing it run. These tests demonstrate generation behavior and preservation; they do not assert that tomorrow's scheduled GitHub job or Cloudflare deployment has already succeeded.
