import {transformSync} from 'esbuild';
import {readdir, readFile, writeFile} from 'node:fs/promises';
import {resolve, relative} from 'node:path';
import {pathToFileURL} from 'node:url';

export function minifyCSS(source, filename = 'style.css') {
  return transformSync(source, {sourcefile:filename, loader:'css', minify:true,
    target:['chrome100','safari15.4'], legalComments:'inline', charset:'utf8'}).code;
}

export function validateCSS(source, filename = 'style.css') {
  const result=transformSync(source,{sourcefile:filename,loader:'css',logLevel:'silent'});
  if(result.warnings.length)throw new Error(`Invalid generated CSS in ${filename}: ${result.warnings.map(w=>w.text).join('; ')}`);
}

async function build(directory) {
  const rows=[];
  async function visit(dir) {
    for (const entry of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))) {
      const path=resolve(dir,entry.name);
      if(entry.isDirectory()) await visit(path);
      else if(entry.name.endsWith('.css')) {
        const source=await readFile(path,'utf8'), result=minifyCSS(source,relative(directory,path));
        await writeFile(path,result);
        rows.push({path:'/assets/'+relative(directory,path).replaceAll('\\','/'),source_bytes:Buffer.byteLength(source),generated_bytes:Buffer.byteLength(result)});
      }
    }
  }
  await visit(directory);
  await writeFile('docs/performance/css-sizes.json',JSON.stringify({method:'esbuild 0.28.2 CSS syntax minification; Chrome 100 / Safari 15.4 target; no selector renaming',styles:rows},null,2)+'\n');
  console.log(`Minified ${rows.length} stylesheets: ${rows.reduce((n,r)=>n+r.source_bytes,0)} → ${rows.reduce((n,r)=>n+r.generated_bytes,0)} bytes`);
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await build(resolve(process.argv[2]||'public/assets'));
