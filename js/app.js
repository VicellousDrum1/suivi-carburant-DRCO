// ============================================================
// UTILITAIRES PARTAGÉS
// ============================================================

export function formatFCFA(valeur) {
  const n = Number(valeur) || 0;
  return n.toLocaleString("fr-FR").replace(/\u202f|,/g, " ") + " FCFA";
}

export function formatNombre(valeur) {
  const n = Number(valeur) || 0;
  return n.toLocaleString("fr-FR").replace(/\u202f|,/g, " ");
}

export function formatDate(dateISO) {
  const d = new Date(dateISO);
  return d.toLocaleDateString("fr-FR", { timeZone: "Africa/Abidjan" });
}

export function formatHeure(dateISO) {
  const d = new Date(dateISO);
  return d.toLocaleTimeString("fr-FR", {
    timeZone: "Africa/Abidjan",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function toast(message, type = "info") {
  const zone = document.getElementById("toast-zone") || createToastZone();
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  el.textContent = message;
  zone.appendChild(el);
  requestAnimationFrame(() => el.classList.add("toast--visible"));
  setTimeout(() => {
    el.classList.remove("toast--visible");
    setTimeout(() => el.remove(), 250);
  }, 3800);
}

function createToastZone() {
  const zone = document.createElement("div");
  zone.id = "toast-zone";
  zone.className = "toast-zone";
  document.body.appendChild(zone);
  return zone;
}

export function debounce(fn, delay = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

export function uuid() {
  return crypto.randomUUID();
}
