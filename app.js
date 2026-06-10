// Dress Panic — app bootstrap: service worker, install prompt, nav, edition badge.

import { initWardrobe } from "./js/wardrobe.js";
import { toast } from "./js/ui.js";

// --- Service worker -------------------------------------------------------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      // Relative scope so it works under GitHub Pages project subpaths (e.g. /dp/).
      const reg = await navigator.serviceWorker.register("sw.js", { scope: "./" });
      console.log("[DressPanic] SW registered:", reg.scope);
    } catch (err) {
      console.error("[DressPanic] SW registration failed:", err);
    }
  });
}

// --- Edition badge: month/year, or OFFLINE EDITION --------------------------
const editionBadge = document.getElementById("edition-badge");

function renderEdition() {
  const online = navigator.onLine;
  editionBadge.dataset.offline = String(!online);
  editionBadge.textContent = online
    ? new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date())
    : "Offline Edition";
}
window.addEventListener("online", renderEdition);
window.addEventListener("offline", renderEdition);
renderEdition();

// --- Install (A2HS) prompt ---------------------------------------------------
const installBtn = document.getElementById("install-btn");
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

// --- Tab bar (future sections are stubs for now) ------------------------------
for (const tab of document.querySelectorAll(".tab")) {
  tab.addEventListener("click", () => {
    if (tab.dataset.tab !== "archive") {
      toast("In the next issue.");
    }
  });
}

// --- Boot ----------------------------------------------------------------------
initWardrobe();
