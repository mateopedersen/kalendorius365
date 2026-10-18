import test from 'node:test';
import assert from 'node:assert/strict';
import {commonScriptFingerprint} from '../scripts/performance_version.mjs';

test('Lighthouse recognizes current content-addressed release URLs and legacy query versions',()=>{
  assert.equal(commonScriptFingerprint('https://kalendorius365.lt/assets/releases/594925b46a5a7c775bc8/common.js'),'594925b46a5a');
  assert.equal(commonScriptFingerprint('https://kalendorius365.lt/assets/common.js?v=f0e1de11c440'),'f0e1de11c440');
  assert.equal(commonScriptFingerprint('https://kalendorius365.lt/assets/app.js?v=f0e1de11c440'),null);
  assert.equal(commonScriptFingerprint('https://kalendorius365.lt/assets/releases/not-a-release/common.js'),null);
  assert.equal(commonScriptFingerprint('invalid'),null);
});
