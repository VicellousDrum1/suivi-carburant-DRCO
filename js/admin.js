import { toast, formatFCFA, formatNombre, formatDate, formatHeure, debounce } from "./app.js";

// Renseigner les mêmes valeurs que dans js/supabase.js (voir README, section 3)
const SUPABASE_URL = "https://vicellousdrum1.github.io/";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhZHR5ZG95bWFydHVmZ2J0aWV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5OTg2NTAsImV4cCI6MjEwMjU3NDY1MH0.yA_uHsEEqyWnhspYzNeKKEpvGQNIzQMGySPgqATUgbg
";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ============================================================
   ÉTAT GLOBAL
   ============================================================ */
const etat = {
  sites: [],
  vehicules: [],
  operations: { page: 1, parPage: 15, tri: "date_prise", ordre: "desc", recherche: "", siteId: "", debut: "", fin: "" },
  graphiques: {},
};

const $ = (id) => document.getElementById(id);

/* ============================================================
   AUTHENTIFICATION
   ============================================================ */
$("form-connexion").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = $("champ-email").value.trim();
  const password = $("champ-mdp").value;
  $("btn-connexion").disabled = true;
  $("btn-connexion").textContent = "Connexion…";
  $("erreur-connexion").textContent = "";

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  $("btn-connexion").disabled = false;
  $("btn-connexion").textContent = "Se connecter";

  if (error) {
    $("erreur-connexion").textContent = "Email ou mot de passe incorrect.";
    return;
  }
  await afficherDashboard();
});

$("btn-deconnexion").addEventListener("click", async () => {
  await supabase.auth.signOut();
  location.reload();
});

async function verifierSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session) await afficherDashboard();
}

async function afficherDashboard() {
  $("ecran-connexion").hidden = true;
  $("app-admin").hidden = false;
  await chargerReferentiels();
  initNavigation();
  initFiltresDashboard();
  initVueOperations();
  initVueVehicules();
  initVueSites();
  await Promise.all([chargerStatsEtGraphiques(), chargerOperations(), rendreVehicules(), rendreSites()]);
}

verifierSession();

/* ============================================================
   NAVIGATION LATÉRALE
   ============================================================ */
function initNavigation() {
  document.querySelectorAll(".nav-item[data-vue]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-item[data-vue]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".vue").forEach((v) => (v.hidden = true));
      $(btn.dataset.vue).hidden = false;
      $("titre-vue").textContent = {
        "vue-dashboard": "TABLEAU DE BORD — SUIVI CARBURANT",
        "vue-operations": "OPÉRATIONS",
        "vue-vehicules": "GESTION DES VÉHICULES",
        "vue-sites": "GESTION DES SITES",
      }[btn.dataset.vue];
      document.querySelector(".sidebar").classList.remove("ouverte");
    });
  });
  $("btn-menu-mobile").addEventListener("click", () => document.querySelector(".sidebar").classList.toggle("ouverte"));
}

/* ============================================================
   RÉFÉRENTIELS (sites / véhicules)
   ============================================================ */
async function chargerReferentiels() {
  const [{ data: sites }, { data: vehicules }] = await Promise.all([
    supabase.from("sites").select("*").order("nom"),
    supabase.from("vehicules").select("*, sites(nom)").order("immatriculation"),
  ]);
  etat.sites = sites || [];
  etat.vehicules = vehicules || [];

  document.querySelectorAll("#filtre-site-dashboard, #filtre-site-operations").forEach((sel) => {
    sel.innerHTML = '<option value="">Tous les sites</option>' +
      etat.sites.map((s) => `<option value="${s.id}">${s.nom}</option>`).join("");
  });
}

/* ============================================================
   DASHBOARD — FILTRES, STATS, GRAPHIQUES
   ============================================================ */
function initFiltresDashboard() {
  $("filtre-periode").addEventListener("change", (e) => {
    const perso = e.target.value === "personnalise";
    $("filtre-date-debut").hidden = !perso;
    $("filtre-date-fin").hidden = !perso;
    chargerStatsEtGraphiques();
  });
  $("filtre-date-debut").addEventListener("change", chargerStatsEtGraphiques);
  $("filtre-date-fin").addEventListener("change", chargerStatsEtGraphiques);
  $("filtre-site-dashboard").addEventListener("change", chargerStatsEtGraphiques);
}

