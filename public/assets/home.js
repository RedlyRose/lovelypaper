/**
 * home.js
 * Logic for fetching and rendering Home page components:
 * 1. Marquee images
 * 2. Album circles
 * 3. Video Grid
 */

const API_LIST = "/api/files/list";

// DOM Elements
const marqueeContent = document.getElementById("marquee-content");
const albumsGrid = document.getElementById("albums-grid");
const videoGrid = document.getElementById("video-grid");
const lightbox = document.getElementById("lightbox");
const lightboxContent = document.getElementById("lightbox-content");
const lightboxClose = document.getElementById("lightbox-close");

// Utility: is image
function isImage(obj) {
  const type = obj.contentType || "";
  if (type.startsWith("image/")) return true;
  return /\.(jpg|jpeg|png|gif|webp|svg|avif|bmp)$/i.test(obj.key);
}

// Utility: is video
function isVideo(obj) {
  const type = obj.contentType || "";
  if (type.startsWith("video/")) return true;
  return /\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(obj.key);
}

// Build URL for a key
function getUrl(key) {
  return `/api/files?key=${encodeURIComponent(key)}`;
}

// Fetch recursive files
async function fetchAll(prefix = "") {
  let url = `${API_LIST}?recursive=true`;
  if (prefix) url += `&prefix=${encodeURIComponent(prefix)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Fetch failed");
  return await res.json();
}

// 1. Setup Marquee
// Fetches all files, grabs recent images
async function setupMarquee(allObjects) {
  const images = allObjects.filter(
    (obj) => isImage(obj) && !obj.key.toLowerCase().startsWith("albums/"),
  );

  // Sort reverse chronologically (assuming 'uploaded' or just trust R2 order mostly)
  images.sort((a, b) => new Date(b.uploaded || 0) - new Date(a.uploaded || 0));

  // take up to 20 for marquee
  const marqueeImages = images.slice(0, 20);

  if (marqueeImages.length === 0) {
    marqueeContent.innerHTML = `<span style="color:var(--text-muted); padding:2rem;">No images found</span>`;
    return;
  }

  // Create elements
  const fragment = document.createDocumentFragment();
  marqueeImages.forEach((img) => {
    const el = document.createElement("img");
    el.src = getUrl(img.key);
    el.className = "marquee-img";
    el.loading = "lazy";

    // allow clicking to view
    el.onclick = () => openLightbox(`<img src="${getUrl(img.key)}" />`);
    fragment.appendChild(el);
  });

  // Duplicate for smooth infinite scrolling
  const duplicateFragment = fragment.cloneNode(true);

  marqueeContent.appendChild(fragment);
  marqueeContent.appendChild(duplicateFragment);
}

// 2. Setup Albums
// Scans for 'albums/*/', counts items, looks for cover
function setupAlbums(allObjects) {
  // Determine the actual casing of the "albums/" folder in the bucket
  const firstAlbumPath = allObjects.find((obj) =>
    obj.key.toLowerCase().startsWith("albums/"),
  );
  if (!firstAlbumPath) {
    albumsGrid.innerHTML = `<div style="color:var(--text-muted); padding:1rem 0;">No albums found. Make sure you have an "albums" folder.</div>`;
    return;
  }

  // Get the actual prefix (e.g., "Albums/" or "albums/")
  const albumsPrefix = firstAlbumPath.key.split("/")[0] + "/";

  // Find all keys starting with that prefix
  const albumKeys = allObjects.filter(
    (obj) => obj.key.startsWith(albumsPrefix) && obj.key !== albumsPrefix,
  );

  // Group by album name
  // Key format: albums/MyTrip/photo.jpg
  const albumsMap = new Map(); // albumName -> { count, coverUrl }

  albumKeys.forEach((obj) => {
    const parts = obj.key.split("/");
    if (parts.length < 3) return; // e.g. albums/Folder/file.jpg needs at least 3 parts

    const albumName = parts[1];
    const fileName = parts[parts.length - 1];

    if (!albumsMap.has(albumName)) {
      albumsMap.set(albumName, { count: 0, coverUrl: null });
    }

    const data = albumsMap.get(albumName);
    data.count++;

    // Check if cover
    if (
      fileName.toLowerCase().startsWith("cover") &&
      isImage(obj)
    ) {
      data.coverUrl = getUrl(obj.key);
    }
  });

  // Second pass: if no cover, pick first image
  albumKeys.forEach((obj) => {
    const parts = obj.key.split("/");
    if (parts.length < 3) return;
    const albumName = parts[1];
    const data = albumsMap.get(albumName);
    if (!data.coverUrl && isImage(obj)) {
      data.coverUrl = getUrl(obj.key);
    }
  });

  if (albumsMap.size === 0) {
    albumsGrid.innerHTML = `<div style="color:var(--text-muted); padding:1rem 0;">No albums created yet.</div>`;
    return;
  }

  albumsGrid.innerHTML = "";
  albumsMap.forEach((data, name) => {
    const div = document.createElement("div");
    div.className = "album-item";

    // Placeholder if no cover
    const coverHtml = data.coverUrl
      ? `<img src="${data.coverUrl}" class="album-cover" loading="lazy" />`
      : `<div class="album-cover">📁</div>`;

    div.innerHTML = `
      ${coverHtml}
      <div class="album-info">
        <div class="album-name">${name}</div>
        <div class="album-count">${data.count} items</div>
      </div>
    `;

    // Click navigates to dashboard inside that folder
    div.onclick = () => {
      window.location.href = `/dashboard.html?path=${encodeURIComponent(albumsPrefix + name)}`;
    };

    albumsGrid.appendChild(div);
  });
}

// 3. Setup Videos
// Fetches all videos in bucket
function setupVideos(allObjects) {
  const videos = allObjects.filter((obj) => isVideo(obj));
  videos.sort((a, b) => new Date(b.uploaded || 0) - new Date(a.uploaded || 0));

  if (videos.length === 0) {
    videoGrid.innerHTML = `<div style="color:var(--text-muted);">No videos found.</div>`;
    return;
  }

  videoGrid.innerHTML = "";
  videos.forEach((vid) => {
    const card = document.createElement("div");
    card.className = "video-card";

    card.innerHTML = `
      <video src="${getUrl(vid.key)}#t=0.1" preload="metadata" muted playsinline></video>
      <div class="play-overlay"><div class="play-icon">▶</div></div>
    `;

    card.onclick = () => {
      openLightbox(`
        <video src="${getUrl(vid.key)}" controls autoplay style="max-height:85vh; outline:none;"></video>
      `);
    };

    videoGrid.appendChild(card);
  });
}

// Lightbox logic
function openLightbox(htmlContent) {
  lightboxContent.innerHTML = htmlContent;
  lightbox.classList.remove("hidden");
}
function closeLightbox() {
  lightbox.classList.add("hidden");
  lightboxContent.innerHTML = ""; // stops video playing
}
lightboxClose.addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) closeLightbox();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeLightbox();
});

// Init Main
async function init() {
  try {
    const data = await fetchAll("");
    const allObjects = data.objects || [];

    setupMarquee(allObjects);
    setupAlbums(allObjects);
    setupVideos(allObjects);
  } catch (err) {
    console.error("Failed to load home data:", err);
    marqueeContent.innerHTML = "Error loading images.";
    albumsGrid.innerHTML = "Error loading albums.";
    videoGrid.innerHTML = "Error loading videos.";
  }
}

init();
