import fs from 'node:fs/promises';
import path from 'node:path';
import c from '../data/shopping-guides.json' with {type:'json'};
import {render,discovery,writeCalendars} from './shopping-guides/render.mjs';
const root=path.resolve(import.meta.dirname,'..');
await writeCalendars(c,path.join(root,'site/assets/shopping'));
for(let i=0;i<c.pages.length;i++){const p=c.pages[i],target=path.join(root,'site',c.paths[i],'index.html');await fs.mkdir(path.dirname(target),{recursive:true});const metadata={title:p.title,description:p.description,preserve_source:true,shopping_guide:true,shopping_css:c.css,og_image:c.asset+p.slug+'-og.png',og_image_alt:p.name+' 2026: '+c.labels.heroLine.toLocaleLowerCase(c.locale),og_image_width:1200,og_image_height:630};await fs.writeFile(target,'---\n'+Object.entries(metadata).map(([k,v])=>k+': '+JSON.stringify(v)).join('\n')+'\n---\n'+render(c,p));}
const hub=path.join(root,'site/sventes/index.html');let text=await fs.readFile(hub,'utf8');text=text.replace(/<section class="sg-discovery" data-shopping-discovery>[\s\S]*?<\/section>/g,'');text=text.replace(/^shopping_css:.*\n/m,'');if(!text.includes('shopping_guide: true'))text=text.replace('---\n','---\nshopping_guide: true\n');text=text.replace('---\n','---\nshopping_css: '+JSON.stringify(c.css)+'\n');await fs.writeFile(hub,text+'\n'+discovery(c));
