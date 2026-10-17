"""Local-only rendered QA fixture. A normal release build removes its public files."""
from pathlib import Path
import shutil
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/__monthly_qa';OUT.mkdir(exist_ok=True)
shutil.copy('/Users/melihozcan/Documents/Codex/2026-10-15/files-pasted-by-the-user-kalendorius365/work/tooling/qa/node_modules/axe-core/axe.min.js',OUT/'axe.js')
(OUT/'index.html').write_text('''<!doctype html><html lang="lt"><meta charset="utf-8"><title>Vietinė mėnesių patikra</title><style>html,body{margin:0;background:#e5ebe6;font:14px sans-serif}iframe{display:block;border:0;background:white}pre{white-space:pre-wrap;max-width:1400px}</style><iframe id="page" title="Tikrinamas švenčių gidas"></iframe><pre id="result" data-state="running">Tikrinama…</pre><script>
const q=new URLSearchParams(location.search),f=document.querySelector('iframe'),o=document.querySelector('pre');
const width=Number(q.get('width')||1440);f.style.width=width+'px';f.style.height='1000px';
f.src='/sventes/2027/'+q.get('month')+'/';
f.addEventListener('load',async()=>{try{
const w=f.contentWindow,d=f.contentDocument;await d.fonts.ready;
await Promise.all([...d.querySelectorAll('.mh img:not([loading=lazy])')].map(i=>i.decode().catch(()=>{})));
if(q.get('font')==='200')d.documentElement.style.fontSize='200%';
await new Promise(r=>w.requestAnimationFrame(()=>w.requestAnimationFrame(r)));
for(let i=0;i<120&&d.querySelector('[data-category-filter]')?.disabled;i++)await new Promise(r=>w.requestAnimationFrame(r));
const root=d.querySelector('.mh'),events=[...d.querySelectorAll('[data-event]')],days=[...d.querySelectorAll('[data-day]')];
const norm=s=>s.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLocaleLowerCase('lt');
const visible=()=>events.filter(e=>!e.hidden);const counts=()=>visible().length;
let checks=[],add=(name,ok,detail)=>checks.push({name,passed:!!ok,detail});
add('Module enabled controls',!d.querySelector('[data-category-filter]').disabled);add('Lato loaded',d.fonts.check('16px Lato'));add('CSS viewport',w.innerWidth===width,w.innerWidth);
add('No horizontal overflow',d.documentElement.scrollWidth<=width+1,d.documentElement.scrollWidth);
const image=d.querySelector('.mh-art img');add('Original hero decoded',image.complete&&image.naturalWidth===1200);
for(const b of d.querySelectorAll('[data-category-filter]')){b.click();const cat=b.dataset.categoryFilter;add('Filter '+cat,counts()===events.filter(e=>cat==='all'||e.dataset.category===cat).length,counts());add('Pressed '+cat,b.getAttribute('aria-pressed')==='true');}
d.querySelector('[data-reset]').click();add('Reset categories',counts()===events.length);
const search=d.querySelector('#mh-search');search.value='zzzz-no-date-zzzz';search.dispatchEvent(new w.Event('input',{bubbles:true}));add('Empty search',counts()===0&&!d.querySelector('.mh-empty').hidden&&d.querySelector('[data-next-date]').hidden);
d.querySelector('[data-reset]').click();const term=events[0].querySelector('h4').textContent.split(' ')[0];search.value=norm(term);search.dispatchEvent(new w.Event('input',{bubbles:true}));add('Diacritic-insensitive search',visible().some(e=>e===events[0]));
const activeDates=new Set(visible().map(e=>e.dataset.date));const next=d.querySelector('[data-next-date]');add('Filtered next date',!next.hidden&&activeDates.has(next.getAttribute('href').replace('#data-','')));
d.querySelector('[data-reset]').click();
const two=days.find(e=>e.querySelector('.mh-daycount')?.textContent==='2');if(two){two.click();add('Two entries selected',d.querySelector('.mh-date-group.is-selected')?.querySelectorAll('[data-event]:not([hidden])').length>=2);}
const ordinary=days.find(e=>!e.querySelector('.mh-daycount'));if(ordinary){ordinary.click();add('Ordinary date selection',d.querySelector('#mh-day-info').textContent.includes('įrašų nėra'));}
days[0].focus();days[0].dispatchEvent(new w.KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));add('Arrow keyboard navigation',d.activeElement===days[1]);
let printRequested=false;w.print=()=>{printRequested=true};d.querySelector('[data-print]').click();add('Print handler called',printRequested);
const source=d.querySelector('.mh-event-source');source.querySelector('summary').click();add('Source disclosure',source.open&&source.textContent.includes('2026-10-17'));add('Source punctuation',![...d.querySelectorAll('.mh-event-source')].some(e=>e.textContent.includes('d..')));source.querySelector('summary').click();
const faq=d.querySelector('.mh-faq details');faq.querySelector('summary').click();add('FAQ disclosure',faq.open);faq.querySelector('summary').click();
const checkElements=[...root.querySelectorAll('h1,h2,h3,h4,p,button,input,a,summary,figcaption,dt,dd')].filter(e=>e.getClientRects().length&&getComputedStyle(e).display!=='none');
const clipped=checkElements.filter(e=>e.clientWidth&&e.scrollWidth>e.clientWidth+2&&!['inline','contents'].includes(getComputedStyle(e).display)).map(e=>({tag:e.tagName,class:e.className,text:e.textContent.slice(0,100),width:e.clientWidth,scroll:e.scrollWidth}));
add('No clipped text',clipped.length===0,clipped);
const collisions=days.flatMap(day=>{const num=day.querySelector('.mh-day-number').getBoundingClientRect(),badge=day.querySelector('.mh-daycount')?.getBoundingClientRect(),marks=day.querySelector('.mh-marks').getBoundingClientRect();return badge&&num.right>badge.left+.5&&num.bottom>badge.top+.5&&num.top<badge.bottom-.5?[day.dataset.day]:num.bottom>marks.top+.5?[day.dataset.day]:[]});
add('Calendar numbers separate from cues',collisions.length===0,collisions);
const tiny=days.filter(e=>{let r=e.getBoundingClientRect();return r.width<24||r.height<44});add('Calendar touch targets',tiny.length===0,tiny.length);
const out={route:w.location.pathname,width:w.innerWidth,font_percent:q.get('font')||'100',checks,failures:checks.filter(c=>!c.passed),images:[...d.querySelectorAll('.mh img:not([loading=lazy])')].map(i=>({src:i.getAttribute('src'),width:i.naturalWidth})),calendar_top:Math.round(d.querySelector('.mh-calendar').getBoundingClientRect().top+w.scrollY),events:events.length};
d.querySelector('[data-reset]').click();w.scrollTo(0,0);d.activeElement?.blur();
if(q.get('axe')==='1'){const s=d.createElement('script');s.src='/__monthly_qa/axe.js';await new Promise((r,j)=>{s.onload=r;s.onerror=j;d.head.append(s)});const r=await w.axe.run(d,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});out.axe={violations:r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),incomplete:r.incomplete.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))})),passes:r.passes.length};}
o.textContent=JSON.stringify(out);o.dataset.state='done';
}catch(e){o.dataset.state='failed';o.textContent=String(e.stack)}});
</script></html>''')
print('Local-only browser fixture created; removed by release build.')
