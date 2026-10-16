# Horoscope release runbook

- Workflow: `.github/workflows/horoscope-automation.yml`.
- Schedule: daily 06:20, recovery check 08:20 `Europe/Vilnius`.
- It becomes automatic after merge to `main`; `workflow_dispatch` is an on-demand recovery path.
- No paid LLM, API key, translation model or third-party horoscope prose is used.
- Production verifier: `scripts/horoscopes/verify_live.py`; checks the current publication across thirteen routes.
- Sanitized source proof: `docs/horoscopes/validation/horoscope-source-qa.json`.
- The Cloudflare deployment ID is not available from this checkout; live HTTP verification proves whether the change reached the public routes.

All user-facing horoscope pages are Lithuanian. This automation does not change calendar downloads or working-day tools.
