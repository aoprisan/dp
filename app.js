// DressPanic! — app bootstrap
const statusEl = document.getElementById("status");
const netStatus = document.getElementById("net-status");
const installBtn = document.getElementById("install-btn");

// --- Service worker registration ---------------------------------------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      // Relative scope so it works under GitHub Pages project subpaths (e.g. /dp/).
      const reg = await navigator.serviceWorker.register("sw.js", {
        scope: "./",
      });
      statusEl.textContent = "Ready — works offline.";
      console.log("[DressPanic] SW registered:", reg.scope);
    } catch (err) {
      statusEl.textContent = "Running (no offline support).";
      console.error("[DressPanic] SW registration failed:", err);
    }
  });
} else {
  statusEl.textContent = "Service workers unsupported.";
}

// --- Network status ----------------------------------------------------
function renderNetwork() {
  const online = navigator.onLine;
  netStatus.textContent = online ? "online" : "offline";
  netStatus.dataset.online = String(online);
}
window.addEventListener("online", renderNetwork);
window.addEventListener("offline", renderNetwork);
renderNetwork();

// --- Install (A2HS) prompt --------------------------------------------
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});

installBtn.addEventListener("click", async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.hidden = true;
});

window.addEventListener("appinstalled", () => {
  installBtn.hidden = true;
  console.log("[DressPanic] installed");
});
