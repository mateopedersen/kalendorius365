import test from 'node:test';
import assert from 'node:assert/strict';
import {minifyJavaScript, staticImports} from '../scripts/minify_js.mjs';

test('generated modules preserve names, exports, Unicode and public property names', async () => {
  const source = `/*! Test licence */
    export function skaičiuoti(value) { return {rezultatas: value + ' Ąčęėįšųūž'}; }
    export class Calendar { static nameOf() { return skaičiuoti.name; } }
  `;
  const output = minifyJavaScript(source);
  const module = await import('data:text/javascript,' + encodeURIComponent(output));
  assert.deepEqual(module.skaičiuoti('LT'), {rezultatas: 'LT Ąčęėįšųūž'});
  assert.equal(module.Calendar.nameOf(), 'skaičiuoti');
  assert.ok(output.includes('Test licence'));
  assert.ok(output.length < source.length + 300);
});

test('module minification retains versioned lazy import and asset URL strings', () => {
  const output = minifyJavaScript(`export const load = () => import('./engine.js?v=abc123'); export const image = '/assets/moon.webp?v=123abc#moon';`);
  assert.ok(output.includes('./engine.js?v=abc123'));
  assert.ok(output.includes('/assets/moon.webp?v=123abc#moon'));
  assert.ok(output.includes('import('));
});

test('preloads follow static dependencies while leaving intent-driven imports lazy', () => {
  assert.deepEqual(staticImports(`import { Store } from './storage.js?v=123';
import * as cal from './calendar.js?v=123';
export { x } from './shared.js?v=123';
const lazy = () => import('./search-engine.js?v=123');
fetch('/api/location');`), ['./storage.js?v=123','./calendar.js?v=123','./shared.js?v=123']);
});

test('minification does not introduce class static blocks beyond the Safari 15.4 syntax target', () => {
 const output=minifyJavaScript('export class Calendar { value() { return 1; } }');
 assert.doesNotMatch(output, /static\s*\{/);
 assert.ok(output.includes('Calendar'));
});
