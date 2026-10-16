const notice = document.querySelector("#cookie-notice");
const dismissButton = document.querySelector("#cookie-notice-dismiss");
const storageKey = "kalendorius365:privacy-notice:v1";

if (notice && dismissButton) {
  let alreadyDismissed = false;
  try {
    alreadyDismissed = localStorage.getItem(storageKey) === "dismissed";
  } catch {
    // Keep the notice available when browser storage is disabled.
  }

  if (!alreadyDismissed) {
    let showNotice = true;
    try {
      const response = await fetch("/api/privacy-region", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Region lookup unavailable");
      const region = await response.json();
      if (region.showNotice === false) showNotice = false;
    } catch {
      // If the region endpoint is unavailable, do not suppress the notice.
    }

    if (showNotice) {
      notice.hidden = false;
      dismissButton.addEventListener("click", () => {
        try {
          localStorage.setItem(storageKey, "dismissed");
        } catch {
          // Dismissing still works for this page if storage is blocked.
        }
        notice.remove();
      });
    } else {
      // Visitors outside Europe do not receive the regional privacy notice.
      notice.remove();
    }
  } else {
    notice.remove();
  }
}
