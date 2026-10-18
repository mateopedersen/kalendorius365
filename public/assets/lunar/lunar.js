import {lunarState,noonInVilnius,nextPhase,lunarAge,countdown,localMoment,phaseICS,PHASES} from './lunar-engine.js?v=2827d897e091';

const scope=document.querySelector('.lunar-app');
const texture=new Image();texture.src='/assets/lunar/albedo-web.png';
const textureReady=texture.decode();
const geometry=new Map();
function renderMoon(canvas,state) {
  const n=canvas.width;let base=geometry.get(n);
  if(!base){
    const off=document.createElement('canvas');off.width=n;off.height=n;
    const context=off.getContext('2d',{willReadFrequently:true});context.drawImage(texture,0,0,n,n);
    base=context.getImageData(0,0,n,n);geometry.set(n,base);
  }
  const ctx=canvas.getContext('2d');const output=new ImageData(new Uint8ClampedArray(base.data),n,n);
  const angle=state.phaseAngle*Math.PI/180;
  const sx=Math.sin(angle)*(state.waxing?1:-1),sz=Math.cos(angle);
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const index=(y*n+x)*4;if(!output.data[index+3])continue;
    const nx=(x+.5)/n*2-1,ny=(y+.5)/n*2-1,z=Math.sqrt(Math.max(0,1-nx*nx-ny*ny));
    const dot=Math.max(0,nx*sx+z*sz);
    const light=.012+.988*Math.min(1,1.85*dot/(dot+z+1e-6))*(.92+.08*z);
    for(let c=0;c<3;c++)output.data[index+c]*=light;
  }
  ctx.putImageData(output,0,0);
}
const number=new Intl.NumberFormat('lt-LT',{maximumFractionDigits:1});
const officialEvents=JSON.parse(scope.querySelector('#lunar-official-events')?.textContent||'[]');
function text(selector,value){const el=scope.querySelector(selector);if(el)el.textContent=value;}
function refreshLive(){
  const canvas=scope.querySelector('[data-live-moon]');if(!canvas)return;
  const now=new Date(),state=lunarState(now);renderMoon(canvas,state);
  text('[data-live-date]',localMoment(now)+' · Lietuvos laiku');
  text('[data-live-phase]',state.label);text('[data-live-light]',number.format(state.illumination*100)+' %');
  text('[data-live-age]',number.format(lunarAge(now))+' d.');
  for(const [quarter,key] of [[0,'new'],[2,'full']]){
    const official=officialEvents.find(e=>e.phase===key&&new Date(e.utc)>now);
    const next=official?new Date(official.utc):nextPhase(quarter,now);text(`[data-next-${key}]`,countdown(next,now));
    const el=scope.querySelector(`[data-next-${key}-date]`);el.dateTime=next.toISOString();el.textContent=localMoment(next);
  }
  canvas.setAttribute('aria-label',`${state.label}; apšviesta ${number.format(state.illumination*100)} % disko. ${localMoment(now)}`);
}
function selectDate(value,focus=false){
  const input=scope.querySelector('[data-selected-date]');if(!input)return;
  if(value<input.min||value>input.max)return;
  const state=lunarState(noonInVilnius(value));input.value=value;
  const selectedCanvas=scope.querySelector('[data-selected-moon]');
  renderMoon(selectedCanvas,state);
  selectedCanvas.setAttribute('aria-label',`${value}: ${state.label}; apšviesta ${number.format(state.illumination*100)} % disko, 12:00 Lietuvos laiku.`);
  text('#lunar-selected-title',new Intl.DateTimeFormat('lt-LT',{timeZone:'UTC',year:'numeric',month:'long',day:'numeric'}).format(new Date(value+'T12:00:00Z')));
  const details=scope.querySelector('[data-selected-details]');details.replaceChildren();
  const strong=document.createElement('strong');strong.textContent=state.label;
  const paragraph=document.createElement('p');paragraph.textContent=`Apšviesta ${number.format(state.illumination*100)} % disko. ${state.waxing?'Mėnulis auga.':'Mėnulis dyla.'}`;
  details.append(strong,paragraph);
  const phaseEvent=calendarEvents.find(event=>event.local_date===value);
  if(phaseEvent){const eventLine=document.createElement('p');eventLine.textContent=`Pagrindinė fazė: ${phaseEvent.label_lt.toLocaleLowerCase('lt-LT')}, ${localMoment(phaseEvent.utc)}.`;details.append(eventLine);}
  for(const button of scope.querySelectorAll('[data-lunar-date]')){
    const selected=button.dataset.lunarDate===value;button.setAttribute('aria-pressed',String(selected));button.tabIndex=selected?0:-1;
    if(selected&&focus)button.focus();
  }
}
const calendarEvents=JSON.parse(scope.querySelector('#lunar-events')?.textContent||'[]');
function downloadICS(events){
  const blob=new Blob([phaseICS(events)],{type:'text/calendar;charset=utf-8'});const url=URL.createObjectURL(blob);
  const link=document.createElement('a');link.href=url;link.download='menulio-fazes.ics';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const dialog=document.createElement('dialog');dialog.className='lunar-lightbox';
const close=document.createElement('button');close.type='button';close.className='lunar-button';close.textContent='Uždaryti';
const zoomImage=document.createElement('img');const caption=document.createElement('p');caption.id='lunar-zoom-caption';dialog.setAttribute('aria-label','Padidintas kalendorius');dialog.setAttribute('aria-describedby',caption.id);dialog.append(close,zoomImage,caption);document.body.append(dialog);
close.addEventListener('click',()=>dialog.close());dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
scope.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.dataset.lunarDate)textureReady.then(()=>selectDate(button.dataset.lunarDate));
  if(button.hasAttribute('data-all-ics'))downloadICS(calendarEvents);
  if(button.dataset.eventIcs)downloadICS(calendarEvents.filter(e=>e.utc===button.dataset.eventIcs));
  if(button.dataset.zoom){zoomImage.src=button.dataset.zoom;zoomImage.alt=button.dataset.caption;caption.textContent=button.dataset.caption;dialog.showModal();}
  if(button.dataset.printImage){
    if(document.querySelector('.lunar-print-output'))return;
    const output=document.createElement('section');output.className='lunar-print-output';output.style.display='none';
    const style=document.createElement('style');style.textContent=`@page{size:${button.dataset.paper};margin:0}@media print{html,body{margin:0!important;padding:0!important}body>:not(.lunar-print-output){display:none!important}.lunar-print-output{display:block!important;margin:0!important;padding:0!important}.lunar-print-output img{display:block;width:100%;height:auto;max-height:100vh;object-fit:contain}}`;
    const image=document.createElement('img');image.alt='Spausdinamas Mėnulio kalendorius';
    const cleanup=()=>{output.remove();style.remove();button.disabled=false;};
    button.disabled=true;output.append(image);document.head.append(style);document.body.append(output);
    image.addEventListener('load',()=>{try{window.print();}finally{cleanup();}},{once:true});
    image.addEventListener('error',()=>{cleanup();window.location.assign(button.closest('.lunar-print-card').querySelector('a[href$=".pdf"]').href);},{once:true});
    image.src=button.dataset.printImage;
  }
});
scope.querySelector('[data-selected-date]')?.addEventListener('change',event=>textureReady.then(()=>selectDate(event.target.value)));
scope.querySelector('.lunar-month-table')?.addEventListener('keydown',event=>{
  const button=event.target.closest('[data-lunar-date]');if(!button)return;
  const move={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key];if(!move)return;
  event.preventDefault();const date=new Date(button.dataset.lunarDate+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+move);selectDate(date.toISOString().slice(0,10),true);
});
textureReady.then(()=>{
  refreshLive();selectDate(scope.querySelector('[data-selected-date]')?.value);
  for(const canvas of scope.querySelectorAll('[data-benchmark]')){
    const angle=Number(canvas.dataset.benchmark);renderMoon(canvas,{phaseAngle:Math.abs(180-angle),waxing:angle<=180});
  }
  setInterval(refreshLive,60000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshLive();});
}).catch(()=>{text('[data-live-phase]','Vaizdas šiuo metu nepasiekiamas');});
