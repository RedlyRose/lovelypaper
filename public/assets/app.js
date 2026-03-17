/* ============================================================
   CHINRA — app.js
   Vanilla JS SPA for R2 media dashboard
   ============================================================ */

// ── State ──────────────────────────────────────────────────
const state = {
  currentPath: "", // current folder prefix
  files: [], // R2 objects in current folder
  folders: [], // sub-folder prefixes in current folder
  allFolders: [], // flat list of all known folders (for move picker)
  selectedFileKey: null, // key of right-clicked / context file
  selectedItems: new Set(), // keys of selected files for bulk action
  isBulkAction: false, // flag for move modal
  lightboxIndex: 0, // index into mediaFiles array
  viewMode: "grid", // 'grid' | 'list'
};

// ── Derived helpers ────────────────────────────────────────
const mediaFiles = () => state.files.filter((f) => isMedia(f));
const isImage = (f) => /\.(jpg|jpeg|png|gif|webp|svg|avif|bmp)$/i.test(f.key);
const isVideo = (f) => /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(f.key);
const isMedia = (f) => isImage(f) || isVideo(f);
const fileName = (key) => key.split("/").pop();
const folderName = (prefix) => prefix.replace(/\/$/, "").split("/").pop();
const formatSize = (b) => {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
};
const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
const objectUrl = (key) => `/api/r2-proxy?key=${encodeURIComponent(key)}`;

// ── DOM refs ───────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const fileGrid = $("file-grid");
const folderTree = $("folder-tree");
const breadcrumbs = $("breadcrumbs");
const emptyState = $("empty-state");
const loadingState = $("loading-state");
const uploadQueue = $("upload-queue");
const dropOverlay = $("drop-overlay");
const ctxMenu = $("ctx-menu");
const lightbox = $("lightbox");
const lightboxContent = $("lightbox-content");
const lightboxInfo = $("lightbox-info");
const modalBackdrop = $("modal-backdrop");

// ── Init ───────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const urlParams = new URLSearchParams(window.location.search);
  const initialPath = urlParams.get("path") || state.currentPath;
  loadFiles(initialPath);
  setupDrop();
  setupUpload();
  setupViewToggle();
  setupSelectionDropdown();
  setupContextMenu();
  setupModals();
  setupLightbox();
});

// ── Load files from R2 ─────────────────────────────────────
async function loadFiles(prefix = "") {
  showLoading(true);
  state.currentPath = prefix;
  state.selectedItems.clear();
  updateBulkActions();
  updateBreadcrumbs(prefix);
  updateFolderTree(prefix);

  try {
    const res = await fetch(
      `/api/files/list?prefix=${encodeURIComponent(prefix)}`,
    );
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    state.folders = data.prefixes || [];
    state.files = (data.objects || []).filter(
      (o) => !o.key.endsWith(".keep") && o.key !== prefix,
    );

    // Track all folders ever seen
    state.allFolders = [...new Set([...state.allFolders, ...state.folders])];

    renderGrid();
  } catch (err) {
    console.error("loadFiles error:", err);
    showToast("Failed to load files: " + err.message, "error");
  } finally {
    showLoading(false);
  }
}

// ── Render grid ────────────────────────────────────────────
function renderGrid() {
  fileGrid.innerHTML = "";

  const hasFolders = state.folders.length > 0;
  const hasFiles = state.files.length > 0;

  emptyState.classList.toggle("hidden", hasFolders || hasFiles);

  // Folders first
  state.folders.forEach((prefix) => {
    const card = createFolderCard(prefix);
    fileGrid.appendChild(card);
  });

  // Then files
  state.files.forEach((file, idx) => {
    const card = createFileCard(file, idx);
    fileGrid.appendChild(card);
  });
}

// ── Folder card ────────────────────────────────────────────
function createFolderCard(prefix) {
  const name = folderName(prefix);
  const div = document.createElement("div");
  div.className = "folder-card";
  div.dataset.prefix = prefix;

  div.innerHTML = `
    <div class="folder-thumb">📁</div>
    <div class="folder-card-info">
      <div class="folder-card-name">${escHtml(name)}</div>
      <div class="folder-card-meta">Folder</div>
    </div>`;

  div.addEventListener("click", () => loadFiles(prefix));
  div.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    // Folders not supported in ctx menu yet
  });
  return div;
}

