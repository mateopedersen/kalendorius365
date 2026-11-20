const guide = document.querySelector("[data-holiday-research]");

if (guide) {
  const panels = [...guide.querySelectorAll("[data-hg-year]")];
  const buttons = [...guide.querySelectorAll(".hg-year")];
  const label = guide.querySelector("[data-hg-selected]");
  const activeYear = () => {
    const hash = location.hash.match(/^#metai-(\d{4})$/)?.[1];
    const query = new URLSearchParams(location.search).get("metai");
    return [hash, query].find(value => panels.some(panel => panel.dataset.hgYear === value)) ?? guide.dataset.defaultYear;
  };

  function show(year) {
    for (const panel of panels) {
      panel.hidden = panel.dataset.hgYear !== year;
      if (!panel.hidden) label.textContent = panel.dataset.hgLabel;
    }
    for (const button of buttons) {
      if (button.hash === "#metai-" + year) button.setAttribute("aria-current", "true");
      else button.removeAttribute("aria-current");
    }
    guide.dispatchEvent(new CustomEvent('occasion-year', { detail: year }));
  }

  for (const button of buttons) {
    button.addEventListener("click", event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const year = button.hash.slice("#metai-".length);
      const url = new URL(location.href);
      url.searchParams.set("metai", year);
      url.hash = "datos";
      history.replaceState(null, "", url);
      show(year);
    });
  }
  window.addEventListener("hashchange", () => show(activeYear()));
  show(activeYear());
}
