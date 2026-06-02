import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase service-role : **bypasse la RLS**. SERVEUR UNIQUEMENT.
 * Réservé aux tâches sans utilisateur connecté (ex : cron daily-digest, US-8.3).
 * Ne JAMAIS importer côté client ni exposer la clé.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Variables Supabase admin manquantes (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
    );
  }
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
