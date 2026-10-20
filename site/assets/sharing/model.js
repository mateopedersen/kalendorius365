import {lt} from './i18n.js';
export const ORIGIN='https://kalendorius365.lt';
export function publicUrl(value){const u=new URL(value,ORIGIN);if(u.origin!==ORIGIN||u.username||u.password||u.protocol!=='https:')throw new Error('invalid_public_url');u.search='';u.hash='';return u.href;}
export function validateRecord(raw){
 if(!raw||!['site','page','calendar','design','horoscope'].includes(raw.kind))throw new Error('invalid_kind');
 const p={};for(const key of ['kind','contentId','canonicalUrl','shareUrl','title','excerpt','locale','timezone','contentDate','contentVersion','signSlug','signName','year','month','day','templateId','designType','imageUrl','imageAlt','artwork','pdf','webp','sections','displayDate'])if(raw[key]!==undefined)p[key]=raw[key];
 p.canonicalUrl=publicUrl(p.canonicalUrl);p.shareUrl=publicUrl(p.shareUrl);p.imageUrl=publicUrl(p.imageUrl);p.artwork=publicUrl(p.artwork||p.imageUrl);
 if(p.locale!=='lt-LT'||p.timezone!=='Europe/Vilnius'||typeof p.title!=='string'||p.title.length>300||typeof p.contentId!=='string')throw new Error('invalid_record');
 if(p.kind==='horoscope'){
  const route=`/horoskopai/${p.signSlug}/${p.contentDate}/v-${p.contentVersion}/`;
  const currentAlias=new URL(`/horoskopai/${p.signSlug}/`,ORIGIN).href;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(p.contentDate)||Number.isNaN(Date.parse(`${p.contentDate}T00:00:00Z`))||new Date(`${p.contentDate}T00:00:00Z`).toISOString().slice(0,10)!==p.contentDate||!['avinas','jautis','dvyniai','vezys','liutas','mergele','svarstykles','skorpionas','saulys','oziaragis','vandenis','zuvys'].includes(p.signSlug)||!/^[0-9a-f]{16}$/.test(p.contentVersion)||p.shareUrl!==new URL(route,ORIGIN).href||![p.shareUrl,currentAlias].includes(p.canonicalUrl)||p.contentId!==`horoscope-${p.signSlug}-${p.contentDate}-${p.contentVersion}`)throw new Error('invalid_snapshot');
 }
 const monthSlugs=['sausis','vasaris','kovas','balandis','geguze','birzelis','liepa','rugpjutis','rugsejis','spalis','lapkritis','gruodis'];
 if(p.kind==='calendar'&&(![2027,2028,2029].includes(p.year)||(p.month!==undefined&&(!Number.isInteger(p.month)||p.month<1||p.month>12))))throw new Error('invalid_calendar');
 if(p.kind==='calendar'){const route=`/${p.year}/${p.month?monthSlugs[p.month-1]+'/':''}`;if(p.canonicalUrl!==new URL(route,ORIGIN).href||p.shareUrl!==p.canonicalUrl)throw new Error('invalid_calendar_route');}
 if(p.kind==='horoscope'){
  if(!p.sections||typeof p.sections!=='object')throw new Error('invalid_sections');
  p.sections=Object.fromEntries(['lead','relationships','work'].filter(k=>typeof p.sections[k]==='string'&&p.sections[k].length<=12000).map(k=>[k,p.sections[k]]));
  if(!p.sections.lead)throw new Error('invalid_sections');
 }
 if(p.kind==='design'){
  const route=`/dalintis/kalendorius/${p.templateId}/`;
  if(!/^[a-z0-9-]{1,100}$/.test(p.templateId||'')||p.shareUrl!==new URL(route,ORIGIN).href||p.canonicalUrl!==p.shareUrl||!['blank','dated'].includes(p.designType)||(p.designType==='blank'&&p.year!==undefined)||(p.designType==='dated'&&![2027,2028,2029].includes(p.year)))throw new Error('invalid_design');
 }
 return Object.freeze(p);
}
export function graphemes(text){return Array.from(new Intl.Segmenter('lt-LT',{granularity:'grapheme'}).segment(String(text)),x=>x.segment);}
export function shorten(text,budget){const parts=graphemes(text);if(parts.length<=budget)return text;if(budget<2)return '';return parts.slice(0,budget-1).join('').replace(/\s+\S*$/u,'').trimEnd()+'…';}
export function vilniusDate(now=new Date()){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Vilnius',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const get=k=>parts.find(p=>p.type===k).value;return `${get('year')}-${get('month')}-${get('day')}`;}
export function excerptFor(p,section='lead',limit=180){const source=p.kind==='horoscope'&&['lead','relationships','work'].includes(section)?p.sections?.[section]:p.excerpt;return shorten(source||p.excerpt||p.title,limit);}
export function shareText(p,{section='lead',caption='',now=null,short=false}={}){
 const excerpt=excerptFor(p,section,short?95:180);let text;
 if(p.kind==='horoscope'){const args={excerpt,sign:p.signName,date:p.displayDate};text=now instanceof Date&&!Number.isNaN(now.valueOf())&&p.contentDate===vilniusDate(now)?(short?lt.horoscopeShort(args):lt.horoscopeToday(args)):lt.horoscopeArchive(args);}else text=`${p.title}\n${excerpt}`;
 const note=String(caption).trim();if(note)text+=`\n\n${lt.ownNote}: ${shorten(note,240)}`;
 return text;
}
export function combinedText(p,options={}){return `${shareText(p,options)}\n${p.shareUrl}`;}
