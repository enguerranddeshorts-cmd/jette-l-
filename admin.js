import {
  adminSignIn, adminSignOut, isCurrentUserAdmin, getSession,
  fetchAllFeedback, fetchAllReportsForModeration, fetchAllCommunityBinsForModeration,
  deleteReport, deleteCommunityBin, fetchVoteTally,
} from "./data.js";
import { escapeHtml } from "./utils.js";

let tab = "avis";

export async function openAdmin() {
  document.getElementById("adminOverlay").hidden = false;
  const session = await getSession();
  if (session && (await isCurrentUserAdmin())) renderPanel();
  else renderLogin();
}
export function closeAdmin() { document.getElementById("adminOverlay").hidden = true; }
document.getElementById("adminOverlay").addEventListener("click", (ev) => { if (ev.target === ev.currentTarget) closeAdmin(); });

function renderLogin(msg) {
  const html = `
    <button class="sheet-close" aria-label="Fermer">&times;</button>
    <h3>Espace admin</h3>
    <div class="card-sub">Connexion avec ton compte Supabase (créé et ajouté à la table "admins" — voir README).</div>
    <div class="form-grid" style="grid-template-columns:1fr;">
      <label>Email<input type="email" id="adminEmail"></label>
      <label>Mot de passe<input type="password" id="adminPassword"></label>
    </div>
    ${msg ? `<div class="cooldown-msg">${escapeHtml(msg)}</div>` : ""}
    <div class="btn-row"><button class="btn primary" id="adminLoginBtn">Se connecter</button></div>
  `;
  const sheet = document.getElementById("adminSheet");
  sheet.innerHTML = html;
  sheet.querySelector(".sheet-close").onclick = closeAdmin;
  sheet.querySelector("#adminLoginBtn").addEventListener("click", async () => {
    const email = sheet.querySelector("#adminEmail").value.trim();
    const password = sheet.querySelector("#adminPassword").value;
    const { error } = await adminSignIn(email, password);
    if (error) { renderLogin("Identifiants incorrects."); return; }
    if (!(await isCurrentUserAdmin())) { await adminSignOut(); renderLogin("Ce compte n'est pas administrateur (voir README, étape 6)."); return; }
    renderPanel();
  });
}

function renderPanel() {
  const html = `
    <button class="sheet-close" aria-label="Fermer">&times;</button>
    <h3>Espace admin</h3>
    <div class="chip-toggle" id="adminTabs">
      <button data-tab="avis" class="${tab === "avis" ? "active" : ""}">Avis reçus</button>
      <button data-tab="moderation" class="${tab === "moderation" ? "active" : ""}">Modération</button>
    </div>
    <div id="adminBody" style="margin-top:14px;"></div>
    <div class="btn-row"><button class="btn ghost" id="adminLogout">Se déconnecter</button></div>
  `;
  const sheet = document.getElementById("adminSheet");
  sheet.innerHTML = html;
  sheet.querySelector(".sheet-close").onclick = closeAdmin;
  sheet.querySelector("#adminLogout").addEventListener("click", async () => { await adminSignOut(); closeAdmin(); });
  sheet.querySelectorAll("#adminTabs button").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; renderPanel(); }));
  if (tab === "avis") renderAvis(); else renderModeration();
}

async function renderAvis() {
  const body = document.getElementById("adminBody");
  body.innerHTML = '<div class="card-sub">Chargement…</div>';
  const items = await fetchAllFeedback();
  if (!items.length) { body.innerHTML = '<div class="card-sub">Aucun avis reçu pour l\'instant.</div>'; return; }
  const rated = items.filter((f) => f.rating);
  const avg = rated.length ? (rated.reduce((s, f) => s + f.rating, 0) / rated.length).toFixed(1) : null;
  let html = avg ? `<div class="info-block">Note moyenne : <b>${avg} / 5</b> sur ${rated.length} avis noté${rated.length > 1 ? "s" : ""} (${items.length} au total).</div>` : "";
  html += '<ul class="admin-list">';
  items.forEach((f) => {
    const stars = f.rating ? "★".repeat(f.rating) + "☆".repeat(5 - f.rating) : "(pas de note)";
    html += `<li class="admin-row"><div><div class="admin-stars">${stars}</div>${f.comment ? `<div style="font-size:13px;margin-top:2px;">${escapeHtml(f.comment)}</div>` : ""}<div class="card-sub">${new Date(f.created_at).toLocaleString("fr-FR")}</div></div></li>`;
  });
  html += "</ul>";
  body.innerHTML = html;
}

async function renderModeration() {
  const body = document.getElementById("adminBody");
  body.innerHTML = '<div class="card-sub">Chargement…</div>';
  const [reports, bins] = await Promise.all([fetchAllReportsForModeration(), fetchAllCommunityBinsForModeration()]);

  let html = `<div style="font-weight:600;font-size:11.5px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;">Signalements (${reports.length})</div>`;
  if (!reports.length) html += '<div class="card-sub" style="margin-bottom:16px;">Aucun signalement.</div>';
  else {
    html += '<ul class="admin-list">';
    reports.forEach((r) => {
      html += `<li class="admin-row">${r.photo_url ? `<img class="photo-thumb" src="${r.photo_url}">` : ""}<div style="flex:1;"><div style="font-size:13px;"><b>${escapeHtml(r.bin_id)}</b> — ${escapeHtml(r.kind)}</div><div class="card-sub">${new Date(r.created_at).toLocaleString("fr-FR")}</div></div><button class="btn danger-ghost" data-del-report="${r.id}">Supprimer</button></li>`;
    });
    html += "</ul>";
  }

  html += `<div style="font-weight:600;font-size:11.5px;color:var(--ink-soft);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px;">Propositions communautaires (${bins.length})</div>`;
  if (!bins.length) html += '<div class="card-sub">Aucune proposition.</div>';
  else {
    html += '<ul class="admin-list">';
    for (const b of bins) {
      const t = await fetchVoteTally(b.id);
      const status = t.net >= 3 ? "validée" : t.net <= -3 ? "rejetée" : "en attente";
      html += `<li class="admin-row"><div style="flex:1;"><div style="font-size:13px;"><b>${escapeHtml(b.commune)}</b> — ${escapeHtml(b.category)} <span class="badge">${status} · ${t.net}</span></div>${b.note ? `<div class="card-sub">${escapeHtml(b.note)}</div>` : ""}<div class="card-sub">${new Date(b.created_at).toLocaleString("fr-FR")}</div></div><button class="btn danger-ghost" data-del-bin="${b.id}">Supprimer</button></li>`;
    }
    html += "</ul>";
  }

  body.innerHTML = html;
  body.querySelectorAll("[data-del-report]").forEach((btn) => btn.addEventListener("click", async () => {
    if (!confirm("Supprimer ce signalement ?")) return;
    await deleteReport(btn.dataset.delReport);
    renderModeration();
  }));
  body.querySelectorAll("[data-del-bin]").forEach((btn) => btn.addEventListener("click", async () => {
    if (!confirm("Supprimer cette proposition ?")) return;
    await deleteCommunityBin(btn.dataset.delBin);
    renderModeration();
  }));
}