function bornesPeriode() {
  const val = $("filtre-periode").value;
  const maintenant = new Date();
  let debut = null, fin = null;

  if (val === "aujourdhui") {
    debut = new Date(maintenant); debut.setHours(0, 0, 0, 0);
  } else if (val === "semaine") {
    debut = new Date(maintenant);
    debut.setDate(debut.getDate() - debut.getDay() + (debut.getDay() === 0 ? -6 : 1));
    debut.setHours(0, 0, 0, 0);
  } else if (val === "mois") {
    debut = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1);
  } else if (val === "mois-precedent") {
    debut = new Date(maintenant.getFullYear(), maintenant.getMonth() - 1, 1);
    fin = new Date(maintenant.getFullYear(), maintenant.getMonth(), 0, 23, 59, 59);
  } else if (val === "personnalise") {
    if ($("filtre-date-debut").value) debut = new Date($("filtre-date-debut").value);
    if ($("filtre-date-fin").value) fin = new Date($("filtre-date-fin").value + "T23:59:59");
  }
  return { debut, fin };
}

async function chargerStatsEtGraphiques() {
  const { debut, fin } = bornesPeriode();
  const siteId = $("filtre-site-dashboard").value;

  let requete = supabase.from("prises_carburant").select("*, sites(nom), vehicules(immatriculation)");
  if (debut) requete = requete.gte("date_prise", debut.toISOString());
  if (fin) requete = requete.lte("date_prise", fin.toISOString());
  if (siteId) requete = requete.eq("site_id", siteId);

  const { data: prises, error } = await requete;
  if (error) { toast("Erreur lors du chargement des statistiques.", "erreur"); return; }

  const totalPrises = prises.length;
  const montantPris = prises.reduce((s, p) => s + Number(p.montant_pris || 0), 0);
  const montantRestant = prises.reduce((s, p) => s + Number(p.montant_restant || 0), 0);

  $("stat-total-prises").textContent = formatNombre(totalPrises);
  $("stat-montant-pris").textContent = formatFCFA(montantPris);
  $("stat-montant-restant").textContent = formatFCFA(montantRestant);
  $("stat-vehicules").textContent = formatNombre(etat.vehicules.filter((v) => v.actif).length);
  $("stat-sites").textContent = formatNombre(etat.sites.filter((s) => s.actif).length);

  dessinerGraphiques(prises);
}

function agreger(prises, cle, valeurFn) {
  const map = new Map();
  prises.forEach((p) => {
    const k = cle(p);
    map.set(k, (map.get(k) || 0) + valeurFn(p));
  });
  return map;
}

