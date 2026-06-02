/** Types des tables (le client Supabase n'est pas généré via types DB). */

export type PostStatus = "to_publish" | "published";

/** Verdict qualité (mesure du % publié sans édition). */
export type PostVerdict = "as_is" | "edited" | "rejected";

export type Workspace = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
};

export type Communication = {
  id: string;
  name: string;
  event_date: string; // ISO date (yyyy-MM-dd)
  event_location: string | null;
  event_link: string | null;
  intervenants_text: string | null;
  workspace_id: string | null;
  created_at: string;
};

export type Post = {
  id: string;
  communication_id: string;
  scheduled_date: string; // ISO date (yyyy-MM-dd)
  content: string;
  so_what: string | null;
  status: PostStatus;
  verdict: PostVerdict | null;
  created_at: string;
};

/** Charte éditoriale versionnée (append-only ; la version la plus haute est active). */
export type CharterVersion = {
  id: string;
  workspace_id: string;
  content: string;
  version: number;
  created_at: string;
};
