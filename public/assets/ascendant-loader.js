// Prepare the calculator when it approaches the viewport or receives input.
// Birth details stay in the browser, exactly as in the calculator module.
const form = document.querySelector("#ascendant-form");
if (form) {
  let ready;
  let loaded = false;
  const prepare = () => ready ||= import("./ascendant-calculator.js?v=2f62d0a9fccd").then(() => {
    loaded = true;
  }).catch((error) => {
    ready = undefined;
    throw error;
  });
  const warm = () => { void prepare().catch(() => {}); };
  form.addEventListener("focusin", warm, { once: true });
  form.addEventListener("pointerdown", warm, { once: true });
  form.addEventListener("submit", (event) => {
    if (loaded) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const submitter = event.submitter;
    void prepare().then(() => form.requestSubmit(submitter)).catch(() => {
      const result = document.querySelector("#ascendant-result");
      if (result) {
        result.hidden = false;
        result.textContent = "Nepavyko įkelti skaičiuoklės. Patikrinkite ryšį ir bandykite dar kartą.";
      }
    });
  }, true);
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        warm();
      }
    }, { rootMargin: "200px" });
    observer.observe(form);
  } else warm();
}