function dessinerGraphiques(prises) {
  const palette = ["#12303F", "#E2A63B", "#2F9E6E", "#5B7A8C", "#C4881F", "#8A9BA8", "#D64545", "#1D4457", "#F0C878", "#3E6478"];

  const parSite = agreger(prises, (p) => p.sites?.nom || "—", (p) => Number(p.montant_pris || 0));
  creerGraphique("graph-site", "bar", [...parSite.keys()], [...parSite.values()], palette);

  const parVehicule = agreger(prises, (p) => p.vehicules?.immatriculation || "—", (p) => Number(p.montant_pris || 0));
  creerGraphique("graph-vehicule", "bar", [...parVehicule.keys()].slice(0, 10), [...parVehicule.values()].slice(0, 10), palette);

  const parJour = agreger(prises, (p) => formatDate(p.date_prise), (p) => Number(p.montant_pris || 0));
  const joursTries = [...parJour.entries()].sort((a, b) => new Date(a[0].split("/").reverse().join("-")) - new Date(b[0].split("/").reverse().join("-")));
  creerGraphique("graph-evolution", "line", joursTries.map((j) => j[0]), joursTries.map((j) => j[1]), palette);

  const nbParSite = agreger(prises, (p) => p.sites?.nom || "—", () => 1);
  creerGraphique("graph-nb-site", "bar", [...nbParSite.keys()], [...nbParSite.values()], palette);

  const top10 = [...parVehicule.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  creerGraphique("graph-top10", "bar", top10.map((t) => t[0]), top10.map((t) => t[1]), palette, true);
}

function creerGraphique(idCanvas, type, labels, valeurs, palette, horizontal = false) {
  if (etat.graphiques[idCanvas]) etat.graphiques[idCanvas].destroy();
  const ctx = $(idCanvas).getContext("2d");
  etat.graphiques[idCanvas] = new Chart(ctx, {
    type,
    data: {
      labels,
      datasets: [{
        data: valeurs,
        backgroundColor: type === "line" ? "rgba(226,166,59,0.18)" : palette,
        borderColor: type === "line" ? "#E2A63B" : palette,
        borderWidth: type === "line" ? 2 : 0,
        borderRadius: type === "bar" ? 6 : 0,
        fill: type === "line",
        tension: 0.35,
      }],
    },
    options: {
      indexAxis: horizontal ? "y" : "x",
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
      responsive: true,
      maintainAspectRatio: false,
    },
  });
}

/* ============================================================
   VUE OPÉRATIONS — tableau, recherche, tri, pagination, export
   ============================================================ */
function initVueOperations() {
  $("recherche-operations").addEventListener("input", debounce((e) => {
    etat.operations.recherche = e.target.value.trim().toLowerCase();
    etat.operations.page = 1;
    chargerOperations();
  }, 300));
  $("filtre-site-operations").addEventListener("change", (e) => {
    etat.operations.siteId = e.target.value; etat.operations.page = 1; chargerOperations();
  });
  $("filtre-op-debut").addEventListener("change", (e) => { etat.operations.debut = e.target.value; etat.operations.page = 1; chargerOperations(); });
  $("filtre-op-fin").addEventListener("change", (e) => { etat.operations.fin = e.target.value; etat.operations.page = 1; chargerOperations(); });

  document.querySelectorAll("[data-tri]").forEach((th) => {
    th.addEventListener("click", () => {
      const cle = th.dataset.tri;
      if (etat.operations.tri === cle) etat.operations.ordre = etat.operations.ordre === "asc" ? "desc" : "asc";
      else { etat.operations.tri = cle; etat.operations.ordre = "asc"; }
      chargerOperations();
    });
  });

  $("btn-export-csv").addEventListener("click", () => exporterOperations("csv"));
  $("btn-export-xlsx").addEventListener("click", () => exporterOperations("xlsx"));
}

async function requeteOperationsFiltree() {
  const { recherche, siteId, debut, fin, tri, ordre } = etat.operations;
  let requete = supabase.from("prises_carburant").select("*, sites(nom), vehicules(immatriculation)", { count: "exact" });

  if (siteId) requete = requete.eq("site_id", siteId);
  if (debut) requete = requete.gte("date_prise", debut + "T00:00:00");
  if (fin) requete = requete.lte("date_prise", fin + "T23:59:59");
  if (recherche) requete = requete.or(`nom.ilike.%${recherche}%,prenom.ilike.%${recherche}%`);

  const colonneTri = tri === "site" ? "site_id" : tri === "immatriculation" ? "vehicule_id" : tri;
  requete = requete.order(colonneTri, { ascending: ordre === "asc" });
  return requete;
}

async function chargerOperations() {
  const { page, parPage } = etat.operations;
  const requete = await requeteOperationsFiltree();
  const { data, error, count } = await requete.range((page - 1) * parPage, page * parPage - 1);

  if (error) { toast("Erreur lors du chargement des opérations.", "erreur"); return; }

  const corps = $("corps-tableau-operations");
  corps.innerHTML = data.map((p) => `
    <tr>
      <td data-label="Date">${formatDate(p.date_prise)}</td>
      <td data-label="Heure">${formatHeure(p.date_prise)}</td>
      <td data-label="Site">${p.sites?.nom || "—"}</td>
      <td data-label="Nom">${p.nom}</td>
      <td data-label="Prénom">${p.prenom}</td>
      <td data-label="Immatriculation">${p.vehicules?.immatriculation || "—"}</td>
      <td data-label="Index">${formatNombre(p.index_km)}</td>
      <td data-label="Km parcouru">${formatNombre(p.km_parcouru)}</td>
      <td data-label="Montant pris">${formatFCFA(p.montant_pris)}</td>
      <td data-label="Reste">${formatFCFA(p.montant_restant)}</td>
    </tr>
  `).join("") || `<tr><td colspan="10" style="text-align:center;color:var(--color-muted)">Aucune opération trouvée.</td></tr>`;

  rendrePagination(count || 0);
}

function rendrePagination(total) {
  const { page, parPage } = etat.operations;
  const totalPages = Math.max(1, Math.ceil(total / parPage));
  $("pagination-operations").innerHTML = `
    <button id="pg-prec" ${page <= 1 ? "disabled" : ""}>← Précédent</button>
    <span>Page ${page} / ${totalPages} — ${formatNombre(total)} opérations</span>
    <button id="pg-suiv" ${page >= totalPages ? "disabled" : ""}>Suivant →</button>
  `;
  $("pg-prec")?.addEventListener("click", () => { etat.operations.page--; chargerOperations(); });
  $("pg-suiv")?.addEventListener("click", () => { etat.operations.page++; chargerOperations(); });
}

async function exporterOperations(format) {
  const requete = await requeteOperationsFiltree();
  const { data, error } = await requete;
  if (error) { toast("Erreur lors de l'export.", "erreur"); return; }

  const lignes = data.map((p) => ({
    Date: formatDate(p.date_prise),
    Heure: formatHeure(p.date_prise),
    Site: p.sites?.nom || "",
    Nom: p.nom,
    Prénom: p.prenom,
    Immatriculation: p.vehicules?.immatriculation || "",
    Index: p.index_km,
    "Km parcouru": p.km_parcouru,
    "Montant pris": p.montant_pris,
    Reste: p.montant_restant,
  }));

  if (format === "csv") {
    const entetes = Object.keys(lignes[0] || {});
    const csv = [entetes.join(";"), ...lignes.map((l) => entetes.map((e) => l[e]).join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    telecharger(blob, "operations-carburant.csv");
  } else {
    const feuille = XLSX.utils.json_to_sheet(lignes);
    const classeur = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(classeur, feuille, "Opérations");
    XLSX.writeFile(classeur, "operations-carburant.xlsx");
  }
}

function telecharger(blob, nomFichier) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nomFichier;
  a.click();
  URL.revokeObjectURL(url);
}

/* ============================================================
   VUE VÉHICULES — CRUD
   ============================================================ */
function initVueVehicules() {
  $("btn-ajouter-vehicule").addEventListener("click", () => ouvrirModaleVehicule());
}

async function rendreVehicules() {
  const corps = $("corps-tableau-vehicules");
  corps.innerHTML = etat.vehicules.map((v) => `
    <tr>
      <td data-label="Immatriculation">${v.immatriculation}</td>
      <td data-label="Site">${v.sites?.nom || "—"}</td>
      <td data-label="Description">${v.description || "—"}</td>
      <td data-label="Statut"><span class="badge ${v.actif ? "badge--actif" : "badge--inactif"}">${v.actif ? "Actif" : "Inactif"}</span></td>
      <td data-label="Actions">
        <button class="action-lien" data-modifier="${v.id}">Modifier</button>
        <button class="action-lien" data-basculer="${v.id}">${v.actif ? "Désactiver" : "Réactiver"}</button>
      </td>
    </tr>
  `).join("");

  corps.querySelectorAll("[data-modifier]").forEach((b) => b.addEventListener("click", () => ouvrirModaleVehicule(b.dataset.modifier)));
  corps.querySelectorAll("[data-basculer]").forEach((b) => b.addEventListener("click", () => basculerVehicule(b.dataset.basculer)));
}

function ouvrirModaleVehicule(id = null) {
  const vehicule = id ? etat.vehicules.find((v) => v.id === id) : null;
  $("modale-titre").textContent = vehicule ? "Modifier le véhicule" : "Ajouter un véhicule";
  $("modale-form").innerHTML = `
    <label>Immatriculation</label>
    <input type="text" name="immatriculation" required value="${vehicule?.immatriculation || ""}" />
    <label>Site</label>
    <select name="site_id" required>${etat.sites.map((s) => `<option value="${s.id}" ${vehicule?.site_id === s.id ? "selected" : ""}>${s.nom}</option>`).join("")}</select>
    <label>Description</label>
    <input type="text" name="description" value="${vehicule?.description || ""}" placeholder="Ex : Toyota Hilux" />
    <div class="modale-actions">
      <button type="button" class="btn-secondaire" id="modale-annuler">Annuler</button>
      <button type="submit" class="btn-principal">Enregistrer</button>
    </div>
  `;
  $("modale").hidden = false;
  $("modale-annuler").addEventListener("click", fermerModale);
  $("modale-form").onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = { immatriculation: fd.get("immatriculation").trim(), site_id: fd.get("site_id"), description: fd.get("description").trim() || null };
    const { error } = vehicule
      ? await supabase.from("vehicules").update(payload).eq("id", vehicule.id)
      : await supabase.from("vehicules").insert(payload);
    if (error) { toast("Immatriculation déjà existante ou erreur de saisie.", "erreur"); return; }
    toast("Véhicule enregistré.", "succes");
    fermerModale();
    await chargerReferentiels();
    rendreVehicules();
  };
}

async function basculerVehicule(id) {
  const v = etat.vehicules.find((x) => x.id === id);
  const { error } = await supabase.from("vehicules").update({ actif: !v.actif }).eq("id", id);
  if (error) { toast("Erreur lors de la mise à jour.", "erreur"); return; }
  await chargerReferentiels();
  rendreVehicules();
}

/* ============================================================
   VUE SITES — CRUD
   ============================================================ */
function initVueSites() {
  $("btn-ajouter-site").addEventListener("click", () => ouvrirModaleSite());
}

async function rendreSites() {
  const corps = $("corps-tableau-sites");
  corps.innerHTML = etat.sites.map((s) => `
    <tr>
      <td data-label="Nom">${s.nom}</td>
      <td data-label="Code">${s.code || "—"}</td>
      <td data-label="Statut"><span class="badge ${s.actif ? "badge--actif" : "badge--inactif"}">${s.actif ? "Actif" : "Inactif"}</span></td>
      <td data-label="Actions">
        <button class="action-lien" data-modifier="${s.id}">Modifier</button>
        <button class="action-lien" data-basculer="${s.id}">${s.actif ? "Désactiver" : "Réactiver"}</button>
      </td>
    </tr>
  `).join("");

  corps.querySelectorAll("[data-modifier]").forEach((b) => b.addEventListener("click", () => ouvrirModaleSite(b.dataset.modifier)));
  corps.querySelectorAll("[data-basculer]").forEach((b) => b.addEventListener("click", () => basculerSite(b.dataset.basculer)));
}

function ouvrirModaleSite(id = null) {
  const site = id ? etat.sites.find((s) => s.id === id) : null;
  $("modale-titre").textContent = site ? "Modifier le site" : "Ajouter un site";
  $("modale-form").innerHTML = `
    <label>Nom du site</label>
    <input type="text" name="nom" required value="${site?.nom || ""}" placeholder="Ex : Exploitation Bonoua" />
    <label>Code</label>
    <input type="text" name="code" value="${site?.code || ""}" placeholder="Ex : BNA" />
    <div class="modale-actions">
      <button type="button" class="btn-secondaire" id="modale-annuler">Annuler</button>
      <button type="submit" class="btn-principal">Enregistrer</button>
    </div>
  `;
  $("modale").hidden = false;
  $("modale-annuler").addEventListener("click", fermerModale);
  $("modale-form").onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const payload = { nom: fd.get("nom").trim(), code: fd.get("code").trim() || null };
    const { error } = site
      ? await supabase.from("sites").update(payload).eq("id", site.id)
      : await supabase.from("sites").insert(payload);
    if (error) { toast("Nom de site déjà existant ou erreur de saisie.", "erreur"); return; }
    toast("Site enregistré.", "succes");
    fermerModale();
    await chargerReferentiels();
    rendreSites();
  };
}

async function basculerSite(id) {
  const s = etat.sites.find((x) => x.id === id);
  const { error } = await supabase.from("sites").update({ actif: !s.actif }).eq("id", id);
  if (error) { toast("Erreur lors de la mise à jour.", "erreur"); return; }
  await chargerReferentiels();
  rendreSites();
}

function fermerModale() { $("modale").hidden = true; }
