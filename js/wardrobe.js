// The Archive — wardrobe item CRUD, filtering, and rendering.

import { db, uid } from "./db.js";
import { toast } from "./ui.js";

const PRIVACY_MARK = { public: "○", followers: "◐", private: "●" };
const PRIVACY_NAME = { public: "Public", followers: "Circle", private: "Private" };

const state = {
  items: [],
  tags: [],
  scope: "all",
  selectedTags: new Set(),
  editingId: null,
  draftPhotos: [], // [{ id, blob }]
  draftTagIds: new Set(),
};

// Object URLs per photo id, revoked when their photo disappears.
const urlCache = new Map();

function photoURL(photo) {
  if (!urlCache.has(photo.id)) {
    urlCache.set(photo.id, URL.createObjectURL(photo.blob));
  }
  return urlCache.get(photo.id);
}

function pruneURLCache() {
  const live = new Set();
  for (const item of state.items) for (const p of item.photos) live.add(p.id);
  for (const p of state.draftPhotos) live.add(p.id);
  for (const [id, url] of urlCache) {
    if (!live.has(id)) {
      URL.revokeObjectURL(url);
      urlCache.delete(id);
    }
  }
}

const $ = (sel) => document.querySelector(sel);

const fmtNo = (n) => "Nº " + String(n).padStart(3, "0");
const fmtCount = (n) => String(n).padStart(3, "0");
const fmtDate = (ts) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(ts);

function tagName(id) {
  return state.tags.find((t) => t.id === id)?.name;
}

// --- Rendering -----------------------------------------------------------

function visibleItems() {
  return state.items.filter((item) => {
    if (state.scope !== "all" && item.privacy !== state.scope) return false;
    for (const t of state.selectedTags) if (!item.tags.includes(t)) return false;
    return true;
  });
}

function render() {
  renderTagRail();
  renderGrid();
}

function renderTagRail() {
  const rail = $("#tag-rail");
  rail.replaceChildren(
    ...state.tags.map((tag) => {
      const b = document.createElement("button");
      b.className = "chip";
      b.textContent = "#" + tag.name;
      b.setAttribute("aria-pressed", String(state.selectedTags.has(tag.id)));
      b.addEventListener("click", () => {
        state.selectedTags.has(tag.id)
          ? state.selectedTags.delete(tag.id)
          : state.selectedTags.add(tag.id);
        render();
      });
      return b;
    })
  );
}

function renderGrid() {
  const grid = $("#grid");
  const empty = $("#empty");
  const items = visibleItems();

  $("#piece-count").innerHTML =
    `<strong>${fmtCount(items.length)}</strong> ${items.length === 1 ? "piece" : "pieces"}`;

  grid.replaceChildren(...items.map(renderCard));

  const filtered = state.scope !== "all" || state.selectedTags.size > 0;
  empty.hidden = items.length > 0;
  if (!empty.hidden) {
    $("#empty-title").textContent = filtered ? "Nothing under this filter." : "Nothing filed yet.";
    $("#empty-sub").textContent = filtered
      ? "The archive holds no piece matching this selection."
      : "Every archive begins with a single piece. Add the thing you wore today.";
  }
}

function renderCard(item, i) {
  const card = document.createElement("button");
  card.className = "piece" + (i === 0 ? " piece--lead" : "");
  card.style.setProperty("--i", Math.min(i, 12));
  card.setAttribute("aria-label", item.title);

  const photo = document.createElement("div");
  photo.className = "piece__photo";
  if (item.photos.length) {
    const img = new Image();
    img.src = photoURL(item.photos[0]);
    img.alt = "";
    img.loading = "lazy";
    photo.append(img);
  } else {
    const ph = document.createElement("span");
    ph.className = "no-photo";
    ph.textContent = "no photograph";
    photo.append(ph);
  }

  const meta = document.createElement("div");
  meta.className = "piece__meta mono";
  meta.innerHTML = `<span class="no">${fmtNo(item.no)}</span><span>${PRIVACY_MARK[item.privacy]}</span>`;

  const title = document.createElement("div");
  title.className = "piece__title";
  title.textContent = item.title;

  const tags = document.createElement("div");
  tags.className = "piece__tags";
  tags.textContent = item.tags.map((t) => "#" + tagName(t)).filter(Boolean).join("  ");

  card.append(photo, meta, title, tags);
  card.addEventListener("click", () => openDetail(item.id));
  return card;
}

