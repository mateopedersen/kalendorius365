import { formatDate, parse, today } from '../calendar.js';
import { exportICS } from '../ics.js';

const euro = new Intl.NumberFormat('lt-LT', { useGrouping: false, style: 'currency', currency: 'EUR' });
const number = new Intl.NumberFormat('lt-LT', { useGrouping: false, maximumFractionDigits: 2 });
const STORE = 'kalendorius365:benefit-reminders:v1';
const MAX_REMINDERS = 50;
const cent = value => Math.round((value + Number.EPSILON * Math.max(1, Math.abs(value))) * 100) / 100;
const money = value => euro.format(cent(value));

export function addMonths(date, months) {
  parse(date);
  const [year, month, day] = date.split('-').map(Number);
  const first = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(day, lastDay));
  return first.toISOString().slice(0, 10);
}

export function pensionDates(birth, rules, sex) {
  const historical = birth < rules.uniformFrom
    ? rules.historical[sex]?.find(([start, end]) => birth >= start && birth <= end) : null;
  if (birth < rules.uniformFrom && !historical) return null;
  const ageMonths = historical ? historical[2] : 12 * rules.age;
  const regular = addMonths(birth, ageMonths);
  const year = Number(regular.slice(0, 4));
  return {
    regular, ageMonths,
    application: year >= 2026 ? addMonths(regular, -rules.applyMonths) : null,
    early: year >= 2026 ? addMonths(regular, -12 * rules.earlyYears) : null,
    necessary: year < 2026 ? null : year === 2026 ? rules.necessary2026 : rules.necessaryLater,
  };
}

export function payroll({ gross, annual, npd, pension, contract }, rules) {
  const periods = annual ? 12 : 1;
  const allowance = !annual && !npd ? 0 : cent(Math.min(gross, Math.max(0,
    rules.maxNpd * periods - rules.npdSlope * Math.max(0, gross - rules.minimumWage * periods))));
  const taxable = Math.max(0, gross - allowance);
  const gpm = cent(annual
    ? Math.min(taxable, rules.bracket1) * 0.2
      + Math.max(0, Math.min(taxable, rules.bracket2) - rules.bracket1) * 0.25
      + Math.max(0, taxable - rules.bracket2) * 0.32
    : taxable * 0.2);
  const vsd = cent(Math.min(gross, rules.bracket2) * rules.vsdRate);
  const psd = cent(gross * rules.psdRate);
  const retirement = pension ? cent(gross * rules.pensionRate) : 0;
  const employer = gross > rules.bracket2 ? null : cent(gross * (rules.employerVsd[contract] + rules.employerFunds));
  return { gross, allowance, taxable: cent(taxable), gpm, vsd, psd, retirement, employer,
    net: cent(gross - gpm - vsd - psd - retirement),
    total: employer === null ? null : cent(gross + employer) };
}

export function vatTotal(amount, rate, extract) {
  const factor = 1 + rate / 100;
  const base = extract ? cent(amount / factor) : amount;
  const total = extract ? amount : cent(base * factor);
  return { base, total, vat: cent(total - base) };
}

export function heating({ members, income, cost }, rules) {
  const threshold = rules.vrp * (members === 1 ? rules.heatSingle : members * rules.heatPerson);
  const personalShare = cent(Math.max(0, income - threshold) * rules.heatRate);
  const area = members === 1 ? 50 : 38 + 12 + (members - 2) * 10;
  return { threshold, personalShare, area, compensation: cent(Math.max(0, cost - personalShare)) };
}

export function socialSupport({ members, income, duration }, rules) {
  const threshold = cent(rules.vrp * rules.incomeFactor);
  const perMember = income / members;
  const withinLimit = income < threshold * members;
  let benefit = 0;
  if (withinLimit && members === 1) benefit = rules.vrp * rules.singleFactors[duration] - income;
  if (withinLimit && members > 1) {
    const [first, second, later] = rules.familyWeights;
    benefit = (threshold - perMember) * (first + second + later * (members - 2));
  }
  return { threshold, perMember, withinLimit, benefit: benefit >= 1.45 ? cent(benefit) : 0 };
}

