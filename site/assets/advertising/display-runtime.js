/** The publisher's ordinary responsive Banner tag. No Smartlink, intermediary
 * creative, proxy, extra iframe wrapper, paid refresh or automatic ad click. */
export function mountDisplayBanner(config,target=window){
 const doc=target.document,slot=doc.querySelector('[data-advertising-slot][data-advertising-mode="display-banner"]');
 if(!slot||slot.dataset.bannerMounted)return;
 slot.dataset.bannerMounted='true';
 const stage=slot.querySelector('[data-advertising-stage]');
 const canonical=doc.querySelector('link[rel="canonical"]')?.href;
 let canonicalPath;try{canonicalPath=new URL(canonical).pathname;}catch{}
 const live=config?.enabled===true&&config.mode==='display-banner'&&config.hosts?.includes(target.location.hostname)&&!target.location.search&&!target.location.hash&&canonicalPath===target.location.pathname;
 const scriptUrl=unit=>{
  try{
   const url=new URL(unit.src);
   const supportedSize=(unit.width===728&&unit.height===90)||(unit.width===300&&unit.height===250);
   if(!supportedSize||!/^[a-f0-9]{32}$/.test(unit.key)||url.protocol!=='https:'||!config.scriptHosts.includes(url.hostname)||url.port||url.username||url.password||url.search||url.hash||url.pathname!=='/22/'+unit.key)return null;
   return url.href;
  }catch{return null;}
 };
 const read=()=>{try{const v=JSON.parse(target.localStorage.getItem(config.storageKey)||'null');const advertising=typeof v?.advertising==='boolean'?v.advertising:typeof v?.allowed==='boolean'?v.allowed:null;return v?.version===1&&advertising!==null&&Number.isFinite(v.expiresAt)&&v.expiresAt>Date.now()&&v.expiresAt<=Date.now()+180*86400000?{...v,advertising}:null;}catch{return null;}};
 let choice=read(),loaded=false,unitWidth=0;
 const update=()=>{slot.hidden=!live||choice?.advertising===false;doc.querySelectorAll('[data-banner-status]').forEach(el=>{el.textContent=(choice?.advertising===false?config.displayLabels?.off:config.displayLabels?.on)||'';});};
 const load=()=>{
  update();if(slot.hidden||loaded||!stage||doc.visibilityState==='hidden')return;
  const width=slot.clientWidth;
  const match=[config.desktop,config.mobile]
   .filter(unit=>unit?.width<=width)
   .map(unit=>({unit,src:scriptUrl(unit)}))
   .find(unit=>unit.src);
  if(!match){slot.hidden=true;return;}
  const {unit,src}=match;
  loaded=true;unitWidth=unit.width;slot.dataset.advertisingFormat=unit.width===728?'desktop':'mobile';
  slot.dataset.advertisingState='loading';stage.style.width=unit.width+'px';stage.style.minHeight=unit.height+'px';
  target.atOptions={key:unit.key,format:'iframe',height:unit.height,width:unit.width,params:{}};
  const script=doc.createElement('script');script.type='text/javascript';script.async=true;script.src=src;
  script.addEventListener('load',()=>{slot.dataset.advertisingState='requested';},{once:true});
  script.addEventListener('error',()=>{slot.dataset.advertisingState='unavailable';slot.hidden=true;},{once:true});
  stage.append(script);
 };
 const choose=allowed=>{
  choice={version:1,advertising:allowed,expiresAt:Date.now()+180*86400000};
  try{target.localStorage.setItem(config.storageKey,JSON.stringify(choice));}catch{}
  if(!allowed&&loaded){stage?.replaceChildren();slot.dataset.advertisingState='disabled';}
  update();if(allowed&&!loaded)load();
 };
 doc.addEventListener('click',event=>{const b=event.target.closest?.('[data-banner-choice]');if(!b)return;event.preventDefault();choose(b.dataset.bannerChoice==='on');});
 target.addEventListener('storage',event=>{if(event.key!==config.storageKey&&event.key!==null)return;choice=read();if(choice?.advertising===false&&loaded)stage?.replaceChildren();update();if(!loaded)load();});
 target.addEventListener('resize',()=>{if(!loaded)load();else{update();if(!slot.hidden&&unitWidth>slot.clientWidth)slot.hidden=true;}},{passive:true});
 doc.addEventListener('visibilitychange',()=>{if(!loaded)load();});
 target.Calendar365Banner={choice:()=>choice,setAllowed:choose};
 update();target.requestAnimationFrame(load);
}