// --- Editor (add / edit) ---------------------------------------------------

function openEditor(item = null) {
  state.editingId = item?.id ?? null;
  state.draftPhotos = item ? [...item.photos] : [];
  state.draftTagIds = new Set(item?.tags ?? []);

  $("#editor-kicker").textContent = item ? `Revising ${fmtNo(item.no)}` : "New entry";
  $("#editor-title").textContent = item ? "Revise the Piece" : "Add a Piece";
  $("#editor-save").textContent = item ? "File the revision" : "File into the archive";
  $("#f-title").value = item?.title ?? "";
  $("#f-desc").value = item?.description ?? "";
  const privacy = item?.privacy ?? "public";
  $(`#privacy input[value="${privacy}"]`).checked = true;

  renderPhotoStrip();
  renderTagPicker();
  $("#editor").showModal();
}

function renderPhotoStrip() {
  const strip = $("#photo-strip");
  strip.replaceChildren(
    ...state.draftPhotos.map((photo, i) => {
      const t = document.createElement("div");
      t.className = "thumb";

      const img = new Image();
      img.src = photoURL(photo);
      img.alt = "";

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "thumb__remove";
      remove.textContent = "✕";
      remove.setAttribute("aria-label", "Remove photograph");
      remove.addEventListener("click", () => {
        state.draftPhotos.splice(i, 1);
        renderPhotoStrip();
      });

      const cover = document.createElement("button");
      cover.type = "button";
      cover.className = "thumb__cover";
      cover.dataset.cover = String(i === 0);
      cover.textContent = i === 0 ? "cover" : "set cover";
      cover.addEventListener("click", () => {
        state.draftPhotos.unshift(...state.draftPhotos.splice(i, 1));
        renderPhotoStrip();
      });

      t.append(img, remove, cover);
      return t;
    })
  );
}

function renderTagPicker() {
  const picker = $("#tag-picker");
  picker.replaceChildren(
    ...state.tags.map((tag) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = "#" + tag.name;
      b.setAttribute("aria-pressed", String(state.draftTagIds.has(tag.id)));
      b.addEventListener("click", () => {
        state.draftTagIds.has(tag.id)
          ? state.draftTagIds.delete(tag.id)
          : state.draftTagIds.add(tag.id);
        renderTagPicker();
      });
      return b;
    })
  );
}

