export function notice(message) {
  const status = document.querySelector("#notice");
  status.textContent = message;
  status.hidden = false;
  clearTimeout(status.timer);
  status.timer = setTimeout(() => (status.hidden = true), 10_000);
}
