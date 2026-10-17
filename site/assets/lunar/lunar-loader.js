const scope = document.querySelector(".lunar-app");
const interactiveControl = "[data-lunar-date], [data-event-ics], .lunar-preview-button, [data-print-image]";
let modulePromise;
let moduleLoaded = false;

function loadLunarTools() {
  if (moduleLoaded) return Promise.resolve(true);
  modulePromise ||= import("./lunar.js").then(() => {
    moduleLoaded = true;
    return true;
  }).catch(() => {
    modulePromise = undefined;
    const phase = scope?.querySelector("[data-live-phase]");
    if (phase) phase.textContent = "Vaizdas šiuo metu nepasiekiamas";
    return false;
  });
  return modulePromise;
}

if (scope) {
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        loadLunarTools();
      }
    });
    for (const target of scope.querySelectorAll(".lunar-selected, [data-live-moon]")) {
      observer.observe(target);
    }
  } else {
    window.setTimeout(loadLunarTools, 5000);
  }

  scope.addEventListener("pointerover", (event) => {
    if (event.target instanceof Element && event.target.closest(interactiveControl)) loadLunarTools();
  }, { passive: true });

  scope.addEventListener("focusin", (event) => {
    if (event.target instanceof Element && (event.target.closest(interactiveControl) || event.target.matches("[data-selected-date]"))) loadLunarTools();
  });

  scope.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest(interactiveControl) : null;
    if (!target || moduleLoaded) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    loadLunarTools().then((loaded) => {
      if (!loaded) return;
      target.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    });
  }, true);

  scope.addEventListener("keydown", (event) => {
    if (moduleLoaded || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    if (!(event.target instanceof Element) || !event.target.closest("[data-lunar-date]")) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const key = event.key;
    loadLunarTools().then((loaded) => {
      if (loaded) event.target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    });
  }, true);

  scope.addEventListener("change", (event) => {
    if (moduleLoaded || !(event.target instanceof Element) || !event.target.matches("[data-selected-date]")) return;
    event.stopImmediatePropagation();
    const target = event.target;
    loadLunarTools().then((loaded) => {
      if (loaded) target.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }, true);
}
