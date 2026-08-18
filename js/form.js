import { supabase } from "./supabase.js";
import { toast, formatFCFA, formatNombre, uuid } from "./app.js";
import {
  validerSite,
  validerTexte,
  validerVehicule,
  validerIndex,
  validerMontant,
} from "./validation.js";

const els = {
  form: document.getElementById("form-carburant"),
  site: document.getElementById("champ-site"),
  nom: document.getElementById("champ-nom"),
  prenom: document.getElementById("champ-prenom"),
  vehicule: document.getElementById("champ-vehicule"),
  index: document.getElementById("champ-index"),
  dernierIndexInfo: document.getElementById("dernier-index-info"),
  montantPris: document.getElementById("champ-montant-pris"),
  montantRestant: document.getElementById("champ-montant-restant"),
  submitBtn: document.getElementById("btn-soumettre"),
  formCard: document.getElementById("carte-formulaire"),
  confirmCard: document.getElementById("carte-confirmation"),
  recap: document.getElementById("recap-contenu"),
  nouvelleSaisie: document.getElementById("btn-nouvelle-saisie"),
};

let vehiculesDuSite = [];
let vehiculeSelectionne = null;
let soumissionEnCours = false;

init();

async function init() {
  await chargerSites();
  els.site.addEventListener("change", onChangeSite);
  els.vehicule.addEventListener("change", onChangeVehicule);
  els.form.addEventListener("submit", onSubmit);
  els.nouvelleSaisie.addEventListener("click", reinitialiserFormulaire);
  ["site", "nom", "prenom", "vehicule", "index", "montantPris"].forEach((champ) => {
    els[champ].addEventListener("input", () => effacerErreur(champ));
  });
}

async function chargerSites() {
  const { data, error } = await supabase
    .from("sites")
    .select("id, nom")
    .eq("actif", true)
    .order("nom");

  if (error) {
    toast("Impossible de charger la liste des sites.", "erreur");
    return;
  }

  els.site.innerHTML = '<option value="">Sélectionnez un site…</option>';
  data.forEach((site) => {
    const opt = document.createElement("option");
    opt.value = site.id;
    opt.textContent = site.nom;
    els.site.appendChild(opt);
  });
}

async function onChangeSite() {
  vehiculeSelectionne = null;
  els.vehicule.innerHTML = '<option value="">Chargement…</option>';
  els.vehicule.disabled = true;
  els.dernierIndexInfo.textContent = "";

  const siteId = els.site.value;
  if (!siteId) {
    els.vehicule.innerHTML = '<option value="">Sélectionnez d\'abord un site</option>';
    return;
  }

  const { data, error } = await supabase
    .from("vehicules")
    .select("id, immatriculation, description, dernier_index")
    .eq("site_id", siteId)
    .eq("actif", true)
    .order("immatriculation");

  if (error) {
    toast("Impossible de charger les véhicules de ce site.", "erreur");
    return;
  }

  vehiculesDuSite = data;
  els.vehicule.innerHTML = '<option value="">Sélectionnez un véhicule…</option>';
  data.forEach((v) => {
    const opt = document.createElement("option");
    opt.value = v.id;
    opt.textContent = v.description ? `${v.immatriculation} — ${v.description}` : v.immatriculation;
    els.vehicule.appendChild(opt);
  });
  els.vehicule.disabled = false;
}

function onChangeVehicule() {
  vehiculeSelectionne = vehiculesDuSite.find((v) => v.id === els.vehicule.value) || null;
  if (vehiculeSelectionne) {
    els.dernierIndexInfo.textContent = `Dernier index enregistré : ${formatNombre(vehiculeSelectionne.dernier_index)}`;
  } else {
    els.dernierIndexInfo.textContent = "";
  }
  effacerErreur("index");
}

function effacerErreur(champ) {
  const erreurEl = document.getElementById(`erreur-${champ}`);
  if (erreurEl) erreurEl.textContent = "";
  els[champ]?.classList.remove("champ--erreur");
}

function afficherErreur(champ, message) {
  const erreurEl = document.getElementById(`erreur-${champ}`);
  if (erreurEl) erreurEl.textContent = message;
  els[champ]?.classList.add("champ--erreur");
}

function validerFormulaire() {
  const erreurs = {
    site: validerSite(els.site.value),
    nom: validerTexte(els.nom.value, "nom"),
    prenom: validerTexte(els.prenom.value, "prénom"),
    vehicule: validerVehicule(els.vehicule.value),
    index: validerIndex(els.index.value, vehiculeSelectionne ? vehiculeSelectionne.dernier_index : null),
    montantPris: validerMontant(els.montantPris.value, "pris"),
  };

  let estValide = true;
  Object.entries(erreurs).forEach(([champ, message]) => {
    if (message) {
      // L'avertissement "index inférieur" reste bloquant mais avec un message dédié
      afficherErreur(champ, message);
      estValide = false;
    }
  });

  if (els.montantRestant.value !== "" && Number(els.montantRestant.value) < 0) {
    afficherErreur("montantRestant", "Le reste doit être un nombre positif.");
    estValide = false;
  }

  return estValide;
}

async function onSubmit(e) {
  e.preventDefault();
  if (soumissionEnCours) return;
  if (!validerFormulaire()) return;

  soumissionEnCours = true;
  els.submitBtn.disabled = true;
  els.submitBtn.textContent = "Enregistrement en cours…";

  const payload = {
    site_id: els.site.value,
    vehicule_id: els.vehicule.value,
    nom: els.nom.value.trim().toUpperCase(),
    prenom: els.prenom.value.trim(),
    index_km: Number(els.index.value),
    montant_pris: Number(els.montantPris.value),
    montant_restant: els.montantRestant.value === "" ? 0 : Number(els.montantRestant.value),
    client_submission_id: uuid(),
  };

  const { error } = await supabase.from("prises_carburant").insert(payload);

  soumissionEnCours = false;

  if (error) {
    toast("Une erreur est survenue lors de l'enregistrement. Réessayez.", "erreur");
    els.submitBtn.disabled = false;
    els.submitBtn.textContent = "Envoyer";
    return;
  }

  afficherConfirmation(payload);
}

function afficherConfirmation(payload) {
  const nomSite = els.site.options[els.site.selectedIndex].textContent;
  const nomVehicule = els.vehicule.options[els.vehicule.selectedIndex].textContent;

  els.recap.innerHTML = `
    <div class="recap-ligne"><span>Site</span><strong>${nomSite}</strong></div>
    <div class="recap-ligne"><span>Véhicule</span><strong>${nomVehicule}</strong></div>
    <div class="recap-ligne"><span>Index</span><strong>${formatNombre(payload.index_km)}</strong></div>
    <div class="recap-ligne"><span>Montant pris</span><strong>${formatFCFA(payload.montant_pris)}</strong></div>
    <div class="recap-ligne"><span>Reste</span><strong>${formatFCFA(payload.montant_restant)}</strong></div>
  `;

  els.formCard.hidden = true;
  els.confirmCard.hidden = false;
  toast("Enregistrement effectué avec succès", "succes");
}

function reinitialiserFormulaire() {
  els.form.reset();
  els.vehicule.innerHTML = '<option value="">Sélectionnez d\'abord un site</option>';
  els.vehicule.disabled = true;
  els.dernierIndexInfo.textContent = "";
  vehiculeSelectionne = null;
  els.submitBtn.disabled = false;
  els.submitBtn.textContent = "Envoyer";
  els.confirmCard.hidden = true;
  els.formCard.hidden = false;
}
