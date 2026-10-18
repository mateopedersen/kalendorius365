# Search and indexing automation

The site keeps its existing Cloudflare Pages deployment from main. These checks use only the public production site and need no analytics account, API token, paid service, or visitor data.

## Live health checks

The search-health workflow runs a lightweight check of the homepage, robots.txt, sitemap.xml, and llms.txt every day at 05:17 UTC (08:17 in Vilnius during summer time, 07:17 in winter time). A weekly run at 05:43 UTC also checks every sitemap page, internal anchor target, canonical and robots directive, plus a PDF/WebP pair linked from the February 2028 calendar.

Reports are retained as GitHub Actions artifacts for 14 days. A failed check fails the workflow and records a run summary; notifications depend on the repository user's existing GitHub Actions failure-notification settings. The weekly checker skips query-string links other than a hexadecimal cache-buster so visitor-generated or personal values are never sent in monitoring requests.

Use the workflow's manual daily or weekly run to repeat a check. The first scheduled production run occurs after this workflow is merged into main; the pull-request run covers offline parser and workflow tests.

## IndexNow

The file site/3bf6b349467b58f37983a699ded53f17.txt is the public IndexNow ownership file, and the Pages build publishes the same file at the root of the site. This key is a public verification value, not a secret.

The IndexNow workflow handles ordinary successful pushes to main. The existing daily horoscope publisher pushes with GITHUB_TOKEN, which does not start a second workflow; after its atomic Pages commit, the publisher workflow calls the same notifier directly.

The notifier compares sitemap HTML using title, description, canonical, H1, visible main text and its public links/images. It ignores changes limited to content-addressed script/style URLs, includes only changed public PDF, WebP and ICS files in the download areas, and sends no private or query-string URLs. It verifies the key file and waits up to eight minutes for the changed public content to match the production deployment before submission. If deployment or IndexNow fails, the Actions run fails and sends no unverified batch. HTTP 200 means received; HTTP 202 means key validation is still pending. Neither means indexed.

Cloudflare Crawler Hints was inspected and is off. The repository uses one explicit publication notifier rather than also enabling a second IndexNow source.

## Evidence after merge

After merge, confirm the latest search-health and IndexNow Actions runs are successful, inspect their saved JSON/log output, and check Bing Webmaster Tools → IndexNow Insights for the submitted URL list. The first automatic IndexNow submission will follow a real qualifying content or public download change; the existing site inventory is not resubmitted as a test.
