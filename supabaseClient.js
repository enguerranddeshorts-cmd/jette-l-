import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    "[Jette là] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY manquants. " +
    "Copie .env.example en .env.local et renseigne tes vraies valeurs Supabase."
  );
}

export const supabase = createClient(url || "https://placeholder.supabase.co", anonKey || "placeholder");
