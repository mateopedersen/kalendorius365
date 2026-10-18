import {transformSync} from 'esbuild';
import {readdir, readFile, writeFile} from 'node:fs/promises';
import {resolve, relative} from 'node:path';
import {pathToFileURL} from 'node:url';

// Each module retains its exports, import boundaries, property names and legal
// notices. Source files remain readable; only generated browser assets change.
export function minifyJavaScript(source, filename = 'module.js') {
  return transformSync(source, {
    sourcefile: filename, loader: 'js', target: 'es2022', format: 'esm',
    minify: true, keepNames: true, treeShaking: false, legalComments: 'inline',
    charset: 'utf8',
  }).code;
}

async function build(directory) {
  const rows = [];
  async function visit(dir) {
    for (const entry of (await readdir(dir, {withFileTypes: true})).sort((a,b)=>a.name.localeCompare(b.name, 'en'))) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.name.endsWith('.js')) {
        const name = relative(directory, path).replaceAll('\\', '/');
        const source = await readFile(path, 'utf8');
        // The upstream MIT astronomy distribution is already minified. Preserve
        // its exact vendor code and full licence header.
        const result = name === 'lunar/astronomy-engine.js' ? source : minifyJavaScript(source, name);
        await writeFile(path, result);
        rows.push({path: '/assets/' + name, source_bytes: Buffer.byteLength(source), generated_bytes: Buffer.byteLength(result)});
      }
    }
  }
  await visit(directory);
  await writeFile('docs/performance/js-sizes.json', JSON.stringify({method: 'esbuild 0.28.2; independent ES2022 modules; no bundling or property mangling; function names and legal comments retained', modules: rows}, null, 2) + '\n');
  console.log(`Minified ${rows.length} JavaScript modules: ${rows.reduce((n,r)=>n+r.source_bytes,0)} → ${rows.reduce((n,r)=>n+r.generated_bytes,0)} bytes`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build(resolve(process.argv[2] || 'public/assets'));
