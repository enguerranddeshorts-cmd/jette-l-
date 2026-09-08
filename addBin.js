import { submitCommunityBin } from "./data.js";

let pendingLatLon = null;

export function openAddForm(lat, lon) {
  pendingLatLon = [lat, lon];
  const html = `
    <button class="sheet-close" aria-label="Fermer">&times;</button>
    <h3>Proposer une poubelle</h3>
    <div class="card-sub mono">${lat.toFixed(5)}, ${lon.toFixed(5)}</div>
    <div class="form-grid">
      <label>Commune<input type="text" id="fCommune" placeholder="ex. Rouen"></label>
      <label>Type<select id="fCategory">
        <option value="corbeille">Corbeille</option>
        <option value="tri">Tri sélectif</option>
        <option value="collecte">Point de collecte</option>
      </select></label>
      <label id="fSubWrap">Sous-type<select id="fSubtype">
        <option value="verre">Verre</option><option value="papier">Papier</option>
        <option value="emballages">Emballages</option><option value="textile">Textile</option>
      </select></label>
      <label>Note (optionnel)<textarea id="fNote" placeholder="repère utile, ex. devant la boulangerie"></textarea></label>
    </div>
    <div class="btn-row"><button class="btn primary" id="fSubmit">Proposer à la communauté</button></div>
    <div class="card-sub">La communauté confirme ou infirme ensuite par vote avant que le point apparaisse comme validé.</div>
  `;
  const sheet = document.getElementById("addSheet");
  sheet.innerHTML = html;
  document.getElementById("addOverlay").hidden = false;
  sheet.querySelector(".sheet-close").onclick = closeAddForm;
  const catSel = sheet.querySelector("#fCategory");
  const subWrap = sheet.querySelector("#fSubWrap");
  const syncSub = () => { subWrap.style.display = catSel.value === "tri" ? "" : "none"; };
  catSel.addEventListener("change", syncSub); syncSub();
  sheet.querySelector("#fSubmit").addEventListener("click", async () => {
    const commune = sheet.querySelector("#fCommune").value.trim() || "Commune non précisée";
    const category = catSel.value;
    const subtypes = category === "tri" ? [sheet.querySelector("#fSubtype").value] : [];
    const note = sheet.querySelector("#fNote").value.trim();
    closeAddForm();
    await submitCommunityBin({ lat: pendingLatLon[0], lon: pendingLatLon[1], category, subtypes, commune, note });
  });
}

export function closeAddForm() { document.getElementById("addOverlay").hidden = true; }
document.getElementById("addOverlay").addEventListener("click", (ev) => { if (ev.target === ev.currentTarget) closeAddForm(); });
