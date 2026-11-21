const dialog = document.querySelector("#tools-dialog");
const opener = document.querySelector("#tools-open");
const query = document.querySelector("#tools-query");

if (dialog && opener && query && typeof dialog.showModal === "function") {
  const closeButton = dialog.querySelector("#tools-close");
  const viewport = window.visualViewport;
  const fullScreenMenu = matchMedia("(max-width: 760px), (max-width: 950px) and (pointer: coarse)");
  const groups = [...dialog.querySelectorAll("[data-menu-group]")];
  const sections = [...dialog.querySelectorAll("[data-menu-section]")];
  const cards = [...dialog.querySelectorAll("[data-menu-tool]")];
  const results = dialog.querySelector("#tools-results");
  const empty = dialog.querySelector("#tools-empty");
  const status = dialog.querySelector("#tools-status");
  const normalize = (value) => value.toLocaleLowerCase("lt-LT").normalize("NFD").replace(/\p{M}/gu, "").trim();
  const indexing = new Map(cards.map((card) => [card, normalize(card.textContent + " " + card.dataset.keywords)]));
  let category = groups[0].dataset.menuGroup;

  function render() {
    const terms = normalize(query.value).split(/\s+/).filter(Boolean);
    let count = 0;
    for (const section of sections) {
      let sectionCount = 0;
      for (const card of section.querySelectorAll("[data-menu-tool]")) {
        card.hidden = terms.length
          ? !terms.every((term) => indexing.get(card).includes(term))
          : section.dataset.menuSection !== category;
        if (!card.hidden) sectionCount++;
      }
      count += sectionCount;
      section.hidden = sectionCount === 0;
    }
    for (const group of groups) {
      group.setAttribute("aria-pressed", String(!terms.length && group.dataset.menuGroup === category));
    }
    empty.hidden = count > 0;
    status.textContent = `Rodoma ${count} iš ${cards.length} įrankių`;
    results.scrollTop = 0;
  }

  function fitToolsMenu() {
    if (fullScreenMenu.matches && viewport?.scale === 1) {
      dialog.style.setProperty("--tools-viewport-height", viewport.height + "px");
      dialog.style.setProperty("--tools-viewport-top", Math.max(0, viewport.offsetTop) + "px");
    } else {
      dialog.style.removeProperty("--tools-viewport-height");
      dialog.style.removeProperty("--tools-viewport-top");
    }
  }

  opener.addEventListener("click", (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || dialog.open) return;
    event.preventDefault();
    query.value = "";
    render();
    dialog.showModal();
    fitToolsMenu();
    viewport?.addEventListener("resize", fitToolsMenu);
    viewport?.addEventListener("scroll", fitToolsMenu);
    opener.setAttribute("aria-expanded", "true");
    (fullScreenMenu.matches ? closeButton : query).focus({ preventScroll: true });
  });
  for (const group of groups) {
    group.addEventListener("click", () => {
      category = group.dataset.menuGroup;
      query.value = "";
      render();
    });
  }
  query.addEventListener("input", render);
  closeButton.addEventListener("click", () => dialog.close());
  dialog.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    dialog.close();
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => {
    viewport?.removeEventListener("resize", fitToolsMenu);
    viewport?.removeEventListener("scroll", fitToolsMenu);
    dialog.style.removeProperty("--tools-viewport-height");
    dialog.style.removeProperty("--tools-viewport-top");
    opener.setAttribute("aria-expanded", "false");
    opener.focus({ preventScroll: true });
  });
}
