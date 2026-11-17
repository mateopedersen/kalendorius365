import {consentRecord,validConsent,unitForWidth} from './ad-policy.js';
const configNode=document.getElementById('advertising-config');
if(configNode){
 let config;try{config=JSON.parse(configNode.textContent);}catch{}
 if(config&&typeof config.storageKey==='string'&&config.labels){
  const cookie=["Slapukų nustatymai", "Leisti visus", "Tik būtinieji", "Išsaugoti pasirinkimą", "Uždaryti", "Reklama (Adsterra)", "Analitika (Google Analytics)", "Gavusi leidimą Adsterra naudoja ryšio informaciją ir slapukus reklamai rodyti ir vertinti. Svetaine galite naudotis ir be papildomų slapukų.", "Puslapyje yra neišsaugotų pakeitimų. Įkėlus puslapį iš naujo bus sustabdytas įkeltas reklamos kodas. Tęsti?"];
  const labels=config.labels,slot=document.querySelector('[data-advertising-slot]');
  let saved=null,loaded=false,loadedWidth=0,near=false,observer=null,opener=null,reloadRequested=false,reloadApproved=false;
  try{const value=JSON.parse(localStorage.getItem(config.storageKey));if(validConsent(value))saved=value;}catch{}
  const publicView=location.search==='';
  if(slot&&!publicView)slot.hidden=true;
  const live=config.hosts.includes(location.hostname)&&publicView,stage=slot?.querySelector('[data-advertising-stage]');
  const dialog=document.createElement('dialog');dialog.className='advertising-dialog';dialog.setAttribute('aria-labelledby','advertising-choice-title');
  const heading=document.createElement('h2');heading.id='advertising-choice-title';heading.textContent=cookie[0];
  const copy=document.createElement('p');copy.textContent=cookie[7];
  const detail=document.createElement('p');detail.textContent='';
  const status=document.createElement('p');status.className='advertising-choice-status';status.setAttribute('role','status');
  const controls=document.createElement('div');controls.className='advertising-choice-actions';
  for(const [action,label] of [['deny',cookie[2]],['allow',cookie[1]],['save',cookie[3]],['close',cookie[4]]]){const b=document.createElement('button');b.type='button';b.dataset.advertisingChoice=action;b.textContent=label;controls.append(b);}
  const privacy=document.createElement('a');privacy.href=config.privacy;privacy.textContent=labels.policy;
  const ads=document.createElement('input');ads.type='checkbox';const adsLabel=document.createElement('label');adsLabel.append(ads,document.createTextNode(cookie[5]));
  const ga=document.createElement('input');ga.type='checkbox';const gaLabel=document.createElement('label');gaLabel.append(ga,document.createTextNode(cookie[6]));
  const analytics=()=>window.Calendar365Analytics||window.K365Analytics;
  dialog.append(heading,copy,adsLabel,gaLabel,status,controls,privacy);document.body.append(dialog);
  const banner=document.createElement('section');banner.className='cookie-choice-banner';banner.setAttribute('role','region');banner.setAttribute('aria-label',cookie[0]);const bannerCopy=document.createElement('p');bannerCopy.textContent=cookie[7];banner.append(bannerCopy);for(const [action,text] of [['deny',cookie[2]],['allow',cookie[1]],['customize',cookie[0]]]){const b=document.createElement('button');b.type='button';b.dataset.advertisingChoice=action;b.textContent=text;banner.append(b);}document.body.append(banner);
  let dirty=false;document.addEventListener('input',e=>{if(e.target.matches?.('input,textarea,select')&&!dialog.contains(e.target)&&!banner.contains(e.target))dirty=true;});
  window.addEventListener('beforeunload',e=>{if(reloadRequested&&dirty&&!reloadApproved){e.preventDefault();e.returnValue='';}});
  document.querySelectorAll('.ad-placeholder,.ad-placement-settings').forEach(e=>e.remove());
  function update(){
   banner.hidden=!!saved;const allowed=saved?.advertising===true;if(slot)slot.hidden=!allowed||!publicView;status.textContent=reloadRequested?"Reklamos paslėptos. Įkelkite puslapį iš naujo, kad anksčiau įkeltas reklamos kodas būtų visiškai sustabdytas. Pirmiausia išsaugokite pakeitimus.":allowed?labels.allowed:labels.denied;
   if(slot){slot.dataset.advertisingConsent=allowed?'granted':'denied';const placeholder=slot.querySelector('[data-advertising-placeholder]');if(placeholder)placeholder.hidden=allowed;}
  }
  function open(control){opener=control;ads.checked=saved?.advertising===true;ga.checked=analytics()?.choice()?.analytics===true;gaLabel.hidden=!analytics();if(!dialog.open)dialog.showModal();}
  function close(){dialog.close();if(opener?.isConnected)opener.focus({preventScroll:true});opener=null;}
  function reloadLoaded(){if(!reloadRequested){reloadRequested=true;update();location.reload();}}
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
  function choose(allowed,all=false){
   if(!allowed&&loaded&&dirty){if(!confirm(cookie[8]))return;reloadApproved=true;}
   if(analytics()?.choose)analytics().choose(all?allowed:ga.checked);
   saved=consentRecord(allowed);try{localStorage.setItem(config.storageKey,JSON.stringify(saved));}catch{}
   update();close();if(!allowed&&loaded){reloadLoaded();return;}load();
  }
  document.addEventListener('click',event=>{
   const button=event.target.closest?.('[data-advertising-open],[data-cookie-preferences],[data-storage-open],[data-advertising-choice]');if(!button)return;
   event.preventDefault();if(button.hasAttribute('data-advertising-open')||button.hasAttribute('data-cookie-preferences')||button.hasAttribute('data-storage-open')||button.dataset.advertisingChoice==='customize')open(button);
   else if(button.dataset.advertisingChoice==='close')close();else choose(button.dataset.advertisingChoice==='save'?ads.checked:button.dataset.advertisingChoice==='allow',button.dataset.advertisingChoice!=='save');
  });
  dialog.addEventListener('cancel',()=>{if(opener?.isConnected)opener.focus({preventScroll:true});opener=null;});
  window.addEventListener('storage',event=>{
   if(event.key!==config.storageKey&&event.key!==null)return;
   let next=null;
   if(event.key!==null){try{const value=JSON.parse(event.newValue);if(validConsent(value))next=value;}catch{}}
   saved=next;update();
   if(loaded&&saved?.advertising!==true){stage?.querySelectorAll('iframe,script').forEach(e=>e.remove());reloadLoaded();return;}
   load();
  });
  window.addEventListener('pageshow',()=>{if(saved&&!validConsent(saved)){saved=null;update();if(loaded)reloadLoaded();}});
  document.addEventListener('visibilitychange',load);
  if(slot&&stage){
   if('IntersectionObserver' in window){observer=new IntersectionObserver(entries=>{near=entries.some(entry=>entry.isIntersecting);if(near)load();},{rootMargin:'200px 0px'});observer.observe(slot);}
   else{const check=()=>{const box=slot.getBoundingClientRect();near=box.top<innerHeight+200&&box.bottom> -200;load();};window.addEventListener('scroll',check,{passive:true});check();}
   window.addEventListener('resize',()=>{if(!loaded)load();else{slot.hidden=false;slot.hidden=saved?.advertising!==true||!publicView||reloadRequested||loadedWidth>slot.clientWidth;}},{passive:true});
  }
  const footerButton=document.querySelector('[data-cookie-preferences]')||document.createElement('button');footerButton.type='button';footerButton.dataset.cookiePreferences='';if(!footerButton.isConnected)footerButton.className='cookie-settings-control';footerButton.textContent=cookie[0];if(!footerButton.isConnected)(document.querySelector('footer')||document.body).append(footerButton);window.K365Advertising={open,choice:()=>saved};update();
 }
}
