# Suivi carburant — Application web

Application de suivi des prises de carburant d'une flotte multi-sites.
Frontend 100 % statique (HTML/CSS/JS vanilla, hébergeable sur GitHub Pages) + backend Supabase (PostgreSQL, Auth, RLS).

## 1. Structure du projet

```
/
├── index.html          → Formulaire public de saisie
├── admin.html           → Espace administrateur (/admin)
├── css/
│   ├── style.css         → Design tokens + composants
│   ├── responsive.css    → Mobile / tablette / desktop
│   └── admin.css         → Dashboard admin
├── js/
│   ├── supabase.js        → Configuration du client Supabase (formulaire public)
│   ├── app.js              → Utilitaires partagés (format FCFA, dates, toasts)
│   ├── form.js              → Logique du formulaire public
│   ├── validation.js         → Validations frontend
│   └── admin.js               → Auth, dashboard, CRUD, export
├── sql/
│   └── schema.sql               → Tables, contraintes, RLS, triggers
└── README.md
```

## 2. Créer le projet Supabase

1. Créer un compte sur [supabase.com](https://supabase.com) et un nouveau projet.
2. Aller dans **SQL Editor** et exécuter l'intégralité du fichier `sql/schema.sql`.
   Cela crée les tables `sites`, `vehicules`, `prises_carburant`, active la Row Level Security,
   met en place les politiques d'accès et insère quelques sites d'exemple.
3. Aller dans **Authentication > Users** et créer manuellement le ou les comptes administrateurs
   (email + mot de passe). Ce sont ces identifiants qui donneront accès à `/admin`.
4. Aller dans **Project Settings > API** et récupérer :
   - `Project URL`
   - `anon public key` (ne jamais utiliser la `service_role key` côté frontend)

## 3. Configurer le frontend

Dans `js/supabase.js` (utilisé par `index.html`) et en tête de `js/admin.js`, remplacer :

```js
const SUPABASE_URL = "https://VOTRE-PROJET.supabase.co";
const SUPABASE_ANON_KEY = "VOTRE_CLE_ANON_PUBLIQUE";
```

par les valeurs récupérées à l'étape précédente.

## 4. Ajouter vos véhicules

Deux options :
- Depuis l'espace `/admin` une fois connecté (section **Véhicules** → *Ajouter un véhicule*) ;
- Ou directement dans Supabase, table `vehicules` (`immatriculation`, `site_id`, `description`).

L'immatriculation doit être unique. Un véhicule désactivé (`actif = false`) disparaît du formulaire
public mais conserve tout son historique — il n'est jamais supprimé physiquement.

## 5. Déploiement sur GitHub Pages

1. Créer un dépôt GitHub et y pousser l'ensemble du projet (à la racine du dépôt).
2. Dans **Settings > Pages** du dépôt, choisir la branche `main` et le dossier `/ (root)`.
3. GitHub publie le site à une adresse du type :
   ```
   https://votre-compte.github.io/nom-du-depot/
   ```
4. Le formulaire public est à la racine (`/`), l'espace administrateur à `/admin.html`
   (vous pouvez renommer en `/admin/index.html` si vous préférez une URL `/admin/`).

Aucun serveur Node.js n'est nécessaire : tout le frontend communique directement avec Supabase
via la clé publique `anon`.

## 6. Sécurité

- La clé `anon` est publique par conception ; c'est la Row Level Security qui protège les données.
- Le formulaire public peut **uniquement** créer une saisie (`insert` sur `prises_carburant`) ;
  il ne peut jamais lire, modifier ou supprimer une saisie, ni toucher aux véhicules ou aux sites.
- L'espace `/admin` exige une authentification Supabase (email + mot de passe) ; sans session valide,
  aucune donnée administrative n'est accessible (politiques RLS `to authenticated`).
- Anti-doublon : chaque soumission porte un identifiant unique généré côté client
  (`client_submission_id`), contraint `unique` en base, et le bouton d'envoi est désactivé
  pendant l'enregistrement.

## 7. Évolutions prévues (non implémentées en V1)

Le schéma prévoit déjà les colonnes nécessaires pour ajouter plus tard, sans migration lourde :
type de carburant, prix au litre, litres, fournisseur, numéro de bon, photo du bon, compteur horaire,
consommation moyenne, ainsi que la gestion de plusieurs administrateurs et d'un audit des modifications.
