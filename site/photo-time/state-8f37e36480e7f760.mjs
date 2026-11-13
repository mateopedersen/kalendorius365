let engine;
const cache=new Map();
const localDate=(instant,zone)=>new Intl.DateTimeFormat('sv-SE',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(instant);
function offset(instant,zone){
  const value=new Intl.DateTimeFormat('en-US',{timeZone:zone,timeZoneName:'shortOffset'}).formatToParts(instant).find(part=>part.type==='timeZoneName').value;
  if(value==='GMT')return 0;
  const match=value.match(/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/);
  if(!match)throw Error('Unsupported time-zone offset');
  return (match[1]==='-'?-1:1)*(Number(match[2])*60+Number(match[3]||0))*60000;
}
export async function cityPhotoState(city,instant=new Date()){
  const latitude=city.latitude??city.lat,longitude=city.longitude??city.lon,zone=city.timeZone;
  if(typeof zone!=='string'||!zone||!Number.isFinite(latitude)||!Number.isFinite(longitude)||!Number.isFinite(+instant))throw TypeError('Invalid city or photo time');
  const A=await(engine??=import('./astronomy-dbe07509b72ca412.mjs'));
  const ds=localDate(instant,zone),key=[city.id,latitude,longitude,zone,ds].join('|');
  if(!cache.has(key)){
    if(cache.size>=256)cache.delete(cache.keys().next().value);
    const probe=new Date(ds+'T00:00:00Z'),next=new Date(+probe+86400000);
    const start=new Date(+probe-offset(probe,zone)),end=new Date(+next-offset(next,zone));
    const observer=new A.Observer(latitude,longitude,0);
    const find=direction=>{
      const result=A.SearchRiseSet('Sun',observer,direction,start,(end-start)/86400000+.00001)?.date;
      return result&&result>=start&&result<end&&localDate(result,zone)===ds?result:null;
    };
    const rise=find(1),set=find(-1),equator=A.Equator('Sun',start,observer,true,true);
    const up=A.Horizon(start,observer,equator.ra,equator.dec,'normal').altitude>-.2666;
    cache.set(key,{rise,set,start,end,up});
  }
  const {rise,set,end,up}=cache.get(key);
  const day=rise&&set?(rise<set?instant>=rise&&instant<set:instant<set||instant>=rise):rise?instant>=rise:set?instant<set:up;
  const nextChange=[rise,set,end].filter(time=>time&&time>instant).sort((a,b)=>a-b)[0];
  return {period:day?'day':'night',nextChange,rise,set};
}