async function createTagFromInput() {
  const input = $("#tag-new-input");
  const name = input.value.trim().toLowerCase().replace(/^#/, "");
  if (!name) return;
  let tag = state.tags.find((t) => t.name === name);
  if (!tag) {
    tag = { id: uid(), name };
    await db.putTag(tag);
    state.tags.push(tag);
    state.tags.sort((a, b) => a.name.localeCompare(b.name));
  }
  state.draftTagIds.add(tag.id);
  input.value = "";
  renderTagPicker();
}

async function submitEditor(event) {
  event.preventDefault();
  const title = $("#f-title").value.trim();
  if (!title) {
    $("#f-title").focus();
    toast("A piece needs a title.");
    return;
  }

  const data = {
    title,
    description: $("#f-desc").value.trim(),
    tags: [...state.draftTagIds],
    privacy: $("#privacy input:checked").value,
    photos: state.draftPhotos,
    updatedAt: Date.now(),
  };

  if (state.editingId) {
    const item = state.items.find((it) => it.id === state.editingId);
    Object.assign(item, data);
    await db.putItem(item);
    toast(`Revised — <span class="accent">${fmtNo(item.no)}</span>`);
  } else {
    const item = {
      id: uid(),
      no: await db.nextPieceNumber(),
      createdAt: Date.now(),
      ...data,
    };
    await db.putItem(item);
    state.items.unshift(item);
    toast(`Filed — <span class="accent">${fmtNo(item.no)}</span>`);
  }

  $("#editor").close();
  pruneURLCache();
  render();
}

// --- Photos ------------------------------------------------------------------

const MAX_EDGE = 1600;

async function decodeImage(file) {
  try {
    return await createImageBitmap(file);
  } catch {
    // Fallback for formats createImageBitmap rejects.
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

async function compressPhoto(file) {
  const src = await decodeImage(file);
  const w = src.width ?? src.naturalWidth;
  const h = src.height ?? src.naturalHeight;
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext("2d").drawImage(src, 0, 0, canvas.width, canvas.height);
  src.close?.();
  const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
  return { id: uid(), blob };
}

async function addPhotoFiles(files) {
  const images = [...files].filter((f) => f.type.startsWith("image/"));
  if (!images.length) return;
  for (const file of images) {
    try {
      state.draftPhotos.push(await compressPhoto(file));
    } catch (err) {
      console.error("[DressPanic] photo decode failed:", err);
      toast("Couldn’t read that photograph.");
    }
  }
  renderPhotoStrip();
}

// --- Detail --------------------------------------------------------------------

function openDetail(id) {
  const item = state.items.find((it) => it.id === id);
  if (!item) return;
  const body = $("#detail-body");
  body.replaceChildren();

  if (item.photos.length) {
    const carousel = document.createElement("div");
    carousel.className = "carousel";
    for (const p of item.photos) {
      const fig = document.createElement("figure");
      const img = new Image();
      img.src = photoURL(p);
      img.alt = item.title;
      fig.append(img);
      carousel.append(fig);
    }
    body.append(carousel);
  }

  const meta = document.createElement("div");
  meta.className = "detail__meta mono";
  meta.innerHTML =
    `<span class="no">${fmtNo(item.no)}</span>` +
    `<span>${PRIVACY_MARK[item.privacy]} ${PRIVACY_NAME[item.privacy]}</span>` +
    `<span>Filed ${fmtDate(item.createdAt)}</span>`;

  const title = document.createElement("h3");
  title.className = "detail__title";
  title.textContent = item.title;

  const desc = document.createElement("p");
  desc.className = "detail__desc";
  desc.textContent = item.description;

  const tags = document.createElement("div");
  tags.className = "detail__tags";
  for (const t of item.tags) {
    const name = tagName(t);
    if (!name) continue;
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = "#" + name;
    tags.append(chip);
  }

  const actions = document.createElement("div");
  actions.className = "detail__actions";

  const edit = document.createElement("button");
  edit.className = "btn-ghost";
  edit.textContent = "Revise";
  edit.addEventListener("click", () => {
    $("#detail").close();
    openEditor(item);
  });

  const remove = document.createElement("button");
  remove.className = "btn-ghost danger";
  remove.textContent = "Remove";
  remove.addEventListener("click", async () => {
    if (remove.dataset.armed !== "true") {
      remove.dataset.armed = "true";
      remove.textContent = "Remove — certain?";
      return;
    }
    await db.deleteItem(item.id);
    state.items = state.items.filter((it) => it.id !== item.id);
    $("#detail").close();
    pruneURLCache();
    render();
    toast(`${fmtNo(item.no)} withdrawn from the archive`);
  });

  actions.append(edit, remove);
  body.append(meta, title, desc, tags, actions);
  $("#detail").showModal();
}

// --- Init ------------------------------------------------------------------------

export async function initWardrobe() {
  const [items, tags] = await Promise.all([db.getAllItems(), db.getAllTags()]);
  state.items = items.sort((a, b) => b.createdAt - a.createdAt);
  state.tags = tags.sort((a, b) => a.name.localeCompare(b.name));

  // Scope tabs
  for (const btn of document.querySelectorAll(".scope")) {
    btn.addEventListener("click", () => {
      state.scope = btn.dataset.scope;
      for (const b of document.querySelectorAll(".scope")) {
        b.setAttribute("aria-pressed", String(b === btn));
      }
      render();
    });
  }

  // Add / editor
  $("#btn-add").addEventListener("click", () => openEditor());
  $("#editor-form").addEventListener("submit", submitEditor);

  // Photo input + drag-drop
  const drop = $("#photo-drop");
  const input = $("#photo-input");
  drop.addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    addPhotoFiles(input.files);
    input.value = "";
  });
  drop.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.classList.add("dragover");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("dragover"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("dragover");
    addPhotoFiles(e.dataTransfer.files);
  });

  // New tag
  $("#tag-new-btn").addEventListener("click", createTagFromInput);
  $("#tag-new-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      createTagFromInput();
    }
  });

  // Close buttons on both sheets
  for (const btn of document.querySelectorAll("[data-close]")) {
    btn.addEventListener("click", () => btn.closest("dialog").close());
  }

  // Drop draft photos when the editor closes without saving.
  $("#editor").addEventListener("close", () => {
    state.draftPhotos = [];
    pruneURLCache();
  });

  render();
}