// ── File card ──────────────────────────────────────────────
function createFileCard(file, idx) {
  const name = fileName(file.key);
  const div = document.createElement("div");
  div.className = "file-card";
  div.dataset.key = file.key;
  div.dataset.idx = idx;

  const thumb = buildThumb(file);

  div.innerHTML = `
    <div class="card-select">✓</div>
    <div class="card-thumb">${thumb}</div>
    <div class="card-info">
      <div class="card-name" title="${escHtml(file.key)}">${escHtml(name)}</div>
      <div class="card-meta">${formatSize(file.size)}</div>
    </div>`;

  div.addEventListener("click", (e) => {
    if (e.target.classList.contains("card-select")) {
      div.classList.toggle("selected");
      if (div.classList.contains("selected")) {
        state.selectedItems.add(file.key);
      } else {
        state.selectedItems.delete(file.key);
      }
      updateBulkActions();
      return;
    }
    openLightbox(file, idx);
  });

  div.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    state.selectedFileKey = file.key;
    showCtxMenu(e.clientX, e.clientY);
  });

  return div;
}

// ── Thumbnail builder ──────────────────────────────────────
function buildThumb(file) {
  if (isImage(file)) {
    return `<img src="${objectUrl(file.key)}" alt="${escHtml(fileName(file.key))}" loading="lazy"
                 onerror="this.parentElement.innerHTML='<span class=file-icon>🖼</span>'" />`;
  }
  if (isVideo(file)) {
    return `
      <video src="${objectUrl(file.key)}" preload="metadata" muted></video>
      <div class="card-play-overlay"><div class="card-play-btn">▶</div></div>`;
  }
  const icons = { pdf: "📄", zip: "📦", mp3: "🎵", default: "📎" };
  const ext = file.key.split(".").pop().toLowerCase();
  const icon = icons[ext] || icons.default;
  return `<span class="file-icon">${icon}</span>`;
}

// ── Breadcrumbs ────────────────────────────────────────────
function updateBreadcrumbs(prefix) {
  breadcrumbs.innerHTML = "";

  const parts = prefix ? prefix.replace(/\/$/, "").split("/") : [];
  const crumb = (label, path) => {
    const s = document.createElement("span");
    s.className = "crumb";
    s.textContent = label;
    s.dataset.path = path;
    s.addEventListener("click", () => loadFiles(path));
    return s;
  };
  const sep = () => {
    const s = document.createElement("span");
    s.className = "crumb-sep";
    s.textContent = "/";
    return s;
  };

  const root = crumb("Root", "");
  if (!prefix) root.classList.add("active");
  breadcrumbs.appendChild(root);

  let built = "";
  parts.forEach((part, i) => {
    built += (built ? "/" : "") + part;
    const path = built + "/";
    breadcrumbs.appendChild(sep());
    const c = crumb(part, path);
    if (i === parts.length - 1) c.classList.add("active");
    breadcrumbs.appendChild(c);
  });
}

// ── Sidebar folder tree ────────────────────────────────────
function updateFolderTree(activePath) {
  folderTree.innerHTML = "";

  const rootItem = document.createElement("div");
  rootItem.className = `folder-item root${activePath === "" ? " active" : ""}`;
  rootItem.dataset.path = "";
  rootItem.innerHTML = `<span class="folder-icon">🗄</span><span>Root</span>`;
  rootItem.addEventListener("click", () => loadFiles(""));
  folderTree.appendChild(rootItem);

  state.allFolders.forEach((prefix) => {
    const depth = prefix.replace(/\/$/, "").split("/").length - 1;
    const name = folderName(prefix);
    const item = document.createElement("div");
    item.className = `folder-item${depth === 1 ? " child" : depth >= 2 ? " child-2" : ""}${activePath === prefix ? " active" : ""}`;
    item.dataset.path = prefix;
    item.innerHTML = `<span class="folder-icon">📁</span><span>${escHtml(name)}</span>`;
    item.addEventListener("click", () => loadFiles(prefix));
    folderTree.appendChild(item);
  });
}

