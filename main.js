import "./style.css";
import { initMap, flyTo, refreshBinsNow } from "./map.js";
import { openDetail, closeDetail, tryOpenFromHash } from "./detail.js";
import { openAddForm } from "./addBin.js";
import { openFeedback } from "./feedback.js";
import { openAdmin } from "./admin.js";
import { subscribeReports, subscribeCommunityBins } from "./data.js";
import { CAT_LABELS, escapeHtml, getFavorites, isFavorite } from "./utils.js";

let latestBins = [];
let catFilter = "all";
let communeQuery = "";
let favoritesOnly = false;

function matchesFilters(bin) {
  if (catFilter !== "all" && bin.category !== catFilter) return false;
  if (favoritesOnly && !isFavorite(bin.id)) return false;
  if (communeQuery) {
    const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (norm(bin.commune).indexOf(norm(communeQuery)) === -1) return false;
  }
  return true;
}

function renderList() {
  const list = latestBins.filter(matchesFilters);
  document.getElementById("listTitle").textContent =
    `${list.length} point${list.length > 1 ? "s" : ""} visible${list.length > 1 ? "s" : ""} sur la carte`;
  const cardsEl = document.getElementById("mainCards");
  cardsEl.innerHTML = list.slice(0, 240).map((bin) => `
    <div class="card ${bin.category}" data-id="${bin.id}">
      <div class="card-title">${escapeHtml(bin.commune)}</div>
      <div class="card-sub">${CAT_LABELS[bin.category] || bin.category}${bin.subtypes && bin.subtypes.length ? " — " + bin.subtypes.join(", ") : ""}</div>
    </div>
  `).join("");
  cardsEl.querySelectorAll("[data-id]").forEach((el) => {
    el.addEventListener("click", () => {
      const bin = latestBins.find((b) => b.id === el.dataset.id);
      if (bin) flyTo(bin.lat, bin.lon, 15);
      openDetail(el.dataset.id);
    });
  });
}

function wireFilters() {
  document.getElementById("catFilter").addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    document.querySelectorAll("#catFilter button").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    catFilter = b.dataset.val;
    renderList();
  });
  document.getElementById("communeSearch").addEventListener("input", (ev) => {
    communeQuery = ev.target.value;
    renderList();
  });
  const favBtn = document.getElementById("favFilterBtn");
  favBtn.addEventListener("click", () => {
    favoritesOnly = !favoritesOnly;
    favBtn.classList.toggle("fav-active", favoritesOnly);
    favBtn.setAttribute("aria-pressed", String(favoritesOnly));
    renderList();
  });
}

function wireHero() {
  document.getElementById("heroBtn").addEventListener("click", () => {
    if (!navigator.geolocation) return;
    const sub = document.getElementById("heroSub");
    sub.textContent = "Localisation en cours…";
    navigator.geolocation.getCurrentPosition(
      (pos) => { flyTo(pos.coords.latitude, pos.coords.longitude, 14); sub.textContent = "Voici les points autour de toi."; },
      () => { sub.textContent = "Impossible de te localiser — vérifie l'autorisation de géolocalisation."; },
      { timeout: 9000 }
    );
  });
}

/* ---------- Tuto de bienvenue (4 écrans, identique dans l'esprit au prototype) ---------- */
const ONBOARD_STEPS = [
  { title: "Trouve une poubelle près de toi", body: "Zoome et déplace-toi sur la carte, ou touche « Me localiser »." },
  { title: "Touche un point pour le détail", body: "Itinéraire, consignes de tri, et un bouton pour signaler un souci." },
  { title: "Favoris et partage par lien", body: "L'étoile ajoute un favori. « Copier le lien » ouvre directement cette fiche chez un ami." },
  { title: "Une poubelle manque ?", body: "Touche une zone vide de la carte pour la proposer — validée ensuite par vote." },
];
let onboardStep = 0;
function renderOnboardStep() {
  const s = ONBOARD_STEPS[onboardStep];
  const last = onboardStep === ONBOARD_STEPS.length - 1;
  const dots = ONBOARD_STEPS.map((_, i) => `<span style="width:6px;height:6px;border-radius:50%;background:${i === onboardStep ? "var(--accent-strong)" : "var(--line)"};"></span>`).join(" ");
  const sheet = document.getElementById("onboardSheet");
  sheet.innerHTML = `
    <button class="sheet-close" aria-label="Fermer">&times;</button>
    <div style="text-align:center;">
      <h3>${s.title}</h3>
      <p style="font-size:13.5px;color:var(--ink-soft);">${s.body}</p>
      <div style="display:flex;gap:6px;justify-content:center;margin:16px 0 2px;">${dots}</div>
    </div>
    <div class="btn-row" style="justify-content:space-between;">
      ${onboardStep > 0 ? '<button class="btn ghost" id="obPrev">Précédent</button>' : "<span></span>"}
      <button class="btn primary" id="obNext">${last ? "C'est parti" : "Suivant"}</button>
    </div>`;
  sheet.querySelector(".sheet-close").onclick = closeOnboard;
  const prev = sheet.querySelector("#obPrev");
  if (prev) prev.addEventListener("click", () => { onboardStep--; renderOnboardStep(); });
  sheet.querySelector("#obNext").addEventListener("click", () => { if (last) closeOnboard(); else { onboardStep++; renderOnboardStep(); } });
}
function openOnboard() { onboardStep = 0; renderOnboardStep(); document.getElementById("onboardOverlay").hidden = false; }
function closeOnboard() { document.getElementById("onboardOverlay").hidden = true; try { localStorage.setItem("jl_onboarded", "1"); } catch (e) {} }
document.getElementById("onboardOverlay").addEventListener("click", (ev) => { if (ev.target === ev.currentTarget) closeOnboard(); });

function wireTopbar() {
  document.getElementById("helpBtn").addEventListener("click", openOnboard);
  document.getElementById("feedbackBtn").addEventListener("click", openFeedback);
}

function init() {
  wireFilters();
  wireHero();
  wireTopbar();

  try {
    initMap(document.getElementById("mapContainer"), {
      handlers: {
        onBinClick: (id) => openDetail(id),
        onEmptyClick: (lat, lon) => openAddForm(lat, lon),
        onBinsUpdate: (bins) => { latestBins = bins; renderList(); },
      },
    });
  } catch (e) {
    // Un token Mapbox manquant/invalide ne doit pas bloquer le reste de l'appli
    // (tuto, avis, espace admin) — juste la carte elle-même.
    console.error("[Jette là] La carte n'a pas pu s'initialiser :", e);
    document.getElementById("mapContainer").innerHTML =
      '<div class="card-sub" style="padding:16px;">Carte indisponible — vérifie VITE_MAPBOX_TOKEN dans .env.local.</div>';
  }

  subscribeReports(() => {}); // les fiches se rafraîchissent à la demande (fetchReportsForBin)
  subscribeCommunityBins(() => refreshBinsNow());

  const viaSharedLink = location.hash.indexOf("#bin=") === 0 || location.hash === "#admin";
  if (!viaSharedLink) {
    let seen = false;
    try { seen = !!localStorage.getItem("jl_onboarded"); } catch (e) {}
    if (!seen) openOnboard();
  }
  if (location.hash === "#admin") openAdmin();
  window.addEventListener("hashchange", () => { if (location.hash === "#admin") openAdmin(); });
  tryOpenFromHash();
}

init();
