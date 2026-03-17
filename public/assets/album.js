/**
 * album.js
 * Specialized logic for the album viewer page
 */

const API_LIST = "/api/files/list";
const galleryGrid = document.getElementById("gallery-grid");
const albumTitle = document.getElementById("album-display-name");
const albumStats = document.getElementById("album-display-stats");
const lightbox = document.getElementById("lightbox");
const lightboxContent = document.getElementById("lightbox-content");
const lightboxClose = document.getElementById("lightbox-close");

// Utility: get URL for a key
function getUrl(key) {
  return `/api/files?key=${encodeURIComponent(key)}`;
}

// Utility: check types
function isImage(key) {
  return /\.(jpg|jpeg|png|gif|webp|svg|avif|bmp)$/i.test(key);
}
function isVideo(key) {
  return /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(key);
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const path = params.get("path");

  if (!path) {
    window.location.href = "/";
    return;
  }

  // Set title
  const name = path.replace(/\/$/, "").split("/").pop();
  albumTitle.textContent = name;

  try {
    const res = await fetch(`${API_LIST}?recursive=true&prefix=${encodeURIComponent(path)}`);
    const data = await res.json();
    const objects = (data.objects || []).filter(o => !o.key.endsWith(".keep") && o.key !== path);

    albumStats.textContent = `${objects.length} item${objects.length === 1 ? "" : "s"}`;

    if (objects.length === 0) {
      galleryGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 4rem;">No items in this album yet.</div>`;
      return;
    }

    renderGallery(objects);
  } catch (err) {
    console.error("Failed to load album:", err);
    galleryGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--danger);">Error loading album.</div>`;
  }
}

function renderGallery(objects) {
  galleryGrid.innerHTML = "";
  objects.forEach(obj => {
    const item = document.createElement("div");
    item.className = "gallery-item";

    if (isImage(obj.key)) {
      const img = document.createElement("img");
      img.src = getUrl(obj.key);
      img.loading = "lazy";
      item.appendChild(img);
      item.onclick = () => openLightbox(`<img src="${getUrl(obj.key)}" />`);
    } else if (isVideo(obj.key)) {
      const vid = document.createElement("video");
      vid.src = `${getUrl(obj.key)}#t=0.1`;
      vid.preload = "metadata";
      vid.muted = true;
      item.appendChild(vid);
      
      const overlay = document.createElement("div");
      overlay.className = "play-overlay";
      overlay.innerHTML = `<div class="play-icon">▶</div>`;
      item.appendChild(overlay);

      item.onclick = () => openLightbox(`<video src="${getUrl(obj.key)}" controls autoplay></video>`);
    } else {
        // Fallback for other files if any
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.justifyContent = 'center';
        item.innerHTML = '📎';
    }

    galleryGrid.appendChild(item);
  });
}

// Lightbox logic (reused from home.js)
function openLightbox(htmlContent) {
  lightboxContent.innerHTML = htmlContent;
  lightbox.classList.remove("hidden");
}
function closeLightbox() {
  lightbox.classList.add("hidden");
  lightboxContent.innerHTML = "";
}
lightboxClose?.addEventListener("click", closeLightbox);
lightbox?.addEventListener("click", (e) => {
  if (e.target === lightbox) closeLightbox();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeLightbox();
});

init();
