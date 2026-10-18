import { Astronomy as A } from './astronomy-engine.js?v=2f62d0a9fccd';

export const ZONE = 'Europe/Vilnius';
export const PHASES = ['Jaunatis','Priešpilnis','Pilnatis','Delčia'];
export const STAGES = ['Jaunaties laikotarpis','Augantis pjautuvas','Priešpilnio laikotarpis','Augantis išgaubtas Mėnulis','Pilnaties laikotarpis','Dylantis išgaubtas Mėnulis','Delčios laikotarpis','Dylantis pjautuvas'];
export function lunarState(instant = new Date()) {
  const date = new Date(instant);
  if (!Number.isFinite(+date)) throw new Error('Neteisinga data');
  const illumination = A.Illumination(A.Body.Moon, date);
  const elongation = A.MoonPhase(date);
  return {date, illumination:illumination.phase_fraction, phaseAngle:illumination.phase_angle,
    elongation, waxing:elongation < 180, label:STAGES[Math.floor(((elongation+22.5)%360)/45)]};
}
export function noonInVilnius(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Neteisinga data');
  const probe = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(+probe) || probe.toISOString().slice(0,10)!==date) throw new Error('Neteisinga data');
  const hour = Number(new Intl.DateTimeFormat('en-GB',{timeZone:ZONE,hour:'2-digit',hourCycle:'h23'}).format(probe));
  return new Date(+probe-(hour-12)*3600000);
}
export function nextPhase(quarter, now=new Date()) {
  const found=A.SearchMoonPhase(quarter*90,new Date(+now+1000),40);
  if (!found) throw new Error('Nepavyko rasti artimiausios fazės');
  return found.date;
}
export function lunarAge(now=new Date()) {
  let previous=A.SearchMoonPhase(0,new Date(+now-35*86400000),40);
  if (!previous) return null;
  let next=A.SearchMoonPhase(0,new Date(+previous.date+1000),40);
  if (next && next.date<=now) previous=next;
  return (+now-previous.date)/86400000;
}
export function countdown(target,now=new Date()) {
  const total=Math.max(0,Math.ceil((+new Date(target)-now)/60000));
  return `${Math.floor(total/1440)} d. ${Math.floor(total%1440/60)} val. ${total%60} min.`;
}
export function localMoment(date) {
  return new Intl.DateTimeFormat('lt-LT',{timeZone:ZONE,year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(date));
}
function escapeICS(value) { return String(value).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,'); }
function fold(line) {
  const encoder=new TextEncoder();let result='',part='',bytes=0;
  for (const character of line) {
    const count=encoder.encode(character).length;
    if (bytes+count>75) { result+=part+'\r\n';part=' ';bytes=1; }
    part+=character;bytes+=count;
  }
  return result+part;
}
export function phaseICS(events,now=new Date()) {
  const stamp=now.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Kalendorius365//Mėnulio kalendorius//LT','CALSCALE:GREGORIAN','X-WR-CALNAME:Mėnulio fazės Lietuvos laiku'];
  for (const e of events) {
    const instant=new Date(e.utc);
    if (!Number.isFinite(+instant)) throw new Error('Neteisingas fazės laikas');
    const start=instant.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    lines.push('BEGIN:VEVENT',`UID:menulis-${e.phase}-${start}@kalendorius365.lt`,`DTSTAMP:${stamp}`,`DTSTART:${start}`,`SUMMARY:${escapeICS(e.label_lt)}`,
      'DESCRIPTION:Pagrindinės Mėnulio fazės momentas. Šaltinis: USNO. Laikas eksportuotas UTC.','TRANSP:TRANSPARENT','END:VEVENT');
  }
  lines.push('END:VCALENDAR');return lines.map(fold).join('\r\n')+'\r\n';
}
