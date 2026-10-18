export const SEASON_IDS=['spring','summer','autumn','winter'];
export const SEASON_NAMES=['Pavasario lygiadienis','Vasaros saulėgrįža','Rudens lygiadienis','Žiemos saulėgrįža'];
export function nextSeasonEvent(events,id,now=Date.now()){
 return events.filter(e=>(!id||e.id===id)&&Date.parse(e.utc)>now).sort((a,b)=>Date.parse(a.utc)-Date.parse(b.utc))[0]||null;
}
export function validatedSelection(params,years,cities){
 const year=Number(params.get('metai')),city=params.get('miestas');
 return {year:years.includes(year)?year:years[0],city:cities.some(c=>c.id===city)?city:'vilnius'};
}
export function durationLabel(minutes){return `${Math.floor(minutes/60)} val. ${String(minutes%60).padStart(2,'0')} min.`;}
export function chartPath(values,width=1000,height=250){
 if(values.length<2||values.some(n=>!Number.isFinite(n)||n<0||n>1440))throw Error('Neteisingi dienos ilgumo duomenys.');
 return values.map((v,i)=>`${i?'L':'M'}${(i/(values.length-1)*width).toFixed(2)},${(height-v/1440*height).toFixed(2)}`).join(' ');
}
export function calendarDayLabel(date){return new Intl.DateTimeFormat('lt-LT',{timeZone:'UTC',month:'long',day:'numeric'}).format(new Date(date+'T12:00:00Z'));}
export function countdownParts(utc,now){const delta=Math.max(0,Date.parse(utc)-now);return {days:Math.floor(delta/86400000),hours:Math.floor(delta/3600000)%24,minutes:Math.floor(delta/60000)%60};}

export function seasonGuideHref(path,year,city){
 const allowed=['/metu-laikai/','/pavasario-lygiadienis/','/vasaros-saulegriza/','/rudens-lygiadienis/','/ziemos-saulegriza/'];
 if(!allowed.includes(path)||![2027,2028,2029].includes(year)||!['vilnius','kaunas','klaipeda','siauliai','panevezys'].includes(city))throw Error('Neteisinga metų laikų nuoroda.');
 return `${path}?${new URLSearchParams({metai:String(year),miestas:city})}`;
}
