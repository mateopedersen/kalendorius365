/* Calendar downloads stay local, including personal entries. */
(function (root) {
  'use strict';
  const pending = new Map();
  // Safari may wait for a download confirmation before reading a blob URL.
  // Keep both the anchor and its data alive; never revoke in the click handler.
  const retention = 10 * 60 * 1000;
  function release(url) {
    if (!url || pending.has(url)) return;
    const timer = setTimeout(() => {
      URL.revokeObjectURL(url);
      pending.get(url)?.anchor?.remove();
      pending.delete(url);
    }, retention);
    timer?.unref?.();
    pending.set(url, {timer});
  }
  function save(content, name, type) {
    const calendar = /\.ics$/i.test(name) || /^text\/calendar/i.test(type || content?.type || '');
    if (calendar && typeof content === 'string') {
      if (!/(?:^|\r?\n)BEGIN:VEVENT(?:\r?\n|$)/.test(content)) throw new Error('Nėra eksportuojamų įvykių. Pirmiausia pridėkite įvykį arba pasirinkite švenčių kalendorių.');
      content = content.replace(/\r\n|\r|\n/g, '\r\n');
    }
    const mime = calendar ? 'text/calendar;charset=utf-8' : type || content?.type || 'application/octet-stream';
    const filename = String(name).replace(/[\/\\\x00-\x1f]/g, '_');
    const blob = content instanceof Blob ? content : new Blob([content], {type: mime});
    const file = typeof File === 'function' ? new File([blob], filename, {type: mime}) : blob;
    const url = URL.createObjectURL(file);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.append(anchor);
    release(url);
    pending.get(url).anchor = anchor;
    anchor.click();
    return url;
  }
  root.Calendar365Downloads = Object.freeze({save, release});
})(globalThis);
