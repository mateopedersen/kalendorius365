// Basic consent mode: the Google library is absent until an explicit choice.
export function createAnalytics({id,hosts,key},target=window){
  if(target.Calendar365Analytics?.id===id)return target.Calendar365Analytics;
  const duration=180*86400000,doc=target.document,listeners=new Set();
  let record=null,loaded=false,expiryTimer;
  const now=()=>Date.now();
  function read(raw){try{const v=JSON.parse(raw);return v?.version===1&&typeof v.analytics==='boolean'&&Number.isFinite(v.expiresAt)&&v.expiresAt>now()&&v.expiresAt<=now()+duration?v:null;}catch{return null;}}
  try{record=read(target.localStorage.getItem(key));}catch{}
  const clean=value=>{try{const u=new URL(value);return /^https?:$/.test(u.protocol)?u.origin+u.pathname:'';}catch{return '';}};
  const allowedHost=hosts.includes(target.location.hostname)&&/^G-[A-Z0-9]{5,}$/.test(id)&&!/^\/(?:admin|api)(?:\/|$)/.test(target.location.pathname);
  const title=doc.querySelector('meta[property="og:title"]')?.content||doc.title;
  function forget(){
    for(const cookie of doc.cookie.split(';')){
      const name=cookie.trim().split('=')[0];if(!/^_ga(?:_|$)/.test(name))continue;
      for(const domain of new Set(['',target.location.hostname,...hosts.map(h=>'.'+h)]))doc.cookie=name+'=;Max-Age=0;Path=/'+(domain?';Domain='+domain:'')+';SameSite=Lax;Secure';
    }
  }
  function apply(){
    target['ga-disable-'+id]=!record?.analytics||!allowedHost;
    if(!record?.analytics||!allowedHost){
      if(loaded)target.gtag('consent','update',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
      return;
    }
    if(loaded){target.gtag('consent','update',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});return;}
    loaded=true;target.dataLayer=target.dataLayer||[];target.gtag=function(){target.dataLayer.push(arguments);};
    target.gtag('consent','default',{analytics_storage:'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
    target.gtag('consent','update',{analytics_storage:'granted',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
    const settings={send_page_view:true,page_title:title,page_location:clean(target.location.href),page_referrer:clean(doc.referrer),allow_google_signals:false,allow_ad_personalization_signals:false,cookie_expires:15552000,cookie_update:false};
    // Defaults must precede startup, which can initiate an automatic page view.
    target.gtag('set',settings);target.gtag('js',new Date());target.gtag('config',id,settings);
    const script=doc.createElement('script');script.async=true;script.src='https://www.googletagmanager.com/gtag/js?id='+id;doc.head.append(script);
  }
  function changed(){for(const fn of listeners)fn(record?{...record}:null);}
  function checkExpiry(){
    target.clearTimeout(expiryTimer);
    if(!record)return;
    const remaining=record.expiresAt-now();
    if(remaining>0){
      // Browser timers accept at most a signed 32-bit millisecond delay.
      expiryTimer=target.setTimeout(checkExpiry,Math.min(remaining,2147483647));
      return;
    }
    record=null;
    apply();
    forget();
    changed();
  }
  const api={id,choice:()=>record?{...record}:null,subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},choose(analytics){
    record={version:1,analytics:analytics===true,expiresAt:now()+duration};
    try{target.localStorage.setItem(key,JSON.stringify(record));}catch{}
    if(!record.analytics){target['ga-disable-'+id]=true;forget();}
    checkExpiry();apply();changed();
  }};
  target.Calendar365Analytics=api;
  target.addEventListener('storage',event=>{if(event.key!==key&&event.key!==null)return;record=read(event.newValue);if(!record?.analytics)forget();checkExpiry();apply();changed();});
  target.addEventListener('pageshow',checkExpiry);
  doc.addEventListener('visibilitychange',()=>{if(!doc.hidden)checkExpiry();});
  checkExpiry();apply();return api;
}

if(typeof document!=='undefined'){
const analytics=createAnalytics({id:'G-X6YPLKE9K9',hosts:['kalendorius365.lt','www.kalendorius365.lt'],key:'kalendorius365:analytics-consent:v1'});
const notice=document.querySelector('#cookie-notice');
if(notice){
  let opener=null;
  const update=()=>{notice.hidden=!!analytics.choice();};
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-analytics-choice],[data-privacy-open],[data-cookie-preferences],[data-privacy-close]');if(!button)return;
    event.preventDefault();
    if(button.hasAttribute('data-analytics-choice')){analytics.choose(button.dataset.analyticsChoice==='yes');notice.hidden=true;opener?.focus({preventScroll:true});}
    else if(button.hasAttribute('data-privacy-close')){notice.hidden=true;opener?.focus({preventScroll:true});}
    else{opener=button;notice.hidden=false;notice.querySelector('button[data-analytics-choice]')?.focus({preventScroll:true});}
  });
  analytics.subscribe(update);update();
}

}
