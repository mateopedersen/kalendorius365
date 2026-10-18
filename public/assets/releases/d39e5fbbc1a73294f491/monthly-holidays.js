export function normalizeText(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('lt-LT').replace(/\s+/g, ' ').trim();
}
export function matchesRecord(record, category = 'all', query = '') {
  if (category !== 'all' && record.category !== category) return false;
  const text = normalizeText(record.search);
  return normalizeText(query).split(' ').filter(Boolean).every(token => text.includes(token));
}
export function nextWithinMonth(dates, todayISO) {
  return [...new Set(dates)].sort().find(d => d >= todayISO) || null;
}
export function vilniusDate(now = new Date()) {
  const p = new Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Vilnius',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const get = key => p.find(x => x.type === key).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function dateLabel(iso) {
  return new Intl.DateTimeFormat('lt-LT',{timeZone:'UTC',month:'long',day:'numeric',weekday:'long'}).format(new Date(iso+'T12:00:00Z'));
}

if (typeof document !== 'undefined') {
  const root = document.querySelector('[data-month-guide]');
  if (root) {
    const all = selector => [...root.querySelectorAll(selector)];
    const records = all('[data-event]').map(el => ({el, id:el.dataset.event, date:el.dataset.date, category:el.dataset.category, search:`${el.querySelector('h4').textContent} ${el.querySelector('p').textContent} ${el.dataset.date} ${dateLabel(el.dataset.date)}`}));
    const days = all('[data-day]');
    const groups = all('[data-date-group]');
    const categoryButtons = all('[data-category-filter]');
    const query = root.querySelector('#mh-search');
    const status = root.querySelector('.mh-results');
    const dayInfo = root.querySelector('#mh-day-info');
    const empty = root.querySelector('.mh-empty');
    let category = 'all';
    let selected = null;
    function describeDate(iso) {
      const visible = records.filter(r => r.date === iso && !r.el.hidden);
      const total = records.filter(r => r.date === iso).length;
      const suffix = visible.length ? ` Rodomi įrašai: ${visible.length}. ${visible.map(r=>r.el.querySelector('h4').textContent).join('; ')}.` : total ? ' Pagal pasirinktus filtrus šios dienos įrašai nerodomi. Galite atkurti viską.' : ' Patikrintame sąraše šiai dienai įrašų nėra. Tai savaime nenustato jūsų darbo grafiko.';
      dayInfo.textContent = dateLabel(iso) + '.' + suffix;
    }
    function applyFilters() {
      for (const r of records) r.el.hidden = !matchesRecord(r, category, query.value);
      for (const group of groups) group.hidden = !records.some(r => r.date === group.dataset.dateGroup && !r.el.hidden);
      for (const day of days) {
        const es = records.filter(r => r.date === day.dataset.day && !r.el.hidden);
        const count = day.querySelector('.mh-daycount');
        if (count) {count.textContent = String(es.length);count.hidden = es.length === 0;}
        for (const mark of day.querySelectorAll('[data-mark-category]')) mark.hidden = !es.some(r => r.category === mark.dataset.markCategory);
        day.classList.toggle('mh-day--muted', es.length === 0);
        day.setAttribute('aria-label', `${dateLabel(day.dataset.day)}. ${es.length ? es.map(r=>r.el.querySelector('h4').textContent).join('; ')+'.' : 'Pagal dabartinius filtrus įrašų nėra.'}`);
      }
      for (const button of categoryButtons) button.setAttribute('aria-pressed', String(button.dataset.categoryFilter === category));
      const visibleCount = records.filter(r=>!r.el.hidden).length;
      status.textContent = `Rodoma įrašų: ${visibleCount} iš ${records.length}.`;
      empty.hidden = visibleCount > 0;
      if (selected) describeDate(selected);
      refreshNext();
    }
    for (const button of categoryButtons) button.addEventListener('click', () => {category = button.dataset.categoryFilter;applyFilters();});
    query.addEventListener('input', applyFilters);
    root.querySelector('[data-reset]').addEventListener('click', () => {category='all';query.value='';applyFilters();});
    function selectDay(iso, scroll = true) {
      selected=iso;
      for (const d of days) {if(d.dataset.day===iso)d.setAttribute('aria-current','date');else d.removeAttribute('aria-current');}
      for (const group of groups) group.classList.toggle('is-selected', group.dataset.dateGroup===iso);
      describeDate(iso);
      const group = groups.find(g=>g.dataset.dateGroup===iso && !g.hidden);
      const target = group || dayInfo;
      if(scroll){target.scrollIntoView({block:'start',behavior:'auto'});target.focus({preventScroll:true});}
    }
    for (const day of days) {
      day.addEventListener('click', event => {event.preventDefault();selectDay(day.dataset.day);});
      day.addEventListener('keydown', event => {
        const i=days.indexOf(day);let ni=null;
        if(event.key==='ArrowRight')ni=i+1;if(event.key==='ArrowLeft')ni=i-1;
        if(event.key==='ArrowDown')ni=i+7;if(event.key==='ArrowUp')ni=i-7;
        if(event.key==='Home')ni=i-((new Date(day.dataset.day+'T12:00:00Z').getUTCDay()+6)%7);
        if(event.key==='End')ni=i+6-((new Date(day.dataset.day+'T12:00:00Z').getUTCDay()+6)%7);
        if(ni!==null){event.preventDefault();days[Math.max(0,Math.min(days.length-1,ni))].focus();}
      });
    }
    const next = root.querySelector('[data-next-date]');
    function refreshNext() {
      const dates=records.filter(r=>!r.el.hidden).map(r=>r.date).sort();
      next.hidden=dates.length===0;
      if(!dates.length)return;
      const upcoming=nextWithinMonth(dates,vilniusDate());
      const ds=upcoming||dates[0];
      next.href='#data-'+ds;
      next.querySelector('span').textContent=upcoming ? 'Artimiausia pagal filtrus: '+dateLabel(ds) : '2027 m. archyvas · '+dateLabel(ds);
    }
    next.addEventListener('click',event=>{event.preventDefault();const ds=next.getAttribute('href').slice(6);selectDay(ds);});
    root.querySelectorAll('[data-enhance] button,[data-enhance] input').forEach(el=>el.disabled=false);
    applyFilters();
  }
}