export function unemployment(income, rules) {
  return rules.rates.map(rate => cent(Math.min(rules.max, Math.max(rules.min, rules.fixed + income * rate))));
}

const result = (label, value, rows = [], note = '', reminder = '') => ({ label, value, rows, note, reminder });
const fields = controls => key => controls.namedItem(key);
const calculate = {
  pay(get, rules) {
    const annual = get('period').value === 'year';
    const pay = payroll({ gross: get('gross').valueAsNumber, annual, npd: get('npd').checked,
      pension: get('pension').checked, contract: get('contract').value }, rules.tax);
    const rows = [['Bruto', money(pay.gross)], ['NPD', money(pay.allowance)], ['GPM bazė', money(pay.taxable)],
      ['GPM', money(pay.gpm)], ['VSD', money(pay.vsd)], ['PSD', money(pay.psd)], ['II pakopa', money(pay.retirement)]];
    if (pay.employer !== null) rows.push(['Darbdavio įmokos', money(pay.employer)], ['Darbo vietos kaina', money(pay.total)]);
    const note = pay.gross > rules.tax.bracket2
      ? 'Kai viršijamos VSD lubos, darbdavio dalį tikrinkite „Sodroje“.'
      : annual ? 'Metinis modelis su progresiniu GPM. Faktinis mėnesio išskaitymas gali skirtis.'
        : 'Mėnesio GPM modelis taiko 20 %. Metiniam perskaičiavimui pasirinkite metinį režimą.';
    return result(annual ? 'Metinis atlyginimas į rankas' : 'Mėnesio atlyginimas į rankas', money(pay.net), rows, note);
  },
  vat(get, rules) {
    const rate = Number(get('rate').value);
    if (!rules.tax.vat.includes(rate)) return result('Tarifas', 'Pasirinkite galiojantį tarifą');
    const vat = vatTotal(get('amount').valueAsNumber, rate, get('direction').value === 'extract');
    return result('PVM suma', money(vat.vat), [['Be PVM', money(vat.base)], ['Su PVM', money(vat.total)],
      ['Pasirinktas tarifas', number.format(rate) + ' %']]);
  },
  pension(get, rules) {
    const birth = get('birth').value;
    const age = pensionDates(birth, rules.pension, get('sex').value);
    if (!age) return result('Pensinis amžius', 'Žr. „Sodros“ skaičiuoklę', [],
      'Šios gimimo datos nėra „Sodros“ paskelbtoje pereinamojo laikotarpio lentelėje. Oficiali nuoroda pateikta šaltiniuose.');
    const months = age.ageMonths % 12;
    const exactAge = Math.floor(age.ageMonths / 12) + ' m.' + (months ? ' ' + months + ' mėn.' : '');
    const rows = [['Taikomas pensinis amžius', exactAge]];
    if (age.necessary !== null) rows.push(['Prašymą galima planuoti nuo', formatDate(age.application)],
      ['Išankstinės pensijos amžiaus riba nuo', formatDate(age.early)],
      ['Būtinasis stažas pensinio amžiaus metais', number.format(age.necessary) + ' m.']);
    const insurance = get('insurance').valueAsNumber;
    if (Number.isFinite(insurance) && age.necessary !== null) {
      rows.push(['Jūsų nurodytas stažas', number.format(insurance) + ' m.']);
      rows.push(['Trūksta iki būtinojo stažo pagal įvestį', number.format(Math.max(0, age.necessary - insurance)) + ' m.']);
    }
    const warning = age.necessary !== null && Number.isFinite(insurance) && insurance < rules.pension.minimumInsurance
      ? 'Įvestas stažas nesiekia 15 metų minimumo. ' : '';
    const leapNote = birth.endsWith('-02-29') ? 'Vasario 29 d. atvejį patvirtinkite „Sodroje“. ' : '';
    const reminderDate = age.application && age.application >= today() ? age.application : '';
    return result('Pensinio amžiaus data', formatDate(age.regular), rows,
      warning + leapNote + 'Teisė į pensiją ir jos dydis priklauso nuo „Sodros“ vertinimo.', reminderDate);
  },
  child(get, rules) {
    const children = get('children').valueAsNumber;
    const eligible = get('eligible').valueAsNumber;
    if (eligible > children) return result('Patikrinkite skaičių', 'Per daug papildomų gavėjų', [],
      'Papildomą išmoką gaunančių vaikų skaičius turi būti ne didesnis už bendrą skaičių.');
    const base = children * rules.child.base;
    const extra = eligible * rules.child.supplement;
    return result('Mėnesio suma', money(base + extra), [['Bazinės išmokos', money(base)],
      ['Papildomos išmokos', money(extra)]]);
  },
  birth(get, rules) {
    const birth = get('birth').value;
    return result('Vienkartinė suma', money(birth < rules.child.birthChange ? rules.child.birthBefore : rules.child.birthFromJune),
      [['Prašymo orientyras po 12 mėn.', formatDate(addMonths(birth, 12))]],
      'Paraiškos aplinkybes ir galutinį terminą tikrinkite savivaldybėje.');
  },
  childcare(get, rules) {
    const amount = get('income').valueAsNumber;
    const [reserved, eighteen, first, second] = rules.insurance.childcare.map(rate => money(amount * rate));
    return result('Neperleidžiamų mėnesių tarifas (78 %)', reserved, [['18 mėn. variantas (60 %)', eighteen],
      ['24 mėn. variantas iki 12 mėn. (45 %)', first], ['24 mėn. variantas nuo 12 mėn. (30 %)', second]],
      'Tai tarifų palyginimas prieš mokesčius ir be ketvirčio ribų.');
  },
  parents(get, rules) {
    return result('Vienos apmokamos dienos tarifo įvertis',
      money(get('income').valueAsNumber * rules.insurance.parent));
  },
  nanny(get, rules) {
    return result('Įvertis už visą mėnesį', money(get('children').valueAsNumber * rules.child.nanny));
  },
  job(get, rules) {
    if (get('insurance').valueAsNumber < 12) return result('Standartinis stažas', 'Trūksta draudimo stažo', [],
      'Įprastai reikia 12 mėnesių per 24. Specialius atvejus ir užsienyje įgytą stažą patikrinkite „Sodroje“.');
    const [first, second, third] = unemployment(get('income').valueAsNumber, rules.job);
    return result('Per pirmą–trečią pilną mokėjimo mėnesį', money(first), [['4–6 mėnuo', money(second)],
      ['7–9 mėnuo', money(third)], ['Pastovi dalis prieš ribų taikymą', money(rules.job.fixed)]],
      'Tai 2026 m. II pusės pavyzdys. Patikrinkite savo paskyrimo datą ir sprendimą.');
  },
  sick(get, rules) {
    const { illness, illnessGpm, illnessPsd } = rules.insurance;
    const gross = cent(get('income').valueAsNumber * get('days').valueAsNumber * illness);
    const gpm = cent(gross * illnessGpm);
    const psd = cent(gross * illnessPsd);
    return result('„Sodros“ dalies įvertis į rankas', money(gross - gpm - psd),
      [['Prieš mokesčius', money(gross)], ['GPM (15 %)', money(gpm)], ['PSD (6 %)', money(psd)]],
      'Darbdavio mokamos dienos, NPD, ketvirčio ribos ir išimtys čia neįtrauktos.');
  },
  social(get, rules) {
    const estimate = socialSupport({ members: get('members').valueAsNumber, income: get('income').valueAsNumber,
      duration: Number(get('duration').value) }, rules.support);
    const note = estimate.withinLimit
      ? 'Savivaldybė papildomai vertina turtą, užimtumą ir asmeninę situaciją.'
      : 'Bendroji pajamų sąlyga šioje įvestyje neįvykdyta. Savivaldybė gali vertinti išimtis.';
    return result('Preliminari mėnesio pašalpa', money(estimate.benefit),
      [['Pajamos asmeniui', money(estimate.perMember)], ['Bendroji pajamų riba', money(estimate.threshold)]], note);
  },
  heat(get, rules) {
    const estimate = heating({ members: get('members').valueAsNumber, income: get('income').valueAsNumber,
      cost: get('cost').valueAsNumber }, rules.support);
    return result('Preliminari kompensacija', money(estimate.compensation),
      [['Nevertinama pajamų dalis', money(estimate.threshold)],
        ['Išlaidų riba pagal pajamas', money(estimate.personalShare)], ['Naudingojo ploto normatyvas', estimate.area + ' m²']]);
  },
};

