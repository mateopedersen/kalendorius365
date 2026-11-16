import {consentRecord,validConsent,unitForWidth} from './ad-policy.js';
const configNode=document.getElementById('advertising-config');
if(configNode){
 let config;try{config=JSON.parse(configNode.textContent);}catch{}
 if(config&&typeof config.storageKey==='string'&&config.labels){
  const labels=config.labels,slot=document.querySelector('[data-advertising-slot]');
  let saved=null,loaded=false,loadedWidth=0,near=false,observer=null,opener=null,reloadRequested=false;
  try{const value=JSON.parse(localStorage.getItem(config.storageKey));if(validConsent(value))saved=value;}catch{}
  const publicView=location.search==='';
  if(slot&&!publicView)slot.hidden=true;
  const live=config.hosts.includes(location.hostname)&&publicView,stage=slot?.querySelector('[data-advertising-stage]');
  const dialog=document.createElement('dialog');dialog.className='advertising-dialog';dialog.setAttribute('aria-labelledby','advertising-choice-title');
  const heading=document.createElement('h2');heading.id='advertising-choice-title';heading.textContent=labels.title;
  const copy=document.createElement('p');copy.textContent=labels.description;
  const detail=document.createElement('p');detail.textContent=labels.detail;
  const status=document.createElement('p');status.className='advertising-choice-status';status.setAttribute('role','status');
  const controls=document.createElement('div');controls.className='advertising-choice-actions';
  for(const [action,label] of [['deny',labels.deny],['allow',labels.allow],['close',labels.close]]){const b=document.createElement('button');b.type='button';b.dataset.advertisingChoice=action;b.textContent=label;controls.append(b);}
  const privacy=document.createElement('a');privacy.href=config.privacy;privacy.textContent=labels.policy;
  dialog.append(heading,copy,detail,status,controls,privacy);document.body.append(dialog);
  function update(){
   const allowed=saved?.advertising===true;status.textContent=allowed?labels.allowed:labels.denied;
   if(slot){slot.dataset.advertisingConsent=allowed?'granted':'denied';const placeholder=slot.querySelector('[data-advertising-placeholder]');if(placeholder)placeholder.hidden=allowed;}
  }
  function open(control){opener=control;if(!dialog.open)dialog.showModal();}
  function close(){dialog.close();if(opener?.isConnected)opener.focus({preventScroll:true});opener=null;}
  function reloadLoaded(){if(!reloadRequested){reloadRequested=true;location.reload();}}
  function load(){
   if(reloadRequested||loaded||!near||!live||!stage||saved?.advertising!==true||document.visibilityState==='hidden')return;
   const unit=unitForWidth(stage.clientWidth,config);if(!unit)return;
   // This is the publisher's ordinary Banner tag: one atOptions block and its
   // matching invoke.js. Never fetch the vendor before consent or wrap its tag.
   loaded=true;loadedWidth=unit.width;slot.dataset.advertisingFormat=unit.width===728?'desktop':'mobile';
   stage.style.minHeight=unit.height+'px';stage.style.width=unit.width+'px';
   window.atOptions={key:unit.key,format:'iframe',height:unit.height,width:unit.width,params:{}};
   const script=document.createElement('script');script.type='text/javascript';script.src=unit.src;script.async=true;
   script.addEventListener('error',()=>{slot.dataset.advertisingState='unavailable';},{once:true});
   stage.append(script);slot.dataset.advertisingState='loaded';observer?.disconnect();
  }
  function choose(allowed){
   saved=consentRecord(allowed);try{localStorage.setItem(config.storageKey,JSON.stringify(saved));}catch{}
   update();close();if(!allowed&&loaded){reloadLoaded();return;}load();
  }
  document.addEventListener('click',event=>{
   const button=event.target.closest?.('[data-advertising-open],[data-advertising-choice]');if(!button)return;
   event.preventDefault();if(button.hasAttribute('data-advertising-open'))open(button);
   else if(button.dataset.advertisingChoice==='close')close();else choose(button.dataset.advertisingChoice==='allow');
  });
  dialog.addEventListener('cancel',()=>{if(opener?.isConnected)opener.focus({preventScroll:true});opener=null;});
  window.addEventListener('storage',event=>{
   if(event.key!==config.storageKey&&event.key!==null)return;
   let next=null;
   if(event.key!==null){try{const value=JSON.parse(event.newValue);if(validConsent(value))next=value;}catch{}}
   saved=next;update();
   if(loaded&&saved?.advertising!==true){reloadLoaded();return;}
   load();
  });
  window.addEventListener('pageshow',()=>{if(saved&&!validConsent(saved)){saved=null;update();if(loaded)reloadLoaded();}});
  document.addEventListener('visibilitychange',load);
  if(slot&&stage){
   if('IntersectionObserver' in window){observer=new IntersectionObserver(entries=>{near=entries.some(entry=>entry.isIntersecting);if(near)load();},{rootMargin:'200px 0px'});observer.observe(slot);}
   else{const check=()=>{const box=slot.getBoundingClientRect();near=box.top<innerHeight+200&&box.bottom> -200;load();};window.addEventListener('scroll',check,{passive:true});check();}
   window.addEventListener('resize',()=>{if(!loaded)load();else{slot.hidden=false;slot.hidden=loadedWidth>slot.clientWidth;}},{passive:true});
  }
  window.K365Advertising={open,choice:()=>saved};update();
 }
}
