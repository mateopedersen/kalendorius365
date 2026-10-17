import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('release policy keeps previews and unidentified Cloudflare branches out of search', () => {
  const out = execFileSync(process.env.K365_RUBY || 'ruby', ['test/build_policy_test.rb'], { encoding: 'utf8' });
  assert.match(out, /3 runs, 10 assertions, 0 failures, 0 errors/);
});

test('duplicate evidence and optional HTML crawler regressions remain truthful offline', () => {
  const out = execFileSync(process.env.K365_PYTHON || 'python3', ['test/test_sitewide_duplicates.py'], {
    encoding: 'utf8', timeout: 60000,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  });
  const result = JSON.parse(out.trim());
  assert.ok(result.testsRun >= 18);
  assert.equal(result.failures, 0);
  assert.equal(result.errors, 0);
  // lxml is optional; unavailable parser checks are reported as skips, never passes.
  assert.equal(result.skipped, result.parser_dependency_available ? 0 : 7);
});
