import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {solarFor} from '../../site/assets/phase-5-6-8-core.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const source=read('data/seasons-phase3-instants.json');
const existing=read('data/astronomy/seasons-utc.json');
const cities=read('data/astronomy/cities.json').cities.map(c=>({...c,lat:c.latitude,lon:c.longitude}));
const ids=['spring','summer','autumn','winter'];
const names=['Pavasario lygiadienis','Vasaros saulėgrįža','Rudens lygiadienis','Žiemos saulėgrįža'];
const zone='Europe/Vilnius';
const dateFmt=new Intl.DateTimeFormat('lt-LT',{timeZone:zone,year:'numeric',month:'long',day:'numeric'});
const timeFmt=new Intl.DateTimeFormat('lt-LT',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const isoFmt=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const localParts=utc=>Object.fromEntries(isoFmt.formatToParts(new Date(utc)).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));
const dayAdd=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const dayLabel=date=>dateFmt.format(new Date(date+'T12:00:00Z'));
function event(utc,id,year,index){
 const p=localParts(utc),date=`${p.year}-${p.month}-${p.day}`;
 const offset=(Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute)-Date.parse(utc))/60000;
 return {id,year,name:names[index],utc,date,label:dateFmt.format(new Date(utc)),clock:timeFmt.format(new Date(utc)),offsetMinutes:offset,offset:`UTC+${String(offset/60).padStart(2,'0')}:00`};
}
const events=source.events.flatMap(row=>row.utc.map((utc,i)=>event(utc,ids[i],row.year,i)));
for(const row of existing.events){if(JSON.stringify(row.utc)!==JSON.stringify(source.events.find(e=>e.year===row.year).utc))throw Error('Existing authoritative instants must not be replaced.');}
const contexts={},annual={};
for(const year of source.comparison_years){
 annual[year]={};
 for(const city of cities){
  const length=(Date.UTC(year+1,0,1)-Date.UTC(year,0,1))/86400000;
  const curve=Array.from({length},(_,i)=>solarFor(new Date(Date.UTC(year,0,i+1)).toISOString().slice(0,10),city).dayMinutes);
  annual[year][city.id]={curve,min:Math.min(...curve),max:Math.max(...curve)};
 }
 for(const e of events.filter(e=>e.year===year)){
  contexts[`${e.id}-${year}`]={};
  for(const city of cities){
   const days=Array.from({length:15},(_,i)=>{const date=dayAdd(e.date,i-7),s=solarFor(date,city);return [date,timeFmt.format(new Date(s.sunrise)),timeFmt.format(new Date(s.sunset)),s.dayMinutes];});
   const today=solarFor(e.date,city);
   contexts[`${e.id}-${year}`][city.id]={days,noon:timeFmt.format(new Date(today.noon)),dayLabel:dayLabel(e.date),delta:days[14][3]-days[0][3]};
  }
 }
}
const result={schema:1,reviewDate:source.review_date,zone,precision:'minute',years:source.comparison_years,events,cities:cities.map(({id,name,latitude,longitude,sourceUrl})=>({id,name,latitude,longitude,sourceUrl})),contexts,annual,method:'Existing phase-5-6-8-core.js solarFor, unmodified; USNO iterative approximate solar coordinates, standard -0.833° rise/set horizon. City centres: GeoNames CC BY.'};
fs.mkdirSync(path.join(root,'site/assets/data'),{recursive:true});
fs.writeFileSync(path.join(root,'site/assets/data/seasons.json'),JSON.stringify(result));
console.log(`Seasons: ${events.length} verified instants, ${Object.keys(contexts).length*cities.length} city/event contexts; existing sun engine reused.`);
