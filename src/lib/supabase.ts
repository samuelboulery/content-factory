import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variables Supabase manquantes : renseigne NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY dans .env.local.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Statut d'un post. L'archi data prévoit la régénération future (US-5.2). */
export type PostStatus = 'to_publish' | 'published';

export type Communication = {
  id: string;
  name: string;
  event_date: string; // ISO date (yyyy-MM-dd)
  event_location: string | null;
  event_link: string | null;
  intervenants_text: string | null;
  created_at: string;
};

export type Post = {
  id: string;
  communication_id: string;
  scheduled_date: string; // ISO date (yyyy-MM-dd)
  content: string;
  so_what: string | null;
  status: PostStatus;
  created_at: string;
};