// ── Drop & Upload ──────────────────────────────────────────
function setupDrop() {
  document.addEventListener("dragenter", (e) => {
    if (e.dataTransfer.types.includes("Files")) {
      dropOverlay.classList.remove("hidden");
    }
  });

  dropOverlay.addEventListener("dragleave", (e) => {
    if (!e.relatedTarget || e.relatedTarget === document.documentElement) {
      dropOverlay.classList.add("hidden");
    }
  });

  dropOverlay.addEventListener("dragover", (e) => e.preventDefault());

  dropOverlay.addEventListener("drop", async (e) => {
    e.preventDefault();
    dropOverlay.classList.add("hidden");
    const files = [...e.dataTransfer.files];
    if (files.length) uploadFiles(files);
  });

  // Also allow dropping on the file area
  $("file-area").addEventListener("dragover", (e) => {
    e.preventDefault();
    $("file-area").classList.add("drop-active");
  });

  $("file-area").addEventListener("dragleave", () => {
    $("file-area").classList.remove("drop-active");
  });

  $("file-area").addEventListener("drop", (e) => {
    e.preventDefault();
    $("file-area").classList.remove("drop-active");
    const files = [...e.dataTransfer.files];
    if (files.length) uploadFiles(files);
  });
}

function setupUpload() {
  $("file-input").addEventListener("change", (e) => {
    const files = [...e.target.files];
    if (files.length) uploadFiles(files);
    e.target.value = "";
  });
}

async function uploadFiles(files) {
  uploadQueue.classList.remove("hidden");

  for (const file of files) {
    const itemEl = createUploadItem(file.name);
    uploadQueue.appendChild(itemEl);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", state.currentPath.replace(/\/$/, ""));

      // XHR for progress tracking
      await uploadWithProgress(formData, itemEl);

      itemEl.querySelector(".upload-item-status").textContent = "✓ Done";
      itemEl.querySelector(".upload-item-status").className =
        "upload-item-status done";
    } catch (err) {
      itemEl.querySelector(".upload-item-status").textContent = "✗ Failed";
      itemEl.querySelector(".upload-item-status").className =
        "upload-item-status error";
      showToast(`Upload failed: ${file.name}`, "error");
    }
  }

  // Refresh the grid after all uploads
  await loadFiles(state.currentPath);

  // Clear queue after a moment
  setTimeout(() => {
    uploadQueue.innerHTML = "";
    uploadQueue.classList.add("hidden");
  }, 2500);
}

function uploadWithProgress(formData, itemEl) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/files/upload");

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        itemEl.querySelector(".upload-item-fill").style.width = pct + "%";
        itemEl.querySelector(".upload-item-status").textContent = pct + "%";
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(xhr.responseText));
    });

    xhr.addEventListener("error", () => reject(new Error("Network error")));
    xhr.send(formData);
  });
}

function createUploadItem(name) {
  const div = document.createElement("div");
  div.className = "upload-item";
  div.innerHTML = `
    <span class="upload-item-name">${escHtml(name)}</span>
    <div class="upload-item-bar"><div class="upload-item-fill" style="width:0%"></div></div>
    <span class="upload-item-status">0%</span>`;
  return div;
}

// ── View toggle ────────────────────────────────────────────
function setupViewToggle() {
  $("btn-grid").addEventListener("click", () => {
    state.viewMode = "grid";
    fileGrid.classList.remove("list-mode");
    $("btn-grid").classList.add("active");
    $("btn-list").classList.remove("active");
  });

  $("btn-list").addEventListener("click", () => {
    state.viewMode = "list";
    fileGrid.classList.add("list-mode");
    $("btn-list").classList.add("active");
    $("btn-grid").classList.remove("active");
  });
}

