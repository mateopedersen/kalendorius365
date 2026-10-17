/** Progressive enhancement: server HTML includes all three year panels and real ICS links. */
export function yearFromLocation(location, years) {
 const fromHash=location.hash.match(/^#metai-(\d{4})$/)?.[1];
 const fromQuery=new URLSearchParams(location.search).get('metai');
 return years.includes(fromHash) ? fromHash : years.includes(fromQuery) ? fromQuery : years[0];
}
export function enhanceHoliday(root, location=window.location, history=window.history) {
 const panels=[...root.querySelectorAll('[data-hd-year]')];
 const years=panels.map(p=>p.dataset.hdYear);
 const links=[...root.querySelectorAll('[data-hd-select]')];
 const label=root.querySelector('[data-hd-selected-date]');
 const live=root.querySelector('.hd-live');
 function select(year, announce=false) {
  const active=panels.find(p=>p.dataset.hdYear===year);
  if(!active)return;
  panels.forEach(p=>{p.hidden=p!==active;});
  links.forEach(a=>{if(a.dataset.hdSelect===year)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');});
  label.textContent=active.dataset.hdLabel;
  root.dataset.hdActiveYear=year;
  if(announce)live.textContent=active.dataset.hdLabel;
 }
 links.forEach(a=>a.addEventListener('click',event=>{
  if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();select(a.dataset.hdSelect,true);
  const u=new URL(location.href);u.searchParams.set('metai',a.dataset.hdSelect);u.hash='datos';history.replaceState(null,'',u);
 }));
 select(yearFromLocation(location,years));
 window.addEventListener('hashchange',()=>{if(/^#metai-/.test(location.hash))select(yearFromLocation(location,years),true);});
}
if(typeof document!=='undefined')document.querySelectorAll('[data-hd-detail]').forEach(root=>enhanceHoliday(root));
