import { addDays, today, formatDate, weekday, monthLength } from '/assets/releases/7ae5541cf6447a0d381c/calendar.js';
import { buildIndex, searchNames, validOccurrence, nextOccurrence, nameDayEvent, weekDates } from '/assets/releases/7ae5541cf6447a0d381c/namedays-engine.js';
import { Store } from '/assets/releases/7ae5541cf6447a0d381c/storage.js';
import { exportICS } from '/assets/releases/7ae5541cf6447a0d381c/ics.js';

const root=document.querySelector('[data-namedays-source]');
const $=(s)=>root.querySelector(s);
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;};
const monthNames=['sausio','vasario','kovo','balandžio','gegužės','birželio','liepos','rugpjūčio','rugsėjo','spalio','lapkričio','gruodžio'];
const label=(key)=>`${monthNames[Number(key.slice(0,2))-1]} ${Number(key.slice(3))} d.`;
const dateLabel=(date)=>formatDate(date,{year:'numeric',month:'long',day:'numeric',weekday:'long'});
if(root) init().catch(()=>{
  $('#nd-search-status').textContent='Nepavyko įkelti interaktyvios paieškos. Visi vardai ir šaltiniai pateikti žemiau esančiuose mėnesių sąrašuose.';
  $('#nd-feedback').textContent='Interaktyvūs įrankiai neįkelti. Naudokite dienų sąrašus ir prie jų pateiktus ICS failus.';
  for(const b of root.querySelectorAll('#nd-export-form button'))b.disabled=true;
});
async function init(){
  const response=await fetch(root.dataset.namedaysSource);
  if(!response.ok)throw Error('Data unavailable');
  const data=await response.json(), records=new Map(data.records.map(r=>[r.date,r])), index=buildIndex(data.records);
  if(records.size!==366)throw Error('Incomplete dataset');
  const pageMonth=Number(root.dataset.namedaysMonth)||0;
  let selected=pageMonth?`2027-${String(pageMonth).padStart(2,'0')}-01`:today();
  let preparedURL='';
  let letter='',shown=12;
  function clearPrepared(){if(preparedURL)URL.revokeObjectURL(preparedURL);preparedURL='';$('#nd-file-link').hidden=true;$('#nd-file-link').removeAttribute('href');}
  const feedback=(message,error=false)=>{const e=$('#nd-feedback');e.textContent=message;e.setAttribute('role',error?'alert':'status');};
  function ensureYear(year){
    const select=$('#nd-year');
    if(![...select.options].some(o=>o.value===String(year))){const option=node('option',String(year));option.value=year;select.prepend(option);}
    select.value=year;
  }
  function source(container,record){
    container.replaceChildren();
    const a=node('a',`„${record.source_title}“ · redakcija ${record.source_revision_id}`);a.href=record.source_revision;
    const h=node('a','straipsnio keitimų istorija');h.href=record.source_history;
    container.append(a,document.createTextNode(' · '),h);
  }
  function selectDate(date,name=''){
    const r=records.get(date.slice(5));
    if(!r || !validOccurrence(r.date,Number(date.slice(0,4)))){clearPrepared();$('#nd-ics').disabled=true;$('#nd-add').disabled=true;feedback('Pasirinkite galiojančią datą. Prieš kurdami įrašą pasirinkite datą.',true);return;}
    $('#nd-ics').disabled=false;$('#nd-add').disabled=false;
    selected=date;$('#nd-date').value=date;ensureYear(Number(date.slice(0,4)));
    $('#nd-open-calendar').href=`/?data=${date}#day-details`;
    clearPrepared();
    $('#nd-selected-title').textContent=dateLabel(date);
    $('#nd-selected-names').textContent=r.names.join(', ');
    source($('#nd-selected-source'),r);
    const sel=$('#nd-export-name');sel.replaceChildren();
    const all=node('option','Visi šios dienos vardai');all.value='';sel.append(all);
    for(const n of [...r.names].sort((a,b)=>a.localeCompare(b,'lt'))){const o=node('option',n);o.value=n;sel.append(o);}
    sel.value=r.names.includes(name)?name:'';
    feedback('');renderGrid();
  }
  function chooseKey(key,name=''){
    const y=Number(selected.slice(0,4));
    const date=validOccurrence(key,y)||nextOccurrence(key,`${y}-01-01`);
    selectDate(date,name);
    if(date.slice(0,4)!==String(y))feedback(`${y} m. vasaris turi 28 dienas. Parodyta artimiausia data: ${dateLabel(date)}.`);
  }
  function renderGrid(){
    const grid=$('#nd-calendar');if(!grid)return;
    const year=Number(selected.slice(0,4)),month=Number(selected.slice(5,7));
    $('#nd-calendar-title').textContent=`${data.months[month-1][1]} ${year}`;
    const calendarKey=`${year}-${month}`;
    // Preserve the clicked date link and keyboard focus within the same month.
    // Replacing that node during its click also interrupts native anchor jumps.
    if(grid.dataset.calendarKey===calendarKey){
      for(const a of grid.querySelectorAll('a[data-calendar-date]')){
        a.classList.toggle('nd-selected',a.dataset.calendarDate===selected);
        if(a.dataset.calendarDate===today())a.setAttribute('aria-current','date');else a.removeAttribute('aria-current');
      }
      return;
    }
    grid.dataset.calendarKey=calendarKey;
    grid.replaceChildren();
    for(const day of ['Pr','An','Tr','Kt','Pn','Št','Sk'])grid.append(node('span',day));
    for(let i=0;i<weekday(`${year}-${String(month).padStart(2,'0')}-01`);i++){const empty=node('span','','nd-empty');empty.setAttribute('aria-hidden','true');grid.append(empty);}
    for(let d=1;d<=monthLength(year,month);d++){
      const key=`${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`,date=`${year}-${key}`,r=records.get(key);
      const a=node('a');a.href='#pasirinkta-data';
      a.dataset.calendarDate=date;
      a.setAttribute('aria-label',`${dateLabel(date)}. Vardai: ${r.names.join(', ')}.`);
      a.append(node('strong',String(d)),node('small',`${r.names.length} v.`));
      if(date===today())a.setAttribute('aria-current','date');
      if(date===selected)a.classList.add('nd-selected');
      a.addEventListener('click',e=>{e.preventDefault();selectDate(date);$('#nd-selected-title').scrollIntoView({block:'nearest',behavior:'auto'});});grid.append(a);
    }
    $('#nd-calendar-note').textContent=month===2&&monthLength(year,month)===28?'Šiais metais vasaris turi 28 dienas. Vasario 29-osios vardai išlieka sąraše; jų datai rinkitės 2028 metus.':`${year} m. ${monthNames[month-1]} mėnesio dienos. Savaitė prasideda pirmadienį.`;
  }
  function renderSearch(){
    const matches=searchNames(index,{query:$('#nd-query').value,letter,month:$('#nd-month-filter').value});
    const list=$('#nd-results');list.replaceChildren();
    for(const result of matches.slice(0,shown)){
      const li=node('li');li.append(node('strong',result.name));const dates=node('div',undefined,'nd-result-dates');
      for(const key of result.dates){const a=node('a',label(key));a.href=`/vardadieniai/${data.months[Number(key.slice(0,2))-1][0]}/#diena-${key.slice(3)}`;
        a.setAttribute('aria-label',`${result.name}: ${label(key)} Pasirinkti kalendoriuje.`);
        a.addEventListener('click',e=>{e.preventDefault();chooseKey(key,result.name);$('#nd-selected-title').scrollIntoView({block:'center',behavior:'auto'});$('#nd-export-name').focus({preventScroll:true});});dates.append(a);}
      li.append(dates);list.append(li);
    }
    $('#nd-search-status').textContent=matches.length?`Rasta vardų: ${matches.length}. Rodoma: ${Math.min(shown,matches.length)}. Paspauskite datą, kad pasirinktumėte būtent tą vardadienį.`:'Vardo pagal šias parinktis nerasta. Patikrinkite rašybą arba išvalykite raidės ir mėnesio filtrus.';
    $('#nd-more').hidden=shown>=matches.length;
    $('#nd-reset').hidden=!($('#nd-query').value||letter||$('#nd-month-filter').value);
  }
  function renderToday(){
    if(!$('#nd-live-day'))return;
    const date=today(),tomorrow=addDays(date,1),r=records.get(date.slice(5)),next=records.get(tomorrow.slice(5));
    const wrap=node('div',undefined,'nd-today-grid'),card=node('div',undefined,'nd-day-card');
    card.append(node('span',String(Number(date.slice(8))),'nd-day-card__number'),node('p',dateLabel(date),'nd-muted'));
    const names=node('div',undefined,'nd-day-card__names');for(const name of r.names)names.append(node('span',name));card.append(names);
    const src=node('p',undefined,'nd-source-link');source(src,r);card.append(src);
    const nextCard=node('div',undefined,'nd-tomorrow');nextCard.append(node('p','Rytoj','nd-eyebrow'),node('h3',dateLabel(tomorrow)),node('p',next.names.join(', ')));
    const a=node('a','Pažymėti rytojaus vardadienį →');a.href='#pasirinkta-data';a.addEventListener('click',()=>selectDate(tomorrow));nextCard.append(a);wrap.append(card,nextCard);$('#nd-live-day').replaceChildren(wrap);
    const week=$('#nd-week');week.replaceChildren();
    for(const d of weekDates(date)){const row=records.get(d.slice(5)),link=node('a');link.href=`/vardadieniai/${data.months[Number(d.slice(5,7))-1][0]}/#diena-${d.slice(8)}`;link.append(node('span',new Intl.DateTimeFormat('lt',{weekday:'short',timeZone:'UTC'}).format(new Date(d+'T12:00:00Z'))),node('strong',d.slice(8)),node('small',row.names.join(', ')));week.append(link);}
  }
  $('#nd-query').addEventListener('input',()=>{shown=12;renderSearch();});
  $('#nd-month-filter').addEventListener('change',()=>{shown=12;renderSearch();});
  $('#nd-reset').addEventListener('click',()=>{letter='';shown=12;$('#nd-query').value='';$('#nd-month-filter').value='';for(const b of root.querySelectorAll('[data-letter]'))b.setAttribute('aria-pressed',String(b.dataset.letter===''));renderSearch();$('#nd-query').focus();});
  for(const b of root.querySelectorAll('[data-letter]'))b.addEventListener('click',()=>{letter=b.dataset.letter;shown=12;for(const x of root.querySelectorAll('[data-letter]'))x.setAttribute('aria-pressed',String(x===b));renderSearch();});
  $('#nd-more').addEventListener('click',()=>{shown+=12;renderSearch();});
  $('#nd-date').addEventListener('change',e=>selectDate(e.target.value));
  $('#nd-year').addEventListener('change',e=>{
    const date=validOccurrence(selected.slice(5),Number(e.target.value));
    if(date)selectDate(date);else{e.target.value=selected.slice(0,4);feedback('Vasario 29-oji yra tik keliamaisiais metais. Data neperkelta; rinkitės 2028 metus arba kitą dieną.',true);}
  });
  $('#nd-today').addEventListener('click',()=>selectDate(today()));$('#nd-tomorrow').addEventListener('click',()=>selectDate(addDays(today(),1)));
  for(const a of root.querySelectorAll('[data-select-day]'))a.addEventListener('click',()=>chooseKey(a.dataset.selectDay));
  const event=()=>{if($('#nd-date').value!==selected)throw Error('Pirmiausia pasirinkite galiojančią datą.');return nameDayEvent(records.get(selected.slice(5)),selected,$('#nd-export-name').value,$('#nd-recurring').checked);};
  $('#nd-export-name').addEventListener('change',clearPrepared);$('#nd-recurring').addEventListener('change',clearPrepared);
  $('#nd-export-form').addEventListener('submit',e=>{e.preventDefault();try{const item=event();clearPrepared();preparedURL=URL.createObjectURL(new Blob([exportICS([item])],{type:'text/calendar;charset=utf-8'}));const link=$('#nd-file-link');link.href=preparedURL;link.download=`vardadienis-${selected}.ics`;link.hidden=false;link.click();feedback(item.repeat==='yearly'?'Parengtas kasmetinis ICS įrašas. Jei atsisiuntimas neprasidėjo, paspauskite žemiau esančią failo nuorodą. Vasario 29-oji neperkeliama.':'Parengtas vienkartinis visos dienos ICS įrašas. Jei atsisiuntimas neprasidėjo, paspauskite žemiau esančią failo nuorodą.');}catch(error){feedback(error.message,true);}});
  $('#nd-add').addEventListener('click',()=>{try{const item=event(),store=new Store();if(store.data.events.some(e=>e.id===item.id)){feedback('Šis vardadienis jau įtrauktas į šios naršyklės kalendorių.');return;}store.update(state=>state.events.push(item));feedback(`Išsaugota šioje naršyklėje: ${item.title}. Atverkite asmeninį kalendorių.`);}catch(error){feedback(error.message,true);}});
  if(pageMonth)$('#nd-month-filter').value=String(pageMonth);
  // Global-search entity links land on this existing lookup with the native
  // name prefilled; visitors can then choose any of its verified dates.
  const initialQuery=new URLSearchParams(location.search).get('q');
  if(initialQuery){$('#nd-query').value=initialQuery.normalize('NFC').slice(0,80);$('#nd-month-filter').value='';}
  const hash=location.hash.match(/^#diena-(\d{2})$/);if(hash&&pageMonth)chooseKey(`${String(pageMonth).padStart(2,'0')}-${hash[1]}`);else selectDate(selected);
  renderSearch();renderToday();
  let last=today();
  function refresh(){const current=today();if(current!==last){if(selected===last)selectDate(current);last=current;renderToday();renderGrid();}}
  setInterval(refresh,30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
}
