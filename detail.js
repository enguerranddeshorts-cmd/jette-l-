import { fetchBinById, fetchReportsForBin, submitReport, submitVote, fetchVoteTally } from "./data.js";
import { CAT_LABELS, escapeHtml, isFavorite, toggleFavorite, reportCooldownRemaining, markReported, resizeImage, googleUrl, appleUrl, wazeUrl } from "./utils.js";

let currentId = null;
let pendingPhoto = null;

export async function openDetail(id) {
  currentId = id;
  pendingPhoto = null;
  history.replaceState(null, "", "#bin=" + encodeURIComponent(id));

  const overlay = document.getElementById("detailOverlay");
  const sheet = document.getElementById("detailSheet");
  sheet.innerHTML = '<div class="card-sub">Chargement…</div>';
  overlay.hidden = false;

  const bin = await fetchBinById(id);
  if (!bin) { sheet.innerHTML = '<button class="sheet-close" aria-label="Fermer">&times;</button><div class="card-sub">Ce point n\'existe plus.</div>'; wireClose(sheet); return; }

  const reports = await fetchReportsForBin(id);
  const cooldown = reportCooldownRemaining(id);
  const fav = isFavorite(id);
  let tally = { up: 0, down: 0, net: 0 };
  if (bin.source === "communaute") tally = await fetchVoteTally(id);

  let html = '<button class="sheet-close" aria-label="Fermer">&times;</button>';
  html += `<button class="fav-star${fav ? " active" : ""}" id="favStarBtn" title="${fav ? "Retirer des favoris" : "Ajouter aux favoris"}">${fav ? "★" : "☆"}</button>`;
  html += `<div class="type-pill">${CAT_LABELS[bin.category] || bin.category}</div>`;
  html += `<h3>${escapeHtml(bin.commune)}</h3>`;
  if (bin.subtypes && bin.subtypes.length) html += `<div class="card-sub">${bin.subtypes.join(", ")}</div>`;
  html += `<div class="btn-row">
    <a class="btn" href="${googleUrl(bin.lat, bin.lon)}" target="_blank" rel="noopener">Google Maps</a>
    <a class="btn" href="${appleUrl(bin.lat, bin.lon)}" target="_blank" rel="noopener">Plans</a>
    <a class="btn" href="${wazeUrl(bin.lat, bin.lon)}" target="_blank" rel="noopener">Waze</a>
    <button class="btn" id="shareLinkBtn">Copier le lien</button>
  </div>`;

  if (bin.source === "communaute") {
    html += `<div class="info-block">Proposition communautaire — score actuel : ${tally.net} (${tally.up} pour / ${tally.down} contre). Validée à +3, retirée à -3.</div>`;
    html += `<div class="btn-row">
      <button class="btn" data-vote="1">Je confirme</button>
      <button class="btn" data-vote="-1">Je ne la trouve pas</button>
    </div>`;
  }

  html += '<label class="file-btn">Joindre une photo au prochain signalement<input type="file" accept="image/*" id="photoInput"></label>';
  html += '<div id="photoPreviewWrap"></div>';
  html += `<div class="btn-row">
    <button class="btn" data-report="plein"${cooldown ? " disabled" : ""}>Signaler pleine</button>
    <button class="btn" data-report="casse"${cooldown ? " disabled" : ""}>Signaler cassée</button>
    <button class="btn" data-report="sale"${cooldown ? " disabled" : ""}>Signaler sale</button>
    <button class="btn danger-ghost" data-report="manquante"${cooldown ? " disabled" : ""}>Signaler manquante</button>
  </div>`;
  if (cooldown) html += `<div class="cooldown-msg">Un signalement a déjà été envoyé récemment pour ce point — réessaie dans ${Math.ceil(cooldown/60000)} min.</div>`;

  if (reports.length) {
    html += '<div class="report-log-title" style="font-weight:600;font-size:11.5px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.04em;margin:14px 0 8px;">Derniers signalements</div><ul class="admin-list">';
    reports.slice(0, 8).forEach((r) => {
      html += `<li class="admin-row">${r.photo_url ? `<img class="photo-thumb" src="${r.photo_url}">` : ""}<div><b>${escapeHtml(r.kind)}</b><div class="card-sub">${new Date(r.created_at).toLocaleString("fr-FR")}</div></div></li>`;
    });
    html += "</ul>";
  }

  sheet.innerHTML = html;
  wireClose(sheet);

  sheet.querySelector("#favStarBtn").addEventListener("click", () => {
    const nowFav = toggleFavorite(id);
    const btn = sheet.querySelector("#favStarBtn");
    btn.textContent = nowFav ? "★" : "☆";
    btn.classList.toggle("active", nowFav);
  });
  sheet.querySelector("#shareLinkBtn").addEventListener("click", () => {
    const url = location.href;
    const btn = sheet.querySelector("#shareLinkBtn");
    const done = () => { btn.textContent = "Lien copié !"; setTimeout(() => { btn.textContent = "Copier le lien"; }, 2000); };
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done).catch(() => prompt("Copie ce lien :", url));
    else prompt("Copie ce lien :", url);
  });
  const photoInput = sheet.querySelector("#photoInput");
  if (photoInput) photoInput.addEventListener("change", (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    resizeImage(f, (blob) => {
      pendingPhoto = blob;
      sheet.querySelector("#photoPreviewWrap").innerHTML = `<img class="photo-thumb" src="${URL.createObjectURL(blob)}">`;
    });
  });
  sheet.querySelectorAll("[data-report]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (reportCooldownRemaining(id)) return;
      markReported(id);
      await submitReport(id, btn.getAttribute("data-report"), pendingPhoto);
      openDetail(id); // rafraîchit la fiche (nouveau signalement + cooldown)
    });
  });
  sheet.querySelectorAll("[data-vote]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await submitVote(id, parseInt(btn.getAttribute("data-vote"), 10));
      openDetail(id);
    });
  });
}

function wireClose(sheet) {
  sheet.querySelector(".sheet-close").onclick = closeDetail;
}

export function closeDetail() {
  document.getElementById("detailOverlay").hidden = true;
  currentId = null;
  if (location.hash.indexOf("#bin=") === 0) history.replaceState(null, "", location.pathname + location.search);
}

document.getElementById("detailOverlay").addEventListener("click", (ev) => {
  if (ev.target === ev.currentTarget) closeDetail();
});

export function tryOpenFromHash() {
  const m = /^#bin=(.+)$/.exec(location.hash);
  if (!m) return false;
  const id = decodeURIComponent(m[1]);
  openDetail(id);
  return true;
}