// ── Selection Dropdown ─────────────────────────────────────
function setupSelectionDropdown() {
  const toggle = $("btn-select-toggle");
  const menu = $("select-menu");

  toggle?.addEventListener("click", (e) => {
    e.stopPropagation();
    menu.classList.toggle("hidden");
  });

  document.addEventListener("click", () => menu?.classList.add("hidden"));

  $("btn-select-all")?.addEventListener("click", () => {
    state.files.forEach((file) => state.selectedItems.add(file.key));
    document
      .querySelectorAll(".file-card")
      .forEach((card) => card.classList.add("selected"));
    updateBulkActions();
  });

  $("btn-select-none")?.addEventListener("click", () => {
    state.selectedItems.clear();
    document
      .querySelectorAll(".file-card")
      .forEach((card) => card.classList.remove("selected"));
    updateBulkActions();
  });
}

// ── Bulk Actions ───────────────────────────────────────────
function updateBulkActions() {
  const bulkBar = $("bulk-actions");
  const countSpan = $("bulk-count");
  if (state.selectedItems.size > 0) {
    bulkBar.classList.remove("hidden");
    countSpan.textContent = `${state.selectedItems.size} selected`;
    fileGrid.classList.add("selection-mode");
  } else {
    bulkBar.classList.add("hidden");
    fileGrid.classList.remove("selection-mode");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  $("btn-bulk-clear")?.addEventListener("click", () => {
    state.selectedItems.clear();
    document.querySelectorAll(".file-card.selected").forEach((el) => {
      el.classList.remove("selected");
    });
    updateBulkActions();
  });

  $("btn-bulk-delete")?.addEventListener("click", async () => {
    if (!confirm(`Delete ${state.selectedItems.size} items?`)) return;
    const keys = Array.from(state.selectedItems);
    showLoading(true);
    try {
      await Promise.all(
        keys.map((key) =>
          fetch("/api/files/delete", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key }),
          }),
        ),
      );
      showToast(`Deleted ${keys.length} items`, "success");
      await loadFiles(state.currentPath);
    } catch (err) {
      showToast("Bulk delete failed", "error");
    }
  });

  $("btn-bulk-move")?.addEventListener("click", () => {
    state.isBulkAction = true;
    populateMovePicker();
    openModal("modal-move");
  });
});

// ── Context menu ───────────────────────────────────────────
function setupContextMenu() {
  $("ctx-open").addEventListener("click", () => {
    const file = state.files.find((f) => f.key === state.selectedFileKey);
    if (file) openLightbox(file, state.files.indexOf(file));
    hideCtxMenu();
  });

  $("ctx-rename").addEventListener("click", () => {
    hideCtxMenu();
    const current = fileName(state.selectedFileKey);
    $("rename-input").value = current;
    openModal("modal-rename");
  });

  $("ctx-move").addEventListener("click", () => {
    hideCtxMenu();
    state.isBulkAction = false;
    populateMovePicker();
    openModal("modal-move");
  });

  $("ctx-delete").addEventListener("click", async () => {
    hideCtxMenu();
    if (!confirm(`Delete "${fileName(state.selectedFileKey)}"?`)) return;
    await deleteFile(state.selectedFileKey);
  });

  document.addEventListener("click", (e) => {
    if (!ctxMenu.contains(e.target)) hideCtxMenu();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      hideCtxMenu();
      closeLightbox();
    }
  });
}

function showCtxMenu(x, y) {
  ctxMenu.classList.remove("hidden");
  const vw = window.innerWidth,
    vh = window.innerHeight;
  const cw = ctxMenu.offsetWidth || 180;
  const ch = ctxMenu.offsetHeight || 150;
  ctxMenu.style.left = Math.min(x, vw - cw - 8) + "px";
  ctxMenu.style.top = Math.min(y, vh - ch - 8) + "px";
}

function hideCtxMenu() {
  ctxMenu.classList.add("hidden");
}

