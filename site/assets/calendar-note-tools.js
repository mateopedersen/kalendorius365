(function () {
  'use strict';

  const storageKey = 'calendar365.date-note-format.v1';
  const fonts = ['sans', 'serif', 'mono', 'rounded', 'script'];
  const styles = {bold: 'B', italic: 'I', underline: 'U'};
  const groups = [
    ['⭐', '📌', '🗓️', '✅', '⏰', '📝', '🔔', '🎯', '⏳', '📍'],
    ['💼', '📚', '💻', '✏️', '📞', '📧', '📎', '📊', '🖨️', '🤝'],
    ['🎉', '🎂', '🎁', '🎈', '❤️', '🥳', '🥂', '🎓', '🎵', '🎄'],
    ['✈️', '🚗', '🚆', '🏖️', '🏕️', '⛅', '☀️', '❄️', '🌷', '🍂'],
    ['💪', '🏃', '🚴', '⚽', '🧘', '💊', '🩺', '💧', '🍎', '😴'],
  ];
  const marks = {
    none:'○', important:'★', deadline:'⚑', reminder:'◷', event:'◆',
    completed:'✓', birthday:'🎂', travel:'✈', health:'✚',
  };
  const markerKeys = Object.keys(marks);
  const translations = {
    sl: {
      tools:'Oblikovanje zapiska', font:'Pisava', fonts:['Običajna', 'Serifna', 'Enakomerna', 'Zaobljena', 'Rokopisna'],
      bold:'Krepko', italic:'Ležeče', underline:'Podčrtano', emoji:'Emodžiji', marks:'Oznake',
      groups:['Načrtovanje', 'Delo in šola', 'Praznovanja', 'Potovanja in narava', 'Zdravje in šport'],
      markers:['Brez oznake', 'Pomembno', 'Rok', 'Opomnik', 'Dogodek', 'Končano', 'Rojstni dan', 'Potovanje', 'Zdravje'],
    },
    lt: {
      tools:'Užrašo formatavimas', font:'Šriftas', fonts:['Įprastas', 'Serifinis', 'Vienodo pločio', 'Apvalus', 'Rankraštinis'],
      bold:'Paryškinti', italic:'Pasvirasis', underline:'Pabraukti', emoji:'Jaustukai', marks:'Žymos',
      groups:['Planavimas', 'Darbas ir mokslai', 'Šventės', 'Kelionės ir gamta', 'Sveikata ir sportas'],
      markers:['Be žymos', 'Svarbu', 'Terminas', 'Priminimas', 'Įvykis', 'Atlikta', 'Gimtadienis', 'Kelionė', 'Sveikata'],
    },
    lv: {
      tools:'Piezīmes noformējums', font:'Fonts', fonts:['Parasts', 'Ar serifiem', 'Vienplatuma', 'Noapaļots', 'Rokraksts'],
      bold:'Treknraksts', italic:'Slīpraksts', underline:'Pasvītrot', emoji:'Emocijzīmes', marks:'Atzīmes',
      groups:['Plānošana', 'Darbs un skola', 'Svinības', 'Ceļojumi un daba', 'Veselība un sports'],
      markers:['Bez atzīmes', 'Svarīgi', 'Termiņš', 'Atgādinājums', 'Notikums', 'Pabeigts', 'Dzimšanas diena', 'Ceļojums', 'Veselība'],
    },
    fi: {
      tools:'Muistiinpanon muotoilu', font:'Kirjasin', fonts:['Tavallinen', 'Päätteellinen', 'Tasalevyinen', 'Pyöristetty', 'Käsinkirjoitettu'],
      bold:'Lihavointi', italic:'Kursivointi', underline:'Alleviivaus', emoji:'Emojit', marks:'Merkit',
      groups:['Suunnittelu', 'Työ ja opiskelu', 'Juhlat', 'Matkat ja luonto', 'Terveys ja liikunta'],
      markers:['Ei merkkiä', 'Tärkeä', 'Määräpäivä', 'Muistutus', 'Tapahtuma', 'Valmis', 'Syntymäpäivä', 'Matka', 'Terveys'],
    },
  };
  const words = translations[document.documentElement.lang.slice(0,2)] || translations.fi;

  let formats;
  function savedFormats() {
    if (!formats) {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
        formats = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
      } catch {
        formats = {};
      }
    }
    return formats;
  }

  function read(date) {
    const saved = savedFormats()[date];
    return {
      font: fonts.includes(saved?.font) ? saved.font : fonts[0],
      bold: saved?.bold === true,
      italic: saved?.italic === true,
      underline: saved?.underline === true,
      marker: markerKeys.includes(saved?.marker) ? saved.marker : saved?.important === true ? 'important' : 'none',
    };
  }

  function hasContent(date, text) {
    return Boolean(text?.trim()) || read(date).marker !== 'none';
  }

  function markedDates() {
    return Object.keys(savedFormats()).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date) && read(date).marker !== 'none');
  }

  function save(date, text, format) {
    const notes = savedFormats();
    if (!format && (text.trim() || read(date).marker !== 'none')) return;
    if (!format || (format.marker === 'none' && (!text.trim() ||
        (format.font === fonts[0] && !Object.keys(styles).some(key => format[key]))))) {
      if (!notes[date]) return;
      delete notes[date];
    } else notes[date] = format;
    try {
      localStorage.setItem(storageKey, JSON.stringify(notes));
    } catch {
      // The site's note editor reports storage failures for the actual text.
    }
  }

  function apply(element, format) {
    element.dataset.noteFont = format.font;
    element.dataset.noteMarker = format.marker;
    for (const key of Object.keys(styles)) element.toggleAttribute('data-note-' + key, format[key]);
    element.toggleAttribute('data-note-important', format.marker === 'important');
  }

  function attributes(date) {
    const format = read(date);
    return 'data-note-font="' + format.font + '" data-note-marker="' + format.marker + '"' +
      Object.keys(styles).filter(key => format[key]).map(key => ' data-note-' + key).join('') +
      (format.marker === 'important' ? ' data-note-important' : '');
  }

  function make(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  function glyph(symbol) {
    const icon = make('span', 'calendar-note-glyph', symbol);
    icon.setAttribute('aria-hidden', 'true');
    return icon;
  }

  function button(label, symbol) {
    const control = make('button');
    control.type = 'button';
    control.title = label;
    control.setAttribute('aria-label', label);
    if (symbol) control.append(glyph(symbol));
    else control.textContent = label;
    return control;
  }

  function menu(toolbar, label, symbol, name) {
    const details = make('details', 'calendar-note-menu');
    details.dataset.noteMenu = name;
    const summary = make('summary');
    summary.title = label;
    summary.setAttribute('aria-label', label);
    summary.append(glyph(symbol), make('span', 'calendar-note-menu-name', label));
    const panel = make('div', 'calendar-note-popover');
    details.append(summary, panel);
    summary.addEventListener('click', () => {
      for (const other of toolbar.querySelectorAll('details[open]'))
        if (other !== details) other.open = false;
    });
    toolbar.append(details);
    return {details, summary, panel};
  }

  function addEmojiMenu(toolbar, input) {
    const picker = menu(toolbar, words.emoji, '☺', 'emoji');
    const categories = make('div', 'calendar-note-categories');
    const palette = make('div', 'calendar-note-emojis');
    picker.panel.append(categories, palette);
    const tabs = words.groups.map((label, index) => {
      const tab = button(label);
      tab.onclick = () => showGroup(index);
      categories.append(tab);
      return tab;
    });
    function showGroup(index) {
      tabs.forEach((tab, i) => tab.setAttribute('aria-pressed', String(i === index)));
      const entries = groups[index].map(symbol => {
        const choice = button(symbol);
        choice.onclick = () => {
          const caret = input.selectionEnd;
          if (input.maxLength < 0 || input.value.length + symbol.length <= input.maxLength)
            input.setRangeText(symbol, caret, caret, 'end');
          picker.details.open = false;
          input.focus();
        };
        return choice;
      });
      palette.replaceChildren(...entries);
    }
    showGroup(0);
  }

  function addMarkerMenu(toolbar, input, format) {
    const picker = menu(toolbar, words.marks, '⚑', 'marker');
    const choices = make('div', 'calendar-note-marks');
    picker.panel.append(choices);
    const update = () => {
      picker.summary.dataset.active = String(format.marker !== 'none');
      picker.summary.querySelector('.calendar-note-glyph').textContent = format.marker === 'none' ? '⚑' : marks[format.marker];
      for (const item of choices.children)
        item.setAttribute('aria-pressed', String(item.dataset.noteMark === format.marker));
      apply(input, format);
    };
    markerKeys.forEach((key, index) => {
      const choice = button(words.markers[index], marks[key]);
      choice.dataset.noteMark = key;
      choice.append(make('span', '', words.markers[index]));
      choice.onclick = () => {
        format.marker = key;
        update();
        picker.details.open = false;
        picker.summary.focus();
      };
      choices.append(choice);
    });
    update();
  }

  function toolbar(input, date) {
    const format = read(date);
    const element = make('div', 'calendar-note-tools');
    element.setAttribute('role', 'group');
    element.setAttribute('aria-label', words.tools);
    if (input.previousElementSibling?.classList.contains(element.className))
      input.previousElementSibling.remove();
    input.before(element);

    const fontLabel = make('label', 'calendar-note-font');
    const font = document.createElement('select');
    font.setAttribute('aria-label', words.font);
    fonts.forEach((key, index) => font.add(new Option(words.fonts[index], key)));
    font.value = format.font;
    font.onchange = () => {
      format.font = font.value;
      apply(input, format);
    };
    fontLabel.append(glyph('Aa'), font);
    element.append(fontLabel);

    for (const [key, symbol] of Object.entries(styles)) {
      const control = button(words[key], symbol);
      control.dataset.noteTool = key;
      control.setAttribute('aria-pressed', String(format[key]));
      control.onclick = () => {
        format[key] = !format[key];
        control.setAttribute('aria-pressed', String(format[key]));
        apply(input, format);
      };
      element.append(control);
    }
    addEmojiMenu(element, input);
    addMarkerMenu(element, input, format);
    return format;
  }

  globalThis.CalendarDateNoteTools = {read, hasContent, markedDates, save, apply, attributes, toolbar};
})();
