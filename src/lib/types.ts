/** Types des tables (le client Supabase n'est pas généré via types DB). */

export type PostStatus = "to_publish" | "published";

export type Workspace = {
  id: string;
  name: string;
  owner_id: string;
  context: string | null;
  networks: string[];
  notification_emails: string[]; // destinataires du digest quotidien (US-8.3)
  network_charters: Record<string, string>; // overlay de charte par réseau (US-2.5)
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
  network: string; // legacy : 1ʳᵉ plateforme (compat) ; voir `networks`
  networks: string[]; // plateformes ciblées par la campagne (multi-plateforme)
  suggested_questions: string[]; // questions IA pour les intervenants (US-6.3)
  share_token: string;
  facts_updated_at: string;
  created_at: string;
};

/** Un template de communication (jeu d'étapes nommé, US-3.4). */
export type Template = {
  id: string;
  workspace_id: string;
  name: string;
  created_at: string;
};

/** Une étape du rétroplanning (offset + intention + niveau d'info attendu). */
export type EventStep = {
  offset_days: number;
  intention: string;
  info_required: string | null;
};

export type IntervenantSubmission = {
  id: string;
  communication_id: string;
  name: string;
  role: string | null;
  bio: string | null;
  message: string | null;
  subject: string | null; // sujet d'intervention (US form interne #2)
  link: string | null; // lien LinkedIn / site
  created_at: string;
};

/** Snapshot d'un post avant une régénération (US-5.10, borné à 3, plus récent en tête). */
export type PostRevision = {
  content: string;
  so_what: string | null;
  regenerated_at: string; // ISO
  note: string | null;
};

/** Verdict du relecteur IA sémantique (US-5.5, flag seul, ne réécrit pas). */
export type PostReview = {
  conforme: boolean;
  remarks: string[];
};

export type Post = {
  id: string;
  communication_id: string;
  scheduled_date: string; // ISO date (yyyy-MM-dd)
  content: string;
  so_what: string | null;
  status: PostStatus;
  edited: boolean;
  published_at: string | null;
  previous_versions: PostRevision[];
  ai_review: PostReview | null;
  original_content: string | null; // brouillon IA figé (diff vs édition humaine, boucle d'apprentissage)
  network: string; // plateforme du post (multi-plateforme)
  created_at: string;
};

/** Dernière analyse d'apprentissage de la charte (corpus de diffs IA→humain). */
export type CharterLearning = {
  id: string;
  workspace_id: string;
  observations: string[];
  addendum: string | null;
  sample_size: number;
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
