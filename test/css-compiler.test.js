import test from 'node:test';
import assert from 'node:assert/strict';
import {minifyCSS} from '../scripts/minify_css.mjs';

test('CSS compilation preserves calc whitespace, variables, media and global selector names',()=>{
  const output=minifyCSS('/*! Test licence */ :root { --gap: 2rem; } .used { width: calc(100vw - 2rem); gap: var(--gap); } @media print { .used { color: black; } }');
  assert.ok(output.includes('Test licence'));
  assert.match(output,/calc\(100vw - 2rem\)/);
  assert.match(output,/var\(--gap\)/);
  assert.match(output,/@media print/);
  assert.match(output,/\.used/);
});

test('CSS strings, Lithuanian text and fragment-bearing asset URLs survive minification',()=>{
  const output=minifyCSS('.label::after { content: "Ąą Čč Ęę Ėė Įį Šš Ųų Ūū Žž"; } .image { mask: url("/assets/icons.svg?v=abc123#calendar"); }');
  assert.ok(output.includes('Ąą Čč Ęę Ėė Įį Šš Ųų Ūū Žž'));
  assert.ok(output.includes('/assets/icons.svg?v=abc123#calendar'));
});
