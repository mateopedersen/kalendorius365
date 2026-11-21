const preview = document.querySelector(".lesson-preview");

if (typeof preview?.showModal === "function") {
  const title = preview.querySelector("h2");
  const image = preview.querySelector("[data-lesson-preview-image]");
  const download = preview.querySelector("[download]");
  for (const link of document.querySelectorAll(".lesson-template [data-template-preview]")) {
    link.setAttribute("aria-haspopup", "dialog");
    link.addEventListener("click", (event) => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const card = link.closest("[data-lesson-template]");
      const pdf = card.querySelector("[data-template-pdf]");
      title.textContent = card.querySelector("[data-template-title]").textContent;
      image.alt = title.textContent;
      image.src = link.href;
      download.href = pdf.href;
      download.download = pdf.download;
      preview.showModal();
    });
  }
}
