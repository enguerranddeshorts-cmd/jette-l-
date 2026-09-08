// Petits utilitaires partagés — portés tels quels depuis le prototype Artifact.

export const CAT_LABELS = { corbeille: "Corbeille de rue", tri: "Tri sélectif", collecte: "Point de collecte" };
export const SUB_LABELS = { verre: "verre", papier: "papier", emballages: "emballages", textile: "textile" };
export const REPORT_COOLDOWN_MS = 10 * 60 * 1000;

export function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s == null ? "" : String(s);
  return d.innerHTML;
}

export function voterId() {
  try {
    let id = localStorage.getItem("jl_voter");
    if (!id) {
      id = "v-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("jl_voter", id);
    }
    return id;
  } catch (e) {
    return "v-anon";
  }
}

export function getFavorites() {
  try { return JSON.parse(localStorage.getItem("jl_favorites") || "[]"); } catch (e) { return []; }
}
export function isFavorite(id) { return getFavorites().indexOf(id) !== -1; }
export function toggleFavorite(id) {
  const favs = getFavorites();
  const i = favs.indexOf(id);
  if (i === -1) favs.push(id); else favs.splice(i, 1);
  try { localStorage.setItem("jl_favorites", JSON.stringify(favs)); } catch (e) {}
  return favs.indexOf(id) !== -1;
}

export function reportCooldownRemaining(binId) {
  try {
    const map = JSON.parse(localStorage.getItem("jl_report_times") || "{}");
    const last = map[binId];
    if (!last) return 0;
    const remaining = REPORT_COOLDOWN_MS - (Date.now() - last);
    return remaining > 0 ? remaining : 0;
  } catch (e) { return 0; }
}
export function markReported(binId) {
  try {
    const map = JSON.parse(localStorage.getItem("jl_report_times") || "{}");
    map[binId] = Date.now();
    localStorage.setItem("jl_report_times", JSON.stringify(map));
  } catch (e) {}
}

export function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
export function formatDistance(m) {
  if (m < 1000) return Math.round(m) + " m";
  return (m / 1000).toFixed(m < 10000 ? 1 : 0) + " km";
}

export function googleUrl(lat, lon) { return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`; }
export function appleUrl(lat, lon) { return `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=w`; }
export function wazeUrl(lat, lon) { return `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`; }

// Redimensionne + compresse une image côté navigateur avant upload (même logique que le prototype).
export function resizeImage(file, cb) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 480; // un peu plus large que le prototype : on stocke maintenant dans Supabase Storage, pas dans une ligne de base
      const scale = Math.min(1, maxW / img.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => cb(blob), "image/jpeg", 0.6);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