function downloadCalendar(entries, filename) {
  const events = entries.map(({ id, label, date }) => ({
    id, title: label, description: 'Asmeninis Kalendorius365 priminimas',
    category: 'personal', start: date, end: date, allDay: true, repeat: 'none', reminder: 0,
  }));
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([exportICS(events)], { type: 'text/calendar;charset=utf-8' }));
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1500);
}

function connectCalculator(form, rules) {
  const pane = form.nextElementSibling;
  const query = selector => pane.querySelector(selector);
  const get = fields(form.elements);
  const key = form.dataset.calc;
  const calendar = query('[data-pension-download]');
  let reminder = '';
  if (key === 'pension') get('birth').max = today();
  if (key === 'birth' && today() < get('birth').max) get('birth').max = today();
  function render(estimate) {
    query('[data-result-label]').textContent = estimate.label;
    query('[data-result-value]').textContent = estimate.value;
    query('[data-result-note]').textContent = estimate.note;
    const breakdown = estimate.rows.map(([label, value]) => {
      const row = document.createElement('div');
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = label;
      description.textContent = value;
      row.append(term, description);
      return row;
    });
    query('[data-result-rows]').replaceChildren(...breakdown);
    reminder = estimate.reminder;
    if (calendar) calendar.hidden = !reminder;
  }
  function update() {
    if (key === 'pay') {
      const annual = get('period').value === 'year';
      form.querySelector('[data-npd-choice]').hidden = annual;
      get('npd').disabled = annual;
    }
    if (key === 'pension') {
      const historical = Boolean(get('birth').value && get('birth').value < rules.pension.uniformFrom);
      form.querySelector('[data-pension-sex]').hidden = !historical;
      get('sex').disabled = !historical;
    }
    if (key === 'social') {
      const shared = get('members').valueAsNumber > 1;
      form.querySelector('[data-social-duration]').hidden = shared;
      get('duration').disabled = shared;
    }
    if (form.checkValidity()) render(calculate[key](get, rules));
    else render(result('Rezultatas', 'Įveskite tinkamus duomenis'));
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    update();
  });
  form.addEventListener('input', update);
  form.addEventListener('change', update);
  calendar?.addEventListener('click', () => {
    if (reminder) downloadCalendar([{ id: 'pensijos-priminimas-' + reminder, date: reminder,
      label: 'Patikrinti prašymą dėl senatvės pensijos' }], 'pensijos-priminimas.ics');
  });
  form.querySelector('fieldset').disabled = false;
  update();
}

