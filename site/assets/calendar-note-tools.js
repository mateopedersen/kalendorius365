(function () {
  'use strict';

  const storageKey = 'calendar365.date-note-format.v1';
  const fonts = ['sans', 'serif', 'mono'];
  const symbols = ['⭐', '🎉', '🎂', '📌', '✅', '❤️', '🗓️', '❗'];
  const toggles = ['bold', 'underline', 'important'];

  function readFormats() {
    try {
      const old = JSON.parse(localStorage.getItem(storageKey) || '{}');
      return old && typeof old === 'object' && !Array.isArray(old) ? old : {};
    } catch {
      return {};
    }
  }

  let formats;
  const getFormats = () => formats ??= readFormats();

  function read(date) {
    const saved = getFormats()[date];
    return {
      font: fonts.includes(saved?.font) ? saved.font : fonts[0],
      bold: saved?.bold === true,
      underline: saved?.underline === true,
      important: saved?.important === true,
    };
  }

  function save(date, text, format) {
    const notes = getFormats();
    if (!text.trim() || (!format && !notes[date])) delete notes[date];
    else if (format) {
      if (format.font === fonts[0] && !toggles.some(key => format[key])) delete notes[date];
      else notes[date] = format;
    } else return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(notes));
    } catch {
      // The site's note editor reports storage failures for the actual text.
    }
  }

  function apply(element, format) {
    element.dataset.noteFont = format.font;
    for (const key of toggles) element.toggleAttribute('data-note-' + key, format[key]);
  }

  function attributes(date) {
    const format = read(date);
    return 'data-note-font="' + format.font + '"' +
      toggles.filter(key => format[key]).map(key => ' data-note-' + key).join('');
  }

  function toolbar(input, date, words) {
    const format = read(date);
    const element = document.createElement('div');
    element.className = 'calendar-note-tools';
    element.setAttribute('role', 'group');
    element.setAttribute('aria-label', words.tools);
    if (input.previousElementSibling?.classList.contains(element.className))
      input.previousElementSibling.remove();
    input.before(element);

    const fontLabel = document.createElement('label');
    fontLabel.append(words.font);
    const font = document.createElement('select');
    fonts.forEach((key, index) => font.add(new Option(words.fonts[index], key)));
    font.value = format.font;
    font.onchange = () => {
      format.font = font.value;
      apply(input, format);
    };
    fontLabel.append(font);
    element.append(fontLabel);

    for (const key of toggles) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.noteTool = key;
      button.textContent = words[key];
      button.setAttribute('aria-pressed', String(format[key]));
      button.onclick = () => {
        format[key] = !format[key];
        button.setAttribute('aria-pressed', String(format[key]));
        apply(input, format);
      };
      element.append(button);
    }

    const emojiPicker = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = words.emoji;
    emojiPicker.append(summary);
    const palette = document.createElement('div');
    palette.className = 'calendar-note-emojis';
    for (const symbol of symbols) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = symbol;
      button.onclick = () => {
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const length = input.value.length + symbol.length - (end - start);
        if (input.maxLength < 0 || length <= input.maxLength)
          input.setRangeText(symbol, start, end, 'end');
        emojiPicker.open = false;
        input.focus();
      };
      palette.append(button);
    }
    emojiPicker.append(palette);
    element.append(emojiPicker);
    apply(input, format);
    return format;
  }

  globalThis.CalendarDateNoteTools = {read, save, apply, attributes, toolbar};
})();