// ── Delete ─────────────────────────────────────────────────
async function deleteFile(key) {
  try {
    const res = await fetch("/api/files/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);
    showToast("Deleted successfully", "success");
    await loadFiles(state.currentPath);
  } catch (err) {
    showToast("Delete failed: " + err.message, "error");
  }
}

// ── Modals ─────────────────────────────────────────────────
function setupModals() {
  // New folder
  $("btn-mkdir").addEventListener("click", () => {
    $("mkdir-name").value = "";
    openModal("modal-mkdir");
  });

  $("mkdir-cancel").addEventListener("click", () => closeModal("modal-mkdir"));

  $("mkdir-confirm").addEventListener("click", async () => {
    const name = $("mkdir-name").value.trim();
    if (!name) return;
    const path = state.currentPath
      ? `${state.currentPath.replace(/\/$/, "")}/${name}`
      : name;
    closeModal("modal-mkdir");
    try {
      const res = await fetch("/api/files/mkdir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      showToast(`Folder "${name}" created`, "success");
      await loadFiles(state.currentPath);
    } catch (err) {
      showToast("Create folder failed: " + err.message, "error");
    }
  });

  $("mkdir-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("mkdir-confirm").click();
  });

  // Rename
  $("rename-cancel").addEventListener("click", () =>
    closeModal("modal-rename"),
  );

  $("rename-confirm").addEventListener("click", async () => {
    const newName = $("rename-input").value.trim();
    if (!newName) return;
    closeModal("modal-rename");

    const oldKey = state.selectedFileKey;
    const dir = oldKey.includes("/")
      ? oldKey.substring(0, oldKey.lastIndexOf("/") + 1)
      : "";
    const destKey = dir + newName;

    try {
      const res = await fetch("/api/files/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceKey: oldKey, destKey }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      showToast("Renamed successfully", "success");
      await loadFiles(state.currentPath);
    } catch (err) {
      showToast("Rename failed: " + err.message, "error");
    }
  });

  $("rename-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("rename-confirm").click();
  });

  // Move
  $("move-cancel").addEventListener("click", () => closeModal("modal-move"));

  $("move-confirm").addEventListener("click", async () => {
    const selected = $("move-folder-list").querySelector(".selected");
    const customPath = $("move-custom-path").value.trim();
    let destFolder = selected
      ? selected.dataset.prefix
      : customPath.replace(/^\/|\/$/g, "");
    closeModal("modal-move");

    const keysToMove = state.isBulkAction
      ? Array.from(state.selectedItems)
      : [state.selectedFileKey];

    if (keysToMove.length === 0) return;

    showLoading(true);
    try {
      await Promise.all(
        keysToMove.map(async (oldKey) => {
          const name = fileName(oldKey);
          const destKey = destFolder ? `${destFolder}/${name}` : name;
          const res = await fetch("/api/files/move", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sourceKey: oldKey, destKey }),
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.error || "Move error");
        }),
      );
      showToast(`Moved ${keysToMove.length} items`, "success");
      // clear selection if it was a bulk action
      if (state.isBulkAction) {
        state.selectedItems.clear();
        state.isBulkAction = false;
        updateBulkActions();
      }
      await loadFiles(state.currentPath);
    } catch (err) {
      showToast("Move failed: " + err.message, "error");
      showLoading(false);
    }
  });
}

function populateMovePicker() {
  const picker = $("move-folder-list");
  picker.innerHTML = "";
  $("move-custom-path").value = "";

  const root = document.createElement("div");
  root.className = "picker-folder";
  root.dataset.prefix = "";
  root.innerHTML = "🗄 Root";
  root.addEventListener("click", () => {
    picker
      .querySelectorAll(".picker-folder")
      .forEach((el) => el.classList.remove("selected"));
    root.classList.add("selected");
  });
  picker.appendChild(root);

  state.allFolders.forEach((prefix) => {
    if (prefix === state.currentPath) return; // skip current
    const div = document.createElement("div");
    div.className = "picker-folder";
    div.dataset.prefix = prefix.replace(/\/$/, "");
    div.innerHTML = `📁 ${escHtml(folderName(prefix))}`;
    div.addEventListener("click", () => {
      picker
        .querySelectorAll(".picker-folder")
        .forEach((el) => el.classList.remove("selected"));
      div.classList.add("selected");
    });
    picker.appendChild(div);
  });
}

