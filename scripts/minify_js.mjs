import {transformSync} from 'esbuild';
import {readdir, readFile, writeFile} from 'node:fs/promises';
import {resolve, relative} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateCSS, minifyCSS} from './minify_css.mjs';

// Each module retains its exports, import boundaries, property names and legal
// notices. Source files remain readable; only generated browser assets change.
export function minifyJavaScript(source, filename = 'module.js') {
  return transformSync(source, {
    sourcefile: filename, loader: 'js', target: ['chrome100', 'safari15.4'], format: 'esm',
    minify: true, keepNames: true, treeShaking: false, legalComments: 'inline',
    charset: 'utf8',
  }).code;
}

export function staticImports(source) {
  return [...source.matchAll(/^\s*(?:import|export)\s+(?:[^'";]+?\s+from\s*)?["']([^"']+)["']/gm)].map(match=>match[1]);
}

async function preloadInitialModules(directory) {
  const root = resolve(directory, '..'), imports = new Map(), compiledStyles=new Map();
  async function dependencies(url, seen) {
    if (seen.has(url)) return;
    seen.add(url);
    const parsed = new URL(url, 'https://kalendorius365.lt');
    if (parsed.origin !== 'https://kalendorius365.lt' || !parsed.pathname.startsWith('/assets/')) return;
    if (!imports.has(url)) imports.set(url, staticImports(await readFile(resolve(root, '.'+parsed.pathname), 'utf8')));
    for (const specifier of imports.get(url)) {
      if (!specifier.startsWith('.') && !specifier.startsWith('/')) continue;
      const child = new URL(specifier, parsed);
      await dependencies(child.pathname + child.search, seen);
    }
  }
  async function visit(dir) {
    for (const entry of await readdir(dir, {withFileTypes:true})) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) { if (entry.name !== 'assets' && entry.name !== 'downloads') await visit(path); }
      else if (entry.name.endsWith('.html')) {
        const html = (await readFile(path, 'utf8')).replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/g,(_,open,css,close)=>{
          if(!compiledStyles.has(css)){
            validateCSS(css,relative(root,path));
            compiledStyles.set(css,minifyCSS(css,relative(root,path)));
          }
          return open+compiledStyles.get(css)+close;
        });
        const roots = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+\.js(?:\?v=[^"]+)?)"[^>]*>/g)].map(match=>match[1]);
        const seen = new Set();
        for (const url of roots) await dependencies(url, seen);
        const hints = [...seen].sort().map(url=>`<link rel="modulepreload" href="${url}">`);
        // Only eagerly used public data is preloaded. Lazy search, birth data,
        // astronomy, APIs and personal calendar state are never speculated.
        const data = new Set();
        if (roots.some(url=>/^\/assets\/(?:app|tools)\.js\?/.test(url))) data.add('calendar.json');
        if (roots.some(url=>/^\/assets\/app\.js\?/.test(url))) data.add('home-holiday-data.json');
        for (const name of data) {
          const source = await readFile(resolve(directory, roots.some(url=>url.startsWith('/assets/app.js?'))?'app.js':'tools.js'), 'utf8');
          const url = source.match(new RegExp('/assets/data/'+name.replaceAll('.', '\\.')+'\\?v=[a-f0-9]+'))?.[0];
          if (url) hints.push(`<link rel="preload" href="${url}" as="fetch" crossorigin>`);
        }
        await writeFile(path, html.replace('</head>', hints.length?hints.join('\n')+'\n</head>':'</head>'));
      }
    }
  }
  await visit(root);
}

async function build(directory) {
  await preloadInitialModules(directory);
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
        const result = ['lunar/astronomy-engine.js', 'calendar-editor/vendor/jspdf-4.2.1.umd.min.js'].includes(name) ? source : minifyJavaScript(source, name);
        await writeFile(path, result);
        rows.push({path: '/assets/' + name, source_bytes: Buffer.byteLength(source), generated_bytes: Buffer.byteLength(result)});
      }
    }
  }
  await visit(directory);
  await writeFile('docs/performance/js-sizes.json', JSON.stringify({method: 'esbuild 0.28.2; independent modules targeting Chrome 100 / Safari 15.4 syntax; no bundling or property mangling; function names and legal comments retained', modules: rows}, null, 2) + '\n');
  console.log(`Minified ${rows.length} JavaScript modules: ${rows.reduce((n,r)=>n+r.source_bytes,0)} → ${rows.reduce((n,r)=>n+r.generated_bytes,0)} bytes`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await build(resolve(process.argv[2] || 'public/assets'));
