const notice = document.querySelector("#cookie-notice");
const dismissButton = document.querySelector("#cookie-notice-dismiss");
const storageKey = "kalendorius365:privacy-notice:v1";

async function showPrivacyNotice() {
  let alreadyDismissed = false;
  try {
    alreadyDismissed = localStorage.getItem(storageKey) === "dismissed";
  } catch {
    // Keep the notice available when browser storage is disabled.
  }

  if (alreadyDismissed) {
    notice.remove();
    return;
  }

  let showNotice = true;
  try {
    const region = window.__k365PrivacyRegion ? await window.__k365PrivacyRegion : await (async () => {
    const response = await fetch("/api/privacy-region", {
      cache: "no-store",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
      priority: "low",
    });
    if (!response.ok) throw new Error("Region lookup unavailable");
    return response.json();
    })();
    if (region?.showNotice === false) showNotice = false;
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
}

if (notice && dismissButton) void showPrivacyNotice();