function connectFilter(root) {
  const filters = root.querySelector('[data-civic-filters]');
  if (!filters) return;
  const control = [...filters.querySelectorAll('button')];
  const cards = [...root.querySelectorAll('[data-benefit-cards] [data-civic-topic]')];
  for (const button of control) {
    button.addEventListener('click', () => {
      const selected = button.dataset.filter;
      for (const option of control) option.setAttribute('aria-pressed', String(option === button));
      for (const card of cards) card.hidden = Boolean(selected && card.dataset.civicTopic !== selected);
      root.querySelector('[data-filter-count]').textContent = 'Rezultatų: ' + cards.filter(card => !card.hidden).length;
    });
  }
  filters.hidden = false;
}

function connectReminders(root) {
  const form = root.querySelector('[data-civic-reminders]');
  if (!form) return;
  const list = root.querySelector('[data-reminder-list]');
  const status = root.querySelector('[data-reminder-status]');
  const empty = root.querySelector('[data-reminder-empty]');
  const download = root.querySelector('[data-reminder-download]');
  const get = fields(form.elements);
  const dateInput = get('date');
  let entries = [];
  function read() {
    const data = JSON.parse(localStorage.getItem(STORE) ?? '[]');
    if (!Array.isArray(data) || data.length > MAX_REMINDERS) throw new Error('Neteisingas sąrašas');
    return data.filter(entry => {
      if (!entry || typeof entry.id !== 'string' || typeof entry.label !== 'string' ||
        entry.label.length > 72 || typeof entry.date !== 'string' ||
        entry.date < dateInput.min || entry.date > dateInput.max) return false;
      try { parse(entry.date); return true; } catch { return false; }
    });
  }
  function render() {
    list.replaceChildren();
    for (const entry of [...entries].sort((a, b) => a.date.localeCompare(b.date))) {
      const item = document.createElement('li');
      const details = document.createElement('div');
      const label = document.createElement('strong');
      const date = document.createElement('time');
      const remove = document.createElement('button');
      label.textContent = entry.label;
      date.dateTime = entry.date;
      date.textContent = formatDate(entry.date);
      remove.textContent = 'Pašalinti';
      remove.setAttribute('aria-label', 'Pašalinti: ' + entry.label);
      remove.type = 'button';
      remove.className = 'civic-button civic-button--plain';
      remove.addEventListener('click', () => {
        if (save(readLatest => readLatest.filter(other => other.id !== entry.id), 'Priminimas pašalintas.')) get('label').focus();
      });
      details.append(label, date);
      item.append(details, remove);
      list.append(item);
    }
    empty.hidden = entries.length !== 0;
    download.disabled = entries.length === 0;
  }
  function save(edit, message) {
    try {
      const next = edit(read());
      if (next.length > MAX_REMINDERS) {
        status.textContent = 'Galima saugoti iki 50 priminimų.';
        return false;
      }
      localStorage.setItem(STORE, JSON.stringify(next));
      entries = next;
      render();
      status.textContent = message;
      return true;
    } catch {
      status.textContent = 'Naršyklėje priminimo išsaugoti nepavyko.';
      return false;
    }
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    const label = get('label').value.trim();
    if (!label) {
      status.textContent = 'Įrašykite priminimo pavadinimą.';
      return;
    }
    const entry = { id: crypto.randomUUID(), date: dateInput.value, label };
    if (save(current => [...current, entry], 'Priminimas išsaugotas.')) form.reset();
  });
  download.addEventListener('click', () => downloadCalendar(entries, 'ismoku-priminimai.ics'));
  window.addEventListener('storage', event => {
    if (event.key !== STORE) return;
    try { entries = read(); render(); } catch { status.textContent = 'Priminimų sąrašo perskaityti nepavyko.'; }
  });
  try { entries = read(); } catch { status.textContent = 'Priminimų sąrašo perskaityti nepavyko.'; }
  form.querySelector('fieldset').disabled = false;
  render();
}

function start() {
  for (const root of document.querySelectorAll('[data-civic]')) {
    const rules = JSON.parse(root.querySelector('[data-civic-rules]').textContent);
    root.querySelectorAll('[data-calc]').forEach(form => connectCalculator(form, rules));
    connectFilter(root);
    connectReminders(root);
  }
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
}
