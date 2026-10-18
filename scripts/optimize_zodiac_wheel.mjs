// Optional asset preparation. The complete original vector stays unchanged.
import {optimize} from 'svgo';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source='site/assets/visuals/zodiac-wheel.svg',target='site/assets/visuals/zodiac-wheel-screen.svg';
const input=await fs.readFile(source,'utf8');
const config={multipass:true,floatPrecision:10,plugins:[{name:'preset-default',params:{overrides:{removeDesc:false,cleanupIds:{preserve:['title','desc']},removeUnknownsAndDefaults:{keepRoleAttr:true}}}}]};
const output=optimize(input,config).data;
if(!output.includes('viewBox="0 0 320 320"')||!output.includes('aria-labelledby="title desc"'))throw Error('Lost SVG geometry or accessible description');
await fs.writeFile(target,output);
const digest=value=>createHash('sha256').update(value).digest('hex');
await fs.writeFile('docs/performance/zodiac-wheel-vector.json',JSON.stringify({method:'SVGO 4.1.0, ten-digit precision; merge equivalent paths and simplify markup; keep a fully scalable SVG, title, description and viewBox. Original complete vector retained. Browser rasterization can differ slightly at anti-aliased edges; separate Chrome/WebKit 88/320-pixel comparisons are retained.',source,target,original_bytes:Buffer.byteLength(input),optimized_bytes:Buffer.byteLength(output),original_elements:(input.match(/<\w/g)||[]).length,optimized_elements:(output.match(/<\w/g)||[]).length,original_sha256:digest(input),optimized_sha256:digest(output),config},null,2)+'\n');
console.log(`Vector: ${Buffer.byteLength(input)} → ${Buffer.byteLength(output)} bytes`);
