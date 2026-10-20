import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
const [input,output]=process.argv.slice(2);
const svg=fs.readFileSync(input);const r=new Resvg(svg,{fitTo:{mode:'width',value:640}});fs.writeFileSync(output,r.render().asPng());
