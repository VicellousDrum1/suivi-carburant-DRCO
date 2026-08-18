// ============================================================
// CONFIGURATION SUPABASE
// Renseigner ces deux valeurs avec celles de votre projet Supabase
// (Project Settings > API). Utiliser UNIQUEMENT la clé "anon public".
// Ne jamais mettre la clé "service_role" ici.
// ============================================================
const SUPABASE_URL = "https://VOTRE-PROJET.supabase.co";
const SUPABASE_ANON_KEY = "VOTRE_CLE_ANON_PUBLIQUE";

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const TIMEZONE = "Africa/Abidjan";
