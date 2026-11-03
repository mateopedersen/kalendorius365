import fs from 'node:fs';
import {Resvg} from '@resvg/resvg-js';
const [src,dest]=process.argv.slice(2);
fs.writeFileSync(dest,new Resvg(fs.readFileSync(src),{fitTo:{mode:'width',value:1200}}).render().asPng());
