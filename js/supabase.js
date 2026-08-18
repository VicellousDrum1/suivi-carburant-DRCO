// ============================================================
// CONFIGURATION SUPABASE
// Renseigner ces deux valeurs avec celles de votre projet Supabase
// (Project Settings > API). Utiliser UNIQUEMENT la clé "anon public".
// Ne jamais mettre la clé "service_role" ici.
// ============================================================
const SUPABASE_URL = "https://vicellousdrum1.github.io";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhZHR5ZG95bWFydHVmZ2J0aWV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5OTg2NTAsImV4cCI6MjEwMjU3NDY1MH0.yA_uHsEEqyWnhspYzNeKKEpvGQNIzQMGySPgqATUgbg";

export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const TIMEZONE = "Africa/Abidjan";
