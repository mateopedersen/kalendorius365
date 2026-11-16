export const CONSENT_DAYS=180;
export function consentRecord(allowed,now=Date.now()){
 if(typeof allowed!=='boolean'||!Number.isFinite(now))throw Error('Invalid advertising choice');
 return {version:1,advertising:allowed,expiresAt:now+CONSENT_DAYS*86400000};
}
export function validConsent(value,now=Date.now()){
 return Boolean(value&&value.version===1&&typeof value.advertising==='boolean'&&Number.isFinite(value.expiresAt)&&value.expiresAt>now&&value.expiresAt<=now+CONSENT_DAYS*86400000);
}
export function validUnit(unit,hosts){
 if(!unit||!((unit.width===728&&unit.height===90)||(unit.width===300&&unit.height===250))||!/^[a-f0-9]{32}$/.test(unit.key))return false;
 try{const url=new URL(unit.src);return url.protocol==='https:'&&hosts.includes(url.hostname)&&!url.username&&!url.password&&!url.port&&!url.search&&!url.hash&&url.pathname==='/22/'+unit.key;}catch{return false;}
}
export function unitForWidth(width,config){
 if(config.enabled!==true||!Number.isFinite(width))return null;
 const units=[config.desktop,config.mobile];
 return units.find(unit=>validUnit(unit,config.scriptHosts||[])&&unit.width<=width)||null;
}
