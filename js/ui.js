// Shared shell UI helpers.

let toastTimer = null;

// Accepts trusted markup only (static strings + numbers) — never user input.
export function toast(html) {
  const el = document.getElementById("toast");
  el.innerHTML = html;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
}
