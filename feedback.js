import { submitFeedback } from "./data.js";

let pendingRating = 0;

export function openFeedback() {
  pendingRating = 0;
  const html = `
    <button class="sheet-close" aria-label="Fermer">&times;</button>
    <h3>Donner un avis</h3>
    <div class="card-sub">Dis-nous ce qui marche, ce qui manque ou ce qui bloque — ça nous aide à améliorer l'appli.</div>
    <div class="star-rating" id="fbStars">${[1,2,3,4,5].map((n) => `<button type="button" data-star="${n}" aria-label="${n} étoile${n>1?"s":""}">★</button>`).join("")}</div>
    <div class="form-grid" style="grid-template-columns:1fr;"><label>Ton commentaire (optionnel)<textarea id="fbComment" placeholder="Une idée, un bug, un point qui te plaît…"></textarea></label></div>
    <div class="btn-row"><button class="btn primary" id="fbSubmit">Envoyer</button></div>
  `;
  const sheet = document.getElementById("feedbackSheet");
  sheet.innerHTML = html;
  document.getElementById("feedbackOverlay").hidden = false;
  sheet.querySelector(".sheet-close").onclick = closeFeedback;
  const starsWrap = sheet.querySelector("#fbStars");
  const paint = () => starsWrap.querySelectorAll("button").forEach((b) => b.classList.toggle("active", parseInt(b.dataset.star, 10) <= pendingRating));
  starsWrap.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { pendingRating = parseInt(b.dataset.star, 10); paint(); }));
  sheet.querySelector("#fbSubmit").addEventListener("click", async () => {
    const comment = sheet.querySelector("#fbComment").value.trim();
    if (!pendingRating && !comment) return;
    await submitFeedback(pendingRating, comment);
    sheet.innerHTML = '<div style="text-align:center;padding:14px 6px 6px;"><h3>Merci pour ton avis !</h3><div class="card-sub">C\'est bien pris en compte.</div></div>';
    setTimeout(closeFeedback, 1400);
  });
}
export function closeFeedback() { document.getElementById("feedbackOverlay").hidden = true; }
document.getElementById("feedbackOverlay").addEventListener("click", (ev) => { if (ev.target === ev.currentTarget) closeFeedback(); });
