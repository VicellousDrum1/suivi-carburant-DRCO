// ============================================================
// VALIDATION FRONTEND DU FORMULAIRE PUBLIC
// Chaque fonction retourne un message d'erreur (string) ou null si valide.
// ============================================================

export function validerSite(siteId) {
  if (!siteId) return "Veuillez sélectionner un site.";
  return null;
}

export function validerTexte(valeur, libelle) {
  if (!valeur || valeur.trim().length === 0) return `Veuillez renseigner votre ${libelle}.`;
  return null;
}

export function validerVehicule(vehiculeId) {
  if (!vehiculeId) return "Veuillez sélectionner un véhicule.";
  return null;
}

export function validerIndex(valeur, dernierIndex) {
  if (valeur === "" || valeur === null) return "Veuillez saisir l'index kilométrique.";
  const n = Number(valeur);
  if (!Number.isFinite(n) || n < 0) return "L'index doit être un nombre positif.";
  if (!Number.isInteger(n)) return "L'index doit être un nombre entier.";
  if (dernierIndex !== null && n < dernierIndex) {
    return `Attention : l'index saisi (${n}) est inférieur au dernier index enregistré pour ce véhicule (${dernierIndex}). Vérifiez votre saisie.`;
  }
  return null;
}

export function validerMontant(valeur, libelle) {
  if (valeur === "" || valeur === null) return `Veuillez saisir le montant ${libelle}.`;
  const n = Number(valeur);
  if (!Number.isFinite(n) || n < 0) return `Le montant ${libelle} doit être un nombre positif.`;
  return null;
}
