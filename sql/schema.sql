-- ============================================================
-- SUIVI CARBURANT — Schéma Supabase (PostgreSQL)
-- À exécuter dans l'éditeur SQL de Supabase, dans cet ordre.
-- ============================================================

-- Extension nécessaire pour les UUID
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- TABLE : sites
-- ------------------------------------------------------------
create table if not exists sites (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null unique,
  code        text unique,
  actif       boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------
-- TABLE : vehicules
-- ------------------------------------------------------------
create table if not exists vehicules (
  id               uuid primary key default gen_random_uuid(),
  immatriculation  text not null unique,
  site_id          uuid not null references sites(id) on delete restrict,
  description      text,
  actif            boolean not null default true,
  dernier_index    integer not null default 0 check (dernier_index >= 0),

  -- Colonnes prévues pour les évolutions futures (section 32 du cahier des charges)
  type_carburant       text check (type_carburant in ('Gasoil', 'Essence')),
  compteur_horaire     numeric,
  consommation_moyenne numeric,

  created_at       timestamptz not null default now()
);

create index if not exists idx_vehicules_site_id on vehicules(site_id);
create index if not exists idx_vehicules_actif on vehicules(actif);

-- ------------------------------------------------------------
-- TABLE : prises_carburant
-- ------------------------------------------------------------
create table if not exists prises_carburant (
  id                  uuid primary key default gen_random_uuid(),
  site_id             uuid not null references sites(id) on delete restrict,
  vehicule_id         uuid not null references vehicules(id) on delete restrict,

  nom                 text not null check (char_length(trim(nom)) > 0),
  prenom              text not null check (char_length(trim(prenom)) > 0),

  index_km            integer not null check (index_km >= 0),
  index_km_precedent  integer not null default 0 check (index_km_precedent >= 0),
  km_parcouru         integer generated always as (index_km - index_km_precedent) stored,

  montant_pris        numeric not null check (montant_pris >= 0),
  montant_restant      numeric not null default 0 check (montant_restant >= 0),

  date_prise          timestamptz not null default (now() at time zone 'Africa/Abidjan'),
  created_at          timestamptz not null default now(),

  -- Anti-doublon : identifiant unique généré côté client pour chaque soumission
  client_submission_id uuid not null unique,

  -- Colonnes prévues pour les évolutions futures
  type_carburant      text check (type_carburant in ('Gasoil', 'Essence')),
  prix_litre          numeric,
  litres               numeric,
  fournisseur          text,
  numero_bon           text,
  photo_bon_url         text
);

create index if not exists idx_prises_site_id on prises_carburant(site_id);
create index if not exists idx_prises_vehicule_id on prises_carburant(vehicule_id);
create index if not exists idx_prises_date on prises_carburant(date_prise desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table sites enable row level security;
alter table vehicules enable row level security;
alter table prises_carburant enable row level security;

-- ---------------- SITES ----------------
-- Le formulaire public ne voit que les sites actifs
create policy "sites_select_public_actifs"
  on sites for select
  to anon
  using (actif = true);

-- L'admin (utilisateur authentifié) voit tout et gère tout
create policy "sites_select_admin"
  on sites for select
  to authenticated
  using (true);

create policy "sites_insert_admin"
  on sites for insert
  to authenticated
  with check (true);

create policy "sites_update_admin"
  on sites for update
  to authenticated
  using (true)
  with check (true);

create policy "sites_delete_admin"
  on sites for delete
  to authenticated
  using (true);

-- ---------------- VEHICULES ----------------
-- Le formulaire public ne voit que les véhicules actifs
create policy "vehicules_select_public_actifs"
  on vehicules for select
  to anon
  using (actif = true);

create policy "vehicules_select_admin"
  on vehicules for select
  to authenticated
  using (true);

create policy "vehicules_insert_admin"
  on vehicules for insert
  to authenticated
  with check (true);

create policy "vehicules_update_admin"
  on vehicules for update
  to authenticated
  using (true)
  with check (true);

create policy "vehicules_delete_admin"
  on vehicules for delete
  to authenticated
  using (true);

-- ---------------- PRISES_CARBURANT ----------------
-- Le formulaire public peut UNIQUEMENT créer une saisie valide.
-- Il ne peut jamais lire, modifier ou supprimer une saisie.
create policy "prises_insert_public"
  on prises_carburant for insert
  to anon
  with check (
    montant_pris >= 0
    and montant_restant >= 0
    and index_km >= 0
    and site_id is not null
    and vehicule_id is not null
    and trim(nom) <> ''
    and trim(prenom) <> ''
  );

-- L'admin voit tout, met à jour, supprime (rarement utilisé, jamais exposé côté public)
create policy "prises_select_admin"
  on prises_carburant for select
  to authenticated
  using (true);

create policy "prises_insert_admin"
  on prises_carburant for insert
  to authenticated
  with check (true);

create policy "prises_update_admin"
  on prises_carburant for update
  to authenticated
  using (true)
  with check (true);

create policy "prises_delete_admin"
  on prises_carburant for delete
  to authenticated
  using (true);

-- ============================================================
-- FONCTION + TRIGGER : mise à jour automatique du dernier index
-- ============================================================
create or replace function fn_apply_prise_carburant()
returns trigger
language plpgsql
security definer
as $$
begin
  -- Récupère le dernier index connu du véhicule au moment de l'insertion
  select coalesce(dernier_index, 0) into new.index_km_precedent
  from vehicules where id = new.vehicule_id;

  return new;
end;
$$;

drop trigger if exists trg_before_insert_prise on prises_carburant;
create trigger trg_before_insert_prise
  before insert on prises_carburant
  for each row
  execute function fn_apply_prise_carburant();

create or replace function fn_update_vehicule_index()
returns trigger
language plpgsql
security definer
as $$
begin
  update vehicules
  set dernier_index = new.index_km
  where id = new.vehicule_id and dernier_index < new.index_km;

  return new;
end;
$$;

drop trigger if exists trg_after_insert_prise on prises_carburant;
create trigger trg_after_insert_prise
  after insert on prises_carburant
  for each row
  execute function fn_update_vehicule_index();

-- ============================================================
-- DONNÉES DE DÉMARRAGE (exemple — à adapter/supprimer)
-- ============================================================
insert into sites (nom, code) values
  ('Exploitation Bonoua', 'BNA'),
  ('Exploitation Abidjan', 'ABJ'),
  ('Exploitation Anyama', 'ANY'),
  ('Exploitation Daloa', 'DLA')
on conflict (nom) do nothing;
