import {SEASON_IDS,SEASON_NAMES,nextSeasonEvent,validatedSelection,durationLabel,chartPath,countdownParts,seasonGuideHref} from '/assets/releases/d39e5fbbc1a73294f491/seasons-core.js';
const app=document.querySelector('.sp3');
if(app)initialize();
async function initialize(){
 const $=s=>app.querySelector(s),all=s=>[...app.querySelectorAll(s)],text=(s,t)=>all(s).forEach(el=>el.textContent=t);
 try{
  const response=await fetch(app.dataset.source);if(!response.ok)throw Error('data');const d=await response.json();
  if(d.schema!==1)throw Error('schema');
  const yearInput=$('#sp3-year'),cityInput=$('#sp3-city'),id=app.dataset.season;
  let selection=validatedSelection(new URLSearchParams(location.search),d.years,d.cities),step=Math.max(0,SEASON_IDS.indexOf(id)),timer=null;
  const find=(s,y=selection.year)=>d.events.find(e=>e.id===s&&e.year===y),city=()=>d.cities.find(c=>c.id===selection.city);
  const slugs=['pavasario-lygiadienis','vasaros-saulegriza','rudens-lygiadienis','ziemos-saulegriza'];
  const monthSlugs=['sausis','vasaris','kovas','balandis','geguze','birzelis','liepa','rugpjutis','rugsejis','spalis','lapkritis','gruodis'];
  function line(kind,values,mark){
   const graph=$(`[data-chart="${kind}"]`),p=chartPath(values);
   graph.querySelector('[data-line]').setAttribute('d',p);graph.querySelector('[data-area]').setAttribute('d',p+'L1000,250L0,250Z');
   if(mark!==undefined)for(const a of ['x1','x2'])graph.querySelector('[data-mark]').setAttribute(a,mark.toFixed(2));
  }
  function table(selector,rows){
   const tbody=$(selector),fragment=document.createDocumentFragment();
   for(const row of rows){const tr=document.createElement('tr');row.forEach((value,i)=>{const cell=document.createElement(i?'td':'th');if(!i)cell.scope='row';cell.textContent=value;tr.append(cell);});fragment.append(tr);}tbody.replaceChildren(fragment);
  }
  function showStep(announce=false){
   const s=SEASON_IDS[step],e=find(s);$('#sp3-earth').src=`/assets/visuals/seasons/${s}-earth.svg`;$('#sp3-earth').alt=`${SEASON_NAMES[step]}: Žemės apšvietimo schema`;
   text('#sp3-diagram-name',e.name);text('#sp3-diagram-time',`${e.label} · ${e.clock} · ${e.offset}`);
   all('[data-step]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.step)===step)));
   all('.sp3-orbit-stop').forEach(g=>g.classList.toggle('is-active',Number(g.dataset.orbitIndex)===step));
   if(announce)text('#sp3-diagram-status',`${e.name}. ${e.label}, ${e.clock}, Lietuvos laiku.`);
  }
  function update(){
   const y=selection.year,c=city(),annual=d.annual[y][c.id];yearInput.value=String(y);cityInput.value=c.id;
   text('[data-year]',y);text('#sp3-status',`Pasirinkta: ${c.name} · ${y} m. Laikas – Europe/Vilnius.`);
   text('[data-annual-caption]',`${y} m. · ${c.name} · laikas nuo saulėtekio iki saulėlydžio`);text('[data-min]',durationLabel(annual.min));text('[data-max]',durationLabel(annual.max));
   const rows=Array.from({length:12},(_,m)=>{const date=new Date(Date.UTC(y,m,15)),index=Math.round((date-Date.UTC(y,0,1))/86400000);return [`${String(m+1).padStart(2,'0')}-15`,durationLabel(annual.curve[index])];});
   table('[data-annual-rows]',rows);text('[data-annual-table-caption]',`${y} m., ${c.name} – mėnesių palyginimas`);
   let mark;
   if(id!=='hub'){
    const e=find(id),context=d.contexts[`${id}-${y}`][c.id],day=context.days[7];mark=(Date.parse(e.date)-Date.UTC(y,0,1))/86400000/(annual.curve.length-1)*1000;
    text('[data-event-date]',e.label);text('[data-event-clock]',e.clock);$('[data-event-clock]').dateTime=e.utc;text('[data-event-offset]',`${e.offset} · Europe/Vilnius`);
    text('[data-context-caption]',`${y} m. · ${c.name} · ${e.label}`);text('[data-metric="rise"]',day[1]);text('[data-metric="set"]',day[2]);text('[data-metric="length"]',durationLabel(day[3]));
    text('[data-delta]',context.delta?`Laikotarpio pabaigoje – ${Math.abs(context.delta)} min. ${context.delta>0?'daugiau':'mažiau'} dienos šviesos nei pradžioje.`:'Laikotarpio pradžioje ir pabaigoje dienos šviesos trukmė sutampa, suapvalinus iki minutės.');
    line('around',context.days.map(r=>r[3]),500);text('[data-around-start]',context.days[0][0]);text('[data-around-end]',context.days[14][0]);
    table('[data-around-rows]',context.days.map(r=>[r[0],r[1],r[2],durationLabel(r[3])]));text('[data-around-table-caption]',`${y} m., ${c.name} – septynios dienos prieš įvykį ir po jo`);
    const month=monthSlugs[Number(e.date.slice(5,7))-1],link=$('[data-month-link]');
    // Monthly editorial guides currently exist only for 2027. Later years link to the real year hub.
    link.href=y===2027?`/sventes/2027/${month}/`:`/sventes/${y}/`;link.textContent=`${y} m. ${y===2027?'šio mėnesio':'Lietuvos'} šventės`;
   }else{
    SEASON_IDS.forEach(s=>{const e=find(s);text(`[data-card-time="${s}"]`,`${e.label} · ${e.clock}`);const cell=$(`[data-timeline="${s}"]`);cell.replaceChildren(document.createTextNode(e.label),document.createElement('br'));const strong=document.createElement('strong');strong.textContent=e.clock;cell.append(strong,document.createTextNode(` · ${e.offset}`));});
   }
   for(const a of all('a')){
    const href=a.getAttribute('href')||'',route=href.split(/[?#]/)[0];
    if(['/metu-laikai/',...slugs.map(s=>'/'+s+'/')].includes(route))a.setAttribute('href',seasonGuideHref(route,y,c.id));
   }
   line('annual',annual.curve,mark);all('[data-ics]').forEach(a=>{const slug=a.dataset.ics==='all'?'metu-laikai':slugs[SEASON_IDS.indexOf(a.dataset.ics)];a.href=`/assets/seasons-ics/${y}-${slug}.ics`;});showStep();
  }
  function plural(n,one,few,many){return n%10===1&&n%100!==11?one:n%10>=2&&n%10<=9&&(n%100<10||n%100>=20)?few:many;}
  function countdown(){
   if(id==='hub')return;const e=nextSeasonEvent(d.events,id),link=$('#sp3-next-ics');
   if(!e){text('#sp3-next-date','Patikrintų būsimų momentų sąrašas baigėsi. Palyginimo lentelėje išlieka 2027–2029 m. datos.');text('#sp3-countdown','Naujos datos dar nepateiktos');link.hidden=true;return;}
   const now=Date.now(),p=countdownParts(e.utc,now);text('#sp3-next-date',`${e.label} · ${e.clock} · ${e.offset}`);
   text('#sp3-countdown',`Liko ${p.days} ${plural(p.days,'para','paros','parų')}, ${p.hours} val. ${p.minutes} min.`);link.href=`/assets/seasons-ics/${e.year}-${slugs[SEASON_IDS.indexOf(id)]}.ics`;link.hidden=false;
  }
  function stop(){clearInterval(timer);timer=null;$('#sp3-play').setAttribute('aria-pressed','false');$('#sp3-play span').textContent='Paleisti metų ciklą';}
  all('[data-step]').forEach(b=>b.addEventListener('click',()=>{stop();step=Number(b.dataset.step);showStep(true);}));
  $('#sp3-play').addEventListener('click',()=>{
   if(timer){stop();return;}
   // Motion starts only on explicit input. Reduced-motion preference keeps changes manual.
   if(matchMedia('(prefers-reduced-motion: reduce)').matches){step=(step+1)%4;showStep(true);return;}
   $('#sp3-play').setAttribute('aria-pressed','true');$('#sp3-play span').textContent='Sustabdyti metų ciklą';timer=setInterval(()=>{step=(step+1)%4;showStep(false);},2200);
  });
  app.querySelector('form').addEventListener('submit',e=>e.preventDefault());
  for(const input of [yearInput,cityInput])input.addEventListener('change',()=>{selection={year:Number(yearInput.value),city:cityInput.value};update();const url=new URL(location.href);url.searchParams.set('metai',String(selection.year));url.searchParams.set('miestas',selection.city);history.replaceState(null,'',url);});
  update();countdown();setInterval(countdown,60000);addEventListener('pagehide',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else countdown();});
  all('button,select').forEach(el=>el.disabled=false);app.dataset.ready='true';
 }catch{const status=$('#sp3-status');if(status)status.textContent='Interaktyvių duomenų įkelti nepavyko. Žemiau pateiktos patikrintos 2027 m. Vilniaus datos; 2027–2029 m. astronominių momentų lentelė ir ICS nuorodos veikia be JavaScript.';app.dataset.ready='error';}
}
