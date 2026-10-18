import { addDays, parse, today } from './calendar.js?v=d2d84b990885';
import { validate, empty } from './storage.js?v=d2d84b990885';
export { today as vilniusToday };
export const ALPHABET = 'A Ą B C Č D E Ę Ė F G H I Į Y J K L M N O P R S Š T U Ų Ū V Z Ž'.split(' ');
export const collator = new Intl.Collator('lt', { sensitivity: 'variant' });
export const foldName = (s) => String(s).normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('lt');
export function buildIndex(records) {
  const map = new Map();
  for (const row of records) for (const name of row.names) {
    const key = name.normalize('NFC').toLocaleLowerCase('lt');
    if (!map.has(key)) map.set(key, { name, dates: [] });
    map.get(key).dates.push(row.date);
  }
  return [...map.values()].map(r => ({ ...r, dates: [...new Set(r.dates)].sort() })).sort((a,b)=>collator.compare(a.name,b.name));
}
export function searchNames(index, { query = '', letter = '', month = '' } = {}) {
  const q = query.trim().normalize('NFC').toLocaleLowerCase('lt').slice(0,80);
  const match = index.filter(r => (!letter || r.name[0].toLocaleUpperCase('lt') === letter) && (!q || foldName(r.name).includes(foldName(q))))
    .map(r => ({ ...r, dates: r.dates.filter(d => !month || Number(d.slice(0,2)) === Number(month)) })).filter(r=>r.dates.length);
  // Exact native spelling precedes accent-insensitive convenience matches.
  return match.sort((a,b) => Number(b.name.toLocaleLowerCase('lt') === q) - Number(a.name.toLocaleLowerCase('lt') === q) || collator.compare(a.name,b.name));
}
export function validOccurrence(key, year) {
  if (!/^\d{2}-\d{2}$/.test(key) || !Number.isInteger(year) || year < 1900 || year > 2100) return null;
  try { const d = `${year}-${key}`; parse(d); return d; } catch { return null; }
}
export function nextOccurrence(key, from) {
  parse(from);
  for (let y=Number(from.slice(0,4));y<=2100;y++) {
    const d=validOccurrence(key,y); if (d && d>=from) return d;
  }
  return null;
}
export function nameDayEvent(record, date, name = '', recurring = false) {
  if (date.slice(5) !== record.date || !validOccurrence(record.date, Number(date.slice(0,4))) || (name && !record.names.includes(name))) throw Error('Pasirinkite galiojančią datą ir vardą iš sąrašo.');
  let hash=2166136261;
  for(const c of `${date}|${name}|${recurring}`) hash=Math.imul(hash^c.codePointAt(0),16777619)>>>0;
  const event={ id:`vardadienis-${date}-${hash.toString(16)}`, title:name ? `${name}: vardadienis` : 'Dienos vardadieniai',
    description:`${name || record.names.join(', ')}. Vardadienių data pagal lietuviškos Vikipedijos dienos straipsnį.\nŠaltinis: ${record.source_page}\nRedakcija: ${record.source_revision}\nLietuviškos Vikipedijos bendraautoriai; Kalendorius365 išskyrė ir susistemino vardus. CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/`,
    start:date,end:date,allDay:true,category:0,important:false,repeat:recurring?'yearly':'none',until:'' };
  const state=empty(); state.events=[event]; validate(state); return event;
}
export function weekDates(date) { parse(date); return Array.from({length:7},(_,i)=>addDays(date,i)); }
