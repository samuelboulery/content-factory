import { createAdminClient } from "@/lib/supabase/admin";

/** Un post à publier aujourd'hui, pour le digest d'un workspace. */
export interface DigestPost {
  communicationId: string;
  communicationName: string;
  scheduledDate: string; // yyyy-MM-dd
}

/** Le digest quotidien d'un workspace (destinataires + posts du jour). */
export interface WorkspaceDigest {
  workspaceId: string;
  workspaceName: string;
  recipients: string[];
  posts: DigestPost[];
}

type PostRow = {
  scheduled_date: string;
  communication_id: string;
};
type CommRow = { id: string; name: string; workspace_id: string };
type WorkspaceRow = {
  id: string;
  name: string;
  owner_id: string;
  notification_emails: string[] | null;
};

/**
 * Collecte les posts encore « à publier » dont la date tombe `today`, groupés
 * par workspace (US-8.3). Destinataires = `notification_emails` du workspace ;
 * fallback sur l'email du propriétaire si la liste est vide.
 * Requêtes explicites (typage clair, sans `any`). Service-role : indispensable
 * car le cron n'a pas d'utilisateur connecté.
 */
export async function collectDailyDigests(
  today: string,
): Promise<WorkspaceDigest[]> {
  const admin = createAdminClient();

  const { data: postsData, error: postsError } = await admin
    .from("posts")
    .select("scheduled_date, communication_id")
    .eq("status", "to_publish")
    .eq("scheduled_date", today);
  if (postsError) {
    throw new Error(`Lecture des posts du jour échouée : ${postsError.message}`);
  }
  const posts = (postsData ?? []) as PostRow[];
  if (posts.length === 0) return [];

  const commIds = [...new Set(posts.map((p) => p.communication_id))];
  const { data: commsData, error: commsError } = await admin
    .from("communications")
    .select("id, name, workspace_id")
    .in("id", commIds);
  if (commsError) {
    throw new Error(`Lecture des communications échouée : ${commsError.message}`);
  }
  const comms = (commsData ?? []) as CommRow[];
  const commById = new Map(comms.map((c) => [c.id, c]));

  const wsIds = [...new Set(comms.map((c) => c.workspace_id))];
  const { data: wsData, error: wsError } = await admin
    .from("workspaces")
    .select("id, name, owner_id, notification_emails")
    .in("id", wsIds);
  if (wsError) {
    throw new Error(`Lecture des workspaces échouée : ${wsError.message}`);
  }
  const wsById = new Map(
    ((wsData ?? []) as WorkspaceRow[]).map((w) => [w.id, w]),
  );

  // Groupe les posts par workspace.
  const postsByWs = new Map<string, DigestPost[]>();
  for (const post of posts) {
    const comm = commById.get(post.communication_id);
    if (!comm) continue;
    const list = postsByWs.get(comm.workspace_id) ?? [];
    list.push({
      communicationId: comm.id,
      communicationName: comm.name,
      scheduledDate: post.scheduled_date,
    });
    postsByWs.set(comm.workspace_id, list);
  }

  // Résout les destinataires de chaque workspace (config ou fallback owner).
  const digests: WorkspaceDigest[] = [];
  for (const [wsId, wsPosts] of postsByWs) {
    const ws = wsById.get(wsId);
    if (!ws) continue;

    let recipients = (ws.notification_emails ?? []).filter(Boolean);
    if (recipients.length === 0) {
      const { data: userData } = await admin.auth.admin.getUserById(
        ws.owner_id,
      );
      const ownerEmail = userData?.user?.email;
      if (ownerEmail) recipients = [ownerEmail];
    }
    if (recipients.length === 0) continue; // personne à notifier

    digests.push({
      workspaceId: wsId,
      workspaceName: ws.name,
      recipients,
      posts: wsPosts,
    });
  }
  return digests;
}
