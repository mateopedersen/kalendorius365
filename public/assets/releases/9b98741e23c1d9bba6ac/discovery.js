import { solarFor } from './phase-5-6-8-core.js';
function setupDiscovery() {
const search = document.querySelector('#commemoration-search');
if (search) {
 const normalize = s => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('lt');
 const filter = () => {
  const query = normalize(search.value.trim()); let count = 0;
  document.querySelectorAll('[data-commemoration]').forEach(card => {
   card.hidden = !normalize(card.textContent).includes(query);
   if (!card.hidden) count++;
  });
  document.querySelectorAll('[data-commemoration-month]').forEach(section => {
   section.hidden = ![...section.querySelectorAll('[data-commemoration]')].some(card => !card.hidden);
  });
  document.querySelector('#commemoration-status').textContent = count ? `Rasta dienų: ${count}` : 'Nieko nerasta. Pabandykite kitą pavadinimą.';
 };
 search.addEventListener('input', filter);
 filter();
}
const form = document.querySelector('#daylight-form');
if (form) {
 const input = document.querySelector('#daylight-date');
 const status = document.querySelector('#daylight-status');
 const clock = time => new Intl.DateTimeFormat('lt-LT', {timeZone:'Europe/Vilnius', hour:'2-digit', minute:'2-digit', hourCycle:'h23'}).format(new Date(time));
 let cities;
 async function render(event) {
  event?.preventDefault();
  if (!form.reportValidity()) return;
  try {
   if (!cities) {
    const response = await fetch('/assets/releases/9b98741e23c1d9bba6ac/data/astronomy/cities.json');
    if (!response.ok) throw new Error();
    cities = (await response.json()).cities;
   }
   const rows = document.querySelector('#daylight-rows'); rows.replaceChildren();
   const lengths = [];
   for (const city of cities) {
    const result = solarFor(input.value, {lat:city.latitude, lon:city.longitude});
    lengths.push(result.dayMinutes);
    const row = document.createElement('tr');
    const duration = `${Math.floor(result.dayMinutes / 60)} val. ${result.dayMinutes % 60} min.`;
    for (const text of [city.name, clock(result.sunrise), clock(result.sunset), duration]) {
     const cell = document.createElement('td'); cell.textContent = text; row.append(cell);
    }
    const cell = document.createElement('td'); const meter = document.createElement('meter');
    meter.min=0;meter.max=1440;meter.value=result.dayMinutes;meter.textContent=duration;
    meter.setAttribute('aria-label', `${city.name}: ${duration}`);cell.append(meter);row.append(cell);rows.append(row);
   }
   status.textContent=`${input.value} · Europe/Vilnius · Skirtumas tarp ilgiausios ir trumpiausios dienos: ${Math.max(...lengths)-Math.min(...lengths)} min.`;
  } catch { status.textContent='Duomenų nepavyko įkelti. Bandykite dar kartą.'; }
 }
 form.addEventListener('submit',render); render();
}

}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupDiscovery, {once:true});
else setupDiscovery();