function openModal(id) {
  modalBackdrop.classList.remove("hidden");
  $(id).classList.remove("hidden");
}

function closeModal(id) {
  $(id).classList.add("hidden");
  modalBackdrop.classList.add("hidden");
}

modalBackdrop.addEventListener("click", () => {
  ["modal-mkdir", "modal-rename", "modal-move"].forEach(closeModal);
});

// ── Lightbox ───────────────────────────────────────────────
function setupLightbox() {
  $("lightbox-close").addEventListener("click", closeLightbox);
  $("lightbox-prev").addEventListener("click", () => navigateLightbox(-1));
  $("lightbox-next").addEventListener("click", () => navigateLightbox(1));

  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  document.addEventListener("keydown", (e) => {
    if (lightbox.classList.contains("hidden")) return;
    if (e.key === "ArrowLeft") navigateLightbox(-1);
    if (e.key === "ArrowRight") navigateLightbox(1);
    if (e.key === "Escape") closeLightbox();
  });
}

function openLightbox(file, idx) {
  const mf = mediaFiles();
  const mIdx = mf.findIndex((f) => f.key === file.key);
  state.lightboxIndex = mIdx >= 0 ? mIdx : 0;
  renderLightboxSlide();
  lightbox.classList.remove("hidden");
}

function renderLightboxSlide() {
  const mf = mediaFiles();
  if (!mf.length) return;
  const file = mf[state.lightboxIndex];

  lightboxContent.innerHTML = "";
  if (isImage(file)) {
    const img = document.createElement("img");
    img.src = objectUrl(file.key);
    img.alt = fileName(file.key);
    lightboxContent.appendChild(img);
  } else if (isVideo(file)) {
    const video = document.createElement("video");
    video.src = objectUrl(file.key);
    video.controls = true;
    video.autoplay = true;
    lightboxContent.appendChild(video);
  }

  lightboxInfo.textContent = `${fileName(file.key)} · ${formatSize(file.size)} · ${state.lightboxIndex + 1}/${mf.length}`;
  $("lightbox-prev").style.visibility =
    state.lightboxIndex > 0 ? "visible" : "hidden";
  $("lightbox-next").style.visibility =
    state.lightboxIndex < mf.length - 1 ? "visible" : "hidden";
}

function navigateLightbox(dir) {
  const mf = mediaFiles();
  state.lightboxIndex = Math.max(
    0,
    Math.min(mf.length - 1, state.lightboxIndex + dir),
  );
  renderLightboxSlide();
}

function closeLightbox() {
  lightbox.classList.add("hidden");
  lightboxContent.innerHTML = ""; // stop video playback
}

// ── UI Helpers ─────────────────────────────────────────────
function showLoading(on) {
  loadingState.classList.toggle("hidden", !on);
  if (on) emptyState.classList.add("hidden");
}

let toastTimeout;
function showToast(msg, type = "info") {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.style.cssText = `
      position:fixed;bottom:24px;right:24px;z-index:9999;
      padding:12px 20px;border-radius:10px;font-size:13px;font-weight:500;
      font-family:var(--font);max-width:320px;
      transition:all 0.2s ease;animation:toastIn 0.2s ease;`;
    document.body.appendChild(toast);
    const style = document.createElement("style");
    style.textContent = `@keyframes toastIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`;
    document.head.appendChild(style);
  }
  const colors = {
    success: "background:#14532d;color:#86efac;border:1px solid #22c55e33",
    error: "background:#450a0a;color:#fca5a5;border:1px solid #ef444433",
    info: "background:#1a1b2e;color:#c4b5fd;border:1px solid #8b5cf633",
  };
  toast.style.cssText += colors[type] || colors.info;
  toast.textContent = msg;
  toast.style.opacity = "1";
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.style.opacity = "0";
  }, 3000);
}

function escHtml(str) {
  return String(str).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
